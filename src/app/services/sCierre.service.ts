import { Injectable } from "@angular/core";
import {
  Http, Response, Headers,
  RequestMethod, RequestOptions,
} from "@angular/http";
import { Observable } from "rxjs/Observable";
import "rxjs/add/observable/fromPromise";
import "rxjs/add/operator/mergeMap";
import { environment } from "../../environments/environment"
import * as firebase from "firebase";

// import { mBolsa } from "../models/mBolsa";

declare var jQuery: any;
declare var $: any;

@Injectable()
export class sCierre {
  private readonly firebaseCollection = "solicitudesCierre";
  private readonly legacyMigrationDocument = "__legacy-api-migration__";

  constructor(public _http: Http) { }

  getCierre(): Observable<any> {
    return Observable.create(observer => {
      const firebaseRequest = this.getFirebaseCierres()
        .then(cierres => ({ cierres: cierres, error: null }), error => ({ cierres: null, error: error }));
      const apiRequest = this.getApiCierres()
        .then(cierres => ({ cierres: cierres, error: null }), error => ({ cierres: null, error: error }));

      Promise.all([firebaseRequest, apiRequest]).then(results => {
        const firebaseCierres = results[0].cierres;
        const apiCierres = results[1].cierres;

        if (!firebaseCierres && !apiCierres) {
          observer.error(results[0].error || results[1].error);
          return;
        }

        if (!firebaseCierres) {
          console.error("No fue posible leer los cierres desde Firestore.", results[0].error);
        }
        if (!apiCierres) {
          console.error("No fue posible leer los cierres históricos desde la API.", results[1].error);
        }

        const cierresFirebaseDisponibles = firebaseCierres || [];
        const cierresApiDisponibles = apiCierres || [];
        observer.next(this.mergeCierres(cierresApiDisponibles, cierresFirebaseDisponibles));

        if (!firebaseCierres || !apiCierres) {
          observer.complete();
          return;
        }

        this.migrateLegacyCierres(cierresApiDisponibles, cierresFirebaseDisponibles)
          .then(cierresMigrados => {
            if (cierresMigrados) {
              observer.next(this.mergeCierres(cierresApiDisponibles, cierresMigrados));
            }
            observer.complete();
          })
          .catch(error => {
            console.error("No fue posible guardar los cierres históricos en Firestore.", error);
            observer.complete();
          });
      }).catch(error => observer.error(error));
    });
  }

