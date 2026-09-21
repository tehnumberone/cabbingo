import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CabbingoEditBoard } from './cabbingo-edit-board';

describe('CabbingoEditBoard', () => {
  let component: CabbingoEditBoard;
  let fixture: ComponentFixture<CabbingoEditBoard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CabbingoEditBoard],
      // No ?board= query param, so ngOnInit redirects home and never hits the network.
      providers: [provideRouter([]), provideHttpClient()],
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
