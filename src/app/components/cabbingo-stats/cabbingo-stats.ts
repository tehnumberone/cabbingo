import { Component, Input, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
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
  prizePool: number = 0;
  buyinCost : number = 3;

  ngOnInit() {
    if (this.endDatetime) {
      let date = new Date(this.endDatetime);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      console.log(date);
      this.endDateTimemillis = date.getTime();
      this.updateCountdown();
      this.subscription = interval(1000).subscribe(() => this.updateCountdown());
    }
    for (let donation of this.donations) {
      this.prizePool += donation.amount;
    }
    this.prizePool += this.participants.length * this.buyinCost;
    this.prizePool *= 1000000; // convert to millions
  }

  private updateCountdown(): void {
    const now = new Date().getTime();
    const target = this.endDateTimemillis;
    const distance = target - now;

    if (distance < 0) {
      this.remainingTime = 'Expired';
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
