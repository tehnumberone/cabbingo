import { Injectable } from '@angular/core';

// ponytail: in-memory like before, a page refresh logs the team out; persist to localStorage if that gets annoying
@Injectable({
    providedIn: 'root',
})
export class SessionService {
    team: { boardId: number; teamId: string; token: string } | null = null;

    headers(): Record<string, string> {
        return this.team ? { Authorization: `Bearer ${this.team.token}` } : {};
    }

    logout() {
        this.team = null;
    }
}
