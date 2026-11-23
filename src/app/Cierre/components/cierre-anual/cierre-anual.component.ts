import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { forkJoin } from 'rxjs/observable/forkJoin';
import { of } from 'rxjs/observable/of';
import { mergeMap, take } from 'rxjs/operators';
import { sOrdenComra } from '../../../services/sOrdenComra.service';
import { sOrdenPedido } from '../../../services/sOrdenPedido.service';
import { sCierre } from '../../../services/sCierre.service';

declare var $: any;
declare var Swal: any;

interface CentroCostoItem {
  nombre: string;
  fondo: string;
  letras: string;
}

interface ResumenCentro {
  porcentaje: number;
  texto: string;
}

interface EstilosCentro {
  card: any;
  icon: any;
  text: any;
  meta: any;
  track: any;
  progress: any;
}

@Component({
  selector: 'app-cierre-anual',
  templateUrl: './cierre-anual.component.html',
  styleUrls: ['./cierre-anual.component.css'],
  providers: [
    sOrdenComra,
    sOrdenPedido,
    sCierre
  ]
})
export class CierreAnualComponent implements OnInit, OnChanges {

  @Input() totales: any[];
  @Input() cierres: any[];

  @Output() reload = new EventEmitter<any>();
  @Output() selectCentro = new EventEmitter<string[]>();

  agno: number;
  agnosDisponibles: number[];
  tiposCierre = [
    { value: 'directo', label: 'Directo', description: 'Cierra el centro completo en una sola accion.' },
    { value: 'etapas', label: 'Por etapas', description: 'Organiza el cierre en varias etapas antes de concluirlo.' }
  ];
  cantidadEtapasOpciones = [2, 3, 4, 5, 6];

  centrosCostoItems: CentroCostoItem[] = [];
  cerrar: string[] = [];
  fechaCorte: string = null;
  tipoCierre: string = null;
  cantidadEtapas: number = null;
  etapasCierre: any[] = [];
  cierresHistoricos: any[] = [];
  agnoUltimoCierrePorCentro: { [key: string]: number } = {};

  loading = false;

  /** Porcentaje y texto por centro, precalculados cuando cambian cierres o totales. */
  private resumenPorCentro: { [key: string]: ResumenCentro } = {};
  /** Estilos por centro + estado activo, para no recalcular colores en cada ciclo. */
  private estilosCache: { [key: string]: EstilosCentro } = {};

  constructor(
    private OrdenCompra: sOrdenComra,
    private OrdenPedido: sOrdenPedido,
    private Cierre: sCierre
  ) {
    this.agnosDisponibles = this.buildAgnosDisponibles();
    this.resetFormulario();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.cierres) {
      this.cierresHistoricos = this.cierres || [];
    }

    if (changes.totales) {
      this.centrosCostoItems = this.buildCentrosCostoItems();
      this.estilosCache = {};
    }

