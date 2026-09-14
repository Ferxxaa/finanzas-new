import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import { Observable } from "rxjs";
import 'rxjs/add/observable/forkJoin';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/shareReplay';
import 'rxjs/add/operator/switchMap';
import { environment } from "../../../environments/environment";
import { operacionalYears, tablaReporteOperacional } from "../../models/nestReporteOperacional";
import { ReporteVentas } from "../../models/nestReportVentas";

@Injectable()
export class reporteOperacionalService {
    context: string
    private yearsCache: Observable<number[]>;
    private reportByYearCache = new Map<number, Observable<tablaReporteOperacional[]>>();
    private fiveYearCache = new Map<number, Observable<operacionalYears[]>>();
    private readonly monthKeys = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    constructor(public _http: Http) {
        this.context = environment.nest + 'v1/reporteOperacional'
    }

    // getProveedoresYears(): Observable<EvalProveedoresYear[]> {
    //     return this._http.get(`${this.context}/reportYears`).map((res: Response) => res.json());
    // }

    getYears(): Observable<number[]> {
        if (!this.yearsCache) {
            this.yearsCache = this._http.get(`${this.context}/years`)
                .map((res: Response) => res.json())
                .shareReplay(1);
        }
        return this.yearsCache;
    }

    getReportByYear(year: number): Observable<tablaReporteOperacional[]> {
        if (!this.reportByYearCache.has(year)) {
            const cacheKey = 'reporte-operacional-' + year;
            const cached = localStorage.getItem(cacheKey);
            const cachedData = cached ? JSON.parse(cached) : null;

            if (cachedData && cachedData.timestamp && Date.now() - cachedData.timestamp < 300000) {
                this.reportByYearCache.set(year, Observable.of(cachedData.data));
            } else {
                this.reportByYearCache.set(year,
                    this._http.get(`${this.context}/year/${year}`)
                        .map((res: Response) => {
                            const data = res.json() || [];
                            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data }));
                            return data;
                        })
                        .shareReplay(1)
                );
            }
        }
        return this.reportByYearCache.get(year);
    }

    getReportByFiveYear(year: number = new Date().getFullYear()): Observable<operacionalYears[]> {
        if (!this.fiveYearCache.has(year)) {
            this.fiveYearCache.set(year,
                Observable.of([year - 2, year - 1, year])
                    .switchMap(selectedYears => {

                        const requests = selectedYears.map(itemYear =>
                            this.getReportByYear(itemYear).catch(_ => Observable.of([]))
                        );

                        return Observable.forkJoin(requests)
                            .map((reports: tablaReporteOperacional[][]) => selectedYears
                                .map((itemYear, index) => this.buildYearSeries(itemYear, reports[index]))
                                .filter(item => !!item)
                            );
                    })
                    .shareReplay(1)
            );
        }
        return this.fiveYearCache.get(year);
    }

    private buildYearSeries(year: number, report: tablaReporteOperacional[]): operacionalYears | null {
        if (!report || !report.length) {
            return null;
        }

        const base = {
            year: year,
            enero: 0,
            febrero: 0,
            marzo: 0,
            abril: 0,
            mayo: 0,
            junio: 0,
            julio: 0,
            agosto: 0,
            septiembre: 0,
            octubre: 0,
            noviembre: 0,
            diciembre: 0
        };

        const filtered = report.filter(item => !['RETIROS', 'INVERSIONES'].includes(this.normalizeType(item.nombreTipoGasto)));
        const aggregated = filtered.reduce((acc, item) => {
            this.monthKeys.forEach(month => acc[month] += item[month] || 0);
            return acc;
        }, base as operacionalYears);

        const hasData = this.monthKeys.some(month => aggregated[month] > 0);
        return hasData ? aggregated : null;
    }

    private normalizeType(value: string): string {
        return (value || '').toUpperCase().trim().replace('O. ', '');
    }

    // getDetalleProveedor(idProveedor: number, year: number): Observable<ReportEvalProv[]> {
    //     return this._http.get(`${this.context}/proveedor/${idProveedor}/${year}`).map((res: Response) => res.json());
    // }


}