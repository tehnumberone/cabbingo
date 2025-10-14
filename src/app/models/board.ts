import { Team } from "./team";
import { Tile } from "./tile";

export interface Board {
    description: string;
    title: string;
    tiles: Tile[];
    teams: Team[];
    rules: string[];
    startDate: string;
    endDate: string;
    templeosCompetitionId: string;
}