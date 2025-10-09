import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
    providedIn: 'root',
})
export class TempleOSService {

    // Uses local SSR proxy to avoid browser cors block
    private apiUrl = 'https://steep-unit-c896.tehnumberone87.workers.dev/templeosrs/api/';

    constructor(private http: HttpClient) { }

    getCompetition(id: string): Observable<any> {
        const params = new HttpParams().set('id', id);
        return this.http.get(`${this.apiUrl}competition_info_v2.php`, { params });
    }
}
