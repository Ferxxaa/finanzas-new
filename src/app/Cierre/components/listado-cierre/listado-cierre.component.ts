import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { forkJoin } from 'rxjs/observable/forkJoin';
import { of } from 'rxjs/observable/of';
import { map, switchMap } from 'rxjs/operators';
import { centroCostoService } from '../../../services/sCentroCostoNest.service';
import { viewCentroCostoService } from '../../../services/sViewCentroCosto.service';

interface RangoPeriodo {
  inicio: number | null;
  fin: number | null;
  agnoInicio: number | null;
  agnoFin: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

const SIN_RESULTADOS: any[] = [];

@Component({
  selector: 'app-listado-cierre',
  templateUrl: './listado-cierre.component.html',
  styleUrls: ['./listado-cierre.component.css'],
  providers: [
    centroCostoService,
    viewCentroCostoService
  ]
})
export class ListadoCierreComponent implements OnChanges, OnDestroy {

  @Input() totales: any[];
  @Input() cierres: any[];
  @Input() centrosSeleccionados: string[];

  centrosSelected: string[] = [];
  filtroCentro = '';

  listado: any[];
  cierresCentros: Array<{ _id: any, centros: string[] }> = [];
  expandedYears: { [key: string]: boolean } = {};
  montosPeriodoPorCentro: { [key: string]: number } = {};
  montosAnualesPeriodoPorCentro: { [key: string]: { [key: number]: number } } = {};
  movimientosPeriodoPorCentro: { [key: string]: any[] } = {};

  private montosSub: Subscription;

  // Caches: se limpian cuando llega un listado nuevo (o montos nuevos, en el caso del desglose).
  private centrosCache = new Map<any, string[]>();
  private centrosFiltradosCache = new Map<any, { filtro: string, valor: string[] }>();
  private periodoCierreCache = new Map<any, string>();
  private rangoCache = new Map<any, { [centro: string]: RangoPeriodo }>();
  private detallePeriodoCache = new Map<any, { [centro: string]: any }>();
  private periodoVisibleCache = new Map<any, { [centro: string]: string }>();
  private resumenCache = new Map<any, { [centro: string]: string }>();
  private desgloseCache = new Map<any, { [centro: string]: Array<{ agno: number, total: number }> }>();
  private listadoFiltradoKey: string = null;
  private listadoFiltradoRef: any[] = null;
  private listadoFiltradoValor: any[] = SIN_RESULTADOS;

  constructor(
    private centroCostoService: centroCostoService,
    private viewCentroCostoService: viewCentroCostoService
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.cierres) {
      this.setValueCierres(this.cierres || []);
    }

    if (changes.cierres || changes.centrosSeleccionados) {
      this.displayCentro(this.centrosSeleccionados);
    }
  }

  ngOnDestroy() {
    this.cancelarCargaMontos();
  }

  // ---------------------------------------------------------------------------
  // Entrada de datos
  // ---------------------------------------------------------------------------

  setValueCierres(res: any[]) {
    this.listado = res || [];
    this.limpiarCaches();
    this.cierresCentros = this.listado.map(cierre => ({
      _id: cierre._id,
      centros: this.getOrdenes(cierre).map(el => el.subCentroCosto)
    }));
    this.loadMontosPeriodoPorCentro();
  }

  displayCentro(centros: string[]) {
    this.centrosSelected = centros || [];
    (this.cierresCentros || []).forEach(regAgno => {
      this.expandedYears[regAgno._id] = !!this.centrosSelected.find(centro => regAgno.centros.includes(centro));
    });
  }

  // ---------------------------------------------------------------------------
  // Template
  // ---------------------------------------------------------------------------

  display(id: any) {
    this.expandedYears[id] = !this.expandedYears[id];
  }

  limpiarFiltro() {
    this.filtroCentro = '';
  }

  hasFiltroActivo(): boolean {
    return !!this.normalizarTexto(this.filtroCentro);
  }

  shouldShowYearDetails(item: any): boolean {
    return this.hasFiltroActivo() || !!this.expandedYears[item._id];
  }

