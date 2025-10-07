import { ChangeDetectionStrategy, Component, Inject, OnChanges, OnInit, PLATFORM_ID } from '@angular/core';
import { Tile } from '../../models/tile';
import { DatabaseService } from '../../services/database.service';
import { isPlatformBrowser } from '@angular/common';
import { NgClass } from '../../../../node_modules/@angular/common';
import { MockService } from '../../services/mock-service';
import { environment as env } from '../../environments/environment.prod';
import { Teams } from '../../models/teamEnum';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-cabbingo-board',
  imports: [NgClass, RouterModule],
  templateUrl: './cabbingo-board.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: '../../../styles.css',
})
export class CabbingoBoard implements OnInit {
  teamEnum: typeof Teams = Teams;
  currentTeam: Teams = Teams.Team1;
  selectedTile: Tile | undefined = undefined;
  board: Tile[][] = [];
  boardSize: number = 6;
  columnBonus = 5;
  rowBonus = 5;
  bingoRulesOpened: boolean = true;
  teamNames = ['Team 1', 'Team 2'];

  constructor(
    private databaseService: DatabaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (env.production === false) {
      const mockService = new MockService();
      this.board = mockService.board;
      this.generateBoard(this.board[this.currentTeam]);
    } else {
      // Only load Firebase data in the browser
      if (isPlatformBrowser(this.platformId)) {
        this.databaseService.getTeamNames().then((namesFromDb) => {
          this.teamNames[0] = namesFromDb[0] || 'Team 1';
          this.teamNames[1] = namesFromDb[1] || 'Team 2';
        });
        this.loadTilesFromFirebase();
      }
    }
  }

  loadTilesFromFirebase() {
    this.databaseService.getTiles().subscribe({
      next: (firebaseTeams) => {
        if (firebaseTeams && firebaseTeams.length > 0) {
          this.generateBoard(firebaseTeams[this.currentTeam]);
          if (this.selectedTile) {
            this.selectedTile = this.board[this.currentTeam][this.selectedTile?.id! - 1];
          }
        }
      },
      error: (error) => {
        console.error('Error loading tiles:', error);
      },
    });
  }

  generateBoard(tiles: Tile[]): void {
    this.board = []; // Clear the board before generating
    let tileIndex = 0;

    for (let row = 0; row < this.boardSize; row++) {
      this.board[row] = [];
      for (let col = 0; col < this.boardSize; col++) {
        if (tileIndex >= tiles.length) {
          return; // Stop filling the board if we run out of tiles
        }
        this.board[row][col] = {
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
        const mockService = new MockService();
        this.board = mockService.board;
        this.generateBoard(this.board[this.currentTeam]);
      } else {
        this.loadTilesFromFirebase();
      }
    }
  }

  getTotalPoints(): number {
    let totalPoints = 0;

    // Calculate row points and row bonuses
    for (let rowIndex = 0; rowIndex < this.board.length; rowIndex++) {
      const row = this.board[rowIndex];
      let isRowComplete = true;

      for (const tile of row) {
        if (tile.itemsObtained >= tile.itemsRequired) {
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

      for (let rowIndex = 0; rowIndex < this.board.length; rowIndex++) {
        const tile = this.board[rowIndex][colIndex];
        if (!tile || tile.itemsObtained < tile.itemsRequired) {
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

    const rowsToCheck = rowIndex !== undefined ? [rowIndex] : Array.from({ length: this.board.length }, (_, i) => i);

    for (const rowIdx of rowsToCheck) {
      let isRowComplete = true;

      for (const tile of this.board[rowIdx]) {
        if (!tile || tile.itemsObtained < tile.itemsRequired) {
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
