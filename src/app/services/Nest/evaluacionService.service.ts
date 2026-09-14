import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Evaluacion, EvaluacionAdd } from "../../models/nestEvaluacion";

@Injectable()
export class evaluacionService {
    context: string
    constructor(public _http: Http) {
        this.context = environment.nest + 'v1/evaluacion'
    }

    private parseJsonSafe<T>(res: Response): T {
        if (!res) {
            return null;
        }

        try {
            return res.json();
        } catch (error) {
            return null;
        }
    }

    getEvaluacion(): Observable<Evaluacion[]> {
        return this._http.get(`${this.context}/all`).map((res: Response) => this.parseJsonSafe<Evaluacion[]>(res));
    }

    getEvaluacionByIdMovimiento(idMovimiento: number): Observable<Evaluacion> {
        return this._http.get(`${this.context}/movimiento/${idMovimiento}`).map((res: Response) => this.parseJsonSafe<Evaluacion>(res));
    }


    addEvaluacion(evaluacion: EvaluacionAdd): Observable<Evaluacion> {
        return this._http.post(`${this.context}/add`, evaluacion).map((res: Response) => this.parseJsonSafe<Evaluacion>(res));
    }

    addEvaluacionMasiva(evaluacion: EvaluacionAdd[]): Observable<Evaluacion> {
        return this._http.post(`${this.context}/masive/add`, evaluacion).map((res: Response) => this.parseJsonSafe<Evaluacion>(res));
    }
}