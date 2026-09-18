import { Component, Input, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-cabbingo-stats',
  imports: [DecimalPipe],
  templateUrl: './cabbingo-stats.html',
  styleUrl: './cabbingo-stats.css'
})
export class CabbingoStats implements OnInit {

  @Input() teams: any[] = [];
  @Input() participants: any[] = [];
  @Input() currentTeam: number = 0;
  @Input() endDatetime: Date = new Date();
  @Input() donations: any[] = [];
  private subscription!: Subscription;
  now: number = Date.now();
  endDateTimemillis: number = 0;
  remainingTime: string = '';
  @Input() prizePool: number = 0;

  ngOnInit() {
    this.setBingoEndCountdown();
  }

  // TempleOSRS sometimes gives a dashed slug (jay-m-e) as the capitalised name; the username reads better then.
  displayName(participant: any): string {
    const capitalised = participant?.player_name_with_capitalization;
    const username = participant?.username ?? '';
    return capitalised && !(capitalised.includes('-') && !username.includes('-')) ? capitalised : username;
  }

  getTeamMvp() {
    const team = this.teams[this.currentTeam];
    const mvp = this.participants.find(p => p.username === team.mvp);
    return mvp ? this.displayName(mvp) : team.mvp;
  }

  private setBingoEndCountdown() {
    if (this.endDatetime) {
      let date = new Date(this.endDatetime);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      this.endDateTimemillis = date.getTime();
      this.updateCountdown();
      this.subscription = interval(1000).subscribe(() => this.updateCountdown());
    }
  }

  private updateCountdown(): void {
    const now = new Date().getTime();
    const target = this.endDateTimemillis;
    const distance = target - now;

    if (distance < 0) {
      this.remainingTime = 'Bingo ended!';
      this.subscription?.unsubscribe();
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    this.remainingTime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
