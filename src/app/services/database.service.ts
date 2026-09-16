import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { Board, Progress } from '../models/bingo';
import { SessionService, User } from './session-service';

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

  createBoard(board: Board): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${API_URL}/boards`, board, { headers: this.session.headers() });
  }

  saveBoard(id: number, board: Board) {
    return this.http.put(`${API_URL}/boards/${id}`, board, { headers: this.session.headers() });
  }

  deleteBoard(id: number) {
    return this.http.delete(`${API_URL}/boards/${id}`, { headers: this.session.headers() });
  }

  updateProgress(boardId: number, teamId: string, tileId: string, progress: Progress) {
    return this.http.put(
      `${API_URL}/boards/${boardId}/teams/${encodeURIComponent(teamId)}/tiles/${encodeURIComponent(tileId)}`,
      progress,
      { headers: this.session.headers() }
    );
  }

  async account(mode: 'login' | 'register', username: string, password: string): Promise<string | null> {
    try {
      const { token, user } = await firstValueFrom(
        this.http.post<{ token: string; user: User }>(`${API_URL}/auth/${mode}`, { username, password })
      );
      this.session.setUser({ ...user, token });
      return null;
    } catch (e: any) {
      return e?.error?.error ?? 'Something went wrong, please try again.';
    }
  }

  // Drops a stored login whose token expired and picks up admin changes.
  refreshUser() {
    const stored = this.session.user;
    if (!stored) return;
    this.http.get<{ user: User | null }>(`${API_URL}/auth/me`, { headers: this.session.headers() }).subscribe({
      next: ({ user }) => this.session.setUser(user ? { ...user, token: stored.token } : null),
      error: () => { }, // offline or worker down: keep the stored login
    });
  }

  logoutUser() {
    const headers = this.session.headers();
    this.session.setUser(null);
    this.http.post(`${API_URL}/auth/logout`, null, { headers }).subscribe({ error: () => { } });
  }
}
