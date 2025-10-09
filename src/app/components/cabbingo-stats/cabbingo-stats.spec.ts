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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
