import { Injectable } from '@angular/core';
import { Http, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/forkJoin';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/shareReplay';
import * as firebase from 'firebase';
import { EtiquetaGasto } from '../models/nestEtiquetaGasto';
import { environment } from '../../environments/environment';
import { sVis_UsuarioPersona } from './sVis_UsuarioPersona.service';
import { SCuentaCorrienteService } from './s-cuenta-corriente.service';

@Injectable()
export class etiquetaGastoService {
    private firebaseCollection = 'finanza-etiquetas-gastos';
    private counterDoc = 'counters/finanza-etiquetas-gastos';
    private relacionesCollection = 'finanza-etiquetas-relaciones';
    private etiquetasCache$: Observable<EtiquetaGasto[]>;
    private relacionesCache$: Observable<{ [idMovimiento: number]: number }>;
    private movimientosCache$: Observable<any[]>;
    private cajasChicasCache$: Observable<any[]>;
    private usuariosCache$: Observable<any[]>;
    private cuentaCorrienteConfirmadosCache$: Observable<any[]>;
    private cuentaCorrientePendientesCache$: Observable<any[]>;

    constructor(
        private http: Http,
        private usuarioService: sVis_UsuarioPersona,
        private cuentaCorrienteService: SCuentaCorrienteService
    ) { }

    init(idCentroCosto?: number): EtiquetaGasto {
        return { idEtiquetaGasto: null, nombreEtiqueta: null, isActive: true, fechaCreacion: new Date(), idCentroCosto: idCentroCosto };
    }

    getEtiquetasGastos(): Observable<EtiquetaGasto[]> {
        if (this.etiquetasCache$) {
            return this.etiquetasCache$;
        }

        const firebaseDb = this.getFirebaseDb();

        this.etiquetasCache$ = Observable.create((observer) => {
            firebaseDb.collection(this.firebaseCollection).get()
                .then((snapshot) => {
                    const etiquetas = (snapshot.docs || []).map((doc) => {
                        const data = doc.data();
                        return {
                            ...data,
                            idEtiquetaGasto: data.idEtiquetaGasto || null,
                            fechaCreacion: data.fechaCreacion && data.fechaCreacion.toDate ? data.fechaCreacion.toDate() : new Date(data.fechaCreacion || Date.now())
                        } as EtiquetaGasto;
                    });
                    observer.next(etiquetas);
                    observer.complete();
                })
                .catch((error) => {
                    console.error('Error al obtener etiquetas de Firebase:', error);
                    observer.error(error);
                });
        }).shareReplay(1);

        return this.etiquetasCache$;
    }

    addEtiquetaGasto(etiqueta: EtiquetaGasto): Observable<EtiquetaGasto> {
        const firebaseDb = this.getFirebaseDb();

        return Observable.create((observer) => {
            const counterRef = firebaseDb.doc(this.counterDoc);

            firebaseDb.runTransaction((transaction) => {
                return transaction.get(counterRef).then((counterSnap) => {
                    const lastId = counterSnap.exists ? Number(counterSnap.data().lastId || 0) : 0;
                    const nextId = lastId + 1;

                    transaction.set(counterRef, { lastId: nextId }, { merge: true });

                    etiqueta.idEtiquetaGasto = nextId;
                    etiqueta.fechaCreacion = new Date();

                    const nuevoDocRef = firebaseDb.collection(this.firebaseCollection).doc();
                    transaction.set(nuevoDocRef, {
                        ...etiqueta,
                        fechaCreacion: etiqueta.fechaCreacion
                    });

                    return nextId;
                });
            }).then((nextId) => {
                this.etiquetasCache$ = null;
                console.log('Etiqueta guardada en Firebase con id único:', nextId, etiqueta.nombreEtiqueta);
                observer.next(etiqueta);
                observer.complete();
            }).catch((error) => {
                console.error('Error al guardar etiqueta en Firebase (transacción):', error);
                observer.error(error);
            });
        });
    }

    updateEtiquetaGasto(etiqueta: EtiquetaGasto): Observable<EtiquetaGasto> {
        const firebaseDb = this.getFirebaseDb();

        return Observable.create((observer) => {
            if (!etiqueta || !etiqueta.idEtiquetaGasto) {
                observer.next(null);
                observer.complete();
                return;
            }

            firebaseDb.collection(this.firebaseCollection)
                .where('idEtiquetaGasto', '==', Number(etiqueta.idEtiquetaGasto))
                .get()
                .then((snapshot) => {
                    const docs = snapshot.docs || [];
                    if (!docs.length) {
                        observer.next(null);
                        observer.complete();
                        return;
                    }

                    const doc = docs[0];
                    const updatePayload = {
                        nombreEtiqueta: etiqueta.nombreEtiqueta,
                        idCentroCosto: etiqueta.idCentroCosto,
                        isActive: etiqueta.isActive !== undefined ? etiqueta.isActive : true,
                        fechaCreacion: doc.data().fechaCreacion || new Date()
                    };

                    return doc.ref.update(updatePayload);
                })
                .then(() => {
                    this.etiquetasCache$ = null;
                    observer.next(etiqueta);
                    observer.complete();
                })
                .catch((error) => {
                    console.error('Error al actualizar etiqueta en Firebase:', error);
                    observer.error(error);
                });
        });
    }

    deleteEtiquetaGasto(idEtiquetaGasto: number): Observable<boolean> {
        const firebaseDb = this.getFirebaseDb();

        return Observable.create((observer) => {
            if (!idEtiquetaGasto) {
                observer.next(false);
                observer.complete();
                return;
            }

            Promise.all([
                firebaseDb.collection(this.firebaseCollection).where('idEtiquetaGasto', '==', Number(idEtiquetaGasto)).get(),
                firebaseDb.collection(this.relacionesCollection).where('etiquetaGasto', '==', Number(idEtiquetaGasto)).get()
            ]).then(([etiquetasSnapshot, relacionesSnapshot]) => {
                const batch = firebaseDb.batch();

                (etiquetasSnapshot.docs || []).forEach((doc) => batch.delete(doc.ref));
                (relacionesSnapshot.docs || []).forEach((doc) => batch.delete(doc.ref));

                return batch.commit();
            }).then(() => {
                this.etiquetasCache$ = null;
                this.relacionesCache$ = null;
                observer.next(true);
                observer.complete();
            }).catch((error) => {
                console.error('Error al eliminar etiqueta:', error);
                observer.next(false);
                observer.complete();
            });
        });
    }

    asignarEtiquetaAMovimiento(idMovimiento: number, etiquetaGasto: number): Observable<any> {
        const firebaseDb = this.getFirebaseDb();
        return Observable.create((observer) => {
            if (!idMovimiento || !etiquetaGasto) {
                observer.next(null);
                observer.complete();
                return;
            }
            firebaseDb.collection(this.relacionesCollection).doc('movimiento_' + idMovimiento).set({
                idMovimiento: idMovimiento,
                etiquetaGasto: etiquetaGasto,
                fechaCreacion: new Date()
            }, { merge: true }).then(() => {
                this.relacionesCache$ = null;
                console.log('Relación etiqueta-movimiento guardada:', idMovimiento, etiquetaGasto);
                observer.next(true);
                observer.complete();
            }).catch((error) => {
                console.error('Error al guardar relación etiqueta-movimiento:', error);
                observer.error(error);
            });
        });
    }

    asignarEtiquetaBuscandoMovimiento(
        descripcion: string,
        idCreador: number,
        etiquetaGasto: number,
        idCentroCosto?: number,
        tipoMovimiento?: number,
        idMovimientoCreado?: number
    ): Observable<any> {
        if (!etiquetaGasto) {
            return Observable.of(null);
        }

        if (idMovimientoCreado) {
            return this.asignarEtiquetaAMovimiento(Number(idMovimientoCreado), Number(etiquetaGasto));
        }

        return this.http.get(environment.nest + 'v1/movimiento/allRelationShip')
            .map((res: Response) => res.json() || [])
            .flatMap((movimientos: any[]) => {
                const fechaAhora = Date.now();
                const descripcionNormalizada = (descripcion || '').trim();

                const candidatos = (movimientos || []).filter((m: any) => {
                    const mismoCreador = Number(m.idCreador) === Number(idCreador);
                    const mismoTipo = tipoMovimiento === undefined || Number(m.tipo) === Number(tipoMovimiento);
                    const centroMovimiento = (m.centroCosto && typeof m.centroCosto === 'object') ? Number(m.centroCosto.idCentroCosto) : Number(m.centroCosto);
                    const mismoCentro = idCentroCosto === undefined || Number(centroMovimiento) === Number(idCentroCosto);

                    if (descripcionNormalizada) {
                        return mismoCreador && mismoTipo && mismoCentro && (m.descripcion === descripcionNormalizada || m.descripcion === descripcion);
                    }

                    const fechaMovimiento = new Date(m.fechaCreacion || m.fecha || 0).getTime();
                    const diferenciaMs = Math.abs(fechaMovimiento - fechaAhora);
                    return mismoCreador && mismoTipo && mismoCentro && diferenciaMs <= 60000;
                });

                if (!candidatos.length) {
                    console.warn('No se encontró el movimiento recién creado para vincular la etiqueta. Descripción:', descripcion, 'idCreador:', idCreador, 'centroCosto:', idCentroCosto);
                    return Observable.of(null);
                }

                const masReciente = candidatos.reduce((a, b) => Number(a.idMovimiento) > Number(b.idMovimiento) ? a : b);
                return this.asignarEtiquetaAMovimiento(masReciente.idMovimiento, etiquetaGasto);
            });
    }

    getEtiquetasRelaciones(): Observable<{ [idMovimiento: number]: number }> {
        if (this.relacionesCache$) {
            return this.relacionesCache$;
        }

        const firebaseDb = this.getFirebaseDb();
        this.relacionesCache$ = Observable.create((observer) => {
            firebaseDb.collection(this.relacionesCollection).get()
                .then((snapshot) => {
                    const mapa = {};
                    (snapshot.docs || []).forEach((doc) => {
                        const data = doc.data();
                        if (data.idMovimiento) {
                            mapa[Number(data.idMovimiento)] = Number(data.etiquetaGasto);
                        }
                    });
                    observer.next(mapa);
                    observer.complete();
                })
                .catch((error) => {
                    console.error('Error al obtener relaciones etiqueta-movimiento:', error);
                    observer.next({});
                    observer.complete();
                });
        }).shareReplay(1);

        return this.relacionesCache$;
    }

    getDetalleEtiquetas(idCentroCosto?: number): Observable<any[]> {
        return Observable.forkJoin(
            this.getEtiquetasGastos(),
            this.getEtiquetasRelaciones(),
            this.getMovimientosPorCentroCosto(idCentroCosto),
            this.getCajasChicas(),
            this.getUsuarios()
        ).map(([etiquetas, relaciones, movimientos, cajasChicas, usuarios]) => {

            const usuariosMap = {};
            (usuarios || []).forEach((u: any) => {
                const nombreCompleto = [u.nombre, u.paterno].filter(Boolean).join(' ');
                usuariosMap[Number(u.idUsuario)] = nombreCompleto || ('Usuario ' + u.idUsuario);
            });

            const nombreEtiquetaPorId = (etiquetaId: number): string => {
                const etiqueta = (etiquetas || []).find(el => Number(el.idEtiquetaGasto) === Number(etiquetaId));
                return etiqueta ? etiqueta.nombreEtiqueta : 'Etiqueta ' + etiquetaId;
            };

            const montosPorEstado = (registro: any): { pendiente: number, pagado: number } => {
                const pagos = registro && registro.estadoPago ? registro.estadoPago : [];
                return (pagos || []).reduce((acc, pago) => {
                    if (Number(pago.estado) === 4) {
                        acc.pagado += Number(pago.monto || 0);
                    } else {
                        acc.pendiente += Number(pago.monto || 0);
                    }
                    return acc;
                }, { pendiente: 0, pagado: 0 });
            };

            const extraerCentroCosto = (registro: any): { id: number, nombre: string } => {
                if (registro.centroCosto && typeof registro.centroCosto === 'object') {
                    return {
                        id: Number(registro.centroCosto.idCentroCosto),
                        nombre: registro.centroCosto.nombreCentroCosto || ('Centro de Costo ' + registro.centroCosto.idCentroCosto)
                    };
                }
                const id = Number(registro.centroCosto);
                return { id: id, nombre: 'Centro de Costo ' + id };
            };

            const coincideCentroCosto = (centroCostoId: number): boolean => {
                if (idCentroCosto === undefined || idCentroCosto === null) {
                    return true;
                }
                return Number(centroCostoId) === Number(idCentroCosto);
            };

            const tipoLabelMovimiento = (tipo: number): string => {
                switch (Number(tipo)) {
                    case 1: return 'Orden de Compra';
                    case 2: return 'Egreso';
                    case 3: return 'Ingreso';
                    case 5: return 'Contrato';
                    default: return 'Otro';
                }
            };

            const nombreTipoGastoMovimiento = (mov: any): string => {
                if (mov && mov.tipoGasto) {
                    const tipoGasto = mov.tipoGasto;
                    if (tipoGasto.nombreTipoGasto) {
                        return tipoGasto.nombreTipoGasto;
                    }
                    if (tipoGasto.nombre) {
                        return tipoGasto.nombre;
                    }
                }
                return tipoLabelMovimiento(mov && mov.tipo ? mov.tipo : 0);
            };

            const nombreSubTipoGastoMovimiento = (mov: any): string => {
                if (mov && mov.subTipoGasto) {
                    const subTipo = mov.subTipoGasto;
                    if (subTipo.nombreSubTipoGasto) {
                        return subTipo.nombreSubTipoGasto;
                    }
                    if (subTipo.nombreSubtipoGasto) {
                        return subTipo.nombreSubtipoGasto;
                    }
                    if (subTipo.nombre) {
                        return subTipo.nombre;
                    }
                }
                return null;
            };

            const filas = [];
            const totals = {};

            (etiquetas || []).forEach((etiqueta: any) => {
                if (Number(etiqueta.idCentroCosto) === Number(idCentroCosto)) {
                    totals[etiqueta.nombreEtiqueta] = {
                        etiquetaId: Number(etiqueta.idEtiquetaGasto),
                        nombreEtiqueta: etiqueta.nombreEtiqueta,
                        pendiente: 0,
                        pagado: 0,
                        total: 0
                    };
                }
            });

            (movimientos || []).forEach((mov) => {
                const cc = extraerCentroCosto(mov);
                if (!coincideCentroCosto(cc.id)) {
                    return;
                }
                const etiquetaId = mov.etiquetaGasto || relaciones[Number(mov.idMovimiento)] || 0;
                if (!etiquetaId) {
                    return;
                }
                const montos = montosPorEstado(mov);
                if (montos.pendiente + montos.pagado <= 0) {
                    return;
                }
                filas.push({
                    idMovimiento: mov.idMovimiento,
                    etiquetaId: Number(etiquetaId),
                    nombreEtiqueta: nombreEtiquetaPorId(etiquetaId),
                    nombreCentroCosto: cc.nombre,
                    tipo: Number(mov.tipo),
                    tipoLabel: tipoLabelMovimiento(mov.tipo),
                    nombreTipoGasto: nombreTipoGastoMovimiento(mov),
                    nombreSubTipoGasto: nombreSubTipoGastoMovimiento(mov),
                    descripcion: mov.descripcion || '(Sin descripción)',
                    solicitante: usuariosMap[Number(mov.idSolicitador)] || (mov.idSolicitador ? 'Usuario ' + mov.idSolicitador : '—'),
                    fecha: mov.fechaCreacion,
                    pendiente: montos.pendiente,
                    pagado: montos.pagado,
                    total: montos.pendiente + montos.pagado
                });
            });

            (cajasChicas || []).forEach((caja) => {
                const cc = extraerCentroCosto(caja);
                if (!coincideCentroCosto(cc.id) || !caja.etiquetaGasto) {
                    return;
                }
                const tipoGastoCaja = caja.tipoGasto && (caja.tipoGasto.nombreTipoGasto || caja.tipoGasto.nombre);
                const subTipoCaja = caja.subTipoGasto && (caja.subTipoGasto.nombreSubTipoGasto || caja.subTipoGasto.nombreSubtipoGasto || caja.subTipoGasto.nombre);
                filas.push({
                    idMovimiento: caja.idCajaChica || null,
                    etiquetaId: Number(caja.etiquetaGasto),
                    nombreEtiqueta: nombreEtiquetaPorId(caja.etiquetaGasto),
                    nombreCentroCosto: cc.nombre,
                    tipo: 2,
                    tipoLabel: 'Caja Chica',
                    nombreTipoGasto: tipoGastoCaja || 'Caja Chica',
                    nombreSubTipoGasto: subTipoCaja || null,
                    descripcion: caja.descripcion || '(Sin descripción)',
                    solicitante: usuariosMap[Number(caja.idSolicitador)] || (caja.idSolicitador ? 'Usuario ' + caja.idSolicitador : '—'),
                    fecha: caja.fechaCreacion,
                    pendiente: 0,
                    pagado: Number(caja.monto || 0),
                    total: Number(caja.monto || 0)
                });
            });

            filas.forEach((fila) => {
                if (!totals[fila.nombreEtiqueta]) {
                    totals[fila.nombreEtiqueta] = {
                        etiquetaId: fila.etiquetaId,
                        nombreEtiqueta: fila.nombreEtiqueta,
                        pendiente: 0,
                        pagado: 0,
                        total: 0
                    };
                }
                totals[fila.nombreEtiqueta].pendiente += fila.pendiente;
                totals[fila.nombreEtiqueta].pagado += fila.pagado;
                totals[fila.nombreEtiqueta].total += fila.total;
            });

            Object.keys(totals).forEach((key) => {
                if (!(filas || []).some((fila) => fila.nombreEtiqueta === key)) {
                    filas.push({
                        etiquetaId: totals[key].etiquetaId,
                        nombreEtiqueta: totals[key].nombreEtiqueta,
                        nombreCentroCosto: 'Centro de Costo ' + idCentroCosto,
                        nombreTipoGasto: null,
                        tipoLabel: null,
                        descripcion: null,
                        solicitante: null,
                        fecha: null,
                        pendiente: 0,
                        pagado: 0,
                        total: 0
                    });
                }
            });

            return filas.sort((a, b) => {
                if (a.nombreEtiqueta !== b.nombreEtiqueta) {
                    return a.nombreEtiqueta.localeCompare(b.nombreEtiqueta);
                }
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
            });
        });
    }

    private getMovimientosPorCentroCosto(idCentroCosto: number): Observable<any[]> {
        return Observable.forkJoin(
            this.http.get(environment.nest + 'v1/viewCentroCosto/centroCosto/confirmados/' + idCentroCosto),
            this.http.get(environment.nest + 'v1/viewCentroCosto/centroCosto/pendientes/' + idCentroCosto),
            this.getCuentaCorrienteConfirmadosCache(),
            this.getCuentaCorrientePendientesCache()
        ).map(([confirmadosRes, pendientesRes, ccConfirmados, ccPendientes]: any[]) => {
            const base = [confirmadosRes, pendientesRes].reduce((movimientos, respuesta) => {
                const filas = respuesta.json() || [];
                return movimientos.concat(filas.map((fila: any) => ({
                    idMovimiento: fila.idMovimiento,
                    centroCosto: {
                        idCentroCosto: fila.idCentroCosto,
                        nombreCentroCosto: fila.nombreCentroCosto
                    },
                    tipo: fila.tipoOC,
                    tipoGasto: { nombreTipoGasto: fila.nombreTipoGasto },
                    subTipoGasto: { nombreSubTipoGasto: fila.nombreSubtipoGasto },
                    descripcion: fila.descripcion,
                    fechaCreacion: fila.fechaPago,
                    estadoPago: [{ estado: fila.estado, monto: fila.monto }]
                })));
            }, []);

            const nombreCentroCosto = base.length ? base[0].centroCosto.nombreCentroCosto : null;

            const contratos = (nombreCentroCosto ? (ccConfirmados || []).concat(ccPendientes || []) : [])
                .filter((fila: any) => (Number(fila.tipoOC) === 5 || Number(fila.tipoOC) === 3) && fila.nombreCentroCosto === nombreCentroCosto)
                .map((fila: any) => ({
                    idMovimiento: fila.idMovimiento,
                    centroCosto: {
                        idCentroCosto: idCentroCosto,
                        nombreCentroCosto: fila.nombreCentroCosto
                    },
                    tipo: fila.tipoOC,
                    tipoGasto: { nombreTipoGasto: fila.nombreTipoGasto },
                    subTipoGasto: { nombreSubTipoGasto: fila.nombreSubTipoGasto },
                    descripcion: fila.descripcion,
                    fechaCreacion: fila.fechaPago,
                    estadoPago: [{ estado: fila.estado, monto: fila.monto }]
                }));

            return base.concat(contratos);
        });
    }

    private getCuentaCorrienteConfirmadosCache(): Observable<any[]> {
        if (!this.cuentaCorrienteConfirmadosCache$) {
            this.cuentaCorrienteConfirmadosCache$ = this.cuentaCorrienteService
                .getCuentaCorrienteConfirmados()
                .shareReplay(1);
        }
        return this.cuentaCorrienteConfirmadosCache$;
    }

    private getCuentaCorrientePendientesCache(): Observable<any[]> {
        if (!this.cuentaCorrientePendientesCache$) {
            this.cuentaCorrientePendientesCache$ = this.cuentaCorrienteService
                .getCuentaCorrientePendientes()
                .shareReplay(1);
        }
        return this.cuentaCorrientePendientesCache$;
    }

    private getMovimientos(): Observable<any[]> {
        if (!this.movimientosCache$) {
            this.movimientosCache$ = this.http
                .get(environment.nest + 'v1/movimiento/allRelationShip')
                .map((res: Response) => res.json() || [])
                .shareReplay(1);
        }
        return this.movimientosCache$;
    }

    private getCajasChicas(): Observable<any[]> {
        if (!this.cajasChicasCache$) {
            this.cajasChicasCache$ = this.http
                .get(environment.node + 'CajaChica')
                .map((res: Response) => res.json() || [])
                .shareReplay(1);
        }
        return this.cajasChicasCache$;
    }

    private getUsuarios(): Observable<any[]> {
        if (!this.usuariosCache$) {
            this.usuariosCache$ = this.usuarioService
                .getVis_UsuarioPersona()
                .shareReplay(1);
        }
        return this.usuariosCache$;
    }

    getDesglosePorEtiquetaPorCentroCosto(idCentroCosto?: number): Observable<any[]> {
        return this.getDetalleEtiquetas(idCentroCosto).map((filas) => {
            const totals = {};
            (filas || []).forEach((fila) => {
                const key = fila.nombreEtiqueta;
                if (!totals[key]) {
                    totals[key] = {
                        etiquetaId: fila.etiquetaId,
                        nombreEtiqueta: fila.nombreEtiqueta,
                        pendiente: 0,
                        pagado: 0,
                        total: 0
                    };
                }
                totals[key].pendiente += Number(fila.pendiente || 0);
                totals[key].pagado += Number(fila.pagado || 0);
                totals[key].total += Number(fila.total || 0);
            });
            return Object.keys(totals)
                .map((k) => totals[k])
                .sort((a, b) => a.nombreEtiqueta.localeCompare(b.nombreEtiqueta));
        });
    }

    private getFirebaseDb(): any {
        if (!firebase.apps.length && environment.firebaseConfig) {
            firebase.initializeApp(environment.firebaseConfig);
        }
        return firebase.firestore();
    }
}