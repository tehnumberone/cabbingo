import { Board, Progress, SideProgress, Team, emptyProgress, sideDone, validateBoard } from '../../src/app/models/bingo';

interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
}

type StoredTeam = Omit<Team, 'captains'> & { captainIds: number[] };
type StoredBoard = Omit<Board, 'id' | 'ownerId' | 'teams'> & { teams: StoredTeam[] };
type BoardRow = { id: number; owner_id: number; end_date: number; config: StoredBoard };
type Session = { user_id: number; username: string; is_admin: number };

const DAY = 86_400_000;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']; // no svg: it can carry scripts
const MAX_IMAGE = 1024 * 1024; // D1 caps a row at 2MB
const MAX_BODY = 512 * 1024;
const MAX_ATTEMPTS = 10; // login or register attempts per IP
const ATTEMPT_WINDOW = 60_000;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin') ?? '';
    const cors: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      Vary: 'Origin',
    };
    if (env.ALLOWED_ORIGINS.split(',').includes(origin)) cors['Access-Control-Allow-Origin'] = origin;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    let res: Response;
    try {
      res = await route(req, env);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      res = e instanceof HttpError
        ? Response.json({ error: e.message }, { status: e.status })
        : Response.json({ error: 'Server error' }, { status: 500 });
    }
    res = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;
  let g: RegExpMatchArray | null;

  // TempleOSRS proxy (browser CORS workaround)
  if (p.startsWith('/templeosrs/') && m === 'GET') {
    const r = await fetch('https://templeosrs.com' + p.slice('/templeosrs'.length) + url.search);
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' } });
  }

  if ((g = p.match(/^\/img\/([\w-]+)$/)) && m === 'GET') {
    const img = await env.DB.prepare('SELECT type, data FROM images WHERE id = ?').bind(g[1]).first<{ type: string; data: number[] }>();
    if (!img) throw new HttpError(404, 'Not found');
    return new Response(new Uint8Array(img.data), {
      headers: {
        'Content-Type': img.type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if ((p === '/auth/register' || p === '/auth/login') && m === 'POST') await throttle(env, req);

  if (p === '/auth/register' && m === 'POST') {
    const { username, password } = await body(req);
    if (typeof username !== 'string' || !/^[\w -]{3,20}$/.test(username))
      throw new HttpError(400, 'Username must be 3-20 letters, numbers, spaces, - or _');
    if (typeof password !== 'string' || password.length < 8 || password.length > 200)
      throw new HttpError(400, 'Password must be at least 8 characters');
    let user: { id: number; username: string; is_admin: number } | null;
    try {
      user = await env.DB.prepare('INSERT INTO users (username, pw_hash) VALUES (?, ?) RETURNING id, username, is_admin')
        .bind(username.trim(), await hashPassword(password))
        .first();
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw new HttpError(409, 'Username is taken');
      throw e;
    }
    return Response.json({ token: await newSession(env, user!.id), user: toUser(user!) });
  }

  if (p === '/auth/login' && m === 'POST') {
    const { username, password } = await body(req);
    const user = await env.DB.prepare('SELECT id, username, is_admin, pw_hash FROM users WHERE username = ?')
      .bind(String(username).trim())
      .first<{ id: number; username: string; is_admin: number; pw_hash: string }>();
      if (!user || !(await verifyPassword(String(password), user.pw_hash))) throw new HttpError(401, 'Invalid username or password');
    return Response.json({ token: await newSession(env, user.id), user: toUser(user) });
  }

  if (p === '/auth/logout' && m === 'POST') {
    const token = bearer(req);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return Response.json({ ok: true });
  }

  if (p === '/auth/me' && m === 'GET') {
    const s = await session(req, env);
    return Response.json({ user: s ? { id: s.user_id, username: s.username, isAdmin: !!s.is_admin } : null });
  }

  if (p === '/upload' && m === 'POST') {
    const s = await requireUser(req, env);
    const type = req.headers.get('Content-Type') ?? '';
    if (!IMAGE_TYPES.includes(type)) throw new HttpError(415, 'Only png, jpeg, gif or webp images');
    if (Number(req.headers.get('Content-Length')) > MAX_IMAGE) throw new HttpError(413, 'Image must be under 1MB');
    const data = await req.arrayBuffer();
    if (data.byteLength > MAX_IMAGE) throw new HttpError(413, 'Image must be under 1MB');
    const key = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO images (id, owner_id, type, data, created) VALUES (?, ?, ?, ?, ?)')
      .bind(key, s.user_id, type, data, Date.now())
      .run();
    return Response.json({ url: `${url.origin}/img/${key}` });
  }

  // Shared image library: logged-in users pick from it ("Use existing"), admins also delete from it.
  if (p === '/images' && m === 'GET') {
    await requireUser(req, env);
    // ponytail: returns every image in one response; paginate if the library grows past a few hundred
    const [images, boards] = await env.DB.batch([
      env.DB.prepare(
        `SELECT i.id, i.type, length(i.data) AS size, i.created, u.username AS owner
         FROM images i JOIN users u ON u.id = i.owner_id
         ORDER BY i.created DESC`
      ),
      env.DB.prepare(`SELECT id, json_extract(config, '$.title') AS title, config FROM boards`),
    ]);
    const usedIn = new Map<string, { id: number; title: string }[]>();
    for (const b of boards.results as { id: number; title: string; config: string }[]) {
      for (const key of new Set([...b.config.matchAll(/\/img\/([\w-]+)/g)].map((x) => x[1]))) {
        usedIn.set(key, [...(usedIn.get(key) ?? []), { id: b.id, title: b.title }]);
      }
    }
    return Response.json(
      (images.results as { id: string; type: string; size: number; created: number | null; owner: string }[]).map((i) => ({
        ...i,
        url: `${url.origin}/img/${i.id}`,
        usedIn: usedIn.get(i.id) ?? [],
      }))
    );
  }

  if ((g = p.match(/^\/images\/([\w-]+)$/)) && m === 'DELETE') {
    const s = await requireUser(req, env);
    if (!s.is_admin) throw new HttpError(403, 'Only admins can delete images');
    const { meta } = await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(g[1]).run();
    if (!meta.changes) throw new HttpError(404, 'Image not found');
    return Response.json({ ok: true });
  }

  if (p === '/boards' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT b.id, b.end_date, u.username AS owner,
              json_extract(b.config, '$.title') AS title,
              json_extract(b.config, '$.description') AS description,
              json_extract(b.config, '$.startDate') AS startDate
       FROM boards b JOIN users u ON u.id = b.owner_id
       ORDER BY b.end_date DESC`
    ).all<{ id: number; end_date: number; owner: string; title: string; description: string; startDate: string }>();
    return Response.json(
      results.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? '',
        owner: r.owner,
        startDate: r.startDate,
        endDate: new Date(r.end_date).toISOString(),
        archived: r.end_date < Date.now(),
      }))
    );
  }

  if (p === '/boards' && m === 'POST') {
    const s = await requireUser(req, env);
    const board = await cleanBoard(env, await body(req));
    const row = await env.DB.prepare('INSERT INTO boards (owner_id, end_date, config) VALUES (?, ?, ?) RETURNING id')
      .bind(s.user_id, Date.parse(board.endDate), JSON.stringify(board))
      .first<{ id: number }>();
    return Response.json({ id: row!.id });
  }

  if ((g = p.match(/^\/boards\/(\d+)$/))) {
    const row = await getBoard(env, Number(g[1]));
    if (m === 'GET') {
      const { results } = await env.DB.prepare('SELECT team_id, tile_id, data FROM progress WHERE board_id = ?')
        .bind(row.id)
        .all<{ team_id: string; tile_id: string; data: string }>();
      const progress: Record<string, Record<string, Progress>> = {};
      for (const r of results) (progress[r.team_id] ??= {})[r.tile_id] = JSON.parse(r.data);
      const { teams, ...config } = row.config;
      const ids = [...new Set(teams.flatMap((t) => t.captainIds))];
      const names = new Map<number, string>();
      if (ids.length) {
        const users = await env.DB.prepare(`SELECT id, username FROM users WHERE id IN (${ids.map(() => '?').join(',')})`)
          .bind(...ids)
          .all<{ id: number; username: string }>();
        for (const u of users.results) names.set(u.id, u.username);
      }
      return Response.json({
        board: {
          ...config,
          id: row.id,
          ownerId: row.owner_id,
          teams: teams.map(({ captainIds, ...t }) => ({ ...t, captains: captainIds.flatMap((id) => names.get(id) ?? []) })),
        },
        progress,
      });
    }
    const s = await requireUser(req, env);
    if (s.user_id !== row.owner_id && !s.is_admin) throw new HttpError(403, 'Not your board');
    if (m === 'PUT') {
      if (row.end_date < Date.now() && !s.is_admin) throw new HttpError(403, 'This bingo has ended');
      const board = await cleanBoard(env, await body(req));
      await env.DB.prepare('UPDATE boards SET end_date = ?, config = ? WHERE id = ?')
        .bind(Date.parse(board.endDate), JSON.stringify(board), row.id)
        .run();
      return Response.json({ ok: true });
    }
    if (m === 'DELETE') {
      const { title } = await body(req);
      if (title !== row.config.title) throw new HttpError(400, 'Type the exact bingo title to delete it');
      await env.DB.batch([
        env.DB.prepare('DELETE FROM progress WHERE board_id = ?').bind(row.id),
        env.DB.prepare('DELETE FROM boards WHERE id = ?').bind(row.id),
      ]);
      return Response.json({ ok: true });
    }
  }

  if ((g = p.match(/^\/boards\/(\d+)\/teams\/([^/]+)\/tiles\/([^/]+)$/)) && m === 'PUT') {
    const row = await getBoard(env, Number(g[1]));
    const teamId = decodeURIComponent(g[2]);
    const tileId = decodeURIComponent(g[3]);
    const s = await requireUser(req, env);
    const team = row.config.teams.find((t) => t.id === teamId);
    const tile = row.config.tiles.find((t) => t.id === tileId);
    if (!tile || !team) throw new HttpError(404, 'Not found');
    const isOwner = s.user_id === row.owner_id || !!s.is_admin;
    if (!isOwner && !team.captainIds.includes(s.user_id)) throw new HttpError(403, "Only this team's captains can update its progress");
    if (row.end_date < Date.now() && !s.is_admin) throw new HttpError(403, 'This bingo has ended');

    const next = parseProgress(await body(req));
    const prevRow = await env.DB.prepare('SELECT data FROM progress WHERE board_id = ? AND team_id = ? AND tile_id = ?')
      .bind(row.id, teamId, tileId)
      .first<{ data: string }>();
    const prev: Progress = prevRow ? JSON.parse(prevRow.data) : emptyProgress();
    if (next.flipped && (!row.config.flipEnabled || !tile.flip)) throw new HttpError(400, 'This tile cannot be flipped');
    if (next.flipped && !sideDone(tile, next.front)) throw new HttpError(400, 'Complete the tile before flipping it');
    if (prev.flipped && !next.flipped && !isOwner) throw new HttpError(400, 'A flipped tile cannot be unflipped');

    await env.DB.prepare(
      `INSERT INTO progress (board_id, team_id, tile_id, data) VALUES (?, ?, ?, ?)
       ON CONFLICT (board_id, team_id, tile_id) DO UPDATE SET data = excluded.data`
    )
      .bind(row.id, teamId, tileId, JSON.stringify(next))
      .run();
    return Response.json({ ok: true });
  }

  throw new HttpError(404, 'Not found');
}

// Counts login/register attempts per IP. Cloudflare's rate limit binding is a no-op on this plan, so this uses D1.
async function throttle(env: Env, req: Request) {
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO attempts (ip, count, reset) VALUES (?1, 1, ?2 + ${ATTEMPT_WINDOW})
     ON CONFLICT (ip) DO UPDATE SET
       count = CASE WHEN reset < ?2 THEN 1 ELSE count + 1 END,
       reset = CASE WHEN reset < ?2 THEN ?2 + ${ATTEMPT_WINDOW} ELSE reset END
     RETURNING count`
  )
    .bind(ip, now)
    .first<{ count: number }>();
  if ((row?.count ?? 0) > MAX_ATTEMPTS) throw new HttpError(429, 'Too many attempts, please wait a minute');
}

async function body(req: Request): Promise<any> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Request too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

async function getBoard(env: Env, id: number): Promise<BoardRow> {
  const row = await env.DB.prepare('SELECT id, owner_id, end_date, config FROM boards WHERE id = ?')
    .bind(id)
    .first<{ id: number; owner_id: number; end_date: number; config: string }>();
  if (!row) throw new HttpError(404, 'Board not found');
  return { ...row, config: JSON.parse(row.config) };
}

// Whitelists fields and turns captain usernames into user ids.
async function cleanBoard(env: Env, input: any): Promise<StoredBoard> {
  const err = validateBoard(input);
  if (err) throw new HttpError(400, err);
  const b = input as Board;
  const key = (name: string) => name.trim().toLowerCase();
  const wanted = [...new Set(b.teams.flatMap((t) => t.captains.map(key)))];
  if (wanted.length > 50) throw new HttpError(400, 'A board can have at most 50 captains'); // D1 binds max 100 params
  const found = new Map<string, number>();
  if (wanted.length) {
    const users = await env.DB.prepare(`SELECT id, username FROM users WHERE username IN (${wanted.map(() => '?').join(',')})`)
      .bind(...wanted)
      .all<{ id: number; username: string }>();
    for (const u of users.results) found.set(key(u.username), u.id);
  }
  const missing = wanted.filter((w) => !found.has(w));
  if (missing.length) throw new HttpError(400, `No account found for captain: ${missing.join(', ')}`);
  return {
    title: b.title.trim(),
    description: String(b.description ?? ''),
    rules: Array.isArray(b.rules) ? b.rules.map(String) : [],
    size: b.size,
    startDate: new Date(b.startDate).toISOString(),
    endDate: new Date(b.endDate).toISOString(),
    templeosCompetitionId: b.templeosCompetitionId ? String(b.templeosCompetitionId) : undefined,
    rowBonus: Number(b.rowBonus) || 0,
    columnBonus: Number(b.columnBonus) || 0,
    flipEnabled: !!b.flipEnabled,
    flipMode: b.flipMode,
    tiles: b.tiles,
    donations: Array.isArray(b.donations) ? b.donations.map((d) => ({ name: String(d?.name), amount: Number(d?.amount) || 0 })) : undefined,
    buyIn: b.buyIn === undefined ? undefined : Number(b.buyIn) || 0,
    teams: b.teams.map((t) => ({
      id: t.id,
      name: String(t.name),
      players: Array.isArray(t.players) ? t.players.map(String) : [],
      captainIds: [...new Set(t.captains.map((c) => found.get(key(c))!))],
    })),
  };
}

function parseProgress(x: any): Progress {
  const side = (s: any): SideProgress => ({
    obtained: Array.isArray(s?.obtained)
      ? s.obtained.slice(0, 200).map((o: any) => ({ name: String(o?.name ?? ''), obtained: Math.max(0, Number(o?.obtained) || 0) }))
      : [],
    completed: !!s?.completed,
  });
  return { front: side(x?.front), flipped: !!x?.flipped, flip: x?.flip ? side(x.flip) : undefined };
}

const toUser = (u: { id: number; username: string; is_admin: number }) => ({ id: u.id, username: u.username, isAdmin: !!u.is_admin });

const bearer = (req: Request) => req.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];

function session(req: Request, env: Env): Promise<Session | null> {
  const token = bearer(req);
  if (!token) return Promise.resolve(null);
  return env.DB.prepare(
    `SELECT s.user_id, u.username, u.is_admin
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires > ?`
  )
    .bind(token, Date.now())
    .first<Session>();
}

async function requireUser(req: Request, env: Env): Promise<Session> {
  const s = await session(req, env);
  if (!s) throw new HttpError(401, 'Log in first');
  return s;
}

async function newSession(env: Env, userId: number): Promise<string> {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, '');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()),
    env.DB.prepare('DELETE FROM attempts WHERE reset < ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)').bind(token, userId, Date.now() + 30 * DAY),
  ]);
  return token;
}

// PBKDF2-SHA256 stored as "iterations:salt:hash" (base64).
// ponytail: 10k iterations fits Workers Free's 10ms CPU cap (100k takes ~30ms); raise PBKDF2_ITERATIONS on the paid plan,
// old hashes keep verifying because each stores its own count.
const PBKDF2_ITERATIONS = 10_000;
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${PBKDF2_ITERATIONS}:${b64(salt)}:${b64(await pbkdf2(password, salt, PBKDF2_ITERATIONS))}`;
}

async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  if (!stored) return false;
  const [iterations, salt, hash] = stored.split(':');
  const actual = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iterations)));
  const expected = unb64(hash);
  return actual.length === expected.length && crypto.subtle.timingSafeEqual(actual, expected);
}
