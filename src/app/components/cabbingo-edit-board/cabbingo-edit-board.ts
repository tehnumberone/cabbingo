import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment as env } from '../../environments/environment.prod';
import { Tile } from '../../models/tile';
import { DatabaseService } from '../../services/database.service';
import { MockService } from '../../services/mock-service';
import { Teams } from '../../models/teamEnum';

@Component({
  selector: 'app-cabbingo-edit-board',
  imports: [CommonModule, FormsModule],
  templateUrl: './cabbingo-edit-board.html',
  styleUrl: './cabbingo-edit-board.css',
})
export class CabbingoEditBoard {
  selectedTeam = -1;
  team1Password = '';
  team2Password = '';
  authenticated = { team: 0, authenticated: false };
  board: Tile[] = [];

  constructor(
    private databaseService: DatabaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (env.production === false) {
      const mockService = new MockService();
      this.board = mockService.board[0];
    } else if (this.selectedTeam >= 0) {
      // Only load Firebase data in the browser
      if (isPlatformBrowser(this.platformId)) {
        this.loadTilesFromFirebase();
      }
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
          this.board = firebaseTeams[this.selectedTeam];
        }
      },
      error: (error) => {
        console.error('Error loading tiles:', error);
      },
    });
  }

  validatePassword() {
    if (this.selectedTeam === 0 && env.passwordTeam1 === this.team1Password) {
      return this.loginForTeam(0);
    } else if (this.selectedTeam === 1 && env.passwordTeam2 === this.team2Password) {
      return this.loginForTeam(1);
    } else return false;
  }

  loginForTeam(teamNumber: number) {
    if (teamNumber === Teams.Team1) {
      this.authenticated = { team: 0, authenticated: true };
    } else if (teamNumber === Teams.Team2) {
      this.authenticated = { team: 1, authenticated: true };
    }
  }

  saveTile(tile: Tile, index: number) {
    this.databaseService
      .updateTile(this.selectedTeam, tile, index)
      .catch((error) => {
        console.error('Error saving tile:', error);
      });
  }
}