  getListadoFiltrado(): any[] {
    if (!this.listado || !this.listado.length) {
      return SIN_RESULTADOS;
    }

    const filtro = this.normalizarTexto(this.filtroCentro);
    if (this.listadoFiltradoRef === this.listado && this.listadoFiltradoKey === filtro) {
      return this.listadoFiltradoValor;
    }

    this.listadoFiltradoRef = this.listado;
    this.listadoFiltradoKey = filtro;
    this.listadoFiltradoValor = filtro
      ? this.listado.filter(item => this.getCentroCostoFiltrado(item).length > 0)
      : this.listado;

    return this.listadoFiltradoValor;
  }

  getCentroCosto(cierre: any): string[] {
    let centros = this.centrosCache.get(cierre);
    if (!centros) {
      centros = this.getOrdenes(cierre)
        .map(el => el.subCentroCosto)
        .filter((v, i, a) => a.indexOf(v) === i);
      this.centrosCache.set(cierre, centros);
    }
    return centros;
  }

  getCentroCostoFiltrado(item: any): string[] {
    const filtro = this.normalizarTexto(this.filtroCentro);
    const cache = this.centrosFiltradosCache.get(item);
    if (cache && cache.filtro === filtro) {
      return cache.valor;
    }

    const centros = this.getCentroCosto(item);
    const valor = filtro
      ? centros.filter(centro => this.normalizarTexto(centro).includes(filtro))
      : centros;

    this.centrosFiltradosCache.set(item, { filtro, valor });
    return valor;
  }

  getDetalleCentro(cierre: any, centroCosto: string): any {
    return cierre && cierre.detalleCierre
      ? cierre.detalleCierre.find(detalle => detalle.centroCosto === centroCosto) || null
      : null;
  }

  getPeriodoCierre(cierre: any): string {
    if (this.periodoCierreCache.has(cierre)) {
      return this.periodoCierreCache.get(cierre);
    }

    const detalle = cierre && cierre.detalleCierre && cierre.detalleCierre.length
      ? cierre.detalleCierre
        .slice()
        .sort((a, b) => new Date(b.fechaCorte || 0).getTime() - new Date(a.fechaCorte || 0).getTime())[0]
      : null;

    const periodo = this.getPeriodoDetalle(cierre, detalle);
    this.periodoCierreCache.set(cierre, periodo);
    return periodo;
  }

  getPeriodoCentroVisible(cierre: any, centroCosto: string): string {
    return this.memo(this.periodoVisibleCache, cierre, centroCosto, () => {
      if (this.isTaiPingCierre2021(cierre, centroCosto)) {
        return '2021 - 2023';
      }

      const detalle = this.getDetalleCentroPeriodo(cierre, centroCosto);
      const rango = this.getRangoPeriodoCierre(cierre, centroCosto);

      if (!detalle || detalle.tipoCierre !== 'etapas') {
        return rango.fechaFin ? this.formatFecha(rango.fechaFin) : this.getPeriodoDetalle(cierre, detalle);
      }

      return this.formatPeriodoDetalle(rango.fechaInicio, rango.fechaFin, rango.agnoInicio, rango.agnoFin);
    });
  }

  getResumenDetalleCentro(cierre: any, centroCosto: string): string {
    return this.memo(this.resumenCache, cierre, centroCosto, () => {
      if (this.isTaiPingCierre2021(cierre, centroCosto)) {
        return 'Directo (2021 - 2023)';
      }

      const detalle = this.getDetalleCentroPeriodo(cierre, centroCosto);
      if (!detalle) {
        return 'Sin detalle adicional';
      }

      const periodo = this.getPeriodoCentroVisible(cierre, centroCosto);
      return detalle.tipoCierre === 'etapas'
        ? (detalle.cantidadEtapas || 0) + ' etapas (' + periodo + ')'
        : 'Directo (' + periodo + ')';
    });
  }

