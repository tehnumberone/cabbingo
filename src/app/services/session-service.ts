
import { environment as env } from '../environments/environment.prod';
import { Teams } from '../models/teamEnum';
import { DataSnapshot } from 'firebase/database';
import { DatabaseService } from './database.service';
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class SessionService {
    session = { team: -1, authenticated: false };

    constructor(private databaseService: DatabaseService) { }

    async validPassword(password: string, selectedTeam: number): Promise<boolean> {
        if (env.production === true && selectedTeam !== -1) {
            try {
                const credentialsFromDb: DataSnapshot = await this.databaseService.getTeamCredentials(selectedTeam);
                let passwordValue = credentialsFromDb.val() ? JSON.stringify(credentialsFromDb.val().password) : '';
                if (selectedTeam === Teams.Team1 && passwordValue === JSON.stringify(password)) {
                    this.loginForTeam(Teams.Team1);
                    return true;
                } else if (
                    selectedTeam === Teams.Team2 &&
                    passwordValue === JSON.stringify(password)
                ) {
                    this.loginForTeam(Teams.Team2);
                    return true;
                }
                else {
                    return false;
                }
            } catch {
                return false;
            }
        } else if (env.production === false) {
            this.loginForTeam(selectedTeam);
            return true;
        } else {
            return false;
        }
    }

    loginForTeam(teamNumber: number) {
        if (teamNumber === Teams.Team1) {
            this.session = { team: 0, authenticated: true };
        } else if (teamNumber === Teams.Team2) {
            this.session = { team: 1, authenticated: true };
        }
    }

    logout() {
        this.session = { team: -1, authenticated: false };
    }
}
