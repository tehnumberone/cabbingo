import { ChangeDetectionStrategy, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
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
  imports: [NgClass,RouterModule],
  templateUrl: './cabbingo-board.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: '../../../styles.css',
})
export class CabbingoBoard implements OnInit {
  teamEnum: typeof Teams = Teams;
  currentTeam: Teams = Teams.Team1;
  selectedTile: Tile | null = null;
  // Create a 5x5 board by repeating the tile patterns
  board: Tile[][] = [];
  boardSize: number = 6;

  constructor(
    private databaseService: DatabaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (env.production === false) {
      const mockService = new MockService();
      this.board = mockService.board;
      this.generateBoard(this.board[this.currentTeam]);
    } else {
      // Only load Firebase data in the browser
      if (isPlatformBrowser(this.platformId)) {
        this.loadTilesFromFirebase();
      }
    }
  }

  loadTilesFromFirebase() {
    this.databaseService.getTiles().subscribe({
      next: (firebaseTeams) => {
        if (firebaseTeams && firebaseTeams.length > 0) {
          this.generateBoard(firebaseTeams[this.currentTeam]);
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
  }

  switchTeam(selectedTeam: Teams): void {
    if (this.currentTeam !== selectedTeam) {
      this.currentTeam = selectedTeam;
      this.selectedTile = null;
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
    for (const row of this.board) {
      for (const tile of row) {
        if (tile.itemsObtained >= tile.itemsRequired) {
          totalPoints += tile.points || 0;
        }
      }
    }
    return totalPoints;
  }
}
