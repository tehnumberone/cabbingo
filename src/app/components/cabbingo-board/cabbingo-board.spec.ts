import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CabbingoBoard } from './cabbingo-board';
import { Board, Progress } from '../../models/bingo';
import { DatabaseService } from '../../services/database.service';

const SIZES = [3, 4, 5, 6, 7, 8, 9, 10];
// The board is desktop-only (the frame has a 1175px min-width), so these are the widths that matter.
const WIDTHS = [1280, 1440, 1920];
const BOOTSTRAP_CSS = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';

// styles.css leans on bootstrap for gaps and padding, and the app loads it from a CDN in
// index.html rather than the bundle, so the karma page has to pull it in too or the
// measurements in these specs are meaningless.
async function loadBootstrap(): Promise<void> {
  if (document.querySelector(`link[href="${BOOTSTRAP_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = BOOTSTRAP_CSS;
  document.head.appendChild(link);
  await new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = () => reject(new Error(`could not load ${BOOTSTRAP_CSS}`));
  });
}

function boardOfSize(size: number): Board {
  return {
    id: 1,
    title: `${size}x${size}`,
    description: '',
    rules: [],
    size,
    startDate: '2020-01-01',
    endDate: '2030-01-01',
    rowBonus: 0,
    columnBonus: 0,
    flipEnabled: false,
    flipMode: 'keep',
    // Long titles on purpose: they are what used to spill out of a tile.
    tiles: Array.from({ length: size * size }, (_, i) => ({
      id: `t${i}`,
      title: `Tile ${i + 1} with a deliberately long name`,
      type: 'custom' as const,
      amount: 1,
      rules: [],
      tileImg: '',
      bossSrc: '',
      points: 1,
    })),
    teams: [{ id: 'a', name: 'Team A', players: [], captains: [] }],
  };
}

describe('CabbingoBoard', () => {
  let fixture: ComponentFixture<CabbingoBoard>;

  beforeAll(loadBootstrap);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CabbingoBoard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: DatabaseService, useValue: { getBoard: () => of({ board: boardOfSize(5), progress: {} }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CabbingoBoard);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Every board size has to fit its frame at every desktop width: no size may squash tiles,
  // overflow the frame, or let a tile spill onto the row below.
  for (const size of SIZES) {
    for (const width of WIDTHS) {
      it(`lays out a ${size}x${size} board at ${width}px without distortion`, () => {
        fixture.componentInstance.board = boardOfSize(size);
        fixture.detectChanges();

        const el: HTMLElement = fixture.nativeElement;
        const page = el.querySelector('.board-page') as HTMLElement;
        // 98vw, as the stylesheet would compute it for this screen width.
        page.style.setProperty('--avail', `${width * 0.98}px`);
        page.style.width = `${width}px`;

        const frame = el.querySelector('.osrs-border-thick') as HTMLElement;
        const tiles = Array.from(el.querySelectorAll('.tile')) as HTMLElement[];
        const headers = Array.from(el.querySelectorAll('.column-tile')) as HTMLElement[];
        const rows = Array.from(el.querySelectorAll('.tiles > .py-1')) as HTMLElement[];

        expect(tiles.length).toBe(size * size);
        expect(headers.length).toBe(size);
        expect(rows.length).toBe(size);

        // Nothing spills out of the frame horizontally.
        expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth + 1);
        // ...and the frame itself fits the screen.
        expect(frame.getBoundingClientRect().width).toBeLessThanOrEqual(width);

        // All tiles share one size, and the flex row never squashed them below it.
        const { width: tileW, height: tileH } = tiles[0].getBoundingClientRect();
        expect(tileW).toBeGreaterThanOrEqual(60);
        expect(tileH).toBeGreaterThanOrEqual(50);
        for (const tile of tiles) {
          const box = tile.getBoundingClientRect();
          expect(box.width).toBeCloseTo(tileW, 0);
          expect(box.height).toBeCloseTo(tileH, 0);
        }

        // Column headers line up with the tiles they label — same width, and sitting
        // directly above them. Width alone missed an 8px drift across the whole header row.
        expect(headers[0].getBoundingClientRect().width).toBeCloseTo(tileW, 0);
        const firstRowTiles = Array.from(rows[0].querySelectorAll('.tile')) as HTMLElement[];
        for (const [i, header] of headers.entries()) {
          expect(header.getBoundingClientRect().left)
            .toBeCloseTo(firstRowTiles[i].getBoundingClientRect().left, 0);
        }

        // Rows stay stacked: a long tile title never covers the row underneath it.
        for (let r = 1; r < rows.length; r++) {
          expect(rows[r - 1].getBoundingClientRect().bottom)
            .toBeLessThanOrEqual(rows[r].getBoundingClientRect().top + 1);
        }
      });
    }
  }
});

// Flip and completion are drawn as CSS pseudo-elements (.tile-flipped::before, the folded
// corner, and .tile-completed::after, the check), which screen readers skip entirely. The
// button's aria-label is the only place those states are announced.
describe('CabbingoBoard tile labels', () => {
  let fixture: ComponentFixture<CabbingoBoard>;
  let component: CabbingoBoard;
  let board: Board;

  const FRONT = 'Tile 1 with a deliberately long name';
  const FLIP = 'The other side';

  beforeEach(async () => {
    board = boardOfSize(3);
    board.flipEnabled = true;
    board.tiles[0].flip = {
      title: FLIP,
      type: 'custom',
      amount: 1,
      rules: [],
      tileImg: '',
      bossSrc: '',
    };

    await TestBed.configureTestingModule({
      imports: [CabbingoBoard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: DatabaseService, useValue: { getBoard: () => of({ board, progress: {} }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CabbingoBoard);
    component = fixture.componentInstance;
    component.board = board;
  });

  // Team 'a' is the only team on boardOfSize, and currentTeam defaults to 0.
  function setProgress(p: Progress): void {
    component.progress = { a: { t0: p } };
  }

  it('is just the title when the tile is untouched', () => {
    expect(component.tileLabel(board.tiles[0])).toBe(FRONT);
  });

  // side() switches once the tile is flipped, so the label has to follow it — announcing
  // the front title on a flipped tile would name an objective that no longer applies.
  it('names the flipped side, not the front, once flipped', () => {
    setProgress({ front: { obtained: [], completed: false }, flipped: true });
    expect(component.tileLabel(board.tiles[0])).toBe(`${FLIP}, flipped`);
  });

  it('reports both states when a flipped tile has scored', () => {
    setProgress({
      front: { obtained: [], completed: true },
      flipped: true,
      flip: { obtained: [], completed: true },
    });
    expect(component.tileLabel(board.tiles[0])).toBe(`${FLIP}, flipped, completed`);
  });

  it('reports completion on an unflipped tile', () => {
    setProgress({ front: { obtained: [], completed: true }, flipped: false });
    expect(component.tileLabel(board.tiles[0])).toBe(`${FRONT}, completed`);
  });

  // The label is useless if it never reaches the DOM. Also guards the mobile case, where
  // `.tile-image + .tile-text { display: none }` drops the visible title out of the a11y
  // tree and aria-label becomes the button's only accessible name.
  it('lands on the tile button', () => {
    setProgress({ front: { obtained: [], completed: false }, flipped: true });
    fixture.detectChanges();

    const tile = fixture.nativeElement.querySelector('.tile') as HTMLElement;
    expect(tile.getAttribute('aria-label')).toBe(`${FLIP}, flipped`);
  });
});

// .button is a fixed 243x54 box painted with button.png, which is 243x52 — there is no room
// for a second line. Any label that wraps escapes the artwork.
describe('CabbingoBoard team buttons', () => {
  let fixture: ComponentFixture<CabbingoBoard>;

  // Rendered in full, never clipped. Measured against Runescape-Bold these run 0.43-0.49
  // em/char, which is what --avg-advance (0.5) is calibrated for.
  const NAMES = [
    'benjamin', // 8: comfortably fits, must stay at the full 27px
    'franklin whaddup widdit', // 23: board 30's team, the reported bug
    'WidditWhaddupFranklinsXX', // 24: the validateBoard cap, worst realistic mixed case
  ];
  // 0.94 em/char — roughly double a real name. The proxy cannot shrink this to fit, so it
  // only has to stay contained; the ellipsis takes it from there.
  const PATHOLOGICAL = 'WWWWWWWWWWWWWWWWWWWWWWWW';

  beforeAll(async () => {
    await loadBootstrap();
    // Without the real Runescape-Bold metrics these measurements are Times New Roman's.
    await document.fonts.ready;
  });

  beforeEach(async () => {
    const board = boardOfSize(3);
    board.teams = [...NAMES, PATHOLOGICAL].map((name, i) => ({
      id: `t${i}`,
      name,
      players: [],
      captains: [],
    }));

    await TestBed.configureTestingModule({
      imports: [CabbingoBoard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: DatabaseService, useValue: { getBoard: () => of({ board, progress: {} }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CabbingoBoard);
    fixture.componentInstance.board = board;
    fixture.detectChanges();
  });

  // On a nowrap element, scrollWidth is the full laid-out text width even though
  // `overflow: hidden` clips it — so scrollWidth > clientWidth means the ellipsis kicked in.
  for (const [i, name] of NAMES.entries()) {
    it(`keeps "${name}" (${name.length} chars) inside its button`, () => {
      const el = fixture.nativeElement.querySelectorAll('.teams .button')[i] as HTMLElement;
      expect(el.textContent!.trim()).toBe(name);

      // The button keeps the artwork's size...
      expect(el.getBoundingClientRect().height).toBeCloseTo(54, 0);
      expect(el.getBoundingClientRect().width).toBeCloseTo(243, 0);
      // ...the label stays on one line inside it...
      expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight + 1);
      // ...and is shown in full, never reaching the ellipsis backstop.
      expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth + 1);
    });
  }

  it('leaves a short name at the full 27px', () => {
    const el = fixture.nativeElement.querySelector('.teams .button') as HTMLElement;
    expect(getComputedStyle(el).fontSize).toBe('27px');
  });

  // No font size derived from a character count can fit this, so it gets ellipsised. What
  // matters is that it is contained: the button keeps its size and the text stays on one line.
  it(`contains an all-caps-W name rather than letting it escape`, () => {
    const el = fixture.nativeElement.querySelectorAll('.teams .button')[NAMES.length] as HTMLElement;
    expect(el.textContent!.trim()).toBe(PATHOLOGICAL);
    expect(el.getBoundingClientRect().height).toBeCloseTo(54, 0);
    expect(el.getBoundingClientRect().width).toBeCloseTo(243, 0);
    expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight + 1);
    // Clipped rather than shrunk to fit — the documented fallback, not an accident.
    expect(el.scrollWidth).toBeGreaterThan(el.clientWidth);
  });

  // Same class, same overflow: 20-char username cap plus " (admin)".
  it('keeps the longest possible username inside the login button', () => {
    const el = fixture.nativeElement.querySelector('.login-btn') as HTMLElement;
    el.textContent = 'a'.repeat(20) + ' (admin)'; // 28
    el.style.setProperty('--len', '28');

    expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight + 1);
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth + 1);
  });
});
