import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CabbingoEditBoard } from './cabbingo-edit-board';

describe('CabbingoEditBoard', () => {
  let component: CabbingoEditBoard;
  let fixture: ComponentFixture<CabbingoEditBoard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CabbingoEditBoard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CabbingoEditBoard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
