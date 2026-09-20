import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CabbingoBoards } from './cabbingo-boards';
import { BoardSummary, DatabaseService } from '../../services/database.service';
import { SessionService, User } from '../../services/session-service';

function summary(id: number, ownerId: number, archived = false): BoardSummary {
  return {
    id,
    title: `Board ${id}`,
    description: '',
    ownerId,
    owner: `owner${ownerId}`,
    startDate: '2020-01-01',
    endDate: '2030-01-01',
    archived,
  };
}

async function render(boards: BoardSummary[], user: (User & { token: string }) | null) {
  await TestBed.resetTestingModule()
    .configureTestingModule({
      imports: [CabbingoBoards],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: DatabaseService, useValue: { listBoards: () => of(boards) } },
      ],
    })
    .compileComponents();

  TestBed.inject(SessionService).setUser(user);
  const fixture: ComponentFixture<CabbingoBoards> = TestBed.createComponent(CabbingoBoards);
  fixture.detectChanges();
  return fixture;
}

function person(id: number, isAdmin = false): User & { token: string } {
  return { id, username: `u${id}`, email: null, isAdmin, token: 't' };
}

// An "Actions" column with no action in any row is a blank strip down the side of the
// table, which is what a logged-out visitor used to get.
describe('CabbingoBoards actions column', () => {
  afterEach(() => TestBed.inject(SessionService).setUser(null));

  const headers = (fixture: ComponentFixture<CabbingoBoards>) =>
    Array.from(fixture.nativeElement.querySelectorAll('thead th')).map((th) => (th as HTMLElement).innerText.trim());

  it('is hidden from a logged-out visitor', async () => {
    const fixture = await render([summary(1, 7)], null);
    expect(headers(fixture)).toEqual(['Bingo', 'Created by', 'Dates']);
    expect(fixture.nativeElement.querySelectorAll('tbody tr:first-child td').length).toBe(3);
  });

  it('is hidden from a signed-in user who owns none of the boards', async () => {
    const fixture = await render([summary(1, 7)], person(9));
    expect(headers(fixture)).toEqual(['Bingo', 'Created by', 'Dates']);
  });

  it('is shown to the owner of one of the boards', async () => {
    const fixture = await render([summary(1, 9)], person(9));
    expect(headers(fixture)).toEqual(['Bingo', 'Created by', 'Dates', 'Actions']);
    expect(fixture.nativeElement.querySelectorAll('tbody tr:first-child td').length).toBe(4);
  });

  it('is shown to an admin', async () => {
    const fixture = await render([summary(1, 7)], person(9, true));
    expect(headers(fixture)).toEqual(['Bingo', 'Created by', 'Dates', 'Actions']);
  });

  // Header and cells are decided per section, so one table having actions must not add an
  // empty column to the other.
  it('decides per table, so the archive can differ from the active list', async () => {
    const fixture = await render([summary(1, 9), summary(2, 7, true)], person(9));
    const tables = Array.from(fixture.nativeElement.querySelectorAll('table')) as HTMLElement[];
    expect(tables.length).toBe(2);
    expect(tables[0].querySelectorAll('thead th').length).toBe(4); // active: owned
    expect(tables[1].querySelectorAll('thead th').length).toBe(3); // archive: not owned
    expect(tables[1].querySelectorAll('tbody tr:first-child td').length).toBe(3);
  });

  // The column can appear while an individual row still has nothing to offer.
  it('leaves the cell empty for a row the user cannot manage', async () => {
    const fixture = await render([summary(1, 9), summary(2, 7)], person(9));
    const rows = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[];
    // Newest first: board 2 (not owned) then board 1 (owned).
    expect(rows[0].querySelectorAll('td')[3].innerText.trim()).toBe('');
    expect(rows[1].querySelectorAll('td')[3].innerText.trim()).toBe('Settings');
  });
});