  getDesglosePeriodo(cierre: any, centroCosto: string): Array<{ agno: number, total: number }> {
    return this.memo(this.desgloseCache, cierre, centroCosto, () => {
      const desglose = this.montosAnualesPeriodoPorCentro[this.buildMontoPeriodoKey(cierre, centroCosto)] || {};
      const rango = this.getRangoPeriodoCierre(cierre, centroCosto);

      if (rango.agnoInicio === null || rango.agnoFin === null || rango.agnoFin <= rango.agnoInicio) {
        return [];
      }

      const resultado = [];
      for (let agno = rango.agnoInicio; agno <= rango.agnoFin; agno++) {
        resultado.push({
          agno,
          total: Object.prototype.hasOwnProperty.call(desglose, agno) ? desglose[agno] : 0
        });
      }

      return resultado;
    });
  }

  hasDesglosePeriodo(cierre: any, centroCosto: string): boolean {
    return this.getDesglosePeriodo(cierre, centroCosto).length > 0;
  }

  // ---------------------------------------------------------------------------
  // Montos por periodo (view de centro de costo)
  // ---------------------------------------------------------------------------

  private loadMontosPeriodoPorCentro() {
    this.cancelarCargaMontos();

    const centrosUnicos = this.getCentrosUnicosCierre();
    if (!centrosUnicos.length) {
      this.resetMontos();
      return;
    }

    this.montosSub = this.centroCostoService.getCentroCosto()
      .pipe(
        switchMap((centros: any[]) => {
          const idsPorNombre = (centros || []).reduce((acc, centro) => {
            acc[this.normalizarTexto(centro.nombreCentroCosto)] = centro.idCentroCosto;
            return acc;
          }, {});

          const centrosConId = centrosUnicos.filter(nombre => !!idsPorNombre[this.normalizarTexto(nombre)]);
          if (!centrosConId.length) {
            return of({ centrosConId, resultados: [] });
          }

          const consultas: Observable<any>[] = centrosConId.map(nombre => {
            const idCentroCosto = idsPorNombre[this.normalizarTexto(nombre)];
            return forkJoin(
              this.viewCentroCostoService.getViewCentroCostoByConfirmados(idCentroCosto),
              this.viewCentroCostoService.getViewCentroCostoByPendientes(idCentroCosto)
            );
          });

          return forkJoin(...consultas).pipe(map((resultados: any[]) => ({ centrosConId, resultados })));
        })
      )
      .subscribe(({ centrosConId, resultados }: { centrosConId: string[], resultados: any[] }) => {
        if (!centrosConId.length) {
          this.resetMontos();
          return;
        }

        const movimientosPorCentro: { [key: string]: any[] } = {};
        resultados.forEach((respuesta: any[], index: number) => {
          movimientosPorCentro[centrosConId[index]] = (respuesta[0] || []).concat(respuesta[1] || []);
        });

        this.movimientosPeriodoPorCentro = movimientosPorCentro;
        this.montosPeriodoPorCentro = this.buildMontosPeriodoPorCentro(movimientosPorCentro);
        this.montosAnualesPeriodoPorCentro = this.buildMontosAnualesPeriodoPorCentro();
        this.desgloseCache.clear();
      }, () => this.resetMontos());
  }

  private cancelarCargaMontos() {
    if (this.montosSub) {
      this.montosSub.unsubscribe();
      this.montosSub = null;
    }
  }

  private resetMontos() {
    this.montosPeriodoPorCentro = {};
    this.montosAnualesPeriodoPorCentro = {};
    this.movimientosPeriodoPorCentro = {};
    this.desgloseCache.clear();
  }

  private getCentrosUnicosCierre(): string[] {
    return (this.listado || [])
      .reduce((acc, cierre) => acc.concat(this.getCentroCosto(cierre)), [])
      .filter((centro, index, arr) => arr.indexOf(centro) === index);
  }

  private buildMontosPeriodoPorCentro(movimientosPorCentro: { [key: string]: any[] }): { [key: string]: number } {
    const montos = {};

    (this.listado || []).forEach(cierre => {
      this.getCentroCosto(cierre).forEach(centroCosto => {
        const rango = this.getRangoPeriodoCierre(cierre, centroCosto);
        const total = (movimientosPorCentro[centroCosto] || [])
          .filter(movimiento => this.isMovimientoEnPeriodo(movimiento, rango))
          .reduce((acc, movimiento) => acc + (movimiento.monto || 0), 0);

        montos[this.buildMontoPeriodoKey(cierre, centroCosto)] = Math.ceil(total);
      });
    });

    return montos;
  }

