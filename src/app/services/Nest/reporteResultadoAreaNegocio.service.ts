import { Injectable } from "@angular/core"
import { Http, Response } from "@angular/http"
import { Observable } from "rxjs"
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/shareReplay';
import { environment } from "../../../environments/environment"
import { ReportRentabilidadAreaNegocioByYear, ReportResultadoAreaNegocioByYear } from "../../models/nestResultadoAreaNegocio"

@Injectable()
export class ResultadoAreaNegocioService {
    context: string
    private rentabilidadCache = new Map<number, Observable<ReportRentabilidadAreaNegocioByYear[]>>();
    constructor(public _http: Http) {
        this.context = environment.nest + 'v1/resultadoAreaNegocio'
    }

    getResultadoByAreaNegocio(idAreaNegocio: number): Observable<ReportResultadoAreaNegocioByYear[]> {
        return this._http.get(`${this.context}/resultados/${idAreaNegocio}`).map((res: Response) => res.json());
    }

    getRentabilidadByAreaNegocio(idAreaNegocio: number): Observable<ReportRentabilidadAreaNegocioByYear[]> {
        if (!this.rentabilidadCache.has(idAreaNegocio)) {
            const cacheKey = 'rentabilidad-area-negocio-' + idAreaNegocio;
            const cached = localStorage.getItem(cacheKey);
            let cachedData: any = null;

            try {
                cachedData = cached ? JSON.parse(cached) : null;
            } catch (error) {
                cachedData = null;
            }

            if (cachedData && cachedData.timestamp && Date.now() - cachedData.timestamp < 300000) {
                this.rentabilidadCache.set(idAreaNegocio, Observable.of(cachedData.data));
            } else {
                this.rentabilidadCache.set(idAreaNegocio, this._http
                    .get(`${this.context}/rentabilidad/${idAreaNegocio}`)
                    .map((res: Response) => {
                        const data = res.json() || [];
                        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data }));
                        return data;
                    })
                    .shareReplay(1));
            }
        }

        return this.rentabilidadCache.get(idAreaNegocio);
    }
}