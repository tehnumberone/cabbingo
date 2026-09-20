import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import { API_URL } from "./database.service";

@Injectable({
    providedIn: 'root',
})
export class TempleOSService {

    // Proxied through the worker to avoid browser CORS blocks
    private apiUrl = `${API_URL}/templeosrs/api/`;

    constructor(private http: HttpClient) { }

    getCompetition(id: string): Observable<any> {
        const params = new HttpParams().set('id', id);
        return this.http.get(`${this.apiUrl}competition_info_v2.php`, { params });
    }
}
