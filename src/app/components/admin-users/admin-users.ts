import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminUser, DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

// Admin view of every account, with the admin rights toggle.
@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, RouterModule],
  template: `
    <div class="page-wrap">
      <div class="w-100">
        <div class="d-flex justify-content-center align-items-center w-100 banner">
          <a class="btn button edit-btn" [routerLink]="['']">All boards</a>
          <a class="btn button login-btn" [style.--len]="sessionService.label.length" [routerLink]="['/login']">
            {{ sessionService.label }}
          </a>
        </div>
      </div>
      <div class="d-flex justify-content-center">
        <div class="osrs-border-thick-login px-5 py-4 mb-5 d-flex flex-column gap-3" style="width:900px; max-width:100%;">
          <h2 class="m-0">Accounts</h2>
          @if(!sessionService.user?.isAdmin){
          <p class="m-0">Only admins can see the account list.</p>
          } @else if(errorMessage && !users){
          <p class="text-danger m-0" role="alert">{{ errorMessage }}</p>
          } @else if(!users){
          <p class="m-0">Loading accounts...</p>
          } @else {
          <p class="m-0">
            {{ users.length }} account{{ users.length === 1 ? '' : 's' }}. Admins can edit and delete every bingo. Deleting an account
            also removes its claimed names; an account that still owns bingos has to lose those first.
          </p>
          @if(errorMessage){
          <p class="text-danger m-0" role="alert">{{ errorMessage }}</p>
          }
          <div class="overflow-auto">
            <table class="table osrs-table table-bordered m-0 align-middle">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Email</th>
                  <th>RuneScape names</th>
                  <th>Bingos</th>
                  <th>Admin</th>
                  <th><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for(user of users; track user.id){
                <tr>
                  <td>{{ user.username }}</td>
                  <td>{{ user.email || 'No email' }}</td>
                  <td>{{ user.rsns }}</td>
                  <td>{{ user.boards }}</td>
                  <td>{{ user.isAdmin ? 'Yes' : 'No' }}</td>
                  <td>
                    @if(user.id === sessionService.user!.id){
                    <small>That is you</small>
                    } @else if(deleting === user){
                    <div class="d-flex flex-column gap-1">
                      <label [for]="'confirm' + user.id">Type <strong>{{ user.username }}</strong> to confirm</label>
                      <input class="form-control" autocomplete="off" [id]="'confirm' + user.id" [(ngModel)]="confirmation" />
                      <div class="d-flex gap-1">
                        <button class="btn custom-btn text-danger" type="button" [disabled]="confirmation !== user.username"
                          (click)="remove(user)">Delete permanently</button>
                        <button class="btn custom-btn" type="button" (click)="deleting = undefined; confirmation = ''">Cancel</button>
                      </div>
                    </div>
                    } @else {
                    <div class="d-flex gap-1 flex-wrap">
                      <button class="btn custom-btn" type="button" [disabled]="saving[user.id]" (click)="toggleAdmin(user)">
                        {{ saving[user.id] ? 'Saving...' : user.isAdmin ? 'Remove admin' : 'Make admin' }}
                      </button>
                      <button class="btn custom-btn text-danger" type="button" (click)="startDelete(user)">Delete</button>
                    </div>
                    }
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class AdminUsers implements OnInit {
  users?: AdminUser[];
  errorMessage = '';
  saving: Record<number, boolean> = {};
  deleting?: AdminUser;
  confirmation = '';

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.sessionService.user?.isAdmin) return;
    this.databaseService.adminUsers().subscribe({
      next: (users) => (this.users = users),
      error: () => (this.errorMessage = 'Could not load accounts, please try again later.'),
    });
  }

  startDelete(user: AdminUser) {
    this.deleting = user;
    this.confirmation = '';
    this.errorMessage = '';
  }

  // Accounts that still own bingos are refused by the worker, so those get deleted or handed over first.
  remove(user: AdminUser) {
    if (this.confirmation !== user.username) return;
    this.errorMessage = '';
    this.databaseService.deleteUser(user.id, this.confirmation).subscribe({
      next: () => {
        this.users = this.users?.filter((u) => u !== user);
        this.deleting = undefined;
        this.confirmation = '';
      },
      error: (e) => (this.errorMessage = e?.error?.error ?? 'Could not delete that account, please try again.'),
    });
  }

  toggleAdmin(user: AdminUser) {
    const makeAdmin = !user.isAdmin;
    const question = makeAdmin
      ? `Make ${user.username} an admin? They can then edit and delete every bingo.`
      : `Remove admin rights from ${user.username}?`;
    if (!confirm(question)) return;
    this.errorMessage = '';
    this.saving[user.id] = true;
    this.databaseService.setAdmin(user.id, makeAdmin).subscribe({
      next: () => {
        user.isAdmin = makeAdmin ? 1 : 0;
        this.saving[user.id] = false;
      },
      error: (e) => {
        this.saving[user.id] = false;
        this.errorMessage = e?.error?.error ?? 'Could not change admin rights, please try again.';
      },
    });
  }
}
