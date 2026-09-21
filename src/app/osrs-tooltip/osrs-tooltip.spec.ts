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

  afterEach(() => component.onMouseLeave());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // The box is `position: fixed` and was offset by +10 unconditionally, so a tile on the
  // right-hand edge of the board pushed its label off the screen where it could not be read.
  it('keeps the tooltip on screen when anchored at the right edge', () => {
    component.tooltipText = 'a tile with a deliberately long name that will not fit';
    component.onMouseEnter();
    component.positionAt(window.innerWidth - 8, 20);

    const box = component.tooltipElement.getBoundingClientRect();
    expect(box.right).toBeLessThanOrEqual(window.innerWidth);
    expect(box.left).toBeGreaterThanOrEqual(0);
  });

  it('keeps the tooltip on screen when anchored at the bottom edge', () => {
    component.tooltipText = 'Tile 25';
    component.onMouseEnter();
    component.positionAt(20, window.innerHeight - 8);

    const box = component.tooltipElement.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(box.top).toBeGreaterThanOrEqual(0);
  });

  // No amount of clamping rescues a nowrap box wider than the screen.
  it('wraps a title too long for the viewport rather than running off it', () => {
    component.tooltipText = 'x'.repeat(400);
    component.onMouseEnter();
    component.positionAt(10, 10);

    const box = component.tooltipElement.getBoundingClientRect();
    expect(box.width).toBeLessThanOrEqual(window.innerWidth);
    expect(box.height).toBeGreaterThan(30); // i.e. it took more than one line
  });

  /*
   * The reported bug. A tap fires a compatibility mouseenter/mousemove sequence, so the
   * mouse handlers are a touch path too — the tooltip showed on first tap, hid when you
   * tapped away, and came back on the next tap. Headless chrome always reports itself as
   * hover-capable, so the media query is stubbed.
   */
  describe('on a device with no hover', () => {
    beforeEach(() => {
      const real = window.matchMedia.bind(window);
      spyOn(window, 'matchMedia').and.callFake((q: string) =>
        q === '(hover: none)' ? ({ matches: true } as MediaQueryList) : real(q),
      );
    });

    it('shows nothing for the mouseenter a tap synthesises', () => {
      component.tooltipText = 'Tile 1';
      component.onMouseEnter();
      expect(component.tooltipElement).toBeFalsy();
    });

    it('stays away across tap, tap-elsewhere, tap again', () => {
      component.tooltipText = 'Tile 1';
      component.onMouseEnter();
      component.onMouseMove({ clientX: 10, clientY: 10 } as MouseEvent);
      expect(component.tooltipElement).toBeFalsy();

      component.onMouseLeave(); // tapping outside the tile
      component.onMouseEnter(); // tapping it again
      expect(component.tooltipElement).toBeFalsy();
      expect(document.body.querySelector('[style*="position: fixed"]')).toBeNull();
    });
  });

  it('leaves nothing behind in the body once hidden', () => {
    component.tooltipText = 'Tile 1';
    component.onMouseEnter();
    const element = component.tooltipElement;
    expect(element.parentElement).toBe(document.body);

    component.onMouseLeave();
    expect(element.parentElement).toBeNull();
  });
});
