import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Board, Progress, SideProgress, Tile, TileSide, emptyProgress, isEnded, sideDone } from '../../models/bingo';
import { DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

interface SideEdit {
  obtained: number;
  counts: Record<string, number>;
  completed: boolean;
}

const toEdit = (p?: SideProgress): SideEdit => ({
  obtained: (p?.obtained ?? []).reduce((sum, o) => sum + (Number(o.obtained) || 0), 0),
  counts: Object.fromEntries((p?.obtained ?? []).map((o) => [o.name, Number(o.obtained) || 0])),
  completed: !!p?.completed,
});

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
  // one entry per tile side: obtained is a single total, counts is per tracked item
  edits: Record<string, { front: SideEdit; flip: SideEdit; flipped: boolean; status?: string }> = {};

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

  unlocked = false; // admin pressed "Edit archived board" on this visit

  get readOnly(): boolean {
    return this.ended && !this.unlocked;
  }

  get ended(): boolean {
    return !!this.board && isEnded(this.board);
  }

  get teams() {
    return this.sessionService.editableTeams(this.board);
  }

  selectTeam(teamId: string) {
    this.selectedTeam = teamId;
    const teamProgress = this.progress[teamId] ?? {};
    this.edits = {};
    for (const tile of this.board?.tiles ?? []) {
      const p = teamProgress[tile.id];
      this.edits[tile.id] = { front: toEdit(p?.front), flip: toEdit(p?.flip), flipped: !!p?.flipped };
    }
  }

  // The flipped side replaces the front once a tile is flipped.
  side(tile: Tile): TileSide {
    return this.edits[tile.id].flipped && tile.flip ? tile.flip : tile;
  }

  edit(tile: Tile) {
    const e = this.edits[tile.id];
    return e.flipped && tile.flip ? e.flip : e.front;
  }

  total(tile: Tile): number {
    const counts = this.edit(tile).counts;
    return (this.side(tile).items ?? []).reduce((sum, name) => sum + (Number(counts[name]) || 0), 0);
  }

  canFlip(tile: Tile): boolean {
    return !!this.board?.flipEnabled && !!tile.flip && !this.edits[tile.id].flipped && sideDone(tile, this.saved(tile)?.front);
  }

  private saved(tile: Tile): Progress | undefined {
    return this.progress[this.selectedTeam]?.[tile.id];
  }

  // Flipping is a decision, so it saves right away; the worker refuses it unless the front is done.
  flip(tile: Tile) {
    const points = tile.points;
    const cost = this.board!.flipMode === 'all-or-nothing'
      ? `If you do not finish the flipped side you lose all ${points} points for this tile.`
      : `If you do not finish the flipped side you keep the ${points} points.`;
    if (!confirm(`Flip "${tile.title}" to "${tile.flip!.title}"? ${cost} Finishing it is worth ${points * 2}. This cannot be undone.`)) return;
    this.edits[tile.id].flipped = true;
    this.saveTile(tile);
  }

  saveTile(tile: Tile) {
    const teamId = this.selectedTeam;
    const edit = this.edits[tile.id];
    const prev = this.progress[teamId]?.[tile.id] ?? emptyProgress();
    const toSide = (side: TileSide, e: SideEdit): SideProgress => ({
      obtained: side.items?.length
        ? side.items.map((name) => ({ name, obtained: Number(e.counts[name]) || 0 }))
        : [{ name: 'Obtained', obtained: Number(e.obtained) || 0 }],
      completed: e.completed,
    });
    const next: Progress = {
      ...prev,
      front: toSide(tile, edit.front),
      flipped: edit.flipped,
      flip: tile.flip && edit.flipped ? toSide(tile.flip, edit.flip) : prev.flip,
    };
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
