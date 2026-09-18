import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Board, Tile, TileSide, isEnded, validateBoard } from '../../models/bingo';
import { DatabaseService } from '../../services/database.service';
import { SessionService } from '../../services/session-service';
import { RulesEditor } from '../rules-editor/rules-editor';
import { TileSideEditor } from '../tile-side-editor/tile-side-editor';

interface TeamForm {
  id: string;
  name: string;
  players: string[];
  captains: string[];
  newPlayer: string;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const SIZES = [3, 4, 5, 6, 7, 8, 9, 10];
const DAY = 86_400_000;

// <input type="datetime-local"> works in local time without a zone
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

@Component({
  selector: 'app-cabbingo-board-editor',
  imports: [DatePipe, FormsModule, RouterModule, RulesEditor, TileSideEditor],
  templateUrl: './cabbingo-board-editor.html',
})
export class CabbingoBoardEditor implements OnInit {
  readonly sizes = SIZES;
  boardId?: number;
  loaded?: Board; // board as loaded, keeps fields this page doesn't edit (flip settings)
  loading = false;
  saving = false;
  unlocked = false; // admin pressed "Edit archived board" on this visit
  confirmingDelete = false;
  deleteConfirmation = '';
  errorMessage = '';
  status = '';

  title = '';
  description = '';
  rules = '';
  size = 5;
  startDate = '';
  endDate = '';
  templeosCompetitionId = '';
  rowBonus = 5;
  columnBonus = 5;
  buyIn: number | null = null;
  flipEnabled = false;
  flipMode: Board['flipMode'] = 'all-or-nothing';
  donations: { name: string; amount: number }[] = [];
  teams: TeamForm[] = [];
  // Never trimmed while editing, so shrinking and growing the size again keeps the tiles; save sends size² of them.
  tiles: Tile[] = [];
  selectedTile = 0;
  private removedFlips: Record<string, TileSide> = {}; // kept until save so unticking the box is undoable

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
    if (!id) return this.fill(this.newBoard());
    this.boardId = id;
    this.loading = true;
    this.databaseService.getBoard(id).subscribe({
      next: ({ board }) => {
        this.loading = false;
        this.fill(board);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Board not found.';
      },
    });
  }

  get canEdit(): boolean {
    return !this.boardId || this.sessionService.canManage(this.loaded);
  }

  // Saved board past its end date. Read-only unless an admin unlocks it (the worker refuses non-admins anyway).
  get archived(): boolean {
    return !!this.loaded?.id && isEnded(this.loaded);
  }

  get readOnly(): boolean {
    return this.archived && !this.unlocked;
  }

  private newBoard(): Board {
    const start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    return {
      title: '',
      description: '',
      rules: ['* Complete a full row or column to earn a bonus!', '* Tiles can be completed in any order.', '* [color=green]Good luck and have fun![/color]'],
      size: 5,
      startDate: start.toISOString(),
      endDate: new Date(start.getTime() + 14 * DAY).toISOString(),
      rowBonus: 5,
      columnBonus: 5,
      flipEnabled: false,
      flipMode: 'all-or-nothing',
      tiles: [],
      teams: [
        { id: crypto.randomUUID(), name: 'Team 1', players: [], captains: [] },
        { id: crypto.randomUUID(), name: 'Team 2', players: [], captains: [] },
      ],
      donations: [],
    };
  }

  private fill(board: Board) {
    this.loaded = board;
    this.title = board.title;
    this.description = board.description;
    this.rules = board.rules.join('\n');
    this.size = board.size;
    this.startDate = toLocalInput(board.startDate);
    this.endDate = toLocalInput(board.endDate);
    this.templeosCompetitionId = board.templeosCompetitionId ?? '';
    this.rowBonus = board.rowBonus;
    this.columnBonus = board.columnBonus;
    this.buyIn = board.buyIn ?? null;
    this.flipEnabled = board.flipEnabled;
    this.flipMode = board.flipMode;
    this.donations = (board.donations ?? []).map((d) => ({ ...d }));
    this.teams = board.teams.map((t) => ({ id: t.id, name: t.name, players: [...t.players], captains: [...t.captains], newPlayer: '' }));
    this.tiles = board.tiles.map((t) => ({
      ...t,
      rules: [...t.rules],
      items: t.items && [...t.items],
      flip: t.flip && { ...t.flip, rules: [...t.flip.rules], items: t.flip.items && [...t.flip.items] },
    }));
    this.selectedTile = 0;
    this.setSize(board.size);
  }

  setSize(size: number) {
    this.size = Number(size);
    if (this.selectedTile >= this.size * this.size) this.selectedTile = 0;
    while (this.tiles.length < this.size * this.size) {
      const n = this.tiles.length + 1;
      this.tiles.push({ id: crypto.randomUUID(), title: `Tile ${n}`, type: 'items', amount: 1, points: 1, rules: [], tileImg: '', bossSrc: '' });
    }
  }

  get flipSetting(): 'off' | Board['flipMode'] {
    return this.flipEnabled ? this.flipMode : 'off';
  }

  setFlipSetting(value: 'off' | Board['flipMode']) {
    this.flipEnabled = value !== 'off';
    if (value !== 'off') this.flipMode = value;
  }

