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
        this.selectTeam(this.teams[0]?.id ?? '');
      });
  }

  get teams() {
    return this.sessionService.editableTeams(this.board);
  }

  selectTeam(teamId: string) {
    this.selectedTeam = teamId;
    const teamProgress = this.progress[teamId] ?? {};
    this.edits = {};
    for (const tile of this.board?.tiles ?? []) {
      const p = teamProgress[tile.id]?.front;
      this.edits[tile.id] = {
        obtained: (p?.obtained ?? []).reduce((sum, o) => sum + (Number(o.obtained) || 0), 0),
        completed: !!p?.completed,
      };
    }
  }

  saveTile(tile: Tile) {
    const teamId = this.selectedTeam;
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
}
