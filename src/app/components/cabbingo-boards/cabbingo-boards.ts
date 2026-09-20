import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BoardSummary, DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';
import { InfoPopout } from '../info-popout/info-popout';

@Component({
  selector: 'app-cabbingo-boards',
  imports: [DatePipe, RouterModule, InfoPopout],
  templateUrl: './cabbingo-boards.html',
})
export class CabbingoBoards implements OnInit {
  boards?: BoardSummary[];
  errorMessage = '';

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.databaseService.listBoards().subscribe({
      next: (boards) => (this.boards = boards),
      error: () => (this.errorMessage = 'Could not load boards, please try again later.'),
    });
  }

  get sections() {
    const boards = this.boards ?? [];
    const active = boards.filter((b) => !b.archived).reverse();
    const archive = boards.filter((b) => b.archived);
    // Only worth an Actions column if some row in that table actually gets a link; a
    // logged-out visitor was seeing an empty strip down the side of every table.
    const hasActions = (list: BoardSummary[]) => list.some((b) => this.sessionService.canManage(b));
    return [
      { title: 'Active bingos', empty: 'No bingos are running right now.', boards: active, hasActions: hasActions(active) },
      { title: 'Archive', empty: 'No finished bingos yet.', boards: archive, hasActions: hasActions(archive) },
    ];
  }
}
