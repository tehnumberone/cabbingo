// node --experimental-strip-types test.ts
import assert from 'node:assert/strict';
import { type Board, type Tile, sideDone, tilePoints, totalPoints, validateBoard } from '../src/app/models/bingo.ts';

const tile = (points: number, id: string): Tile => ({
  id, title: 't', type: 'items', amount: 2, rules: [], tileImg: '', bossSrc: '', points,
  flip: { title: 'f', type: 'custom', amount: 1, rules: [], tileImg: '', bossSrc: '' },
});
const board: Board = {
  title: 'b', description: '', rules: [], size: 3, startDate: '2026-01-01', endDate: '2026-02-01',
  rowBonus: 5, columnBonus: 7, flipEnabled: true, flipMode: 'all-or-nothing',
  tiles: Array.from({ length: 9 }, (_, i) => tile(10, 't' + i)), teams: [{ id: 'a', name: 'A', players: [], captains: [] }],
};
const done = { obtained: [{ name: 'x', obtained: 1 }, { name: 'y', obtained: 1 }] };

assert.equal(validateBoard(board), null);
assert.match(validateBoard({ ...board, size: 2 })!, /Size/);
assert.match(validateBoard({ ...board, tiles: board.tiles.slice(1) })!, /9 tiles/);
assert.match(validateBoard({ ...board, tiles: board.tiles.map((t) => ({ ...t, id: 'same' })) })!, /unique/);

assert.equal(sideDone(board.tiles[0], { obtained: [{ name: 'x', obtained: 1 }] }), false);
assert.equal(sideDone(board.tiles[0], done), true);

const t = board.tiles[0];
assert.equal(tilePoints(board, t, { front: done, flipped: false }), 10);
assert.equal(tilePoints(board, t, { front: done, flipped: true }), 0, 'all-or-nothing: flipped, not done');
assert.equal(tilePoints(board, t, { front: done, flipped: true, flip: { obtained: [], completed: true } }), 20);
assert.equal(tilePoints({ ...board, flipMode: 'keep' }, t, { front: done, flipped: true }), 10, 'keep: flipped, not done');

// first row complete -> 3*10 + row bonus; flipping one unfinished loses tile and row bonus
const p = { front: done, flipped: false };
const row = { t0: p, t1: p, t2: p };
assert.equal(totalPoints(board, row), 35);
assert.equal(totalPoints(board, { ...row, t2: { front: done, flipped: true } }), 20);
// first column complete -> column bonus
assert.equal(totalPoints(board, { t0: p, t3: p, t6: p }), 37);

console.log('ok');
