import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, filter, switchMap, timer } from 'rxjs';
import { Board, Progress, Tile, sideDone, tilePoints, totalPoints } from '../../models/bingo';
import { DatabaseService } from '../../services/database.service';
import { TempleOSService } from '../../services/templeos-service';
import { CabbingoStats } from '../cabbingo-stats/cabbingo-stats';
import { OsrsTooltip } from '../../osrs-tooltip/osrs-tooltip';

@Component({
  selector: 'app-cabbingo-board',
  imports: [NgClass, RouterModule, CabbingoStats, OsrsTooltip],
  templateUrl: './cabbingo-board.html',
  styleUrl: '../../../styles.css',
})
export class CabbingoBoard implements OnInit, OnDestroy {
  board?: Board;
  progress: Record<string, Record<string, Progress>> = {};
  currentTeam = 0;
  selectedTile?: Tile;
  bingoRulesOpened = true;
  templeTeams: any[] = [];
  participants: any[] = [];
  info: any = {};
  private subscription?: Subscription;
  @ViewChild(OsrsTooltip) tooltip!: OsrsTooltip;

  constructor(
    private databaseService: DatabaseService,
    private templeOSService: TempleOSService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // ponytail: polls every 30s instead of Firebase's live push
    this.subscription = this.databaseService
      .resolveBoardId(this.route.snapshot.queryParamMap.get('board'))
      .pipe(
        filter((id): id is number => !!id),
        switchMap((id) => timer(0, 30_000).pipe(switchMap(() => this.databaseService.getBoard(id))))
      )
      .subscribe({
        next: ({ board, progress }) => {
          if (!this.board && board.templeosCompetitionId) this.getTempleOSData(board.templeosCompetitionId);
          this.board = board;
          this.progress = progress;
          this.selectedTile = board.tiles.find((t) => t.id === this.selectedTile?.id);
        },
        error: (error) => console.error('Error loading board:', error),
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get rows(): Tile[][] {
    const n = this.board?.size ?? 0;
    return Array.from({ length: n }, (_, r) => this.board!.tiles.slice(r * n, r * n + n));
  }

  get columns(): number[] {
    return Array.from({ length: this.board?.size ?? 0 }, (_, i) => i);
  }

  get team() {
    return this.board?.teams[this.currentTeam];
  }

  get donations() {
    return [...(this.board?.donations ?? [])].sort((a, b) => b.amount - a.amount);
  }

  get prizePool(): number {
    const donated = this.donations.reduce((sum, d) => sum + d.amount, 0);
    return (donated + this.participants.length * (this.board?.buyIn ?? 0)) * 1_000_000;
  }

  tileProgress(tile: Tile): Progress | undefined {
    return this.team && this.progress[this.team.id]?.[tile.id];
  }

  obtained(tile: Tile): number {
    return (this.tileProgress(tile)?.front.obtained ?? []).reduce((sum, o) => sum + (Number(o.obtained) || 0), 0);
  }

  isComplete(tile: Tile): boolean {
    return sideDone(tile, this.tileProgress(tile)?.front);
  }

  progressPercent(tile: Tile): number {
    if (tile.type === 'custom') return this.isComplete(tile) ? 100 : 0;
    return Math.min(100, (this.obtained(tile) / tile.amount) * 100);
  }

  rowComplete(row: number): boolean {
    return this.rows[row].every((t) => this.board && tilePoints(this.board, t, this.tileProgress(t)) > 0);
  }

  columnComplete(col: number): boolean {
    return this.rows.every((row) => this.board && tilePoints(this.board, row[col], this.tileProgress(row[col])) > 0);
  }

  getTotalPoints(): number {
    return this.board && this.team ? totalPoints(this.board, this.progress[this.team.id] ?? {}) : 0;
  }

  onTileClick(tile: Tile): void {
    this.selectedTile = tile;
    this.bingoRulesOpened = false;
  }

  switchTeam(index: number): void {
    this.currentTeam = index;
    this.selectedTile = undefined;
    this.bingoRulesOpened = true;
  }

  private getTempleOSData(competitionId: string) {
    this.templeOSService.getCompetition(competitionId).subscribe({
      next: (data) => {
        const teamsObj = data.data.teams as Record<string, any>;
        this.templeTeams = Object.keys(teamsObj)
          .filter((k) => !Number.isNaN(Number(k)))
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => teamsObj[k]);
        this.participants = data.data.participants;
        this.info = data.data.info;
      },
      error: (error) => console.error('Error loading TempleOSRS data:', error),
    });
  }

  onMouseEnter(tileText: string) {
    this.tooltip.tooltipText = tileText;
    this.tooltip.onMouseEnter();
  }

  onMouseLeave() {
    this.tooltip.onMouseLeave();
  }

  onMouseMove(event: MouseEvent) {
    this.tooltip.onMouseMove(event);
  }
}