    if (changes.cierres || changes.totales) {
      this.rebuildResumenCentros();
    }
  }

  ngOnInit() {
    this.setAgnoDefault();
  }

  // ---------------------------------------------------------------------------
  // Centros de costo (template)
  // ---------------------------------------------------------------------------

  filtraCierresCentroCosto(centroCosto: string): number {
    const resumen = this.resumenPorCentro[centroCosto];
    return resumen ? resumen.porcentaje : 0;
  }

  getTextoPorcentajeCentro(centroCosto: string): string {
    const resumen = this.resumenPorCentro[centroCosto];
    return resumen ? resumen.texto : 'Sin cierre registrado';
  }

  activate(centroCosto: CentroCostoItem) {
    this.cerrar = this.cerrar.includes(centroCosto.nombre) ? [] : [centroCosto.nombre];
    this.selectCentro.emit(this.cerrar);
  }

  isActive(centroCosto: CentroCostoItem): boolean {
    return this.cerrar.includes(centroCosto.nombre);
  }

  limpiarSeleccion() {
    this.cerrar = [];
    this.selectCentro.emit(this.cerrar);
  }

  getCentroCardStyle(centro: CentroCostoItem): any {
    return this.getEstilosCentro(centro).card;
  }

  getCentroIconStyle(centro: CentroCostoItem): any {
    return this.getEstilosCentro(centro).icon;
  }

  getCentroTextStyle(centro: CentroCostoItem): any {
    return this.getEstilosCentro(centro).text;
  }

  getCentroMetaStyle(centro: CentroCostoItem): any {
    return this.getEstilosCentro(centro).meta;
  }

  getCentroProgressTrackStyle(centro: CentroCostoItem): any {
    return this.getEstilosCentro(centro).track;
  }

  getCentroProgressStyle(centro: CentroCostoItem): any {
    return this.getEstilosCentro(centro).progress;
  }

  // ---------------------------------------------------------------------------
  // Formulario
  // ---------------------------------------------------------------------------

  limpiar() {
    this.resetFormulario();
    this.selectCentro.emit(this.cerrar);
  }

  setTipoCierre(tipo: string) {
    this.tipoCierre = tipo;
    this.fechaCorte = null;
    this.limpiarInputFechaCorte();

    if (tipo !== 'etapas') {
      this.cantidadEtapas = null;
      this.etapasCierre = [];
      return;
    }

    if (this.cantidadEtapas) {
      this.buildEtapas();
    }
  }

  setCantidadEtapas(cantidad: number) {
    this.cantidadEtapas = cantidad;
    this.buildEtapas();
  }

  onFechaCorteChange(valorFecha: any) {
    this.fechaCorte = valorFecha ? this.ReturnFecha(valorFecha) : null;
    this.syncEtapasDesdeFechaCorte();
  }

  onFechaInicioEtapaChange(index: number, value: string) {
    if (index !== 0 || !this.etapasCierre[index]) {
      return;
    }

    this.fechaCorte = value ? this.ReturnFecha(value) : null;
    this.etapasCierre[index].fechaInicio = value || null;
    this.syncEtapasDesdeFechaCorte();
  }

  onFechaFinEtapaChange(index: number, value: string) {
    if (!this.etapasCierre[index]) {
      return;
    }

    this.etapasCierre[index].fechaFin = value || null;

    for (let etapaIndex = index + 1; etapaIndex < this.etapasCierre.length; etapaIndex++) {
      const etapaAnterior = this.etapasCierre[etapaIndex - 1];
      this.etapasCierre[etapaIndex].fechaInicio = etapaAnterior && etapaAnterior.fechaFin
        ? this.getNextDateInputValue(etapaAnterior.fechaFin)
        : null;
      this.limpiarFinSiEsInvalido(this.etapasCierre[etapaIndex]);
    }
  }

  ReturnFecha(valorFecha: any): string | null {
    const valor = (valorFecha || '').toString();

    if (valor.includes('/')) {
      const [dia, mes, agno] = valor.split('/');
      return agno + '-' + mes + '-' + dia + 'T00:00:00';
    }

    if (valor.includes('-')) {
      return valor + 'T00:00:00';
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Textos del template
  // ---------------------------------------------------------------------------

  puedeConcluir(): boolean {
    const etapasValidas = this.tipoCierre !== 'etapas' || this.areEtapasConfiguradas();
    const fechaDirectaValida = this.tipoCierre !== 'directo' || !!this.fechaCorte;
    return !!this.agno
      && this.cerrar.length === 1
      && !!this.tipoCierre
      && fechaDirectaValida
      && etapasValidas
      && !this.loading;
  }

  getTextoAccionPrincipal(): string {
    if (this.loading) {
      return 'Procesando cierre...';
    }

    if (!this.agno) {
      return 'Selecciona un año';
    }

    if (!this.cerrar.length) {
      return 'Selecciona un centro de costo';
    }

    if (!this.tipoCierre) {
      return 'Selecciona como quieres cerrar';
    }

    if (this.tipoCierre === 'directo' && !this.fechaCorte) {
      return 'Selecciona la fecha del cierre';
    }

    if (this.tipoCierre === 'etapas' && !this.cantidadEtapas) {
      return 'Indica la cantidad de etapas';
    }

    if (this.tipoCierre === 'etapas' && !this.areEtapasConfiguradas()) {
      return 'Completa las fechas de las etapas';
    }

    return 'Concluir cierre';
  }

  getResumenSeleccion(): string {
    return this.cerrar.length ? this.cerrar[0] : 'Aun no hay centro seleccionado.';
  }

  getFechaCorteVisible(): string {
    if (!this.fechaCorte) {
      return 'Pendiente';
    }

    const fecha = this.fechaCorte.split('T')[0].split('-');
    return fecha[2] + '/' + fecha[1] + '/' + fecha[0];
  }

  getFechaCorteInputVisible(): string {
    return this.fechaCorte ? this.fechaCorte.split('T')[0] : '';
  }

  getPeriodoVisible(): string {
    if (!this.agno) {
      return '--';
    }

    const fechaCorteOperativa = this.getFechaCorteOperativa();
    if (!fechaCorteOperativa) {
      return this.agno.toString();
    }

    const agnoFinal = new Date(fechaCorteOperativa).getFullYear();
    return agnoFinal > this.agno
      ? this.agno + ' - ' + agnoFinal
      : this.agno.toString();
  }

  getTipoCierreVisible(): string {
    if (this.tipoCierre === 'directo') {
      return 'Directo';
    }

    if (this.tipoCierre === 'etapas') {
      return this.cantidadEtapas ? 'Por etapas (' + this.cantidadEtapas + ')' : 'Por etapas';
    }

    return 'Pendiente';
  }

  getResumenEtapas(): string {
    if (this.tipoCierre !== 'etapas') {
      return 'Sin etapas';
    }

    if (!this.cantidadEtapas) {
      return 'Pendiente';
    }

    return this.areEtapasConfiguradas()
      ? this.cantidadEtapas + ' etapas configuradas'
      : this.cantidadEtapas + ' etapas por configurar';
  }

  // ---------------------------------------------------------------------------
  // Cierre
  // ---------------------------------------------------------------------------

  concluir() {
    if (!this.puedeConcluir() || !this.getFechaCorteOperativa()) {
      return;
    }

    const centroCosto = this.cerrar[0];
    this.loading = true;

    forkJoin(
      this.OrdenCompra.getOrdenComprabyCentroCosto(centroCosto),
      this.OrdenPedido.getOrdenPedidobyCentroCosto(centroCosto)
    )
      .pipe(
        mergeMap(([ordenesCompra, ordenesPedido]: any[]) => {
          const cierre: any = {
            _id: null,
            agno: this.agno,
            OC: this.filtrarOrdenesEnPeriodo(ordenesCompra),
            OP: this.filtrarOrdenesEnPeriodo(ordenesPedido),
            detalleCierre: [this.buildDetalleCierre()]
          };

          const actualizaciones = this.cerrarEP(ordenesCompra, cierre.OC, 1)
            .concat(this.cerrarEP(ordenesPedido, cierre.OP, 2));

          const actualizar$: Observable<any> = actualizaciones.length
            ? forkJoin(...actualizaciones)
            : of(null);

          return actualizar$.pipe(mergeMap(() => this.persistirCierre(cierre)));
        })
      )
      .subscribe(() => {
        this.loading = false;
        this.showConcluirSuccess();
        this.reload.emit(null);
      }, (error: any) => this.handleConcluirError(error));
  }

  retEP(estadoPagos: any[]): any[] {
    return (estadoPagos || []).filter(estadoPago =>
      this.isEstadoPagoEnPeriodo(estadoPago) && !estadoPago.cerrado
    );
  }

  cerrarEP(ordenesOriginales: any[], ordenesCierre: any[], tipo: number): Observable<any>[] {
    const idsSeleccionados: { [key: string]: boolean } = {};
    (ordenesCierre || []).forEach(orden => idsSeleccionados[String(orden._id)] = true);

    return (ordenesOriginales || [])
      .filter(orden => !!idsSeleccionados[String(orden._id)])
      .map(orden => {
        orden.estadosPagos = (orden.estadosPagos || []).map(estadoPago =>
          this.isEstadoPagoEnPeriodo(estadoPago) && !estadoPago.cerrado
            ? { ...estadoPago, cerrado: true }
            : { ...estadoPago }
        );

        return tipo == 1
          ? this.OrdenCompra.putOrdenCompra(orden)
          : this.OrdenPedido.putOrdenPedido(orden);
      });
  }

  onlyUnique(value: any, index: number, self: any[]): boolean {
    return self.findIndex(el => el._id === value._id) === index;
  }

  private filtrarOrdenesEnPeriodo(ordenes: any[]): any[] {
    return (ordenes || [])
      .map(orden => ({ ...orden, estadosPagos: this.retEP(orden.estadosPagos || []) }))
      .filter(orden => orden.estadosPagos.length);
  }

  private persistirCierre(cierre: any): Observable<any> {
    return this.Cierre.getCierreByAgno(this.agno).pipe(
      take(1),
      mergeMap((cierreHistorico: any[]) => {
        if (!cierreHistorico || !cierreHistorico.length) {
          return this.Cierre.guardarCierreEnFirebase(cierre);
        }

        const historico = cierreHistorico[0];
        historico.OC = historico.OC && historico.OC.length
          ? historico.OC.concat(cierre.OC).filter(this.onlyUnique)
          : cierre.OC;
        historico.OP = historico.OP && historico.OP.length
          ? historico.OP.concat(cierre.OP).filter(this.onlyUnique)
          : cierre.OP;
        historico.detalleCierre = this.mergeDetalleCierre(historico.detalleCierre, cierre.detalleCierre);

        return this.Cierre.guardarCierreEnFirebase(historico);
      }),
      take(1)
    );
  }

  private handleConcluirError(error: any) {
    console.log(error);
    this.loading = false;
    if (typeof Swal !== 'undefined') {
      Swal.fire('Cierre', 'No fue posible completar el cierre. Intenta nuevamente.', 'error');
    }
  }

  private showConcluirSuccess() {
    if (typeof Swal === 'undefined') {
      return;
    }

    const centro = this.cerrar.length ? this.cerrar[0] : 'centro seleccionado';
    Swal.fire(
      'Cierre',
      'Se ha realizado correctamente el cierre de ' + centro + ' para el periodo ' + this.getPeriodoVisible(),
      'success'
    );
  }

  private buildDetalleCierre(): any {
    const esEtapas = this.tipoCierre === 'etapas';

    return {
      centroCosto: this.cerrar[0],
      tipoCierre: this.tipoCierre,
      cantidadEtapas: esEtapas ? this.cantidadEtapas : 1,
      fechaInicio: esEtapas && this.etapasCierre.length ? this.etapasCierre[0].fechaInicio : null,
      fechaCorte: this.getFechaCorteOperativa(),
      etapas: esEtapas
        ? this.etapasCierre.map(etapa => ({
            numero: etapa.numero,
            fechaInicio: etapa.fechaInicio,
            fechaFin: etapa.fechaFin
          }))
        : []
    };
  }

  private mergeDetalleCierre(actual: any[], nuevo: any[]): any[] {
    const existente = (actual || []).filter(detalle => detalle && detalle.centroCosto !== nuevo[0].centroCosto);
    return existente.concat(nuevo);
  }

  // ---------------------------------------------------------------------------
  // Fechas y etapas
  // ---------------------------------------------------------------------------

  private isEstadoPagoEnPeriodo(estadoPago: any): boolean {
    const fechaPago = this.getDateOnly(estadoPago && estadoPago.fecha);
    const fechaFin = this.getDateOnly(this.getFechaCorteOperativa());
    if (!fechaPago || !fechaFin || fechaPago > fechaFin) {
      return false;
    }

    if (this.tipoCierre !== 'etapas') {
      return true;
    }

    const primeraEtapa = this.etapasCierre.length ? this.etapasCierre[0] : null;
    const fechaInicio = this.getDateOnly(primeraEtapa && primeraEtapa.fechaInicio);
    return !!fechaInicio && fechaPago >= fechaInicio;
  }

  private getDateOnly(value: any): string | null {
    if (!value) {
      return null;
    }

    const date = String(value).split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    const parts = date.split('/');
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }

    return null;
  }

  private getFechaCorteOperativa(): string | null {
    if (this.tipoCierre === 'etapas') {
      const ultimaEtapa = this.etapasCierre.length ? this.etapasCierre[this.etapasCierre.length - 1] : null;
      return ultimaEtapa && ultimaEtapa.fechaFin ? this.ReturnFecha(ultimaEtapa.fechaFin) : null;
    }

    return this.fechaCorte;
  }

  private getFechaCorteInputValue(): string | null {
    return this.fechaCorte ? this.fechaCorte.split('T')[0] : null;
  }

  private buildEtapas() {
    if (!this.cantidadEtapas || this.cantidadEtapas < 2) {
      this.etapasCierre = [];
      return;
    }

    const etapasPrevias = this.etapasCierre || [];
    const fechaBase = this.getFechaCorteInputValue();
    const nuevasEtapas = [];

    for (let index = 0; index < this.cantidadEtapas; index++) {
      const etapaActual = etapasPrevias[index] || {};
      const anterior = index > 0 ? (nuevasEtapas[index - 1] || etapasPrevias[index - 1]) : null;

      nuevasEtapas.push({
        numero: index + 1,
        fechaInicio: index === 0
          ? (etapaActual.fechaInicio || fechaBase)
          : this.getNextDateInputValue(anterior && anterior.fechaFin ? anterior.fechaFin : null),
        fechaFin: etapaActual.fechaFin || null
      });
    }

    this.etapasCierre = nuevasEtapas;
    this.syncEtapasDesdeFechaCorte();
  }

  private syncEtapasDesdeFechaCorte() {
    if (!this.etapasCierre.length) {
      return;
    }

    this.etapasCierre[0].fechaInicio = this.getFechaCorteInputValue();
    this.limpiarFinSiEsInvalido(this.etapasCierre[0]);

    for (let index = 1; index < this.etapasCierre.length; index++) {
      this.etapasCierre[index].fechaInicio = this.getNextDateInputValue(this.etapasCierre[index - 1].fechaFin || null);
      this.limpiarFinSiEsInvalido(this.etapasCierre[index]);
    }
  }

  private limpiarFinSiEsInvalido(etapa: any) {
    if (etapa.fechaFin && etapa.fechaInicio && etapa.fechaFin < etapa.fechaInicio) {
      etapa.fechaFin = null;
    }
  }

  private areEtapasConfiguradas(): boolean {
    return !!this.cantidadEtapas
      && this.etapasCierre.length === this.cantidadEtapas
      && this.etapasCierre.every(etapa => !!etapa.fechaInicio && !!etapa.fechaFin && etapa.fechaFin >= etapa.fechaInicio);
  }

  private getNextDateInputValue(value: string): string | null {
    if (!value) {
      return null;
    }

    const fecha = new Date(value + 'T00:00:00');
    fecha.setDate(fecha.getDate() + 1);
    return this.formatDateInput(fecha);
  }

  private formatDateInput(fecha: Date): string {
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return fecha.getFullYear() + '-' + month + '-' + day;
  }

  // ---------------------------------------------------------------------------
  // Estado inicial
  // ---------------------------------------------------------------------------

  private resetFormulario() {
    this.setAgnoDefault();
    this.cerrar = [];
    this.tipoCierre = null;
    this.cantidadEtapas = null;
    this.etapasCierre = [];
    this.loading = false;
    this.fechaCorte = null;
    this.limpiarInputFechaCorte();
  }

  private limpiarInputFechaCorte() {
    if (typeof $ !== 'undefined') {
      $('#txtfechaCorte').val('');
    }
  }

  private setAgnoDefault() {
    if (!this.agno) {
      this.agno = new Date().getFullYear();
    }
  }

  private buildAgnosDisponibles(): number[] {
    const agnos: number[] = [];
    for (let agno = new Date().getFullYear() + 1; agno >= 2018; agno--) {
      agnos.push(agno);
    }
    return agnos;
  }

  private buildCentrosCostoItems(): CentroCostoItem[] {
    return (this.totales || [])
      .filter(item => !!item && !!item.nombre && !!item.nombre.trim())
      .map(item => ({
        nombre: item.nombre,
        fondo: item.fondo || '#dfe8ef',
        letras: item.letras || '#264052'
      }));
  }

  // ---------------------------------------------------------------------------
  // Historico: porcentajes y ultimo cierre por centro
  // ---------------------------------------------------------------------------

  private rebuildResumenCentros() {
    const resumen: { [key: string]: ResumenCentro } = {};
    const agnos: { [key: string]: number } = {};

    this.centrosCostoItems.forEach(centro => {
      const nombre = centro.nombre;
      const ultimoCierre = this.getUltimoCierrePorCentro(nombre);
      const detalle = this.getDetalleCierreHistorico(ultimoCierre, nombre);

      resumen[nombre] = {
        porcentaje: this.calcularPorcentajeCentro(nombre),
        texto: ultimoCierre
          ? 'Ultimo cierre registrado: ' + this.getPeriodoHistorico(ultimoCierre, detalle)
          : 'Sin cierre registrado'
      };

      if (ultimoCierre) {
        agnos[nombre] = detalle && detalle.fechaCorte
          ? new Date(detalle.fechaCorte).getFullYear()
          : ultimoCierre.agno;
      }
    });

    this.resumenPorCentro = resumen;
    this.agnoUltimoCierrePorCentro = agnos;
  }

  private calcularPorcentajeCentro(centroCosto: string): number {
    if (!this.totales) {
      return 0;
    }

    const totalInfo = this.totales.find(el => el.nombre == centroCosto);
    const totalCentro = totalInfo ? totalInfo.totalCentro : 0;
    if (!totalCentro) {
      return 0;
    }

    return Math.min(100, this.getTotalCerradoCentro(centroCosto) * 100 / totalCentro);
  }

  private getTotalCerradoCentro(centroCosto: string): number {
    const pagosRegistrados: { [key: string]: boolean } = {};
    let total = 0;

    this.cierresHistoricos.forEach(cierre => {
      this.getOrdenesEgresoCentro(cierre, centroCosto).forEach(orden => {
        (orden.estadosPagos || []).forEach(estadoPago => {
          const llave = this.buildPagoCerradoKey(orden, estadoPago);
          if (!pagosRegistrados[llave]) {
            pagosRegistrados[llave] = true;
            total += estadoPago.monto || 0;
          }
        });
      });
    });

    return Math.ceil(total);
  }

  private getUltimoCierrePorCentro(centroCosto: string): any {
    let ultimo = null;
    let fechaUltimo = -Infinity;

    this.cierresHistoricos.forEach(cierre => {
      if (!this.getOrdenesEgresoCentro(cierre, centroCosto).length) {
        return;
      }

      const fecha = this.getFechaCorteHistorica(cierre, centroCosto);
      if (!ultimo || fecha >= fechaUltimo) {
        ultimo = cierre;
        fechaUltimo = fecha;
      }
    });

    return ultimo;
  }

  private getOrdenesEgresoCentro(cierre: any, centroCosto: string): any[] {
    if (!cierre) {
      return [];
    }

    return (cierre.OC || [])
      .concat(cierre.OP || [])
      .filter((orden: any) => orden.ingresoEgreso == 1 && orden.subCentroCosto == centroCosto);
  }

  private getFechaCorteHistorica(cierre: any, centroCosto: string): number {
    if (!cierre) {
      return 0;
    }

    const detalle = this.getDetalleCierreHistorico(cierre, centroCosto);
    if (detalle && detalle.fechaCorte) {
      return new Date(detalle.fechaCorte).getTime();
    }

    return cierre.agno ? new Date(cierre.agno, 11, 31).getTime() : 0;
  }

  private getDetalleCierreHistorico(cierre: any, centroCosto: string): any {
    if (!cierre || !cierre.detalleCierre) {
      return null;
    }

    return cierre.detalleCierre.find((item: any) => item && item.centroCosto === centroCosto) || null;
  }

  private getPeriodoHistorico(cierre: any, detalle: any): string {
    if (!cierre) {
      return 'sin periodo';
    }

    if (!detalle || !detalle.fechaCorte) {
      return cierre.agno ? cierre.agno.toString() : 'sin periodo';
    }

    const agnoFinal = new Date(detalle.fechaCorte).getFullYear();
    if (cierre.agno && agnoFinal > cierre.agno) {
      return cierre.agno + ' - ' + agnoFinal;
    }

    return cierre.agno ? cierre.agno.toString() : agnoFinal.toString();
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

  // ---------------------------------------------------------------------------
  // Colores de las tarjetas
  // ---------------------------------------------------------------------------

  private getEstilosCentro(centro: CentroCostoItem): EstilosCentro {
    const active = this.isActive(centro);
    const key = centro.nombre + '|' + centro.fondo + '|' + centro.letras + '|' + (active ? 1 : 0);

    if (!this.estilosCache[key]) {
      const palette = this.buildCentroPalette(centro, active);
      this.estilosCache[key] = {
        card: { 'background-color': palette.background, 'border-color': palette.border, 'color': palette.text },
        icon: { 'background-color': palette.iconBackground, 'color': palette.iconText },
        text: { 'color': palette.text },
        meta: { 'color': palette.mutedText },
        track: { 'background-color': palette.progressTrack },
        progress: { 'background-color': palette.progressFill }
      };
    }

    return this.estilosCache[key];
  }

  private buildCentroPalette(centro: CentroCostoItem, active: boolean) {
    const fondo = this.normalizeColor(centro && centro.fondo, '#dfe8ef');
    const letras = this.normalizeColor(centro && centro.letras, '#264052');
    const background = this.mixColors(fondo, '#ffffff', active ? 0.78 : 0.88);
    const iconBackground = this.mixColors(fondo, '#ffffff', active ? 0.6 : 0.74);
    const text = this.ensureReadableText(background, letras);

    return {
      background,
      border: this.mixColors(fondo, '#cfd9e1', active ? 0.44 : 0.6),
      text,
      mutedText: this.mixColors(text, '#6c7f8b', active ? 0.2 : 0.42),
      iconBackground,
      iconText: this.ensureReadableText(iconBackground, letras),
      progressTrack: this.mixColors(fondo, '#eef3f7', active ? 0.5 : 0.68),
      progressFill: this.mixColors(fondo, '#8aa1b3', active ? 0.22 : 0.34)
    };
  }

  private ensureReadableText(background: string, preferred: string): string {
    if (this.getContrastRatio(background, preferred) >= 4.2) {
      return preferred;
    }

    return this.getLuminance(background) > 0.62 ? '#244052' : '#ffffff';
  }

  private getContrastRatio(colorA: string, colorB: string): number {
    const luminanceA = this.getLuminance(colorA);
    const luminanceB = this.getLuminance(colorB);
    return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05);
  }

  private getLuminance(color: string): number {
    const rgb = this.hexToRgb(color);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private mixColors(primary: string, secondary: string, secondaryWeight: number): string {
    const weight = Math.max(0, Math.min(1, secondaryWeight));
    const a = this.hexToRgb(primary);
    const b = this.hexToRgb(secondary);

    return this.rgbToHex(
      Math.round(a.r * (1 - weight) + b.r * weight),
      Math.round(a.g * (1 - weight) + b.g * weight),
      Math.round(a.b * (1 - weight) + b.b * weight)
    );
  }

  private normalizeColor(color: string, fallback: string): string {
    if (!color || typeof color !== 'string') {
      return fallback;
    }

    const trimmed = color.trim();

    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
      return trimmed.length === 4
        ? '#' + trimmed.slice(1).split('').map(char => char + char).join('')
        : trimmed;
    }

    const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
      return this.rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
    }

    return fallback;
  }

  private hexToRgb(hex: string) {
    const normalized = this.normalizeColor(hex, '#ffffff').replace('#', '');
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b]
      .map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
      .join('');
  }

}