import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { forkJoin } from 'rxjs/observable/forkJoin';
import { sCierre } from '../../../services/sCierre.service';
import { centroCostoService } from '../../../services/sCentroCostoNest.service';
import { viewCentroCostoService } from '../../../services/sViewCentroCosto.service';

@Component({
  selector: 'app-listado-cierre',
  templateUrl: './listado-cierre.component.html',
  styleUrls: ['./listado-cierre.component.css'],
  providers: [
    sCierre,
    centroCostoService,
    viewCentroCostoService
  ]
})
export class ListadoCierreComponent implements OnInit {

  @Input() totales: any[];
  centrosSelected: string[];
  filtroCentro: string;

  listado: any[];
  cierresCentros: any[];
  expandedYears: { [key: string]: boolean };
  montosPeriodoPorCentro: { [key: string]: number };
  montosAnualesPeriodoPorCentro: { [key: string]: { [key: number]: number } };
  movimientosPeriodoPorCentro: { [key: string]: any[] };

  listado$: Observable<any>;


  constructor(
    private Cierre: sCierre,
    private centroCostoService: centroCostoService,
    private viewCentroCostoService: viewCentroCostoService
  ) {
    this.listado$ = this.Cierre.getCierre();
    this.centrosSelected = [];
    this.filtroCentro = '';
    this.expandedYears = {};
    this.montosPeriodoPorCentro = {};
    this.montosAnualesPeriodoPorCentro = {};
    this.movimientosPeriodoPorCentro = {};
  }

  ngOnInit() {
  }

  setValueCierres(res) {
    this.listado = res;
    this.cierresCentros = res.map(cierre => ({ _id: cierre._id, centros: cierre.OC.concat(cierre.OP).map(el => el.subCentroCosto) }));
    this.loadMontosPeriodoPorCentro();
  }

  getCentroCosto(el) {
    let ordenes = el.OC.concat(el.OP);
    let centrosCosto = ordenes.map(el => el.subCentroCosto).filter((v, i, a) => a.indexOf(v) === i);
    // console.log(centrosCosto);
    return centrosCosto;
  }

  getDetalleCentro(cierre: any, centroCosto: string): any {
    return cierre && cierre.detalleCierre
      ? cierre.detalleCierre.find(detalle => detalle.centroCosto === centroCosto) || null
      : null;
  }

  getPeriodoCentroVisible(cierre: any, centroCosto: string): string {
    const detalle = this.getDetalleCentroPeriodo(cierre, centroCosto);
    const rango = this.getRangoPeriodoCierre(cierre, centroCosto);

    if (this.isTaiPingCierre2021(cierre, centroCosto)) {
      return '2021 - 2023';
    }

    if (!detalle || detalle.tipoCierre !== 'etapas') {
      return rango.fechaFin ? this.formatFecha(rango.fechaFin) : this.getPeriodoDetalle(cierre, detalle);
    }

    return this.formatPeriodoDetalle(rango.fechaInicio, rango.fechaFin, rango.agnoInicio, rango.agnoFin);
  }

  getResumenDetalleCentro(cierre: any, centroCosto: string): string {
    const detalle = this.getDetalleCentroPeriodo(cierre, centroCosto);

    if (this.isTaiPingCierre2021(cierre, centroCosto)) {
      return 'Directo (2021 - 2023)';
    }

    if (!detalle) {
      return 'Sin detalle adicional';
    }

    const periodo = this.getPeriodoCentroVisible(cierre, centroCosto);

    if (detalle.tipoCierre === 'etapas') {
      return (detalle.cantidadEtapas || 0) + ' etapas (' + periodo + ')';
    }

    return 'Directo (' + periodo + ')';
  }

  getPeriodoCierre(cierre: any): string {
    const detalle = cierre && cierre.detalleCierre && cierre.detalleCierre.length
      ? cierre.detalleCierre
        .slice()
        .sort((a, b) => new Date(b.fechaCorte || 0).getTime() - new Date(a.fechaCorte || 0).getTime())[0]
      : null;

    return this.getPeriodoDetalle(cierre, detalle);
  }

  display(id) {
    this.expandedYears[id] = !this.expandedYears[id];
  }

