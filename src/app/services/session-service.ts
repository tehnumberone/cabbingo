import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Board, isEnded } from '../models/bingo';

export interface Rsn {
    id: number;
    name: string;
}

export interface User {
    id: number;
    username: string;
    email: string | null;
    isAdmin: boolean;
    rsns?: Rsn[]; // only filled in by /auth/me
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

    // Shown on every page's login button.
    get label(): string {
        return this.user ? this.user.username + (this.user.isAdmin ? ' (admin)' : '') : 'Log in / Register';
    }

    headers(): Record<string, string> {
        return this.user ? { Authorization: `Bearer ${this.user.token}` } : {};
    }

    // Owner or admin: may change board settings and every team's progress. The worker enforces the same rules.
    canManage(board?: Board): boolean {
        return !!board && !!this.user && (this.user.isAdmin || this.user.id === board.ownerId);
    }

    // Ended bingos are read-only for everyone except admins.
    locked(board?: Board): boolean {
        return !!board && isEnded(board) && !this.user?.isAdmin;
    }

    // Teams whose progress the logged-in user may update.
    editableTeams(board?: Board) {
        const user = this.user;
        if (!board || !user) return [];
        if (this.canManage(board)) return board.teams;
        return board.teams.filter((t) => t.captains.some((c) => c.toLowerCase() === user.username.toLowerCase()));
    }
}
