import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Database, ref, push, set, remove, onValue } from '@angular/fire/database';
import { Observable, of } from 'rxjs';
import { Tile } from '../models/tile';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  constructor(private database: Database,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
  }

  getTiles(): Observable<any[]> {
    // Return empty observable immediately on server
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return new Observable(observer => {
      const tilesRef = ref(this.database, 'Boards');
      const unsubscribe = onValue(tilesRef, (snapshot) => {
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
      }, (error) => {
        observer.error(error);
      });

      // Return cleanup function
      return () => {
        unsubscribe();
      };
    });
  }
}
