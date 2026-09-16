// One-off Firebase export -> D1 import.
// node --experimental-strip-types migrate.ts <export.json> <templeosrs competition id> > import.sql
// Board owner = first admin user, so register + make yourself admin before running import.sql.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type Board, type Progress, validateBoard } from '../src/app/models/bingo.ts';

const [file, compId] = process.argv.slice(2);
const fb = JSON.parse(readFileSync(file, 'utf8'));
const temple = (await (await fetch(`https://templeosrs.com/api/competition_info_v2.php?id=${compId}`)).json()).data;

// same format as hashPassword() in src/index.ts
const hash = (pw: string) => {
  const salt = randomBytes(16);
  return `10000:${salt.toString('base64')}:${pbkdf2Sync(pw, salt, 10000, 32, 'sha256').toString('base64')}`;
};

const teamKeys = Object.keys(fb.Boards); // "Team 1", "Team 2"
const tiles = fb.Boards[teamKeys[0]].map((t: any) => ({
  id: String(t.id),
  title: t.title,
  description: t.description,
  type: 'items',
  amount: t.itemsRequired,
  rules: t.rules ?? [],
  tileImg: t.src,
  bossSrc: t.bossSrc,
  points: t.points,
}));

const board: Board & { teams: any[] } = {
  title: temple.info.name,
  description: '',
  rules: [
    'Multiple accounts are allowed, but only one can be logged in at once.',
    'The EXP tile will only be counted for ONE account. If you are playing with multiple.',
    'Complete a full row or column to earn a 5 point bonus!',
    'Tiles can be completed in any order.',
    'Good luck and have fun!',
  ],
  size: Math.sqrt(tiles.length),
  startDate: new Date(temple.info.start_date_unix * 1000).toISOString(),
  endDate: new Date(temple.info.end_date_unix * 1000).toISOString(),
  templeosCompetitionId: String(compId),
  rowBonus: 5,
  columnBonus: 5,
  flipEnabled: false,
  flipMode: 'all-or-nothing',
  tiles,
  teams: teamKeys.map((key, i) => {
    const creds = fb.LoginCredentials?.[key] ?? {};
    return {
      id: `team-${i + 1}`,
      name: creds.name ?? key,
      players: temple.teams[String(i + 1)]?.members ?? [],
      ...(creds.password ? { pwHash: hash(creds.password) } : {}),
    };
  }),
  donations: (fb.Donations ?? []).filter(Boolean).flatMap((d: Record<string, number>) =>
    Object.entries(d).map(([name, amount]) => ({ name, amount: Number(amount) }))
  ),
  buyIn: 3,
};

const err = validateBoard(board);
if (err) throw new Error(err);

const q = (v: unknown) => `'${String(v).replace(/'/g, "''")}'`;
const boardId = `(SELECT id FROM boards WHERE json_extract(config, '$.templeosCompetitionId') = ${q(compId)})`;
const out = [
  `INSERT INTO boards (owner_id, end_date, config)
SELECT (SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1), ${Date.parse(board.endDate)}, ${q(JSON.stringify(board))}
WHERE NOT EXISTS ${boardId};`,
];
teamKeys.forEach((key, i) => {
  for (const t of fb.Boards[key]) {
    const p: Progress = { front: { obtained: [{ name: 'Obtained', obtained: Number(t.itemsObtained) || 0 }] }, flipped: false };
    out.push(
      `INSERT OR REPLACE INTO progress (board_id, team_id, tile_id, data) VALUES (${boardId}, 'team-${i + 1}', ${q(t.id)}, ${q(JSON.stringify(p))});`
    );
  }
});
console.log(out.join('\n'));