  private buildMontosAnualesPeriodoPorCentro(): { [key: string]: { [key: number]: number } } {
    const montos = {};

    (this.listado || []).forEach(cierre => {
      this.getCentroCosto(cierre).forEach(centroCosto => {
        montos[this.buildMontoPeriodoKey(cierre, centroCosto)] = this.buildDesgloseAnualPeriodo(cierre, centroCosto);
      });
    });

    return montos;
  }

  private buildDesgloseAnualPeriodo(cierre: any, centroCosto: string): { [key: number]: number } {
    const rango = this.getRangoPeriodoCierre(cierre, centroCosto);
    const desgloseCierre = this.buildDesgloseAnualDesdeMovimientos(centroCosto, rango);

    if (rango.agnoInicio === null || rango.agnoFin === null) {
      return desgloseCierre;
    }

    const desglose = {};
    for (let agno = rango.agnoInicio; agno <= rango.agnoFin; agno++) {
      desglose[agno] = Object.prototype.hasOwnProperty.call(desgloseCierre, agno) ? desgloseCierre[agno] : 0;
    }

    return desglose;
  }

  private buildDesgloseAnualDesdeMovimientos(centroCosto: string, rango: RangoPeriodo): { [key: number]: number } {
    const desglose = {};

    (this.movimientosPeriodoPorCentro[centroCosto] || [])
      .filter(movimiento => this.isMovimientoEnPeriodo(movimiento, rango))
      .forEach(movimiento => {
        const agnoPago = this.getAgnoEstadoPago(movimiento);
        if (agnoPago === null) {
          return;
        }

        desglose[agnoPago] = Math.ceil((desglose[agnoPago] || 0) + (movimiento && movimiento.monto ? movimiento.monto : 0));
      });

    return desglose;
  }

  private isMovimientoEnPeriodo(movimiento: any, rango: RangoPeriodo): boolean {
    if (!movimiento || !movimiento.fechaPago) {
      return false;
    }

    const fechaMovimiento = new Date(movimiento.fechaPago).getTime();
    if (isNaN(fechaMovimiento)) {
      return false;
    }

    if (rango.inicio !== null && fechaMovimiento < rango.inicio) {
      return false;
    }

    return !(rango.fin !== null && fechaMovimiento > rango.fin);
  }

  private buildMontoPeriodoKey(cierre: any, centroCosto: string): string {
    return (cierre && cierre._id ? cierre._id : '') + '|' + centroCosto;
  }

  // ---------------------------------------------------------------------------
  // Rango de cada cierre
  // ---------------------------------------------------------------------------

  private getRangoPeriodoCierre(cierre: any, centroCosto: string): RangoPeriodo {
    return this.memo(this.rangoCache, cierre, centroCosto, () => {
      if (this.isTaiPingCierre2021(cierre, centroCosto)) {
        return {
          inicio: new Date(2021, 0, 1, 0, 0, 0, 0).getTime(),
          fin: new Date(2023, 11, 31, 23, 59, 59, 999).getTime(),
          agnoInicio: 2021,
          agnoFin: 2023,
          fechaInicio: null,
          fechaFin: null
        };
      }

      const detalle = this.getDetalleCentroPeriodo(cierre, centroCosto);
      const agnoBase = cierre && cierre.agno ? cierre.agno : null;
      const esCierrePorEtapas = !!detalle && detalle.tipoCierre === 'etapas';
      const fechaInicio = esCierrePorEtapas ? this.getFechaInicioDetalle(cierre, detalle) : null;
      const fechaFin = this.getFechaFinDetalle(detalle);
      const agnoInicioFecha = esCierrePorEtapas ? this.getAgnoFecha(fechaInicio) : null;
      const agnoInicio = agnoInicioFecha !== null ? agnoInicioFecha : agnoBase;
      const agnoFin = this.getAgnoFinalPeriodo(agnoInicio, this.getAgnoFecha(fechaFin));
      const inicio = esCierrePorEtapas
        ? this.getTimestampInicioPeriodo(fechaInicio, agnoBase)
        : (agnoBase !== null ? new Date(agnoBase, 0, 1, 0, 0, 0, 0).getTime() : null);
      const fin = this.getTimestampFinPeriodo(fechaFin, agnoFin);

      return { inicio, fin, agnoInicio, agnoFin, fechaInicio, fechaFin };
    });
  }

