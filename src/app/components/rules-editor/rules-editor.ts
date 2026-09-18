import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { BULLET, RULE_COLORS, RuleColor } from '../../models/rich-text';
import { RichRules } from '../rich-rules/rich-rules';

// Textarea with formatting buttons (wrap the selection in tags) and a live preview.
@Component({
  selector: 'app-rules-editor',
  imports: [RichRules],
  template: `
    <label class="form-label" [for]="inputId">{{ label }} <small>(one per line)</small></label>
    <div class="d-flex flex-wrap gap-1 mb-1" role="toolbar" [attr.aria-label]="label + ' formatting'">
      @for(c of colors; track c.name){
      <button type="button" class="btn custom-btn btn-sm d-flex align-items-center gap-1" (click)="wrap('[color=' + c.name + ']', '[/color]')">
        <span class="color-swatch" [style.background-color]="c.hex"></span>{{ c.label }}
      </button>
      }
      <button type="button" class="btn custom-btn btn-sm text-decoration-underline" (click)="wrap('[u]', '[/u]')">Underline</button>
      <button type="button" class="btn custom-btn btn-sm text-decoration-line-through" (click)="wrap('[s]', '[/s]')">Strikethrough</button>
      <button type="button" class="btn custom-btn btn-sm" (click)="toggleList()">• List</button>
    </div>
    <textarea #area class="form-control" [id]="inputId" [rows]="rows" [value]="value" (input)="emit(area.value)"></textarea>
    <small>Select text and pick a colour or style. Text without a colour is white.</small>
    @if(value.trim()){
    <div class="rules-preview osrs-border-darker mt-2 p-2" [attr.aria-label]="label + ' preview'">
      <app-rich-rules [rules]="value.split('\\n')"></app-rich-rules>
    </div>
    }
  `,
})
export class RulesEditor {
  @Input() label = 'Rules';
  @Input() inputId = 'rules';
  @Input() rows = 4;
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
  @ViewChild('area', { static: true }) area!: ElementRef<HTMLTextAreaElement>;

  readonly colors = (Object.keys(RULE_COLORS) as RuleColor[]).map((name) => ({
    name,
    hex: RULE_COLORS[name],
    label: name[0].toUpperCase() + name.slice(1),
  }));

  emit(value: string) {
    this.value = value;
    this.valueChange.emit(value);
  }

  // Wraps the selection (or inserts an empty tag pair at the cursor) and keeps the text selected.
  wrap(open: string, close: string) {
    const el = this.area.nativeElement;
    const { selectionStart: a, selectionEnd: b, value } = el;
    this.emit(value.slice(0, a) + open + value.slice(a, b) + close + value.slice(b));
    el.value = this.value;
    el.focus();
    el.setSelectionRange(a + open.length, b + open.length);
  }

  // Adds "* " to every selected line, or removes it when all of them already have it.
  toggleList() {
    const el = this.area.nativeElement;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const start = value.lastIndexOf('\n', a - 1) + 1;
    const endBreak = value.indexOf('\n', b);
    const end = endBreak === -1 ? value.length : endBreak;
    const lines = value.slice(start, end).split('\n');
    const allBullets = lines.every((l) => BULLET.test(l));
    const changed = lines.map((l) => (allBullets ? l.replace(BULLET, '') : BULLET.test(l) ? l : '* ' + l)).join('\n');
    this.emit(value.slice(0, start) + changed + value.slice(end));
    el.value = this.value;
    el.focus();
    el.setSelectionRange(start, start + changed.length);
  }
}
