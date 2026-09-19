import { Board, Progress, SideProgress, Team, TileSide, emptyProgress, sideDone, validateBoard } from '../../src/app/models/bingo';

interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  APP_URL: string;
  SENDER_EMAIL: string;
  SENDER_NAME: string;
  BREVO_API_KEY?: string; // wrangler secret put BREVO_API_KEY
}

type StoredTeam = Omit<Team, 'captains'> & { captainIds: number[] };
type StoredBoard = Omit<Board, 'id' | 'ownerId' | 'teams'> & { teams: StoredTeam[] };
type BoardRow = { id: number; owner_id: number; end_date: number; config: StoredBoard };
type Session = { user_id: number; username: string; is_admin: number };
type UserRow = { id: number; username: string; email: string | null; is_admin: number };

const DAY = 86_400_000;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']; // no svg: it can carry scripts
const MAX_IMAGE = 1024 * 1024; // D1 caps a row at 2MB
const MAX_BODY = 512 * 1024;
const RESET_WINDOW = 15 * 60_000; // password reset links live this long
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RSN = /^[\w -]{1,12}$/; // RuneScape names: up to 12 letters, digits, spaces, - or _
const MAX_RSNS = 10;
const MAX_ATTEMPTS = 10; // failed login or register attempts per IP before the cooldown
const ATTEMPT_COOLDOWN = 15 * 60_000;

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

  let attemptIp = '';
  if (['/auth/register', '/auth/login', '/auth/forgot', '/auth/reset'].includes(p) && m === 'POST') attemptIp = await throttle(env, req);

  if (p === '/auth/register' && m === 'POST') {
    const { username, email, password } = await body(req);
    if (typeof username !== 'string' || !/^[\w -]{3,20}$/.test(username))
      throw new HttpError(400, 'Username must be 3-20 letters, numbers, spaces, - or _');
    if (typeof email !== 'string' || !EMAIL.test(email.trim())) throw new HttpError(400, 'A valid email address is required');
    if (typeof password !== 'string' || password.length < 8 || password.length > 200)
      throw new HttpError(400, 'Password must be at least 8 characters');
    let user: UserRow | null;
    try {
      user = await env.DB.prepare('INSERT INTO users (username, email, pw_hash) VALUES (?, ?, ?) RETURNING id, username, email, is_admin')
        .bind(username.trim(), email.trim(), await hashPassword(password))
        .first();
    } catch (e) {
      const message = String(e);
      if (message.includes('users_email')) throw new HttpError(409, 'That email address already has an account');
      if (message.includes('UNIQUE')) throw new HttpError(409, 'Username is taken');
      throw e;
    }
    await clearAttempts(env, attemptIp);
    return Response.json({ token: await newSession(env, user!.id), user: toUser(user!) });
  }

  if (p === '/auth/login' && m === 'POST') {
    const { username, password } = await body(req);
    const user = await env.DB.prepare('SELECT id, username, email, is_admin, pw_hash FROM users WHERE username = ?')
      .bind(String(username).trim())
      .first<UserRow & { pw_hash: string }>();
      if (!user || !(await verifyPassword(String(password), user.pw_hash))) throw new HttpError(401, 'Invalid username or password');
    await clearAttempts(env, attemptIp);
    return Response.json({ token: await newSession(env, user.id), user: toUser(user) });
  }

  if (p === '/auth/logout' && m === 'POST') {
    const token = bearer(req);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return Response.json({ ok: true });
  }

  if (p === '/auth/me' && m === 'GET') {
    const s = await session(req, env);
    if (!s) return Response.json({ user: null });
    const [user, rsns] = await env.DB.batch([
      env.DB.prepare('SELECT id, username, email, is_admin FROM users WHERE id = ?').bind(s.user_id),
      env.DB.prepare('SELECT id, name FROM rsns WHERE user_id = ? ORDER BY name').bind(s.user_id),
    ]);
    return Response.json({ user: { ...toUser(user.results[0] as UserRow), rsns: rsns.results } });
  }

  if (p === '/account/email' && m === 'PUT') {
    const s = await requireUser(req, env);
    const { email } = await body(req);
    if (typeof email !== 'string' || !EMAIL.test(email.trim())) throw new HttpError(400, 'A valid email address is required');
    try {
      await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email.trim(), s.user_id).run();
    } catch (e) {
      if (String(e).includes('users_email')) throw new HttpError(409, 'That email address already has an account');
      throw e;
    }
    return Response.json({ ok: true });
  }

  // RuneScape names: one account owns a name, and it can be renamed or removed
  if (p === '/account/rsns' && m === 'POST') {
    const s = await requireUser(req, env);
    const name = String((await body(req)).name ?? '').trim();
    if (!RSN.test(name)) throw new HttpError(400, 'A RuneScape name is up to 12 letters, numbers, spaces, - or _');
    const { count } = (await env.DB.prepare('SELECT count(*) AS count FROM rsns WHERE user_id = ?').bind(s.user_id).first<{ count: number }>())!;
    if (count >= MAX_RSNS) throw new HttpError(400, `You can add at most ${MAX_RSNS} RuneScape names`);
    try {
      const rsn = await env.DB.prepare('INSERT INTO rsns (user_id, name) VALUES (?, ?) RETURNING id, name').bind(s.user_id, name).first();
      return Response.json(rsn);
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw new HttpError(409, 'That RuneScape name is already on an account');
      throw e;
    }
  }

  if ((g = p.match(/^\/account\/rsns\/(\d+)$/))) {
    const s = await requireUser(req, env);
    const id = Number(g[1]);
    // admins can remove a name someone claimed that is not theirs
    const owned = await env.DB.prepare(`SELECT id FROM rsns WHERE id = ?${s.is_admin ? '' : ' AND user_id = ?'}`)
      .bind(...(s.is_admin ? [id] : [id, s.user_id]))
      .first();
    if (!owned) throw new HttpError(404, 'Not found');
    if (m === 'PUT') {
      const name = String((await body(req)).name ?? '').trim();
      if (!RSN.test(name)) throw new HttpError(400, 'A RuneScape name is up to 12 letters, numbers, spaces, - or _');
      try {
        await env.DB.prepare('UPDATE rsns SET name = ? WHERE id = ?').bind(name, id).run();
      } catch (e) {
        if (String(e).includes('UNIQUE')) throw new HttpError(409, 'That RuneScape name is already on an account');
        throw e;
      }
      return Response.json({ id, name });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM rsns WHERE id = ?').bind(id).run();
      return Response.json({ ok: true });
    }
  }

  // Suggestions for the player list, and the owner of each name so captains can be resolved
  if (p === '/rsns' && m === 'GET') {
    await requireUser(req, env);
    const { results } = await env.DB.prepare(
      'SELECT r.name, u.username FROM rsns r JOIN users u ON u.id = r.user_id ORDER BY r.name'
    ).all();
    return Response.json(results);
  }

  // Admin: who is registered, and who may edit every board
  if (p === '/admin/users' && m === 'GET') {
    const s = await requireUser(req, env);
    if (!s.is_admin) throw new HttpError(403, 'Admins only');
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.email, u.is_admin AS isAdmin,
              (SELECT count(*) FROM rsns r WHERE r.user_id = u.id) AS rsns,
              (SELECT count(*) FROM boards b WHERE b.owner_id = u.id) AS boards
       FROM users u ORDER BY u.username`
    ).all();
    return Response.json(results);
  }

  if ((g = p.match(/^\/admin\/users\/(\d+)\/admin$/)) && m === 'PUT') {
    const s = await requireUser(req, env);
    if (!s.is_admin) throw new HttpError(403, 'Admins only');
    const id = Number(g[1]);
    if (id === s.user_id) throw new HttpError(400, 'You cannot change your own admin rights');
    const { isAdmin } = await body(req);
    const { meta } = await env.DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(isAdmin ? 1 : 0, id).run();
    if (!meta.changes) throw new HttpError(404, 'Account not found');
    return Response.json({ ok: true });
  }

  if ((g = p.match(/^\/admin\/users\/(\d+)$/)) && m === 'DELETE') {
    const s = await requireUser(req, env);
    if (!s.is_admin) throw new HttpError(403, 'Admins only');
    const id = Number(g[1]);
    if (id === s.user_id) throw new HttpError(400, 'You cannot delete your own account');
    const user = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(id).first<{ username: string }>();
    if (!user) throw new HttpError(404, 'Account not found');
    const { username } = await body(req);
    if (username !== user.username) throw new HttpError(400, 'Type the exact username to delete the account');
    const { count } = (await env.DB.prepare('SELECT count(*) AS count FROM boards WHERE owner_id = ?').bind(id).first<{ count: number }>())!;
    if (count) throw new HttpError(400, `${user.username} still owns ${count} bingo${count === 1 ? '' : 's'}; delete those first`);
    await env.DB.batch([
      // their uploads stay, since other boards may use them; they move to the admin doing the delete
      env.DB.prepare('UPDATE images SET owner_id = ? WHERE owner_id = ?').bind(s.user_id, id),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id), // sessions, names and reset links cascade
    ]);
    return Response.json({ ok: true });
  }

  // Admins see every claimed name with its owner, so a bogus claim can be removed
  if (p === '/admin/rsns' && m === 'GET') {
    const s = await requireUser(req, env);
    if (!s.is_admin) throw new HttpError(403, 'Admins only');
    const { results } = await env.DB.prepare(
      'SELECT r.id, r.name, u.username, u.email FROM rsns r JOIN users u ON u.id = r.user_id ORDER BY r.name'
    ).all();
    return Response.json(results);
  }

  if (p === '/auth/forgot' && m === 'POST') {
    const email = String((await body(req)).email ?? '').trim();
    const user = await env.DB.prepare('SELECT id, username, email FROM users WHERE email = ?').bind(email).first<UserRow>();
    if (user?.email) {
      const token = randomToken();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM resets WHERE user_id = ? OR expires < ?').bind(user.id, Date.now()),
        env.DB.prepare('INSERT INTO resets (token, user_id, expires) VALUES (?, ?, ?)').bind(token, user.id, Date.now() + RESET_WINDOW),
      ]);
      await sendResetEmail(env, user, token);
    }
    // Always the same answer, so this cannot be used to find out which addresses have an account.
    return Response.json({ ok: true });
  }

  if (p === '/auth/reset' && m === 'POST') {
    const { token, password } = await body(req);
    if (typeof password !== 'string' || password.length < 8 || password.length > 200)
      throw new HttpError(400, 'Password must be at least 8 characters');
    const row = await env.DB.prepare('SELECT user_id FROM resets WHERE token = ? AND expires > ?')
      .bind(String(token ?? ''), Date.now())
      .first<{ user_id: number }>();
    if (!row) throw new HttpError(400, 'This reset link has expired or was already used');
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').bind(await hashPassword(password), row.user_id),
      env.DB.prepare('DELETE FROM resets WHERE user_id = ?').bind(row.user_id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id), // signed out everywhere
    ]);
    return Response.json({ ok: true });
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

  // Shared image library: uploads plus every image a board already links to (wiki URLs, repo assets).
  // Logged-in users pick from it ("Use existing"); admins delete uploads from it.
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
    // Key: an upload id for our own images, otherwise the link exactly as the tile stores it.
    const prefix = `${url.origin}/img/`;
    const usedIn = new Map<string, { id: number; title: string }[]>();
    for (const b of boards.results as { id: number; title: string; config: string }[]) {
      const config = JSON.parse(b.config) as StoredBoard;
      const links = new Set<string>();
      for (const tile of config.tiles ?? []) {
        for (const tileSide of [tile as TileSide, tile.flip]) {
          if (tileSide?.tileImg) links.add(tileSide.tileImg);
          if (tileSide?.bossSrc) links.add(tileSide.bossSrc);
        }
      }
      for (const link of links) {
        const key = link.startsWith(prefix) ? link.slice(prefix.length) : link;
        usedIn.set(key, [...(usedIn.get(key) ?? []), { id: b.id, title: b.title }]);
      }
    }
    const uploads = (images.results as { id: string; type: string; size: number; created: number | null; owner: string }[]).map((i) => ({
      ...i,
      kind: 'upload' as const,
      url: `${url.origin}/img/${i.id}`,
      usedIn: usedIn.get(i.id) ?? [],
    }));
    const uploadIds = new Set(uploads.map((i) => i.id));
    const linked = [...usedIn]
      .filter(([key]) => !uploadIds.has(key))
      .map(([link, boardsUsing]) => ({ kind: 'link' as const, url: link, usedIn: boardsUsing }));
    return Response.json([...uploads, ...linked]);
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

// Counts login/register attempts per IP: 10 tries, then a 15 minute cooldown.
// Cloudflare's rate limit binding reports success on every call on this plan, so this uses D1.
async function throttle(env: Env, req: Request): Promise<string> {
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO attempts (ip, count, reset) VALUES (?1, 1, ?2 + ${ATTEMPT_COOLDOWN})
     ON CONFLICT (ip) DO UPDATE SET
       count = CASE WHEN reset < ?2 THEN 1 ELSE count + 1 END,
       reset = CASE WHEN reset < ?2 THEN ?2 + ${ATTEMPT_COOLDOWN} ELSE reset END
     RETURNING count, reset`
  )
    .bind(ip, now)
    .first<{ count: number; reset: number }>();
  if ((row?.count ?? 0) > MAX_ATTEMPTS) {
    const minutes = Math.max(1, Math.ceil((row!.reset - now) / 60_000));
    throw new HttpError(429, `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }
  return ip;
}

// A successful login or registration clears the counter, so normal use never hits the cooldown.
const clearAttempts = (env: Env, ip: string) => env.DB.prepare('DELETE FROM attempts WHERE ip = ?').bind(ip).run();

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

// Whitelists fields and turns captain names into user ids: a RuneScape name owned by an account, or an account name.
async function cleanBoard(env: Env, input: any): Promise<StoredBoard> {
  const err = validateBoard(input);
  if (err) throw new HttpError(400, err);
  const b = input as Board;
  const key = (name: string) => name.trim().toLowerCase();
  const wanted = [...new Set(b.teams.flatMap((t) => t.captains.map(key)))];
  if (wanted.length > 50) throw new HttpError(400, 'A board can have at most 50 captains'); // D1 binds max 100 params
  const found = new Map<string, number>();
  if (wanted.length) {
    const placeholders = wanted.map(() => '?').join(',');
    const [byRsn, byUsername] = await env.DB.batch([
      env.DB.prepare(`SELECT user_id AS id, name FROM rsns WHERE name COLLATE NOCASE IN (${placeholders})`).bind(...wanted),
      env.DB.prepare(`SELECT id, username AS name FROM users WHERE username IN (${placeholders})`).bind(...wanted),
    ]);
    for (const row of [...byUsername.results, ...byRsn.results] as { id: number; name: string }[]) found.set(key(row.name), row.id);
  }
  const missing = wanted.filter((w) => !found.has(w));
  if (missing.length) throw new HttpError(400, `No account owns the RuneScape name: ${missing.join(', ')}`);
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

const toUser = (u: UserRow) => ({ id: u.id, username: u.username, email: u.email, isAdmin: !!u.is_admin });

const randomToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, '');

// Brevo (free tier) sends the mail; without a key configured the reset link cannot be delivered.
async function sendResetEmail(env: Env, user: UserRow, token: string) {
  if (!env.BREVO_API_KEY || !env.SENDER_EMAIL) {
    console.error('Password reset requested but no email sender is configured');
    return;
  }
  const link = `${env.APP_URL}reset?token=${token}`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME },
      to: [{ email: user.email }],
      subject: 'Reset your Cabbingo password',
      textContent: `Hi ${user.username},\n\nOpen this link within 15 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, you can ignore this email; nothing changes until the link is used.`,
      htmlContent: `<p>Hi ${user.username},</p><p>Open this link within 15 minutes to choose a new password:</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, you can ignore this email; nothing changes until the link is used.</p>`,
    }),
  });
  if (!res.ok) console.error('Brevo rejected the reset email', res.status, await res.text());
}

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
  const token = randomToken();
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