  private getDetalleCentroPeriodo(cierre: any, centroCosto: string): any {
    return this.memo(this.detallePeriodoCache, cierre, centroCosto, () => {
      const detalleActual = this.getDetalleCentro(cierre, centroCosto);
      if (detalleActual) {
        return detalleActual;
      }

      const agnoBase = cierre && cierre.agno ? cierre.agno : null;
      if (agnoBase === null) {
        return null;
      }

      const cierreConDetalle = (this.listado || [])
        .filter(item => item && item.agno >= agnoBase && this.getCentroCosto(item).includes(centroCosto))
        .sort((a, b) => a.agno - b.agno)
        .find(item => this.getDetalleCentro(item, centroCosto));

      return cierreConDetalle ? this.getDetalleCentro(cierreConDetalle, centroCosto) : null;
    });
  }

  private getFechaInicioDetalle(cierre: any, detalle: any): string | null {
    const fechasInicio = ((detalle && detalle.etapas) || [])
      .map(etapa => etapa && etapa.fechaInicio ? etapa.fechaInicio : null)
      .filter(fecha => !!fecha)
      .sort();

    if (fechasInicio.length) {
      return fechasInicio[0];
    }

    if (detalle && detalle.fechaInicio) {
      return detalle.fechaInicio;
    }

    return cierre && cierre.agno ? cierre.agno + '-01-01' : null;
  }

  private getFechaFinDetalle(detalle: any): string | null {
    if (!detalle) {
      return null;
    }

    const fechasFin = (detalle.etapas || [])
      .map(etapa => etapa && etapa.fechaFin ? etapa.fechaFin : null)
      .filter(fecha => !!fecha)
      .sort();

    return fechasFin.length ? fechasFin[fechasFin.length - 1] : (detalle.fechaCorte || null);
  }

  private getAgnoFinalPeriodo(agnoInicio: number | null, agnoDetectado: number | null): number | null {
    if (agnoInicio === null) {
      return agnoDetectado;
    }

    if (agnoDetectado === null) {
      return agnoInicio;
    }

    return Math.max(agnoInicio, agnoDetectado);
  }

  // ---------------------------------------------------------------------------
  // Formatos
  // ---------------------------------------------------------------------------

  private getPeriodoDetalle(cierre: any, detalle: any): string {
    const agnoInicial = cierre && cierre.agno ? cierre.agno : null;
    const fechaFinal = detalle && detalle.fechaCorte ? detalle.fechaCorte : null;

    if (!agnoInicial && !fechaFinal) {
      return 'sin periodo';
    }

    if (!agnoInicial) {
      return this.formatFecha(fechaFinal);
    }

    if (!fechaFinal) {
      return agnoInicial.toString();
    }

    const agnoFinal = new Date(fechaFinal).getFullYear();
    return agnoFinal > agnoInicial ? agnoInicial + ' - ' + agnoFinal : agnoInicial.toString();
  }

  private formatPeriodoAgnos(agnoInicial: number | null, agnoFinal: number | null): string {
    if (agnoInicial === null && agnoFinal === null) {
      return 'sin periodo';
    }

    if (agnoInicial === null) {
      return agnoFinal.toString();
    }

    if (agnoFinal === null || agnoFinal <= agnoInicial) {
      return agnoInicial.toString();
    }

    return agnoInicial + ' - ' + agnoFinal;
  }

  private formatPeriodoDetalle(fechaInicio: string | null, fechaFin: string | null, agnoInicial: number | null, agnoFinal: number | null): string {
    if (fechaInicio && fechaFin) {
      const inicio = this.formatFecha(fechaInicio);
      const fin = this.formatFecha(fechaFin);
      return inicio === fin ? inicio : inicio + ' - ' + fin;
    }

    if (fechaFin) {
      return agnoInicial !== null
        ? agnoInicial + ' hasta ' + this.formatFecha(fechaFin)
        : this.formatFecha(fechaFin);
    }

    return this.formatPeriodoAgnos(agnoInicial, agnoFinal);
  }

