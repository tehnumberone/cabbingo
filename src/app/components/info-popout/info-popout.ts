import { Component, Input } from '@angular/core';

let nextId = 0;

// Small info icon that opens a native popover (closes on outside click and Esc).
@Component({
  selector: 'app-info-popout',
  template: `
    <button type="button" class="info-btn" [attr.popovertarget]="id" [attr.aria-label]="'About ' + title">
      <img src="assets/info.png" alt="" width="16" height="16" />
    </button>
    <div popover class="info-popout osrs-border-thick-login p-4" [id]="id">
      <h3>{{ title }}</h3>
      <p class="m-0">{{ text }}</p>
    </div>
  `,
})
export class InfoPopout {
  @Input() title = '';
  @Input() text = '';
  readonly id = `info-popout-${++nextId}`;
}
