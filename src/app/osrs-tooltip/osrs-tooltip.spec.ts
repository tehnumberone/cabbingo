import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OsrsTooltip } from './osrs-tooltip';

describe('OsrsTooltip', () => {
  let component: OsrsTooltip;
  let fixture: ComponentFixture<OsrsTooltip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OsrsTooltip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OsrsTooltip);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
