import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CabbingoBoards } from './components/cabbingo-boards/cabbingo-boards';
import { CabbingoEditBoard } from './components/cabbingo-edit-board/cabbingo-edit-board';
import { CabbingoLogin } from './components/cabbingo-login/cabbingo-login';
import { DatabaseService } from './services/database.service';
import { SessionService, User } from './services/session-service';
import { PHONE_WIDTH, usePhoneViewport } from './testing/phone-viewport';

/*
 * Every page outside the board shares one frame, `.osrs-border-thick-login px-5`. It is
 * `width: fit-content` with no cap and 48px of padding a side, so on a phone the frames
 * measured 602-753px inside a 390px viewport and `px-5` ate 96px of the 390 that was left.
 * These specs pin both: the frame fits the screen, and the padding is a phone's worth.
 */
const person = (isAdmin = false): User & { token: string } => ({
  id: 1,
  username: 'TehNumberOne',
  email: 'a@b.c',
  isAdmin,
  token: 't',
});

const SUMMARY = {
  id: 1,
  title: 'flipped bingo',
  description: 'A description',
  ownerId: 1,
  owner: 'TehNumberOne',
  startDate: '2026-09-18',
  endDate: '2026-10-02',
  archived: false,
};

// Two tiles per shape: a `custom` (manual checkbox) and a counted one (per-item inputs),
// so both arms of the Required/Obtained branch render and get labelled.
function boardData() {
  const tiles = Array.from({ length: 4 }, (_, i) => ({
    id: `t${i}`,
    title: `Tile ${i + 1} with a deliberately long name`,
    description: 'Obtain 5 Barrows bottoms',
    type: i % 2 ? ('custom' as const) : ('items' as const),
    amount: 5,
    rules: [],
    tileImg: '',
    bossSrc: '',
    points: 5,
    items: i % 2 ? undefined : ['Ahrim', 'Dharok'],
  }));
  return {
    board: {
      id: 1,
      ownerId: 1,
      title: 'b',
      description: '',
      rules: [],
      size: 2,
      startDate: '2020-01-01',
      endDate: '2030-01-01',
      rowBonus: 0,
      columnBonus: 0,
      flipEnabled: false,
      flipMode: 'keep' as const,
      tiles,
      teams: [{ id: 'a', name: 'Team 1', players: [], captains: ['tehnumberone'] }],
    },
    progress: {},
  };
}

describe('Site pages on a phone', () => {
  let restoreViewport: () => void;

  beforeAll(async () => {
    restoreViewport = await usePhoneViewport();
  });

  afterAll(() => restoreViewport());

  afterEach(() => TestBed.inject(SessionService).setUser(null));

  async function mount<T>(component: Type<T>, providers: unknown[] = []): Promise<ComponentFixture<T>> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [component],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          { provide: DatabaseService, useValue: { listBoards: () => of([SUMMARY]), getBoard: () => of(boardData()) } },
          ...(providers as never[]),
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(component);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 80));
    return fixture;
  }

  // `.page-wrap` has `overflow: auto`, so an oversized frame quietly becomes a scrollbar on
  // the wrapper rather than on the document — the frame's own width is the honest signal.
  function expectFitsPhone(fixture: ComponentFixture<unknown>) {
    const frame = (fixture.nativeElement as HTMLElement).querySelector('.osrs-border-thick-login') as HTMLElement;
    expect(frame).withContext('page frame').toBeTruthy();
    expect(frame.getBoundingClientRect().width).toBeLessThanOrEqual(PHONE_WIDTH);
    // 48px a side was a quarter of the viewport spent on padding.
    expect(parseFloat(getComputedStyle(frame).paddingLeft)).toBeLessThanOrEqual(16);
    expect(parseFloat(getComputedStyle(frame).paddingRight)).toBeLessThanOrEqual(16);
  }

  it('renders the boards list inside the screen', async () => {
    expectFitsPhone(await mount(CabbingoBoards));
  });

  for (const mode of ['login', 'register', 'forgot'] as const) {
    it(`renders the ${mode} form inside the screen`, async () => {
      const fixture = await mount(CabbingoLogin);
      (fixture.componentInstance as { mode: string }).mode = mode;
      fixture.detectChanges();
      expectFitsPhone(fixture);
    });
  }

  it('renders the account panel inside the screen, including an RSN row being edited', async () => {
    const fixture = await mount(CabbingoLogin);
    TestBed.inject(SessionService).setUser(person(true));
    const component = fixture.componentInstance as { rsns: { id: number; name: string }[]; editingRsn?: unknown };
    component.rsns = [{ id: 1, name: 'LongRsnName' }];
    component.editingRsn = component.rsns[0];
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 40));

    expectFitsPhone(fixture);
    // Input + Save + Cancel are all flex-shrink-0: ~329px of content in ~250px of row.
    const row = (fixture.nativeElement as HTMLElement).querySelector('li.osrs-border-darker') as HTMLElement;
    expect(row).withContext('RSN row').toBeTruthy();
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
  });

  describe('/edit-board', () => {
    const asCaptain = async () => {
      TestBed.resetTestingModule();
      const fixture = await mount(CabbingoEditBoard, [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ board: '1' }) } } },
      ]);
      TestBed.inject(SessionService).setUser(person());
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 80));
      return fixture;
    };

    // This one had no max-width guard at all, so its 8-column table pushed the frame to 753px.
    it('fits the screen', async () => expectFitsPhone(await asCaptain()));

    it('stacks each tile as a card instead of a row', async () => {
      const el = (await asCaptain()).nativeElement as HTMLElement;
      const thead = el.querySelector('thead') as HTMLElement;
      const rows = Array.from(el.querySelectorAll('tbody tr')) as HTMLElement[];

      expect(rows.length).toBeGreaterThan(0);
      expect(getComputedStyle(thead).display).toBe('none');
      for (const row of rows) {
        expect(getComputedStyle(row).display).toBe('block');
      }
    });

    // With the header hidden, data-label is the only thing naming each value.
    it('labels every cell, on both the manual and the counted tile shapes', async () => {
      const el = (await asCaptain()).nativeElement as HTMLElement;
      const rows = Array.from(el.querySelectorAll('tbody tr')) as HTMLElement[];
      const shapes = new Set<string>();

      for (const row of rows) {
        const labels = Array.from(row.querySelectorAll('td')).map((td) => td.dataset['label']);
        expect(labels).not.toContain(undefined);
        expect(labels.slice(0, 5)).toEqual(['Tile title', 'Image', 'Boss image', 'Points', 'Description']);
        expect(labels.slice(5)).toEqual(['Required', 'Obtained', 'Actions']);
        shapes.add(row.querySelector('input[type="checkbox"]') ? 'manual' : 'counted');
      }
      expect(shapes).toEqual(new Set(['manual', 'counted']));
    });
  });
});
