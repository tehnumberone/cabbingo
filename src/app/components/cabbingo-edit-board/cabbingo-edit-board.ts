import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { Board, Progress, Tile, emptyProgress } from '../../models/bingo';
import { DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

@Component({
  selector: 'app-cabbingo-edit-board',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cabbingo-edit-board.html',
  styleUrl: './cabbingo-edit-board.css',
})
export class CabbingoEditBoard implements OnInit {
  board?: Board;
  progress: Record<string, Record<string, Progress>> = {};
  selectedTeam = '';
  password = '';
  errorMessage = '';
  edits: Record<string, { obtained: number; completed: boolean; status?: string }> = {};

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.databaseService
      .resolveBoardId(this.route.snapshot.queryParamMap.get('board'))
      .pipe(
        filter((id): id is number => !!id),
        switchMap((id) => this.databaseService.getBoard(id))
      )
      .subscribe(({ board, progress }) => {
        this.board = board;
        this.progress = progress;
        if (this.loggedIn) this.loadEdits();
      });
  }

  get loggedIn(): boolean {
    return !!this.board && this.sessionService.team?.boardId === this.board.id;
  }

  get teamName(): string {
    return this.board?.teams.find((t) => t.id === this.sessionService.team?.teamId)?.name ?? '';
  }

  private loadEdits() {
    const teamProgress = this.progress[this.sessionService.team!.teamId] ?? {};
    this.edits = {};
    for (const tile of this.board!.tiles) {
      const p = teamProgress[tile.id]?.front;
      this.edits[tile.id] = {
        obtained: (p?.obtained ?? []).reduce((sum, o) => sum + (Number(o.obtained) || 0), 0),
        completed: !!p?.completed,
      };
    }
  }

  async login() {
    if (!this.board || !this.selectedTeam) return;
    const error = await this.databaseService.teamLogin(this.board.id!, this.selectedTeam, this.password);
    this.errorMessage = error ?? '';
    if (!error) this.loadEdits();
  }

  saveTile(tile: Tile) {
    const teamId = this.sessionService.team!.teamId;
    const edit = this.edits[tile.id];
    const prev = this.progress[teamId]?.[tile.id] ?? emptyProgress();
    // ponytail: collapses per-item breakdown into one "Obtained" count; per-item editing comes with the board editor
    const next: Progress = { ...prev, front: { obtained: [{ name: 'Obtained', obtained: edit.obtained }], completed: edit.completed } };
    edit.status = 'Saving...';
    this.databaseService.updateProgress(this.board!.id!, teamId, tile.id, next).subscribe({
      next: () => {
        (this.progress[teamId] ??= {})[tile.id] = next;
        edit.status = 'Saved';
      },
      error: (e) => (edit.status = e?.error?.error ?? 'Save failed'),
    });
  }

  logout() {
    this.sessionService.logout();
    this.password = '';
    this.errorMessage = '';
  }
}
