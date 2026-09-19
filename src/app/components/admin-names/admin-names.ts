import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

interface ClaimedName {
  id: number;
  name: string;
  username: string;
  email: string | null;
}

// Admin view of every claimed RuneScape name, so a name claimed by the wrong person can be removed.
@Component({
  selector: 'app-admin-names',
  imports: [RouterModule],
  template: `
    <div class="page-wrap">
      <div class="w-100">
        <div class="d-flex justify-content-center align-items-center w-100 banner">
          <a class="btn button edit-btn" [routerLink]="['']">All boards</a>
          <a class="btn button login-btn" [routerLink]="['/login']">
            {{ sessionService.user ? sessionService.user.username + (sessionService.user.isAdmin ? ' (admin)' : '') : 'Log in / Register' }}
          </a>
        </div>
      </div>
      <div class="d-flex justify-content-center">
        <div class="osrs-border-thick-login px-5 py-4 mb-5 d-flex flex-column gap-3" style="width:900px; max-width:100%;">
          <h2 class="m-0">Claimed RuneScape names</h2>
          @if(!sessionService.user?.isAdmin){
          <p class="m-0">Only admins can manage claimed names.</p>
          } @else if(errorMessage && !names){
          <p class="text-danger m-0" role="alert">{{ errorMessage }}</p>
          } @else if(!names){
          <p class="m-0">Loading names...</p>
          } @else {
          <p class="m-0">
            Anyone can claim a name, so check this list if someone claims a name that is not theirs. Removing a name also takes away
            any captain spot it gave them.
          </p>
          @if(errorMessage){
          <p class="text-danger m-0" role="alert">{{ errorMessage }}</p>
          }
          @if(names.length){
          <div class="overflow-auto">
            <table class="table osrs-table table-bordered m-0 align-middle">
              <thead>
                <tr>
                  <th>RuneScape name</th>
                  <th>Account</th>
                  <th>Email</th>
                  <th><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for(claim of names; track claim.id){
                <tr>
                  <td>{{ claim.name }}</td>
                  <td>{{ claim.username }}</td>
                  <td>{{ claim.email || 'No email' }}</td>
                  <td>
                    <button class="btn custom-btn text-danger" type="button" [disabled]="removing[claim.id]" (click)="remove(claim)">
                      {{ removing[claim.id] ? 'Removing...' : 'Remove' }}
                    </button>
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
          } @else {
          <p class="m-0">No names claimed yet.</p>
          }
          }
        </div>
      </div>
    </div>
  `,
})
export class AdminNames implements OnInit {
  names?: ClaimedName[];
  errorMessage = '';
  removing: Record<number, boolean> = {};

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.sessionService.user?.isAdmin) return;
    this.databaseService.adminRsns().subscribe({
      next: (names) => (this.names = names),
      error: () => (this.errorMessage = 'Could not load claimed names, please try again later.'),
    });
  }

  remove(claim: ClaimedName) {
    if (!confirm(`Remove "${claim.name}" from ${claim.username}? They lose any captain spot it gave them.`)) return;
    this.errorMessage = '';
    this.removing[claim.id] = true;
    this.databaseService.deleteRsn(claim.id).subscribe({
      next: () => (this.names = this.names?.filter((n) => n !== claim)),
      error: (e) => {
        this.removing[claim.id] = false;
        this.errorMessage = e?.error?.error ?? 'Removing failed, please try again.';
      },
    });
  }
}
