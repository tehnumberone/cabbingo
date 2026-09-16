import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, map, Observable, of } from 'rxjs';
import { Board, Progress } from '../models/bingo';
import { SessionService } from './session-service';

export const API_URL = 'https://cabbingo.tehnumberone87.workers.dev';

export interface BoardSummary {
  id: number;
  title: string;
  owner: string;
  startDate: string;
  endDate: string;
  archived: boolean;
}

export interface BoardData {
  board: Board;
  progress: Record<string, Record<string, Progress>>; // team id -> tile id -> progress
}

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  constructor(private http: HttpClient, private session: SessionService) { }

  listBoards(): Observable<BoardSummary[]> {
    return this.http.get<BoardSummary[]>(`${API_URL}/boards`);
  }

  getBoard(id: number): Observable<BoardData> {
    return this.http.get<BoardData>(`${API_URL}/boards/${id}`);
  }

  // Board id from ?board=, otherwise the running board, otherwise the most recent one.
  resolveBoardId(param: string | null): Observable<number | undefined> {
    if (Number(param)) return of(Number(param));
    return this.listBoards().pipe(map((boards) => (boards.find((b) => !b.archived) ?? boards[0])?.id));
  }

  async teamLogin(boardId: number, teamId: string, password: string): Promise<string | null> {
    try {
      const { token } = await firstValueFrom(
        this.http.post<{ token: string }>(`${API_URL}/boards/${boardId}/teams/${encodeURIComponent(teamId)}/login`, { password })
      );
      this.session.team = { boardId, teamId, token };
      return null;
    } catch (e: any) {
      return e?.error?.error ?? 'Login failed, please try again.';
    }
  }

  updateProgress(boardId: number, teamId: string, tileId: string, progress: Progress) {
    return this.http.put(
      `${API_URL}/boards/${boardId}/teams/${encodeURIComponent(teamId)}/tiles/${encodeURIComponent(tileId)}`,
      progress,
      { headers: this.session.headers() }
    );
  }
}
