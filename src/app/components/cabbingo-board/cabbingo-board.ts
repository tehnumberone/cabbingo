import { ChangeDetectionStrategy, Component, Inject, OnChanges, OnInit, PLATFORM_ID } from '@angular/core';
import { Tile } from '../../models/tile';
import { DatabaseService } from '../../services/database.service';
import { isPlatformBrowser } from '@angular/common';
import { NgClass } from '../../../../node_modules/@angular/common';
import { environment as env } from '../../environments/environment.prod';
import { Teams } from '../../models/teamEnum';
import { RouterModule } from '@angular/router';
import { TempleOSService } from '../../services/templeos-service';
import { CabbingoStats } from '../cabbingo-stats/cabbingo-stats';
import { interval, Subscription } from 'rxjs';
import { Board } from '../../models/board';

@Component({
  selector: 'app-cabbingo-board',
  imports: [NgClass, RouterModule, CabbingoStats],
  templateUrl: './cabbingo-board.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: '../../../styles.css',
})
export class CabbingoBoard implements OnInit {
  teamEnum: typeof Teams = Teams;
  currentTeam: Teams = Teams.Team1;
  selectedTile: Tile | undefined = undefined;
  board!: Board;
  boardSize: number = 2;
  columnBonus = 5;
  rowBonus = 5;
  bingoRulesOpened: boolean = true;
  teamNames = ['Team 1', 'Team 2'];
  teams: any[] = [];
  participants: any[] = [];
  info: any = {};
  donations: any[] = [];
  subscription!: Subscription;
  prizePool: number = 0;
  buyinCost: number = 3;
  bingoTiles: Tile[][] = [];

  constructor(
    private databaseService: DatabaseService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private templeOSService: TempleOSService
  ) { }

  ngOnInit(): void {
    this.databaseService.getBingoBoards().subscribe({
      next: (boardsFromDb: Board[]) => {
        if (boardsFromDb && boardsFromDb.length > 0) {
          console.log(boardsFromDb[0].tiles);
          this.board = boardsFromDb[0]; // Assuming you want the first board
          this.generateBoard(this.board.tiles);
        }
      }
    });
    // if (this.teams.length === 0) {
    //   this.getTempleOSData();
    // }
    // //refreshes the templeOSRS data every 60 seconds
    // this.subscription = interval(60000).subscribe(() => this.getTempleOSData());
    // if (env.production === false) {
    //   const mockService = new MockService();
    //   this.board = mockService.board;
    //   this.generateBoard(this.board[this.currentTeam]);
    // } else {
    //   // Only load Firebase data in the browser
    //   if (isPlatformBrowser(this.platformId)) {
    //     this.getTeamNames();
    //     this.loadTilesFromFirebase();
    //   }
    // }
  }

  calculateTileProgress(tile: Tile): number {
    const progressList = tile?.conditions?.progress ?? [];
    if (tile?.conditions?.type === "obtain any item") {
      const totalObtained = progressList.reduce((sum: number, p: any) => sum + (Number(p?.obtained) || 0), 0);
      return totalObtained || 0;
    }
    else return 0;
  }

  private getTeamNames() {
    this.databaseService.getTeamNames().then((namesFromDb) => {
      this.teamNames[0] = namesFromDb[0] || 'Team 1';
      this.teamNames[1] = namesFromDb[1] || 'Team 2';
    });
  }

  private getDonations() {
    this.databaseService.getDonations2().subscribe(
      {
        next: (donationsFromDb) => {
          donationsFromDb.sort((a: any, b: any) => b.amount - a.amount);
          this.donations = donationsFromDb;
          this.getPrizePool();
        },
        error: (error) => {
          console.error('Error loading donations:', error);
        }
      }
    );
  }

  private getPrizePool() {
    this.prizePool = 0;
    for (let donation of this.donations) {
      this.prizePool += donation.amount;
    }
    this.prizePool += this.participants.length * this.buyinCost;
    this.prizePool *= 1000000; // convert to millions
  }