  toggleFlipSide(on: boolean) {
    if (!on) {
      this.removedFlips[this.tile.id] = this.tile.flip!;
      this.tile.flip = undefined;
      return;
    }
    this.tile.flip = this.removedFlips[this.tile.id] ?? {
      title: this.tile.title,
      type: 'items',
      amount: 1,
      rules: [],
      tileImg: '',
      bossSrc: '',
    };
  }

  addTeam() {
    this.teams.push({ id: crypto.randomUUID(), name: `Team ${this.teams.length + 1}`, players: [], captains: [], newPlayer: '' });
  }

  addPlayer(team: TeamForm) {
    const name = team.newPlayer.trim();
    if (name && !team.players.some((p) => sameName(p, name))) team.players.push(name);
    team.newPlayer = '';
  }

  removePlayer(team: TeamForm, player: string) {
    team.players = team.players.filter((p) => p !== player);
    team.captains = team.captains.filter((c) => !sameName(c, player));
  }

  // Players, plus captains saved earlier that aren't in the player list, so they can still be unticked.
  captainOptions(team: TeamForm): string[] {
    return [...team.players, ...team.captains.filter((c) => !team.players.some((p) => sameName(p, c)))];
  }

  isCaptain(team: TeamForm, player: string): boolean {
    return team.captains.some((c) => sameName(c, player));
  }

  toggleCaptain(team: TeamForm, player: string, checked: boolean) {
    team.captains = checked ? [...team.captains, player] : team.captains.filter((c) => !sameName(c, player));
  }

  removeTeam(team: TeamForm) {
    if (confirm(`Remove ${team.name || 'this team'}? Its progress is lost when you save.`)) this.teams = this.teams.filter((t) => t !== team);
  }

  addDonation() {
    this.donations.push({ name: '', amount: 0 });
  }

  removeDonation(index: number) {
    this.donations.splice(index, 1);
  }

  get grid(): Tile[] {
    return this.tiles.slice(0, this.size * this.size);
  }

  get tile(): Tile {
    return this.tiles[this.selectedTile];
  }

  private cleanSide(side: TileSide): TileSide {
    return {
      ...side,
      title: side.title.trim(),
      rules: lines(side.rules.join('\n')),
      amount: Number(side.amount) || 0,
      items: side.type === 'items' && side.items?.length ? side.items : undefined,
      criteria: side.type === 'custom' ? side.criteria?.trim() || undefined : undefined,
    };
  }

  private toBoard(): Board {
    return {
      ...this.loaded!,
      title: this.title.trim(),
      description: this.description.trim(),
      rules: lines(this.rules),
      size: this.size,
      startDate: this.startDate ? new Date(this.startDate).toISOString() : '',
      endDate: this.endDate ? new Date(this.endDate).toISOString() : '',
      templeosCompetitionId: this.templeosCompetitionId.trim() || undefined,
      rowBonus: Number(this.rowBonus) || 0,
      columnBonus: Number(this.columnBonus) || 0,
      buyIn: this.buyIn === null || (this.buyIn as unknown) === '' ? undefined : Number(this.buyIn),
      flipEnabled: this.flipEnabled,
      flipMode: this.flipMode,
      donations: this.donations.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), amount: Number(d.amount) || 0 })),
      teams: this.teams.map((t) => ({ id: t.id, name: t.name.trim(), players: t.players, captains: t.captains })),
      tiles: this.grid.map((t) => ({
        ...t,
        title: t.title.trim(),
        rules: lines(t.rules.join('\n')),
        amount: Number(t.amount) || 0,
        points: Number(t.points) || 0,
        items: t.type === 'items' && t.items?.length ? t.items : undefined,
        flip: this.flipEnabled && t.flip ? this.cleanSide(t.flip) : undefined,
        criteria: t.type === 'custom' ? t.criteria?.trim() || undefined : undefined,
      })),
    };
  }

  save() {
    const board = this.toBoard();
    this.status = '';
    this.errorMessage = validateBoard(board) ?? '';
    if (this.errorMessage) return;
    this.saving = true;
    const done = (id: number) => {
      this.saving = false;
      this.status = this.boardId ? 'Saved' : 'Board created';
      this.boardId = id;
      this.loaded = { ...board, id, ownerId: this.loaded?.ownerId ?? this.sessionService.user?.id };
      this.router.navigate([], { queryParams: { board: id }, replaceUrl: true });
    };
    const fail = (e: any) => {
      this.saving = false;
      this.errorMessage = e?.error?.error ?? 'Saving failed, please try again.';
    };
    if (this.boardId) this.databaseService.saveBoard(this.boardId, board).subscribe({ next: () => done(this.boardId!), error: fail });
    else this.databaseService.createBoard(board).subscribe({ next: ({ id }) => done(id), error: fail });
  }

  // Compared with the saved title, not the one currently in the form.
  get canDelete(): boolean {
    return !!this.loaded?.title && this.deleteConfirmation === this.loaded.title;
  }

  delete() {
    if (!this.boardId || !this.canDelete) return;
    this.databaseService.deleteBoard(this.boardId, this.deleteConfirmation).subscribe({
      next: () => this.router.navigate(['']),
      error: (e) => (this.errorMessage = e?.error?.error ?? 'Deleting failed, please try again.'),
    });
  }
}
