import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Board } from '../models/bingo';

export interface User {
    id: number;
    username: string;
    isAdmin: boolean;
}

const USER_KEY = 'cabbingo-user';

@Injectable({
    providedIn: 'root',
})
export class SessionService {
    user: (User & { token: string }) | null = null;

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        if (!isPlatformBrowser(platformId)) return;
        try {
            this.user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
        } catch { }
    }

    setUser(user: (User & { token: string }) | null) {
        this.user = user;
        try {
            if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
            else localStorage.removeItem(USER_KEY);
        } catch { }
    }

    headers(): Record<string, string> {
        return this.user ? { Authorization: `Bearer ${this.user.token}` } : {};
    }

    // Teams whose progress the logged-in user may update. The worker enforces the same rule.
    editableTeams(board?: Board) {
        const user = this.user;
        if (!board || !user) return [];
        if (user.isAdmin || user.id === board.ownerId) return board.teams;
        return board.teams.filter((t) => t.captains.some((c) => c.toLowerCase() === user.username.toLowerCase()));
    }
}