  private getTempleOSData() {
    this.templeOSService.getCompetition('32578').subscribe({
      next: (data) => {
        const teamsObj = data.data.teams as Record<string, any>;
        const teamsArr = Object.keys(teamsObj)
          .filter(k => !Number.isNaN(Number(k)))
          .sort((a, b) => Number(a) - Number(b))
          .map(k => teamsObj[k]);
        this.teams = teamsArr;
        this.participants = data.data.participants;
        this.info = data.data.info;
        this.getDonations();
      }, error: (error) => console.error('Error loading TempleOSRS data:', error)
    });
  }

  loadTilesFromFirebase() {
    this.databaseService.getTiles().subscribe({
      next: (firebaseTeams) => {
        if (firebaseTeams && firebaseTeams.length > 0) {
          this.generateBoard(firebaseTeams[this.currentTeam]);
          if (this.selectedTile) {
            this.selectedTile = this.bingoTiles[this.currentTeam][this.selectedTile?.id! - 1];
          }
        }
      },
      error: (error) => {
        console.error('Error loading tiles:', error);
      },
    });
  }

  generateBoard(tiles: Tile[]): void {
    this.bingoTiles = []; // Clear the board before generating
    let tileIndex = 0;

    for (let row = 0; row < this.boardSize; row++) {
      this.bingoTiles[row] = [];
      for (let col = 0; col < this.boardSize; col++) {
        if (tileIndex >= tiles.length) {
          return; // Stop filling the board if we run out of tiles
        }
        this.bingoTiles[row][col] = {
          ...tiles[tileIndex],
          id: row * this.boardSize + col + 1, // Unique ID for each tile
        };
        tileIndex++;
      }
    }
  }

  onTileClick(tile: Tile): void {
    this.selectedTile = tile;
    this.bingoRulesOpened = false;
  }

  switchTeam(selectedTeam: Teams): void {
    if (this.currentTeam !== selectedTeam) {
      this.currentTeam = selectedTeam;
      this.selectedTile = undefined;
      this.bingoRulesOpened = true;
      if (env.production === false) {
        this.generateBoard(this.bingoTiles[this.currentTeam]);
      } else {
        this.loadTilesFromFirebase();
      }
    }
  }

  getTotalPoints(): number {
    let totalPoints = 0;

    // Calculate row points and row bonuses
    for (let rowIndex = 0; rowIndex < this.bingoTiles.length; rowIndex++) {
      const row = this.bingoTiles[rowIndex];
      let isRowComplete = true;

      for (const tile of row) {
        if (this.calculateTileProgress(tile) >= tile.conditions.amount) {
          totalPoints += tile.points || 0;
        } else {
          isRowComplete = false;
        }
      }

      if (isRowComplete) {
        totalPoints += 5;
      }
    }
    totalPoints += this.calculateColumnBonuses();


    return totalPoints;
  }

  calculateColumnBonuses(columnIndex?: number): number {
    let columnBonusPoints = 0;

    const columnsToCheck = columnIndex !== undefined ? [columnIndex] : Array.from({ length: this.boardSize }, (_, i) => i);

    for (const colIndex of columnsToCheck) {
      let isColumnComplete = true;

      for (let rowIndex = 0; rowIndex < this.bingoTiles.length; rowIndex++) {
        const tile = this.bingoTiles[rowIndex][colIndex];
        if (!tile || this.calculateTileProgress(tile) < tile.conditions.amount) {
          isColumnComplete = false;
          break;
        }
      }

      if (isColumnComplete) {
        columnBonusPoints += this.columnBonus;
      }
    }
    return columnBonusPoints;
  }

  calculateRowBonuses(rowIndex?: number): number {
    let rowBonusPoints = 0;

    const rowsToCheck = rowIndex !== undefined ? [rowIndex] : Array.from({ length: this.bingoTiles.length }, (_, i) => i);

    for (const rowIdx of rowsToCheck) {
      let isRowComplete = true;

      for (const tile of this.bingoTiles[rowIdx]) {
        if (!tile || this.calculateTileProgress(tile) < tile.conditions.amount) {
          isRowComplete = false;
          break;
        }
      }

      if (isRowComplete) {
        rowBonusPoints += this.rowBonus;
      }
    }
    return rowBonusPoints;
  }
}
