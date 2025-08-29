import { ChangeDetectionStrategy, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Tile } from '../../models/tile';
import { DatabaseService } from '../../services/database.service';
import { isPlatformBrowser } from '@angular/common';
import { NgClass } from "../../../../node_modules/@angular/common";

enum team {
  TeamDumb = 0,
  TeamWon = 1
}
@Component({
  selector: 'app-cabbingo-board',
  imports: [NgClass],
  templateUrl: './cabbingo-board.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: '../../../styles.css'
})
export class CabbingoBoard implements OnInit {
  teamEnum: typeof team = team;
  currentTeam: team = team.TeamDumb;
  selectedTile: Tile | null = null;
  tiles: Tile[] = [
    {
      id: 1,
      title: 'Draconic Visage',
      src: '../../assets/draconic-visage.png',
      bossSrc: '../../assets/King_Black_Dragon.png',
      alt: 'Draconic Visage',
      description: 'Obtain a Draconic Visage from a King Black Dragon',
      itemsRequired: 1,
      itemsObtained: 1
    },
    {
      id: 2,
      title: 'Any Scroll',
      src: '../../assets/dex-scroll.png',
      bossSrc: '../../assets/kbd.png',
      alt: 'Dex Scroll',
      description: 'Obtain any scroll from the Chamber of Xeric',
      itemsRequired: 1,
      itemsObtained: 1
    },
    {
      id: 3,
      title: 'Any torva piece',
      src: '../../assets/torva-helm.png',
      bossSrc: '../../assets/kbd.png',
      alt: 'Torva Helm',
      description: 'Obtain any piece of Torva from Nex',
      itemsRequired: 1,
      itemsObtained: 1
    },
    {
      id: 4,
      title: 'Any megarare',
      src: '../../assets/twisted-bow.png',
      bossSrc: '../../assets/kbd.png',
      alt: 'Twisted Bow',
      description: 'Obtain any megarare drop from any raid',
      itemsRequired: 1,
      itemsObtained: 1
    },
    {
      id: 5,
      title: '5 Venator Shards',
      src: '../../assets/venator-shard.webp',
      bossSrc: '../../assets/kbd.png',
      alt: 'Venator Shard',
      description: 'Obtain 5 Venator Shards from the Phantom Muspah',
      itemsRequired: 5,
      itemsObtained: 1
    }
  ];
  tiles2: Tile[] = [];

  // Create a 5x5 board by repeating the tile patterns
  board: Tile[][] = [];

  constructor(private databaseService: DatabaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
  }
  ngOnInit(): void {
    // Only load Firebase data in the browser
    if (isPlatformBrowser(this.platformId)) {
      this.loadTilesFromFirebase();
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
      }
    });
  }

  generateBoard(tiles: Tile[]): void {
    for (let row = 0; row < 5; row++) {
      this.board[row] = [];
      for (let col = 0; col < 5; col++) {
        const tileIndex = col % tiles.length;
        this.board[row][col] = {
          ...tiles[tileIndex],
          id: row * 5 + col + 1 // Unique ID for each tile
        };
      }
    }
  }

  onTileClick(tile: Tile): void {
    this.selectedTile = tile;
  }

  completeTile(tile: Tile): void {
    tile.completed = true;
  }

  switchTeam(selectedTeam: team): void {
    console.log('team dumbass picked: ' + selectedTeam);
    this.currentTeam = selectedTeam;
    this.loadTilesFromFirebase();
  }
}
