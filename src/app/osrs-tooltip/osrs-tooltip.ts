import { Component, ElementRef, HostListener, Input, Renderer2 } from '@angular/core';

@Component({
  selector: 'app-osrs-tooltip',
  imports: [],
  templateUrl: './osrs-tooltip.html',
  styleUrl: './osrs-tooltip.css'
})
export class OsrsTooltip {
  @Input('appCursorTooltip') tooltipText = '';
  tooltipElement!: HTMLElement;

  constructor(private renderer: Renderer2) {}

  @HostListener('mouseenter')
  onMouseEnter() {
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
    this.renderer.setStyle(container, 'white-space', 'nowrap');

    // Different colors for prefix and text
    this.renderer.setStyle(prefixSpan, 'color', 'rgba(255, 255, 255, 1)');
    this.renderer.setStyle(textSpan, 'color', 'rgba(0, 255, 255, 1)');

    this.renderer.appendChild(container, prefixSpan);
    this.renderer.appendChild(container, textSpan);

    this.tooltipElement = container;
    this.renderer.appendChild(document.body, this.tooltipElement);
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.tooltipElement) {
      this.renderer.setStyle(this.tooltipElement, 'top', `${event.clientY + 10}px`);
      this.renderer.setStyle(this.tooltipElement, 'left', `${event.clientX + 10}px`);
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null!;
    }
  }
}