  private formatFecha(fecha: string): string {
    if (!fecha) {
      return 'sin fecha';
    }

    const valor = fecha.split('T')[0].split('-');
    return valor.length === 3 ? valor[2] + '/' + valor[1] + '/' + valor[0] : fecha;
  }

  // ---------------------------------------------------------------------------
  // Fechas
  // ---------------------------------------------------------------------------

  private getAgnoEstadoPago(estadoPago: any): number | null {
    const fecha = estadoPago && (estadoPago.fecha || estadoPago.fechaPago);
    return fecha ? this.getAgnoFecha(fecha) : null;
  }

  private getAgnoFecha(fecha: string | null): number | null {
    const fechaNormalizada = this.buildFechaDesdeTexto(fecha, false);
    return fechaNormalizada ? fechaNormalizada.getFullYear() : null;
  }

  private getTimestampInicioPeriodo(fecha: string | null, agnoDefault: number | null): number | null {
    if (fecha) {
      return this.getTimestampFecha(fecha, false);
    }

    return agnoDefault !== null ? new Date(agnoDefault, 0, 1, 0, 0, 0, 0).getTime() : null;
  }

  private getTimestampFinPeriodo(fecha: string | null, agnoDefault: number | null): number | null {
    if (fecha) {
      return this.getTimestampFecha(fecha, true);
    }

    return agnoDefault !== null ? new Date(agnoDefault, 11, 31, 23, 59, 59, 999).getTime() : null;
  }

  private getTimestampFecha(fecha: string | null, endOfDay: boolean): number | null {
    const valor = this.buildFechaDesdeTexto(fecha, endOfDay);
    return valor ? valor.getTime() : null;
  }

  private buildFechaDesdeTexto(fecha: string | null, endOfDay: boolean): Date | null {
    if (!fecha) {
      return null;
    }

    const partes = fecha.split('T')[0].split('-');
    if (partes.length === 3) {
      const agno = +partes[0];
      const mes = +partes[1] - 1;
      const dia = +partes[2];

      if (!isNaN(agno) && !isNaN(mes) && !isNaN(dia)) {
        return endOfDay
          ? new Date(agno, mes, dia, 23, 59, 59, 999)
          : new Date(agno, mes, dia, 0, 0, 0, 0);
      }
    }

    const parsed = new Date(fecha);
    if (isNaN(parsed.getTime())) {
      return null;
    }

    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }

    return parsed;
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  private getOrdenes(cierre: any): any[] {
    return cierre ? (cierre.OC || []).concat(cierre.OP || []) : [];
  }

  private isTaiPingCierre2021(cierre: any, centroCosto: string): boolean {
    return !!cierre && cierre.agno === 2021 && this.normalizarTexto(centroCosto) === 'tai ping';
  }

  private normalizarTexto(valor: string): string {
    return (valor || '').toString().trim().toLowerCase();
  }

  private memo<T>(store: Map<any, { [centro: string]: T }>, cierre: any, centroCosto: string, factory: () => T): T {
    let porCierre = store.get(cierre);
    if (!porCierre) {
      porCierre = {};
      store.set(cierre, porCierre);
    }

    if (!Object.prototype.hasOwnProperty.call(porCierre, centroCosto)) {
      porCierre[centroCosto] = factory();
    }

    return porCierre[centroCosto];
  }

  private limpiarCaches() {
    this.centrosCache.clear();
    this.centrosFiltradosCache.clear();
    this.periodoCierreCache.clear();
    this.rangoCache.clear();
    this.detallePeriodoCache.clear();
    this.periodoVisibleCache.clear();
    this.resumenCache.clear();
    this.desgloseCache.clear();
    this.listadoFiltradoKey = null;
    this.listadoFiltradoRef = null;
    this.listadoFiltradoValor = SIN_RESULTADOS;
  }

}