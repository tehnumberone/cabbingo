import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BoardSummary, DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

@Component({
  selector: 'app-cabbingo-boards',
  imports: [DatePipe, RouterModule],
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
    return [
      { title: 'Active bingos', empty: 'No bingos are running right now.', boards: boards.filter((b) => !b.archived).reverse() },
      { title: 'Archive', empty: 'No finished bingos yet.', boards: boards.filter((b) => b.archived) },
    ];
  }

  // The list only has the owner's username; the board settings page re-checks with the owner id.
  canManage(board: BoardSummary): boolean {
    const user = this.sessionService.user;
    return !!user && (user.isAdmin || user.username.toLowerCase() === board.owner.toLowerCase());
  }
}
