import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CabbingoBoard } from './cabbingo-board';
import { Board } from '../../models/bingo';
import { DatabaseService } from '../../services/database.service';

// The sibling spec fakes width per element, which cannot exercise a media query. This one
// narrows karma's own context iframe instead: styles inside an iframe resolve against the
// iframe's viewport, so `max-width: 767.98px` really fires. Headless chrome clamps
// --window-size at roughly 470px, which is why the browser window itself is no good here.
const PHONE = 390;
const BOOTSTRAP_CSS = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';

// A 1x1 red square, inline so karma does not have to serve it.
const TILE_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="red"/></svg>');

// Long enough to widen a shrink-to-fit box, short enough to stay readable in a diff.
const LONG_RULES = [
  'The obtained legs can be duplicates. All pantaloons are allowed:',
  "Ahrim's robeskirt",
  "Dharok's platelegs",
  "Guthan's chainskirt",
];

function boardOfSize(size: number, tileImg: string, rules: string[] = []): Board {
  return {
    id: 1,
    title: `${size}x${size}`,
    description: 'A description, so the info icon next to the title renders.',
    rules: [],
    size,
    startDate: '2020-01-01',
    endDate: '2030-01-01',
    rowBonus: 0,
    columnBonus: 0,
    flipEnabled: false,
    flipMode: 'keep',
    tiles: Array.from({ length: size * size }, (_, i) => ({
      id: `t${i}`,
      title: `Tile ${i + 1} with a deliberately long name`,
      type: 'custom' as const,
      amount: 1,
      rules,
      tileImg,
      bossSrc: '',
      points: 1,
    })),
    teams: [
      { id: 'a', name: 'Team 1', players: [], captains: [] },
      { id: 'b', name: 'Team 2', players: [], captains: [] },
    ],
  };
}

