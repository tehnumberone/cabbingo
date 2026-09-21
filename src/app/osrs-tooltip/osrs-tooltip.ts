import { Component, HostListener, Input, Renderer2 } from '@angular/core';

const CURSOR_GAP = 10; // offset from the cursor or the tile's corner
const EDGE = 4; // never sit flush against the viewport

@Component({
  selector: 'app-osrs-tooltip',
  imports: [],
  templateUrl: './osrs-tooltip.html',
  styleUrl: './osrs-tooltip.css'
})
export class OsrsTooltip {
  @Input('appCursorTooltip') tooltipText = '';
  tooltipElement!: HTMLElement;

  constructor(private renderer: Renderer2) { }


  /*
   * There is deliberately no touch path. The host element renders empty and zero-sized at
   * the end of the board, so the touch handlers that used to live here listened on nothing
   * a finger could reach — tiles bind mouse and focus events only. The tooltip says
   * "Open <tile>", which tapping the tile already does, so touch needs no substitute.
   */
  @HostListener('mouseenter')
  onMouseEnter() {
    this.showTooltip();
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.positionAt(event.clientX, event.clientY);
  }

  /*
   * Keyboard focus has no cursor to follow, so callers position from the tile's rect.
   * Clamped to the viewport: offsetting by +10 unconditionally ran a tile on the right
   * edge of the board straight off the screen, where the label could not be read.
   */
  positionAt(x: number, y: number) {
    if (!this.tooltipElement) return;
    const box = this.tooltipElement.getBoundingClientRect();
    const fit = (wanted: number, size: number, limit: number) =>
      Math.max(EDGE, Math.min(wanted + CURSOR_GAP, limit - size - EDGE));

    this.renderer.setStyle(this.tooltipElement, 'left', `${fit(x, box.width, window.innerWidth)}px`);
    this.renderer.setStyle(this.tooltipElement, 'top', `${fit(y, box.height, window.innerHeight)}px`);
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.hideTooltip();
  }

  private showTooltip() {
    if (this.tooltipElement) return;
    /*
     * A tap fires a compatibility mouseenter/mousemove sequence, so touch arrives through
     * the mouse handlers too, not just the focus one — the box appeared on the first tap
     * and then hung there, position: fixed, while the page scrolled under it. Guard the
     * single place that creates it so every caller is covered. A touch screen has no
     * cursor to anchor to and nothing to hover away from, and tapping the tile already
     * opens it, so there is nothing for the tooltip to add there.
     */
    if (window.matchMedia('(hover: none)').matches) return;
    const tilePrefix = 'Open ';

    const container = this.renderer.createElement('div');
    const prefixSpan = this.renderer.createElement('span');
    const textSpan = this.renderer.createElement('span');

    this.renderer.appendChild(prefixSpan, this.renderer.createText(tilePrefix));
    this.renderer.appendChild(textSpan, this.renderer.createText(this.tooltipText));

    // Container styles
    this.renderer.setStyle(container, 'font-family', 'Runescape');
    this.renderer.setStyle(container, 'font-size', '18px');
    this.renderer.setStyle(container, 'position', 'fixed');
    this.renderer.setStyle(container, 'background', 'rgb(72, 62, 51, 0.6)');
    this.renderer.setStyle(container, 'border', '1px solid rgb(46, 43, 35, 0.8)');
    this.renderer.setStyle(container, 'padding', '2px 8px');
    this.renderer.setStyle(container, 'border-radius', '4px');
    this.renderer.setStyle(container, 'pointer-events', 'none');
    this.renderer.setStyle(container, 'z-index', '1000');
    this.renderer.setStyle(container, 'display', 'inline-block');
    /*
     * Was `white-space: nowrap`, which no amount of clamping can bring back on screen once
     * a title is wider than the viewport. The cap is measured rather than `100vw`, because
     * vw counts the scrollbar and would still overhang. `anywhere` covers a title with no
     * space in it, which has no wrap opportunity of its own.
     */
    this.renderer.setStyle(container, 'max-width', `${window.innerWidth - EDGE * 2}px`);
    this.renderer.setStyle(container, 'overflow-wrap', 'anywhere');

    // Different colors for prefix and text
    this.renderer.setStyle(prefixSpan, 'color', 'rgba(255, 255, 255, 1)');
    this.renderer.setStyle(textSpan, 'color', 'rgba(0, 255, 255, 1)');

    this.renderer.appendChild(container, prefixSpan);
    this.renderer.appendChild(container, textSpan);

    this.tooltipElement = container;
    this.renderer.appendChild(document.body, this.tooltipElement);
  }

  private hideTooltip() {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null!;
    }
  }
}