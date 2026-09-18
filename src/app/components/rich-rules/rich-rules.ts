import { Component, Input } from '@angular/core';
import { RULE_COLORS, RuleBlock, Segment, parseRules } from '../../models/rich-text';

// Renders formatted rules as text nodes; see models/rich-text.ts for the markup.
@Component({
  selector: 'app-rich-rules',
  template: `
    @for(block of blocks; track $index){
      @if(block.list){
      <ul class="rich-rules-list">
        @for(line of block.lines; track $index){
        <li>@for(seg of line; track $index){<span [style.color]="color(seg)" [style.text-decoration-line]="decoration(seg)">{{ seg.text }}</span>}</li>
        }
      </ul>
      } @else {
        @for(line of block.lines; track $index){
        <div>@for(seg of line; track $index){<span [style.color]="color(seg)" [style.text-decoration-line]="decoration(seg)">{{ seg.text }}</span>}</div>
        }
      }
    }
  `,
})
export class RichRules {
  blocks: RuleBlock[] = [];

  @Input() set rules(rules: string[] | undefined) {
    this.blocks = parseRules(rules ?? []);
  }

  color(seg: Segment): string | null {
    return seg.color ? RULE_COLORS[seg.color] : null;
  }

  decoration(seg: Segment): string | null {
    return [seg.underline && 'underline', seg.strike && 'line-through'].filter(Boolean).join(' ') || null;
  }
}
