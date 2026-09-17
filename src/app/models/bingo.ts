// Shared by the Angular app and the Cloudflare worker (worker/src/index.ts). Keep it dependency-free.

export interface TileSide {
  title: string;
  description?: string;
  type: 'items' | 'custom'; // items: sum of obtained >= amount; custom: manually ticked
  amount: number;
  criteria?: string; // free text for custom tiles
  items?: string[]; // items tile: progress is tracked per item name; empty = one "Obtained" count
  rules: string[];
  tileImg: string;
  bossSrc: string;
}

export interface Tile extends TileSide {
  id: string; // stable across reorders; progress is keyed on it
  points: number;
  flip?: TileSide;
}

export interface Team {
  id: string;
  name: string;
  players: string[];
  captains: string[]; // usernames of accounts that may update this team's progress
}

export interface Board {
  id?: number;
  ownerId?: number;
  title: string;
  description: string;
  rules: string[];
  size: number; // size x size tiles, min 3
  startDate: string; // ISO
  endDate: string; // ISO
  templeosCompetitionId?: string;
  rowBonus: number;
  columnBonus: number;
  flipEnabled: boolean;
  flipMode: 'all-or-nothing' | 'keep';
  tiles: Tile[]; // row-major, length size*size
  teams: Team[];
  donations?: { name: string; amount: number }[]; // amounts in millions gp
  buyIn?: number; // millions gp per participant
}

export interface SideProgress {
  obtained: { name: string; obtained: number }[];
  completed?: boolean;
}

export interface Progress {
  front: SideProgress;
  flipped: boolean;
  flip?: SideProgress;
}

export const emptyProgress = (): Progress => ({ front: { obtained: [] }, flipped: false });

// Archived: the worker refuses edits after this, except from admins.
export const isEnded = (board: Pick<Board, 'endDate'>) => Date.parse(board.endDate) < Date.now();

export function sideDone(side: TileSide, p?: SideProgress): boolean {
  if (!p) return false;
  if (side.type === 'custom') return !!p.completed;
  return p.obtained.reduce((sum, o) => sum + (Number(o.obtained) || 0), 0) >= side.amount;
}

export function tilePoints(board: Board, tile: Tile, p?: Progress): number {
  if (!p || !sideDone(tile, p.front)) return 0;
  if (!p.flipped || !tile.flip) return tile.points;
  if (sideDone(tile.flip, p.flip)) return tile.points * 2;
  return board.flipMode === 'all-or-nothing' ? 0 : tile.points;
}

// progress: tile id -> Progress for one team
export function totalPoints(board: Board, progress: Record<string, Progress>): number {
  const scores = board.tiles.map((t) => tilePoints(board, t, progress[t.id]));
  const n = board.size;
  let total = scores.reduce((a, b) => a + b, 0);
  for (let r = 0; r < n; r++) if (scores.slice(r * n, r * n + n).every((s) => s > 0)) total += board.rowBonus;
  for (let c = 0; c < n; c++) if (scores.filter((_, i) => i % n === c).every((s) => s > 0)) total += board.columnBonus;
  return total;
}

const validSide = (s: TileSide) =>
  typeof s?.title === 'string' &&
  (s.type === 'items' || s.type === 'custom') &&
  Number.isFinite(s.amount) &&
  Array.isArray(s.rules) &&
  (s.items === undefined || (Array.isArray(s.items) && s.items.every((i) => typeof i === 'string')));

export function validateBoard(b: Board): string | null {
  if (typeof b?.title !== 'string' || !b.title.trim()) return 'Title is required';
  if (!Number.isInteger(b.size) || b.size < 3 || b.size > 10) return 'Size must be between 3 and 10';
  if (!Array.isArray(b.tiles) || b.tiles.length !== b.size * b.size) return `Board needs exactly ${b.size * b.size} tiles`;
  const bad = b.tiles.findIndex((t) => !validSide(t) || !Number.isFinite(t.points) || (t.flip && !validSide(t.flip)));
  if (bad >= 0) return `Tile ${bad + 1} is incomplete`;
  if (new Set(b.tiles.map((t) => t.id)).size !== b.tiles.length || b.tiles.some((t) => typeof t.id !== 'string' || !t.id))
    return 'Tile ids must be unique';
  if (!Array.isArray(b.teams) || !b.teams.length) return 'At least one team is required';
  if (b.teams.some((t) => typeof t?.id !== 'string' || !t.name)) return 'Every team needs a name';
  if (b.teams.some((t) => !Array.isArray(t.captains) || t.captains.some((c) => typeof c !== 'string' || !c.trim())))
    return 'Captains must be usernames';
  if (new Set(b.teams.map((t) => t.id)).size !== b.teams.length) return 'Team ids must be unique';
  if (isNaN(Date.parse(b.startDate)) || isNaN(Date.parse(b.endDate))) return 'Invalid dates';
  if (Date.parse(b.endDate) <= Date.parse(b.startDate)) return 'End date must be after start date';
  if (b.flipMode !== 'all-or-nothing' && b.flipMode !== 'keep') return 'Invalid flip mode';
  return null;
}
