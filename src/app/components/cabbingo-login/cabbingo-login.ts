import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { Rsn, SessionService } from '../../services/session-service';

@Component({
  selector: 'app-cabbingo-login',
  imports: [FormsModule, RouterModule],
  templateUrl: './cabbingo-login.html',
})
export class CabbingoLogin implements OnInit {
  mode: 'login' | 'register' | 'forgot' = 'login';
  username = '';
  email = '';
  password = '';
  errorMessage = '';
  status = '';
  busy = false;

  // account page
  rsns: Rsn[] = [];
  newRsn = '';
  editingRsn?: Rsn;
  editedName = '';
  accountEmail = '';
  accountPassword = '';
  accountError = '';
  accountStatus = '';

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (this.sessionService.user) this.loadAccount();
  }

  private loadAccount() {
    this.databaseService.me().subscribe(({ user }) => {
      this.rsns = user?.rsns ?? [];
      this.accountEmail = user?.email ?? '';
    });
  }

  async submit() {
    this.busy = true;
    this.errorMessage = '';
    this.status = '';
    if (this.mode === 'forgot') {
      await this.databaseService.forgotPassword(this.email).catch(() => { });
      // Same answer either way, so nobody can use this to find out which addresses have an account.
      this.status = 'If that email address has an account, a reset link is on its way. The link works for 15 minutes.';
      this.busy = false;
      return;
    }
    this.errorMessage = (await this.databaseService.account(this.mode, this.username, this.password, this.email)) ?? '';
    this.busy = false;
    if (!this.errorMessage) this.router.navigate(['']);
  }

  switchMode(mode: 'login' | 'register' | 'forgot') {
    this.mode = mode;
    this.errorMessage = '';
    this.status = '';
  }

  logout() {
    this.databaseService.logoutUser();
    this.password = '';
    this.rsns = [];
  }

  saveEmail() {
    this.accountError = '';
    this.accountStatus = '';
    this.databaseService.setEmail(this.accountEmail, this.accountPassword).subscribe({
      next: () => {
        this.accountStatus = 'Email saved.';
        this.accountPassword = '';
        if (this.sessionService.user) this.sessionService.setUser({ ...this.sessionService.user, email: this.accountEmail });
      },
      error: (e) => (this.accountError = e?.error?.error ?? 'Could not save your email, please try again.'),
    });
  }

  addRsn() {
    const name = this.newRsn.trim();
    if (!name) return;
    this.accountError = '';
    this.databaseService.addRsn(name).subscribe({
      next: (rsn) => {
        this.rsns = [...this.rsns, rsn].sort((a, b) => a.name.localeCompare(b.name));
        this.newRsn = '';
      },
      error: (e) => (this.accountError = e?.error?.error ?? 'Could not add that name, please try again.'),
    });
  }

  startEdit(rsn: Rsn) {
    this.editingRsn = rsn;
    this.editedName = rsn.name;
    this.accountError = '';
  }

  saveEdit() {
    const rsn = this.editingRsn!;
    this.databaseService.renameRsn(rsn.id, this.editedName.trim()).subscribe({
      next: (updated) => {
        rsn.name = updated.name;
        this.editingRsn = undefined;
      },
      error: (e) => (this.accountError = e?.error?.error ?? 'Could not rename that name, please try again.'),
    });
  }

  removeRsn(rsn: Rsn) {
    if (!confirm(`Remove "${rsn.name}" from your account? You lose any captain spot it gave you.`)) return;
    this.accountError = '';
    this.databaseService.deleteRsn(rsn.id).subscribe({
      next: () => (this.rsns = this.rsns.filter((r) => r !== rsn)),
      error: (e) => (this.accountError = e?.error?.error ?? 'Could not remove that name, please try again.'),
    });
  }
}
