import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CabbingoStats } from './cabbingo-stats';

describe('CabbingoStats', () => {
  let component: CabbingoStats;
  let fixture: ComponentFixture<CabbingoStats>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CabbingoStats]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CabbingoStats);
    component = fixture.componentInstance;
    // The board only renders stats once templeTeams[currentTeam] exists, and the template
    // reads teams[currentTeam].members unguarded, so the test has to supply a team too.
    component.teams = [{ members: [] }];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
