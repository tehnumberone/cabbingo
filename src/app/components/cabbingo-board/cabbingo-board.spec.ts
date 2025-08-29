import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CabbingoBoard } from './cabbingo-board';

describe('CabbingoBoard', () => {
  let component: CabbingoBoard;
  let fixture: ComponentFixture<CabbingoBoard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CabbingoBoard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CabbingoBoard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
