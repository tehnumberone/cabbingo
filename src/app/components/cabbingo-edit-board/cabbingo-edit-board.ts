import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Tile } from '../../models/tile';
import { DatabaseService } from '../../services/database.service';
import { MockService } from '../../services/mock-service';
import { environment as env } from '../../environments/environment.prod';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../services/session-service';

@Component({
  selector: 'app-cabbingo-edit-board',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cabbingo-edit-board.html',
  styleUrl: './cabbingo-edit-board.css',
})
export class CabbingoEditBoard implements OnInit {
  selectedTeam = -1;
  boardSize: number = 6;
  password = '';
  board: Tile[][] = [[]];
  teamNames = ['Team 1', 'Team 2'];
  errorMessage: string = '';

  constructor(
    private databaseService: DatabaseService,
    @Inject(PLATFORM_ID) private platformId: Object,
    public sessionService: SessionService
  ) { }

  ngOnInit(): void {
    this.databaseService.getTeamNames().then((namesFromDb) => {
      this.teamNames[0] = namesFromDb[0] || 'Team 1';
      this.teamNames[1] = namesFromDb[1] || 'Team 2';
    });
    if (this.sessionService.session.authenticated) {
      this.selectedTeam = this.sessionService.session.team;
      this.loadTilesFromFirebase();
    }
  }

  onTeamSelect(teamNumber: any) {
    this.selectedTeam = parseInt(teamNumber);
    this.loadTilesFromFirebase();
  }

  loadTilesFromFirebase() {
    this.databaseService.getTiles().subscribe({
      next: (firebaseTeams) => {
        if (firebaseTeams && firebaseTeams.length > 0) {
          this.generateBoard(firebaseTeams[this.selectedTeam]);
        }
      },
      error: (error) => {
      },
    });
  }

  saveTile(tile: Tile, index: number) {
    this.databaseService.updateTile(this.selectedTeam, tile, index).catch((error) => {
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

  async login() {
    const isValid = await this.sessionService.validPassword(this.password, this.selectedTeam);
    if (isValid) {
      if (env.production === false) {
        const mockService = new MockService();
        this.board = mockService.board;
        this.generateBoard(this.board[this.selectedTeam]);
      } else {
        // Only load Firebase data in the browser
        if (isPlatformBrowser(this.platformId)) {
          this.loadTilesFromFirebase();
        }
      }
    }
    else {
      this.errorMessage = "Incorrect password. Please try again.";
    }
  }

  logout() {
    this.sessionService.logout();
    this.selectedTeam = -1;
    this.board = [[]];
    this.password = '';
    this.errorMessage = '';
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.login();
    }
  }
}
