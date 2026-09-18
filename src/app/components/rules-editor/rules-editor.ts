import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { RULE_COLORS, RuleColor, addBullet, isBullet, stripBullet, stripTags } from '../../models/rich-text';
import { RichRules } from '../rich-rules/rich-rules';

const ANY_COLOR_OPEN = /\[color=\w+\]$/;

// Textarea with formatting buttons (each one toggles) and a live preview.
@Component({
  selector: 'app-rules-editor',
  imports: [RichRules],
  template: `
    <label class="form-label" [for]="inputId">{{ label }} <small>(one per line)</small></label>
    <div class="d-flex flex-wrap gap-1 mb-1" role="toolbar" [attr.aria-label]="label + ' formatting'">
      @for(c of colors; track c.name){
      <button type="button" class="btn custom-btn btn-sm d-flex align-items-center gap-1" [attr.aria-pressed]="isApplied('[color=' + c.name + ']', '[/color]')"
        (click)="toggle('[color=' + c.name + ']', '[/color]')">
        <span class="color-swatch" [style.background-color]="c.hex"></span>{{ c.label }}
      </button>
      }
      <button type="button" class="btn custom-btn btn-sm text-decoration-underline" [attr.aria-pressed]="isApplied('[u]', '[/u]')"
        (click)="toggle('[u]', '[/u]')">Underline</button>
      <button type="button" class="btn custom-btn btn-sm text-decoration-line-through" [attr.aria-pressed]="isApplied('[s]', '[/s]')"
        (click)="toggle('[s]', '[/s]')">Strikethrough</button>
      <button type="button" class="btn custom-btn btn-sm" (click)="toggleList()">• List</button>
      <button type="button" class="btn custom-btn btn-sm" (click)="clearFormatting()">Clear formatting</button>
    </div>
    <textarea #area class="form-control" [id]="inputId" [rows]="rows" [value]="value" (input)="emit(area.value)"></textarea>
    <small>Select text and pick a colour or style; pressing the same button again removes it. Text without a colour is white.</small>
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

  // True when the selection already carries this exact tag, so the button can show as pressed.
  isApplied(open: string, close: string): boolean {
    const el = this.area?.nativeElement;
    if (!el) return false;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const selection = value.slice(a, b);
    return value.slice(0, a).endsWith(open) && value.slice(b).startsWith(close)
      ? true
      : selection.startsWith(open) && selection.endsWith(close);
  }

  // Adds the tag around the selection, removes it when it is already there, and swaps one colour for another.
  toggle(open: string, close: string) {
    const el = this.area.nativeElement;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const before = value.slice(0, a);
    const selection = value.slice(a, b);
    const after = value.slice(b);
    const isColor = open.startsWith('[color=');
    const wrapping = isColor ? before.match(ANY_COLOR_OPEN)?.[0] : before.endsWith(open) ? open : undefined;

    if (wrapping && after.startsWith(close)) {
      if (wrapping === open) {
        this.replace(before.slice(0, -wrapping.length) + selection + after.slice(close.length), a - wrapping.length, b - wrapping.length);
      } else {
        // different colour on the same text: swap the opening tag
        const shift = open.length - wrapping.length;
        this.replace(before.slice(0, -wrapping.length) + open + selection + after, a + shift, b + shift);
      }
      return;
    }
    const insideSelection = isColor ? ANY_COLOR_OPEN.test(selection.split(']')[0] + ']') && selection.endsWith(close) : selection.startsWith(open) && selection.endsWith(close);
    if (insideSelection) {
      const openTag = isColor ? selection.slice(0, selection.indexOf(']') + 1) : open;
      const inner = selection.slice(openTag.length, selection.length - close.length);
      if (openTag === open) return this.replace(before + inner + after, a, a + inner.length);
      return this.replace(before + open + inner + close + after, a, a + open.length + inner.length + close.length);
    }
    this.replace(before + open + selection + close + after, a + open.length, b + open.length);
  }

  // Adds "* " to every selected line, or removes it when all of them already have it.
  toggleList() {
    const el = this.area.nativeElement;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const [start, end] = this.lineRange(value, a, b);
    const lines = value.slice(start, end).split('\n');
    const allBullets = lines.every((l) => isBullet(l));
    const changed = lines.map((l) => (allBullets ? stripBullet(l) : isBullet(l) ? l : addBullet(l))).join('\n');
    this.replace(value.slice(0, start) + changed + value.slice(end), start, start + changed.length);
  }

  // Removes every tag from the selection, or from the current line when nothing is selected.
  clearFormatting() {
    const el = this.area.nativeElement;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const [start, end] = a === b ? this.lineRange(value, a, b) : [a, b];
    const cleaned = stripTags(value.slice(start, end));
    this.replace(value.slice(0, start) + cleaned + value.slice(end), start, start + cleaned.length);
  }

  private lineRange(value: string, a: number, b: number): [number, number] {
    const start = value.lastIndexOf('\n', a - 1) + 1;
    const end = value.indexOf('\n', b);
    return [start, end === -1 ? value.length : end];
  }

  private replace(next: string, selectionStart: number, selectionEnd: number) {
    const el = this.area.nativeElement;
    this.emit(next);
    el.value = next;
    el.focus();
    el.setSelectionRange(selectionStart, selectionEnd);
  }
}