  getCierreByAgno(agno: number): Observable<any> {
    return Observable.create(observer => {
      const firebaseRequest = this.getFirebaseCierre(agno)
        .then(cierre => ({ cierre: cierre, error: null }), error => ({ cierre: null, error: error }));
      const apiRequest = this.getApiCierreByAgno(agno)
        .then(cierres => ({ cierre: cierres.length ? cierres[0] : null, error: null }), error => ({ cierre: null, error: error }));

      Promise.all([firebaseRequest, apiRequest]).then(results => {
        const firebaseCierre = results[0].cierre;
        const apiCierre = results[1].cierre;

        if (!firebaseCierre && !apiCierre && results[0].error && results[1].error) {
          observer.error(results[0].error);
          return;
        }

        if (!firebaseCierre && !apiCierre) {
          observer.next([]);
          observer.complete();
          return;
        }

        if (!firebaseCierre && apiCierre) {
          this.saveCierreToFirebase(apiCierre)
            .then(() => observer.next([apiCierre]))
            .then(() => observer.complete())
            .catch(error => observer.error(error));
          return;
        }

        if (!apiCierre) {
          console.error("No fue posible consultar este cierre en la API histórica.", results[1].error);
          observer.next([firebaseCierre]);
        } else {
          observer.next([this.mergeCierre(apiCierre, firebaseCierre)]);
        }
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  postBolsa(cierre: any): any {
    return this._http
      .post(environment.node + "Cierre/", cierre)
      .map((res: Response) => res.json())
      .mergeMap((res: any) => Observable.fromPromise(this.saveCierreToFirebase(cierre)).map(() => res));
  }

  putBolsa(Cierre: any): any {
    return this._http
      .put(environment.node + "Cierre/" + Cierre._id, Cierre)
      .map((res: Response) => res.json())
      .mergeMap((res: any) => Observable.fromPromise(this.saveCierreToFirebase(Cierre)).map(() => res));
  }

  guardarCierreEnFirebase(cierre: any): Observable<void> {
    return Observable.fromPromise(this.saveCierreToFirebase(cierre));
  }

  corrigeCierre(agno){
    this.getCierreByAgno(agno).subscribe(res => {
      let cierre = res[0];
      cierre.OC = this.filtraAgno(cierre.OC,agno)
      cierre.OP = this.filtraAgno(cierre.OP,agno);
      this.putBolsa(cierre).subscribe(res => console.log(res));
    })
  }

  private filtraAgno(ordenes: any[], agno: number) {
    let filtrada = ordenes.map(orden => ({ ...orden, estadosPagos: orden.estadosPagos.filter(el => new Date(el.fecha).getFullYear() == agno) }));
    return filtrada.filter(el => el.estadosPagos.length > 0);
  }

  private getFirebaseCierres(): Promise<any[]> {
    return this.getFirebaseDb().collection(this.firebaseCollection).get()
      .then(snapshot => Promise.all(snapshot.docs
        .filter(doc => Number.isFinite(Number((doc.data() || {}).agno)))
        .map(doc => this.getCierreFromDocument(doc))))
      .then(cierres => cierres.sort((a, b) => a.agno - b.agno));
  }

  private getApiCierres(): Promise<any[]> {
    return this._http.get(environment.node + "Cierre")
      .map((res: Response) => res.json() || [])
      .toPromise();
  }

  private getApiCierreByAgno(agno: number): Promise<any[]> {
    return this._http.get(environment.node + "Cierre/" + agno)
      .map((res: Response) => res.json() || [])
      .toPromise();
  }

  private getFirebaseCierre(agno: number): Promise<any> {
    return this.getFirebaseDb().collection(this.firebaseCollection).doc(String(agno)).get()
      .then(doc => doc.exists ? this.getCierreFromDocument(doc) : null);
  }

  private getCierreFromDocument(doc: any): Promise<any> {
    const cierre = doc.data() || {};
    return Promise.all([
      doc.ref.collection("OC").get(),
      doc.ref.collection("OP").get()
    ]).then(snapshots => ({
      ...cierre,
      _id: cierre._id || doc.id,
      OC: snapshots[0].docs.map(item => item.data()),
      OP: snapshots[1].docs.map(item => item.data())
    }));
  }

  private migrateLegacyCierres(apiCierres: any[], firebaseCierres: any[]): Promise<any[]> {
    const db = this.getFirebaseDb();
    const migrationRef = db.collection(this.firebaseCollection).doc(this.legacyMigrationDocument);

    const firebaseYears = {};
    (firebaseCierres || []).forEach(cierre => firebaseYears[String(cierre.agno)] = true);
    const cierresToMigrate = (apiCierres || []).filter(cierre =>
      cierre && cierre.agno !== undefined && !firebaseYears[String(cierre.agno)]
    );

    if (!cierresToMigrate.length) {
      return Promise.resolve(null);
    }

    return Promise.all(cierresToMigrate.map(cierre => this.saveCierreToFirebase(cierre)))
      .then(() => migrationRef.set({
        completed: true,
        migratedAt: new Date(),
        years: cierresToMigrate.map(cierre => cierre.agno)
      }, { merge: true }))
      .then(() => this.getFirebaseCierres());
  }

  private mergeCierres(apiCierres: any[], firebaseCierres: any[]): any[] {
    const cierresPorAgno: { [agno: string]: any } = {};
    (apiCierres || []).forEach(cierre => {
      cierresPorAgno[String(cierre.agno)] = cierre;
    });
    (firebaseCierres || []).forEach(cierre => {
      const agno = String(cierre.agno);
      cierresPorAgno[agno] = cierresPorAgno[agno]
        ? this.mergeCierre(cierresPorAgno[agno], cierre)
        : cierre;
    });

    return Object.keys(cierresPorAgno)
      .map(agno => cierresPorAgno[agno])
      .sort((a, b) => a.agno - b.agno);
  }

  private mergeCierre(apiCierre: any, firebaseCierre: any): any {
    return {
      ...apiCierre,
      ...firebaseCierre,
      OC: this.mergeOrders(apiCierre.OC, firebaseCierre.OC),
      OP: this.mergeOrders(apiCierre.OP, firebaseCierre.OP),
      detalleCierre: this.mergeUniqueRecords(apiCierre.detalleCierre, firebaseCierre.detalleCierre)
    };
  }

  private mergeOrders(apiOrders: any[], firebaseOrders: any[]): any[] {
    return this.mergeUniqueRecords(apiOrders, firebaseOrders, order => order && order._id);
  }

  private mergeUniqueRecords(apiRecords: any[], firebaseRecords: any[], getId?: (item: any) => any): any[] {
    const recordsById: { [id: string]: any } = {};
    (apiRecords || []).concat(firebaseRecords || []).forEach((record, index) => {
      const id = getId && getId(record) !== undefined && getId(record) !== null
        ? String(getId(record))
        : JSON.stringify(record) + "-" + index;
      recordsById[id] = record;
    });
    return Object.keys(recordsById).map(id => recordsById[id]);
  }

  private saveCierreToFirebase(cierre: any): Promise<void> {
    const db = this.getFirebaseDb();
    const cierreRef = db.collection(this.firebaseCollection).doc(String(cierre.agno));
    const headerData = Object.assign({}, cierre);
    delete headerData.OC;
    delete headerData.OP;
    const header = this.toFirestoreData(headerData);

    return cierreRef.set(header).then(() => Promise.all([
      this.replaceOrders(cierreRef, "OC", cierre.OC || []),
      this.replaceOrders(cierreRef, "OP", cierre.OP || [])
    ])).then(() => undefined);
  }

  private replaceOrders(cierreRef: any, tipo: string, ordenes: any[]): Promise<void> {
    const collection = cierreRef.collection(tipo);
    return collection.get().then(snapshot => {
      const actuales = {};
      const operaciones = [];

      (ordenes || []).forEach((orden, index) => {
        const clave = this.getOrderDocumentId(orden, index);
        actuales[clave] = true;
        operaciones.push({ type: "set", ref: collection.doc(clave), data: this.toFirestoreData(orden) });
      });

      snapshot.docs.forEach(doc => {
        if (!actuales[doc.id]) {
          operaciones.push({ type: "delete", ref: doc.ref });
        }
      });

      return this.commitOperations(operaciones);
    });
  }

  private commitOperations(operaciones: any[]): Promise<void> {
    const db = this.getFirebaseDb();
    const maxBatchSize = 450;
    let chain = Promise.resolve();

    for (let start = 0; start < operaciones.length; start += maxBatchSize) {
      const batchOperations = operaciones.slice(start, start + maxBatchSize);
      chain = chain.then(() => {
        const batch = db.batch();
        batchOperations.forEach(operacion => {
          if (operacion.type === "delete") {
            batch.delete(operacion.ref);
          } else {
            batch.set(operacion.ref, operacion.data);
          }
        });
        return batch.commit().then(() => undefined);
      });
    }

    return chain;
  }

  private getOrderDocumentId(orden: any, index: number): string {
    const id = orden && orden._id !== undefined && orden._id !== null
      ? String(orden._id)
      : "orden-" + index;
    return encodeURIComponent(id).replace(/\./g, "%2E");
  }

  private toFirestoreData(value: any): any {
    return JSON.parse(JSON.stringify(value || {}));
  }

  private getFirebaseDb(): any {
    if (!firebase.apps.length && environment.firebaseConfig) {
      firebase.initializeApp(environment.firebaseConfig);
    }
    return firebase.firestore();
  }
}
