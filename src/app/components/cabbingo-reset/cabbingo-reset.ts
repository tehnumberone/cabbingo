import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DatabaseService } from '../../services/database.service';

// Opened from the link in the reset email: /reset?token=...
@Component({
  selector: 'app-cabbingo-reset',
  imports: [FormsModule, RouterModule],
  template: `
    <div class="page-wrap">
      <div class="banner"></div>
      <div class="d-flex justify-content-center">
        <div class="osrs-border-thick-login px-5 py-4 mb-5" style="width:500px; max-width:100%;">
          <h2>Choose a new password</h2>
          @if(!token){
          <p>This link is missing its code. Ask for a new reset email from the log in page.</p>
          <a class="btn custom-btn" [routerLink]="['/login']">Log in</a>
          } @else if(done){
          <p class="text-success" role="status">Your password has been changed. You are signed out everywhere, so log in again.</p>
          <a class="btn custom-btn" [routerLink]="['/login']">Log in</a>
          } @else {
          <form (ngSubmit)="submit()">
            <div class="col-12">
              <label for="password" class="form-label">New password</label>
              <input class="form-control" type="password" id="password" name="password" autocomplete="new-password" required
                [class.is-invalid]="errorMessage !== ''" [(ngModel)]="password" />
              <small>At least 8 characters. Do not use your RuneScape or Jagex password.</small>
            </div>
            @if(errorMessage){
            <div class="text-danger mt-2" role="alert">{{ errorMessage }}</div>
            }
            <div class="d-flex justify-content-between gap-2 mt-3">
              <button class="btn custom-btn" type="submit" [disabled]="busy">Change password</button>
              <a class="btn custom-btn" [routerLink]="['']">All boards</a>
            </div>
          </form>
          }
        </div>
      </div>
    </div>
  `,
})
export class CabbingoReset implements OnInit {
  token = '';
  password = '';
  errorMessage = '';
  busy = false;
  done = false;

  constructor(
    private databaseService: DatabaseService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  async submit() {
    this.busy = true;
    this.errorMessage = '';
    try {
      await this.databaseService.resetPassword(this.token, this.password);
      this.done = true;
    } catch (e: any) {
      this.errorMessage = e?.error?.error ?? 'Something went wrong, please try again.';
    }
    this.busy = false;
  }
}