  // retPorcentaje(item) {
  //   console.log(item);
  // }

  displayCentro(centros: string[]) {
    this.centrosSelected = centros || [];
    this.cierresCentros.forEach(regAgno => {
      this.expandedYears[regAgno._id] = !!this.centrosSelected.find(centro => regAgno.centros.includes(centro));
    });
  }

  limpiarFiltro() {
    this.filtroCentro = '';
  }

  getListadoFiltrado(): any[] {
    if (!this.listado || !this.listado.length) {
      return [];
    }

    if (!this.hasFiltroActivo()) {
      return this.listado;
    }

    return this.listado.filter(item => this.getCentroCostoFiltrado(item).length > 0);
  }

  getCentroCostoFiltrado(item: any): string[] {
    const centros = this.getCentroCosto(item);
    const filtro = this.normalizarTexto(this.filtroCentro);

    if (!filtro) {
      return centros;
    }

    return centros.filter(centro => this.normalizarTexto(centro).includes(filtro));
  }

  shouldShowYearDetails(item: any): boolean {
    return this.hasFiltroActivo() || !!this.expandedYears[item._id];
  }

  hasFiltroActivo(): boolean {
    return !!this.normalizarTexto(this.filtroCentro);
  }

  private normalizarTexto(valor: string): string {
    return (valor || '').toString().trim().toLowerCase();
  }

