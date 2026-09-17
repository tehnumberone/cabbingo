import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  // obtained: single total; counts: per tracked item (tiles with items)
  edits: Record<string, { obtained: number; counts: Record<string, number>; completed: boolean; status?: string }> = {};

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const id = Number(this.route.snapshot.queryParamMap.get('board'));
    if (!id) {
      this.router.navigate(['']);
      return;
    }
    this.databaseService.getBoard(id).subscribe(({ board, progress }) => {
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
        counts: Object.fromEntries((p?.obtained ?? []).map((o) => [o.name, Number(o.obtained) || 0])),
        completed: !!p?.completed,
      };
    }
  }

  total(tile: Tile): number {
    const counts = this.edits[tile.id].counts;
    return (tile.items ?? []).reduce((sum, name) => sum + (Number(counts[name]) || 0), 0);
  }

  saveTile(tile: Tile) {
    const teamId = this.selectedTeam;
    const edit = this.edits[tile.id];
    const prev = this.progress[teamId]?.[tile.id] ?? emptyProgress();
    const obtained = tile.items?.length
      ? tile.items.map((name) => ({ name, obtained: Number(edit.counts[name]) || 0 }))
      : [{ name: 'Obtained', obtained: Number(edit.obtained) || 0 }];
    const next: Progress = { ...prev, front: { obtained, completed: edit.completed } };
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
