// node --experimental-strip-types test.ts
import assert from 'node:assert/strict';
import { type Board, type Tile, imageLinkOk, sideDone, tilePoints, totalPoints, validateBoard } from '../src/app/models/bingo.ts';
import { isBullet, parseLine, parseRules, stripBullet, stripTags } from '../src/app/models/rich-text.ts';

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
assert.equal(validateBoard({ ...board, tiles: board.tiles.map((t) => ({ ...t, items: ['Torva platebody'] })) }), null);
assert.match(validateBoard({ ...board, tiles: board.tiles.map((t) => ({ ...t, items: [1] as any })) })!, /Tile 1/);

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

// rule formatting
const seg = (text: string, color?: string, underline = false, strike = false) => ({ text, color, underline, strike });
assert.deepEqual(parseLine('plain'), [seg('plain')]);
assert.deepEqual(parseLine('a [color=green]b [u]c[/u][/color] d'), [seg('a '), seg('b ', 'green'), seg('c', 'green', true), seg(' d')]);
assert.deepEqual(parseLine('[s]x[/s]'), [seg('x', undefined, false, true)]);
assert.deepEqual(parseLine('[color=blue]x[/color]'), [seg('[color=blue]x[/color]')], 'unknown colour and stray close stay text');
assert.deepEqual(parseLine('[color=red]open to the end'), [seg('open to the end', 'red')], 'unclosed tag runs to end of line');
assert.deepEqual(parseLine('<script>alert(1)</script>'), [seg('<script>alert(1)</script>')]);
assert.deepEqual(parseLine('[color=purple]p[/color]'), [seg('p', 'purple')], 'extra palette colours');
assert.equal(stripTags('a [color=cyan][u]b[/u][/color] [color=blue]c[/color]'), 'a b [color=blue]c[/color]');
assert.deepEqual(
  parseRules(['* one', '* two', 'plain', '', '* three']).map((b) => [b.list, b.lines.length]),
  [[true, 2], [false, 1], [true, 1]]
);
// the bullet marker still counts when a colour wraps the whole line
const coloured = parseRules(['[color=green]* one[/color]', '* [color=red]two[/color]']);
assert.deepEqual(coloured.map((b) => b.list), [true]);
assert.deepEqual(coloured[0].lines, [[seg('one', 'green')], [seg('two', 'red')]]);
assert.equal(isBullet('[u]* x[/u]'), true);
assert.equal(stripBullet('[u]* x[/u]'), '[u]x[/u]');
assert.equal(isBullet('no marker'), false);

// image links: the schemes that would fetch from somewhere unexpected are refused
for (const ok of ['', 'https://oldschool.runescape.wiki/x.png', 'assets/coins.png', 'img/abc-123'])
  assert.equal(imageLinkOk(ok), true, `should allow ${ok}`);
for (const bad of ['data:text/html,<script>', 'javascript:alert(1)', 'http://plain.example/x.png', '//other.host/x.png', 42])
  assert.equal(imageLinkOk(bad), false, `should refuse ${bad}`);

const withLink = (link: string) => ({ ...board, tiles: board.tiles.map((t) => ({ ...t, tileImg: link })) });
assert.equal(validateBoard(withLink('https://oldschool.runescape.wiki/x.png')), null);
assert.match(validateBoard(withLink('data:text/html,<script>'))!, /image links/);
assert.match(validateBoard(withLink('javascript:alert(1)'))!, /image links/);
// a bad link on the flip side counts too
assert.match(
  validateBoard({ ...board, tiles: board.tiles.map((t) => ({ ...t, flip: { ...t.flip!, bossSrc: 'http://x.example/y.png' } })) })!,
  /image links/
);
// rules must be strings, not arbitrary JSON smuggled through the array check
assert.match(validateBoard({ ...board, tiles: board.tiles.map((t) => ({ ...t, rules: [{ evil: 1 }] as any })) })!, /Tile 1/);

console.log('ok');