describe('CabbingoBoard on a phone', () => {
  let frame: HTMLElement | null;
  let restoreWidth: string;

  beforeAll(async () => {
    if (!document.querySelector(`link[href="${BOOTSTRAP_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = BOOTSTRAP_CSS;
      document.head.appendChild(link);
      await new Promise((resolve, reject) => {
        link.onload = resolve;
        link.onerror = () => reject(new Error(`could not load ${BOOTSTRAP_CSS}`));
      });
    }
    await document.fonts.ready;

    frame = window.frameElement as HTMLElement | null;
    restoreWidth = frame?.style.width ?? '';
    if (frame) {
      frame.style.width = `${PHONE}px`;
      frame.style.minWidth = `${PHONE}px`;
    }
    await new Promise((r) => setTimeout(r, 100));
  });

  // Every other spec measures at desktop width, so this must not leak.
  afterAll(() => {
    if (frame) {
      frame.style.width = restoreWidth;
      frame.style.minWidth = '';
    }
  });

  async function render(size: number, tileImg: string, rules: string[] = []): Promise<ComponentFixture<CabbingoBoard>> {
    const board = boardOfSize(size, tileImg, rules);
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [CabbingoBoard],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          { provide: DatabaseService, useValue: { getBoard: () => of({ board, progress: {} }) } },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(CabbingoBoard);
    fixture.componentInstance.board = board;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 60));
    return fixture;
  }

  it('is actually rendering at phone width', () => {
    expect(window.innerWidth).toBe(PHONE);
    // If this fails the iframe trick stopped working and every assertion below is meaningless.
    expect(matchMedia('(max-width: 767.98px)').matches).toBe(true);
  });

  it('gives a 5x5 board square tiles big enough to read, with nothing scrolling sideways', async () => {
    const fixture = await render(5, TILE_IMG);
    const el: HTMLElement = fixture.nativeElement;
    const tiles = el.querySelector('.tiles') as HTMLElement;
    const tile = el.querySelector('.tile') as HTMLElement;
    const box = tile.getBoundingClientRect();

    // The first pass shipped 45x38 tiles, which is what this number is guarding. 58px
    // today: the 20px page gutter that keeps the frame's border on screen comes out of
    // the tile budget.
    expect(box.width).toBeGreaterThanOrEqual(55);
    expect(box.height).toBeCloseTo(box.width, 0); // square on mobile, not 0.84 tall

    // The whole board fits: neither the grid nor the page scrolls sideways.
    expect(tiles.scrollWidth).toBeLessThanOrEqual(tiles.clientWidth + 1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);

    // The info column wraps under the grid instead of sitting beside it.
    const infoArea = el.querySelector('.infoArea') as HTMLElement;
    expect(infoArea.getBoundingClientRect().top).toBeGreaterThanOrEqual(tiles.getBoundingClientRect().bottom);

    fixture.nativeElement.remove();
  });

  it('spans the progress bar across the tile the way desktop does', async () => {
    const fixture = await render(5, TILE_IMG);
    const tile = fixture.nativeElement.querySelector('.tile') as HTMLElement;
    const progress = tile.querySelector('.progress') as HTMLElement;
    // bootstrap's .btn padding used to eat 24px of a 68px tile; it is off on mobile.
    const ratio = progress.getBoundingClientRect().width / tile.getBoundingClientRect().width;
    expect(ratio).toBeGreaterThan(0.9);
    fixture.nativeElement.remove();
  });

  it('drops the tile title for the icon, but keeps it when there is no icon', async () => {
    const withIcon = await render(5, TILE_IMG);
    const iconTile = withIcon.nativeElement.querySelector('.tile') as HTMLElement;
    const icon = iconTile.querySelector('.tile-image') as HTMLElement;
    expect(getComputedStyle(iconTile.querySelector('.tile-text') as HTMLElement).display).toBe('none');
    // Big enough to recognise: over half the tile.
    expect(icon.getBoundingClientRect().height).toBeGreaterThan(iconTile.getBoundingClientRect().height * 0.5);
    withIcon.nativeElement.remove();

    const noIcon = await render(5, '');
    const plainTile = noIcon.nativeElement.querySelector('.tile') as HTMLElement;
    expect(plainTile.querySelector('.tile-image')).toBeNull();
    expect(getComputedStyle(plainTile.querySelector('.tile-text') as HTMLElement).display).not.toBe('none');
    noIcon.nativeElement.remove();
  });

  it('abbreviates the row and column labels to a 24px strip, still above their tiles', async () => {
    const fixture = await render(5, TILE_IMG);
    const el: HTMLElement = fixture.nativeElement;
    const rowLabel = el.querySelectorAll('.row-tile')[1] as HTMLElement; // [0] is the corner spacer
    expect(rowLabel.innerText.trim()).toBe('R1');
    expect((el.querySelector('.column-tile') as HTMLElement).innerText.trim()).toBe('C1');
    expect(rowLabel.getBoundingClientRect().width).toBeCloseTo(24, 0);

    const headers = Array.from(el.querySelectorAll('.column-tile')) as HTMLElement[];
    const firstRow = Array.from(
      (el.querySelectorAll('.tiles > .py-1')[0] as HTMLElement).querySelectorAll('.tile'),
    ) as HTMLElement[];
    for (const [i, header] of headers.entries()) {
      expect(header.getBoundingClientRect().left).toBeCloseTo(firstRow[i].getBoundingClientRect().left, 0);
    }
    fixture.nativeElement.remove();
  });

  // The frame is min-width:100% of .page-wrap, so with no gutter it sat at x=0 and its
  // 3px border landed on the viewport edge with the 6px outline drawn off-screen.
  it('leaves room for the frame border and outline on both sides', async () => {
    const fixture = await render(5, TILE_IMG);
    const frame = (fixture.nativeElement as HTMLElement).querySelector('.osrs-border-thick') as HTMLElement;
    const style = getComputedStyle(frame);
    const needed = parseFloat(style.borderLeftWidth) + parseFloat(style.outlineWidth); // 3 + 6
    const box = frame.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(needed);
    expect(window.innerWidth - box.right).toBeGreaterThanOrEqual(needed);
    fixture.nativeElement.remove();
  });

  // The column headers take the corner placeholder's height so the top strip reads as one
  // band. The row labels are deliberately NOT in that group: they stay as tall as the tiles
  // they sit beside, the same as desktop.
  it('matches the column headers to the corner placeholder, and the row labels to their tiles', async () => {
    const fixture = await render(5, TILE_IMG);
    const el: HTMLElement = fixture.nativeElement;
    const h = (e: Element) => e.getBoundingClientRect().height;
    const corner = h(el.querySelectorAll('.row-tile')[0]);
    const tile = h(el.querySelector('.tile')!);

    expect(h(el.querySelector('.column-tile')!)).toBeCloseTo(corner, 0);
    expect(corner).toBeLessThan(tile * 0.7); // the band is a header, not a tile row

    expect(h(el.querySelectorAll('.row-tile')[1])).toBeCloseTo(tile, 0);
    fixture.nativeElement.remove();
  });

  // .infoArea centres its children, so the unclassed wrapper holding the info box was
  // shrink-to-fit and every tile got a box sized to its own rules: 256px for a short one
  // against 334px for a long one. The box is the same for every tile, at the full column.
  it('keeps the info box at full width whatever the selected tile says', async () => {
    const measured: number[] = [];

    for (const rules of [['Only certain uniques count'], LONG_RULES]) {
      const fixture = await render(5, TILE_IMG, rules);
      const el: HTMLElement = fixture.nativeElement;
      (el.querySelector('.tile') as HTMLElement).click();
      fixture.componentInstance.bingoRulesOpened = false; // show the tile's own rules
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 60));

      const column = (el.querySelector('.infoArea') as HTMLElement).getBoundingClientRect().width;
      const box = (el.querySelector('.infobox') as HTMLElement).getBoundingClientRect().width;
      expect(box).toBeCloseTo(column, 0);
      measured.push(box);
      el.remove();
    }

    expect(measured[0]).toBeCloseTo(measured[1], 0);
  });

  // The 44px tap target on the 16px info icon is an overlay, not padding + a negative
  // margin: the latter pulled the icon through the title's gap until they touched.
  it('keeps the info icon clear of the board title', async () => {
    const fixture = await render(5, TILE_IMG);
    const el: HTMLElement = fixture.nativeElement;
    const heading = el.querySelector('h2') as HTMLElement;
    const btn = el.querySelector('.info-btn') as HTMLElement;
    expect(btn.getBoundingClientRect().left - heading.getBoundingClientRect().right).toBeGreaterThanOrEqual(6);
    fixture.nativeElement.remove();
  });

  it('puts the team buttons on one row instead of stacking them full width', async () => {
    const fixture = await render(5, TILE_IMG);
    const [a, b] = Array.from(fixture.nativeElement.querySelectorAll('.teams .button')) as HTMLElement[];
    expect(a.getBoundingClientRect().top).toBeCloseTo(b.getBoundingClientRect().top, 0);
    expect(a.getBoundingClientRect().width).toBeLessThan(PHONE / 2);
    expect(a.getBoundingClientRect().height).toBeCloseTo(44, 0); // stays a tap target
    fixture.nativeElement.remove();
  });

  // The board the user is most likely to have after a 5x5: still no sideways scroll.
  it('still fits a 7x7 board', async () => {
    const fixture = await render(7, TILE_IMG);
    const tiles = fixture.nativeElement.querySelector('.tiles') as HTMLElement;
    expect(tiles.scrollWidth).toBeLessThanOrEqual(tiles.clientWidth + 1);
    expect((fixture.nativeElement.querySelector('.tile') as HTMLElement).getBoundingClientRect().width)
      .toBeGreaterThanOrEqual(44); // the tap-target floor
    fixture.nativeElement.remove();
  });
});