  private formatFecha(fecha: string): string {
    if (!fecha) {
      return 'sin fecha';
    }

    const valor = fecha.split('T')[0].split('-');
    return valor.length === 3 ? valor[2] + '/' + valor[1] + '/' + valor[0] : fecha;
  }

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
    return agnoFinal > agnoInicial
      ? agnoInicial + ' - ' + agnoFinal
      : agnoInicial.toString();
  }

  private loadMontosPeriodoPorCentro() {
    const centrosUnicos = this.getCentrosUnicosCierre();
    if (!centrosUnicos.length) {
      this.montosPeriodoPorCentro = {};
      this.montosAnualesPeriodoPorCentro = {};
      this.movimientosPeriodoPorCentro = {};
      return;
    }

    this.centroCostoService.getCentroCosto().subscribe(centros => {
      const idsPorNombre = (centros || []).reduce((acc, centro) => {
        acc[this.normalizarTexto(centro.nombreCentroCosto)] = centro.idCentroCosto;
        return acc;
      }, {});

      const centrosConId = centrosUnicos.filter(nombre => !!idsPorNombre[this.normalizarTexto(nombre)]);
      if (!centrosConId.length) {
        this.montosPeriodoPorCentro = {};
        this.montosAnualesPeriodoPorCentro = {};
        this.movimientosPeriodoPorCentro = {};
        return;
      }

      const consultas = centrosConId.map(nombre => {
        const idCentroCosto = idsPorNombre[this.normalizarTexto(nombre)];
        return forkJoin(
          this.viewCentroCostoService.getViewCentroCostoByConfirmados(idCentroCosto),
          this.viewCentroCostoService.getViewCentroCostoByPendientes(idCentroCosto)
        );
      });

      forkJoin(...consultas).subscribe(resultados => {
        const movimientosPorCentro = {};

        resultados.forEach((respuesta: any[], index: number) => {
          movimientosPorCentro[centrosConId[index]] = (respuesta[0] || []).concat(respuesta[1] || []);
        });

        this.movimientosPeriodoPorCentro = movimientosPorCentro;
        this.montosPeriodoPorCentro = this.buildMontosPeriodoPorCentro(movimientosPorCentro);
        this.montosAnualesPeriodoPorCentro = this.buildMontosAnualesPeriodoPorCentro();
      }, () => {
        this.montosPeriodoPorCentro = {};
        this.montosAnualesPeriodoPorCentro = {};
        this.movimientosPeriodoPorCentro = {};
      });
    }, () => {
      this.montosPeriodoPorCentro = {};
      this.montosAnualesPeriodoPorCentro = {};
      this.movimientosPeriodoPorCentro = {};
    });
  }

  private getCentrosUnicosCierre(): string[] {
    if (!this.listado || !this.listado.length) {
      return [];
    }

    return this.listado
      .reduce((acc, cierre) => acc.concat(this.getCentroCosto(cierre)), [])
      .filter((centro, index, arr) => arr.indexOf(centro) === index);
  }

  private buildMontosPeriodoPorCentro(movimientosPorCentro: { [key: string]: any[] }): { [key: string]: number } {
    const montos = {};

    (this.listado || []).forEach(cierre => {
      this.getCentroCosto(cierre).forEach(centroCosto => {
        const rango = this.getRangoPeriodoCierre(cierre, centroCosto);
        const movimientos = movimientosPorCentro[centroCosto] || [];
        const total = Math.ceil(movimientos
          .filter(movimiento => this.isMovimientoEnPeriodo(movimiento, rango))
          .reduce((acc, movimiento) => acc + (movimiento.monto || 0), 0));

        montos[this.buildMontoPeriodoKey(cierre, centroCosto)] = total;
      });
    });

    return montos;
  }

  getDesglosePeriodo(cierre: any, centroCosto: string): Array<{ agno: number, total: number }> {
    const key = this.buildMontoPeriodoKey(cierre, centroCosto);
    const desglose = this.montosAnualesPeriodoPorCentro[key] || {};
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
  }

  hasDesglosePeriodo(cierre: any, centroCosto: string): boolean {
    return this.getDesglosePeriodo(cierre, centroCosto).length > 0;
  }

  private buildMontosAnualesPeriodoPorCentro(): { [key: string]: { [key: number]: number } } {
    const montos = {};

    (this.listado || []).forEach(cierre => {
      this.getCentroCosto(cierre).forEach(centroCosto => {
        const key = this.buildMontoPeriodoKey(cierre, centroCosto);
        montos[key] = this.buildDesgloseAnualPeriodo(cierre, centroCosto);
      });
    });

    return montos;
  }

  private getRangoPeriodoCierre(cierre: any, centroCosto: string): { inicio: number | null, fin: number | null, agnoInicio: number | null, agnoFin: number | null, fechaInicio: string | null, fechaFin: string | null } {
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
    const agnoFinDetalle = this.getAgnoFecha(fechaFin);
    const agnoFin = this.getAgnoFinalPeriodo(agnoInicio, agnoFinDetalle);
    const inicio = esCierrePorEtapas
      ? this.getTimestampInicioPeriodo(fechaInicio, agnoBase)
      : (agnoBase !== null ? new Date(agnoBase, 0, 1, 0, 0, 0, 0).getTime() : null);
    const fin = this.getTimestampFinPeriodo(fechaFin, agnoFin);

    return { inicio, fin, agnoInicio, agnoFin, fechaInicio, fechaFin };
  }

  private getDetalleCentroPeriodo(cierre: any, centroCosto: string): any {
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
  }

  private isMovimientoEnPeriodo(movimiento: any, rango: { inicio: number | null, fin: number | null }): boolean {
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

    if (rango.fin !== null && fechaMovimiento > rango.fin) {
      return false;
    }

    return true;
  }

  private buildMontoPeriodoKey(cierre: any, centroCosto: string): string {
    return (cierre && cierre._id ? cierre._id : '') + '|' + centroCosto;
  }

  private buildDesgloseAnualDesdeMovimientos(centroCosto: string, rango: { inicio: number | null, fin: number | null }): { [key: number]: number } {
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

  private buildDesgloseAnualPeriodo(cierre: any, centroCosto: string): { [key: number]: number } {
    const rango = this.getRangoPeriodoCierre(cierre, centroCosto);
    const desgloseCierre = this.buildDesgloseAnualDesdeMovimientos(centroCosto, rango);
    const desglose = {};

    if (rango.agnoInicio === null || rango.agnoFin === null) {
      return desgloseCierre;
    }

    for (let agno = rango.agnoInicio; agno <= rango.agnoFin; agno++) {
      desglose[agno] = Object.prototype.hasOwnProperty.call(desgloseCierre, agno) ? desgloseCierre[agno] : 0;
    }

    return desglose;
  }

  private buildPagoCerradoKey(orden: any, estadoPago: any): string {
    return [
      orden && orden._id ? orden._id : '',
      estadoPago && estadoPago.fecha ? estadoPago.fecha : '',
      estadoPago && estadoPago.monto ? estadoPago.monto : 0,
      estadoPago && estadoPago.numeroPago ? estadoPago.numeroPago : '',
      estadoPago && estadoPago.factura ? estadoPago.factura : ''
    ].join('|');
  }

  private getAgnoEstadoPago(estadoPago: any): number | null {
    const fecha = estadoPago && (estadoPago.fecha || estadoPago.fechaPago);
    if (!fecha) {
      return null;
    }

    return this.getAgnoFecha(fecha);
  }

  private getAgnoFinalPeriodo(agnoDetalle: number | null, agnoDetectado: number | null): number | null {
    if (agnoDetalle === null) {
      return agnoDetectado;
    }

    if (agnoDetectado === null) {
      return agnoDetalle;
    }

    return agnoDetalle >= agnoDetectado ? agnoDetalle : agnoDetectado;
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
      const fechaInicioFormateada = this.formatFecha(fechaInicio);
      const fechaFinFormateada = this.formatFecha(fechaFin);
      return fechaInicioFormateada === fechaFinFormateada
        ? fechaInicioFormateada
        : fechaInicioFormateada + ' - ' + fechaFinFormateada;
    }

    if (fechaFin) {
      return agnoInicial !== null
        ? agnoInicial + ' hasta ' + this.formatFecha(fechaFin)
        : this.formatFecha(fechaFin);
    }

    return this.formatPeriodoAgnos(agnoInicial, agnoFinal);
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

    return cierre && cierre.agno ? this.buildYearStartDate(cierre.agno) : null;
  }

  private getFechaFinDetalle(detalle: any): string | null {
    if (!detalle) {
      return null;
    }

    const fechasFin = (detalle.etapas || [])
      .map(etapa => etapa && etapa.fechaFin ? etapa.fechaFin : null)
      .filter(fecha => !!fecha)
      .sort();

    if (fechasFin.length) {
      return fechasFin[fechasFin.length - 1];
    }

    return detalle.fechaCorte || null;
  }

  private isEstadoPagoEnPeriodo(estadoPago: any, rango: { inicio: number | null, fin: number | null }): boolean {
    const fechaPago = this.getTimestampFecha(estadoPago && (estadoPago.fecha || estadoPago.fechaPago), false);
    if (fechaPago === null) {
      return false;
    }

    if (rango.inicio !== null && fechaPago < rango.inicio) {
      return false;
    }

    if (rango.fin !== null && fechaPago > rango.fin) {
      return false;
    }

    return true;
  }

  private getAgnoFecha(fecha: string | null): number | null {
    const fechaNormalizada = this.buildFechaDesdeTexto(fecha, false);
    return fechaNormalizada ? fechaNormalizada.getFullYear() : null;
  }

  private getTimestampInicioPeriodo(fecha: string | null, agnoDefault: number | null): number | null {
    if (fecha) {
      return this.getTimestampFecha(fecha, false);
    }

    return agnoDefault !== null
      ? new Date(agnoDefault, 0, 1, 0, 0, 0, 0).getTime()
      : null;
  }

  private getTimestampFinPeriodo(fecha: string | null, agnoDefault: number | null): number | null {
    if (fecha) {
      return this.getTimestampFecha(fecha, true);
    }

    return agnoDefault !== null
      ? new Date(agnoDefault, 11, 31, 23, 59, 59, 999).getTime()
      : null;
  }

  private getTimestampFecha(fecha: string | null, endOfDay: boolean): number | null {
    const valor = this.buildFechaDesdeTexto(fecha, endOfDay);
    return valor ? valor.getTime() : null;
  }

  private buildFechaDesdeTexto(fecha: string | null, endOfDay: boolean): Date | null {
    if (!fecha) {
      return null;
    }

    const valor = fecha.split('T')[0];
    const partes = valor.split('-');
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

  private buildYearStartDate(agno: number): string {
    return agno + '-01-01';
  }

  private isTaiPingCierre2021(cierre: any, centroCosto: string): boolean {
    return !!cierre
      && cierre.agno === 2021
      && this.normalizarTexto(centroCosto) === 'tai ping';
  }

}
