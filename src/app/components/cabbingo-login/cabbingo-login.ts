import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

@Component({
  selector: 'app-cabbingo-login',
  imports: [FormsModule, RouterModule],
  templateUrl: './cabbingo-login.html',
})
export class CabbingoLogin {
  mode: 'login' | 'register' = 'login';
  username = '';
  password = '';
  errorMessage = '';
  busy = false;

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    private router: Router
  ) { }

  async submit() {
    this.busy = true;
    this.errorMessage = (await this.databaseService.account(this.mode, this.username, this.password)) ?? '';
    this.busy = false;
    if (!this.errorMessage) this.router.navigate(['']);
  }

  switchMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.errorMessage = '';
  }

  logout() {
    this.databaseService.logoutUser();
    this.password = '';
  }
}
