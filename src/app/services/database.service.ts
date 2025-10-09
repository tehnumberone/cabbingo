import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Database, ref, set, get, onValue } from '@angular/fire/database';
import { Observable, of } from 'rxjs';
import { Tile } from '../models/tile';

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  constructor(private database: Database, @Inject(PLATFORM_ID) private platformId: Object) { }

  getTiles(): Observable<any[]> {
    // Return empty observable immediately on server
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return new Observable((observer) => {
      const tilesRef = ref(this.database, 'Boards');
      const unsubscribe = onValue(
        tilesRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // Convert your Firebase structure to component format
            const teams: any = [];
            for (const team in data) {
              const tilesArray: Tile[] = [];
              for (const key in data[team]) {
                if (data[team].hasOwnProperty(key)) {
                  const item = data[team][key];
                  tilesArray.push(item);
                }
              }
              teams.push(tilesArray);
            }
            observer.next(teams);
          } else {
            observer.next([]);
          }
        },
        (error) => {
          observer.error(error);
        }
      );

      // Return cleanup function
      return () => {
        unsubscribe();
      };
    });
  }

  updateTile(teamNumber: number, tile: Tile, index: number) {
    const tileRef = ref(this.database, `Boards/Team ${teamNumber + 1}/${index}`);
    return set(tileRef, tile);
  }

  getTeamCredentials(teamNumber: number): any {
    const tileRef = ref(this.database, `LoginCredentials/Team ${teamNumber + 1}`);
    return get(tileRef);
  }

  async getDonations(): Promise<{ name: string, amount: number }[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    const donations: { name: string, amount: number }[] = [];
    let id = 0;

    while (true) {
      const donationsRef = ref(this.database, `Donations/${id}`);
      const snapshot = await get(donationsRef);

      if (!snapshot.exists()) {
        break;
      }
      const raw: any = snapshot.val();
      let name: string;
      let amount: number;
      // Handle shape like { someName: 50 } by extracting the single key/value
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const entries = Object.entries(raw as Record<string, unknown>);
        if (entries.length === 1) {
          const [k, v] = entries[0];
          name = String(k);
          amount = typeof v === 'number' ? v : Number(v ?? 0) || 0;

          donations.push({ name, amount });
          id++;
          continue;
        }
      }
      id++;
    }

    return donations;
  }

  async getTeamNames(): Promise<string[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    const names: string[] = [];
    let teamNumber = 1;

    while (true) {
      const nameRef = ref(this.database, `LoginCredentials/Team ${teamNumber}/name`);
      const snapshot = await get(nameRef);

      if (!snapshot.exists()) {
        break;
      }

      const name = snapshot.val();
      names.push(typeof name === 'string' ? name : String(name));
      teamNumber++;
    }

    return names;
  }
}
