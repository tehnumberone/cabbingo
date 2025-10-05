import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment as env } from '../../environments/environment.prod';
import { Tile } from '../../models/tile';
import { DatabaseService } from '../../services/database.service';
import { MockService } from '../../services/mock-service';
import { Teams } from '../../models/teamEnum';
import { RouterModule } from '@angular/router';
import { DataSnapshot } from 'firebase/database';

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
  authenticated = { team: 0, authenticated: false };
  board: Tile[][] = [[]];
  teamNames = ['Team 1', 'Team 2'];
  errorMessage: string = '';

  constructor(
    private databaseService: DatabaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }
  ngOnInit(): void {
    this.databaseService.getTeamNames().then((namesFromDb) => {
      this.teamNames[0] = namesFromDb[0] || 'Team 1';
      this.teamNames[1] = namesFromDb[1] || 'Team 2';
    });
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
        console.error('Error loading tiles:', error);
      },
    });
  }

  validatePassword() {
    if (env.production === true && this.selectedTeam !== -1) {
      this.databaseService.getTeamCredentials(this.selectedTeam).then((credentialsFromDb: DataSnapshot) => {
        let passwordValue = credentialsFromDb.val() ? JSON.stringify(credentialsFromDb.val().password) : '';
        if (this.selectedTeam === 0 && passwordValue === JSON.stringify(this.password)) {
          this.errorMessage = "";
          return this.loginForTeam(0);
        } else if (
          this.selectedTeam === 1 &&
          passwordValue === JSON.stringify(this.password)
        ) {
          this.errorMessage = "";
          return this.loginForTeam(1);
        }
        else {
          this.errorMessage = "Incorrect password. Please try again.";
        }
      });
    } else if (env.production === false) {
      return this.loginForTeam(this.selectedTeam);
    }
  }

  loginForTeam(teamNumber: number) {
    if (teamNumber === Teams.Team1) {
      this.authenticated = { team: 0, authenticated: true };
    } else if (teamNumber === Teams.Team2) {
      this.authenticated = { team: 1, authenticated: true };
    }
    this.generateTableArray();
  }

  saveTile(tile: Tile, index: number) {
    this.databaseService.updateTile(this.selectedTeam, tile, index).catch((error) => {
      console.error('Error saving tile:', error);
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

  generateTableArray() {
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
}
