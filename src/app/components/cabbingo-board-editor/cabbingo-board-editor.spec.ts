import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CabbingoBoardEditor } from './cabbingo-board-editor';
import { Board } from '../../models/bingo';
import { DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

const BOARD_ID = 30;

function board(): Board {
  return {
    id: BOARD_ID,
    ownerId: 1,
    title: 'Cabbingo',
    description: '',
    rules: [],
    size: 3,
    startDate: '2020-01-01T00:00:00.000Z',
    endDate: '2030-01-01T00:00:00.000Z',
    rowBonus: 5,
    columnBonus: 5,
    flipEnabled: false,
    flipMode: 'keep',
    tiles: Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`,
      title: `Tile ${i + 1}`,
      type: 'items' as const,
      amount: 1,
      rules: [],
      tileImg: '',
      bossSrc: '',
      points: 1,
    })),
    teams: [{ id: 'a', name: 'benjamin', players: [], captains: [] }],
  };
}

describe('CabbingoBoardEditor tabs', () => {
  let fixture: ComponentFixture<CabbingoBoardEditor>;
  let component: CabbingoBoardEditor;
  let saved: Board | undefined;

  beforeEach(async () => {
    saved = undefined;
    const db = {
      listRsns: () => of([]),
      getBoard: () => of({ board: board(), progress: {} }),
      saveBoard: (_id: number, b: Board) => {
        saved = b;
        return of({});
      },
    };

    await TestBed.configureTestingModule({
      imports: [CabbingoBoardEditor],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: DatabaseService, useValue: db },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => String(BOARD_ID) } } },
        },
      ],
    }).compileComponents();

    // canEdit needs an account that owns the board, or the form never renders.
    TestBed.inject(SessionService).user = {
      id: 1,
      username: 'owner',
      email: null,
      isAdmin: false,
      token: 't',
    };

    fixture = TestBed.createComponent(CabbingoBoardEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function legends(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('legend')).map((l) =>
      (l as HTMLElement).textContent!.trim()
    );
  }

  function tabButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Board settings sections"] button'));
  }

  // Save and delete sit outside every @if, so one switched tab proves they stay.
  it('shows one panel at a time, with save and delete still there', () => {
    expect(legends().length).toBe(1);

    const teams = tabButtons().length - 1;
    tabButtons()[teams].click();
    fixture.detectChanges();

    expect(legends()).toEqual(['Teams']);
    expect(tabButtons()[teams].getAttribute('aria-pressed')).toBe('true');

    const el: HTMLElement = fixture.nativeElement;
    expect((el.querySelector('button[type="submit"]') as HTMLElement).textContent!.trim())
      .toBe('Save changes');
    expect(el.querySelector('#deleteHeading')).toBeTruthy();
  });

  // The panels are @if'd, so a hidden tab's inputs are destroyed. Saving has to keep reading
  // the component's own fields, or edits made on one tab are lost by switching to another.
  it('saves edits made on a tab that is no longer showing', () => {
    component.title = 'Renamed on General';
    component.teams[0].name = 'Renamed on Teams';
    component.rowBonus = 42;

    component.tab = 'Tiles';
    fixture.detectChanges();
    expect(legends()).toEqual(['Tiles']);

    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();

    expect(saved).toBeTruthy();
    expect(saved!.title).toBe('Renamed on General');
    expect(saved!.teams[0].name).toBe('Renamed on Teams');
    expect(saved!.rowBonus).toBe(42);
  });
});
