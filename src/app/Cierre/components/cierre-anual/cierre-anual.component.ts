import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { mCentroCosto } from '../../../models/mCentroCosto';
import { sCentroCosto } from '../../../services/sCentroCosto.service';
import { sOrdenComra } from '../../../services/sOrdenComra.service';
import { forkJoin } from 'rxjs/observable/forkJoin'
import { mOrdenCompra } from '../../../models/mOrdenCompra';
import { sOrdenPedido } from '../../../services/sOrdenPedido.service';
import { sCierre } from '../../../services/sCierre.service';

declare var $: any;
declare var Swal: any;

@Component({
  selector: 'app-cierre-anual',
  templateUrl: './cierre-anual.component.html',
  styleUrls: ['./cierre-anual.component.css'],
  providers: [
    sCentroCosto,
    sOrdenComra,
    sOrdenPedido,
    sCierre
  ]
})
export class CierreAnualComponent implements OnInit {

  private readonly centrosExcluidos = ['canil', 'coanil'];
  private readonly centrosExcluidosPorCoincidencia = ['otro', 'vario', 'operacional'];

  @Input() totales: any[];

  @Output() reload = new EventEmitter();
  @Output() selectCentro = new EventEmitter();
  @Output() listado = new EventEmitter();

  agno: number;
  agnosDisponibles: number[];
  tiposCierre: any[];
  cantidadEtapasOpciones: number[];

  centroCosto$: Observable<mCentroCosto[]>
  centrosCostoItems: mCentroCosto[];
  cerrar: string[];
  fechaCorte: string;
  tipoCierre: string;
  cantidadEtapas: number;
  etapasCierre: any[];
  arrConcluir: mOrdenCompra[];
  cerrados: any[];
  cierresHistoricos: any[];
  agnoUltimoCierrePorCentro: { [key: string]: number };

  loading: boolean;

  listado$: Observable<any>;

  constructor(
    private _sCentroCosto: sCentroCosto,
    private OrdenCompra: sOrdenComra,
    private OrdenPedido: sOrdenPedido,
    private Cierre: sCierre
  ) {
    this.limpiar()
    this.agnosDisponibles = this.buildAgnosDisponibles();
    this.tiposCierre = [
      { value: 'directo', label: 'Directo', description: 'Cierra el centro completo en una sola accion.' },
      { value: 'etapas', label: 'Por etapas', description: 'Organiza el cierre en varias etapas antes de concluirlo.' }
    ];
    this.cantidadEtapasOpciones = [2, 3, 4, 5, 6];
  }

  ngOnInit() {
    this.setAgnoDefault();
    this.getCierres();
    this.loadCentrosCosto();
  }

  getCierres() {
    this.listado$.subscribe(allCerrados => {
      this.cierresHistoricos = allCerrados || [];
      this.rebuildAgnoUltimoCierrePorCentro();
      this.listado.emit(allCerrados);
      let allOrdenes = allCerrados.map(el => ({ agno: el.agno, allOC: el.OC.concat(el.OP).filter(el => el.ingresoEgreso == 1) }))
      this.cerrados = allOrdenes.reduce((acc, el) => acc.concat(el.allOC), [])
      // console.log(this.cerrados);
    })
  }

  filtraCierresCentroCosto(centroCosto): number {
    if (!this.cierresHistoricos || !this.totales) {
      return 0;
    }

    const totalInfo = this.totales.find(el => el.nombre == centroCosto);
    const totalCentro = totalInfo ? totalInfo.totalCentro : 0;
    if (!totalCentro) {
      return 0;
    }

    const totalCerradoCentro = this.getTotalCerradoCentro(centroCosto);
    return Math.min(100, totalCerradoCentro * 100 / totalCentro);
  }

  activate(centroCosto: mCentroCosto) {
    if (this.cerrar.includes(centroCosto.nombre))
      this.cerrar = []
    else
      this.cerrar = [centroCosto.nombre]
    this.selectCentro.emit(this.cerrar)
  }

  isActive(centroCosto: mCentroCosto): boolean {
    // console.log(this.cerrar);
    if (this.cerrar.includes(centroCosto.nombre))
      return true;
    else
      return false;
  }

  AsignaFechaCorte() {
    const valorFecha = $('#txtfechaCorte').val();
    this.onFechaCorteChange(valorFecha);
  }

  onFechaCorteChange(valorFecha: any) {
    this.fechaCorte = valorFecha ? this.ReturnFecha(valorFecha) : null;
    this.syncEtapasDesdeFechaCorte();
  }

  abrirCalendarioFechaCorte() {
    if (!$) {
      return;
    }

    const inputFecha = $('#txtfechaCorte');
    if (!inputFecha || !inputFecha.length) {
      return;
    }

    const nativeInput = inputFecha.get(0);
    nativeInput.focus();

    if (nativeInput && typeof nativeInput.showPicker === 'function') {
      nativeInput.showPicker();
      return;
    }

    if (nativeInput && typeof nativeInput.click === 'function') {
      nativeInput.click();
    }

    inputFecha.trigger('click');
  }

  ReturnFecha(valorFecha: any) {
    const valor = (valorFecha || '').toString();

    if (valor.includes('/')) {
      let dia = valor.split("/")[0];
      let mes = valor.split("/")[1];
      let agno = valor.split("/")[2];
      return agno + "-" + mes + "-" + dia + "T00:00:00";
    }

    if (valor.includes('-')) {
      return valor + 'T00:00:00';
    }

    return null;
  }

  limpiar() {
    this.listado$ = this.Cierre.getCierre();
    this.centroCosto$ = this._sCentroCosto.getCentroCosto();
    this.setAgnoDefault();
    this.cerrar = [];
    this.tipoCierre = null;
    this.cantidadEtapas = null;
    this.etapasCierre = [];
    this.arrConcluir = [];
    this.agnoUltimoCierrePorCentro = {};
    this.loading = false;
    this.fechaCorte = null;
    if ($) {
      $('#txtfechaCorte').val('');
    }
    this.selectCentro.emit(this.cerrar);
  }

  concluir() {
    if (!this.puedeConcluir()) {
      return;
    }

    const fechaCorteOperativa = this.getFechaCorteOperativa();
    let arrObservable: Observable<any>[] = [];
    let arrObservablePedido: Observable<any>[] = [];
    // this.arrConcluir = [];
    this.loading = true;
    let cierre: any = { _id: null, agno: this.agno, OC: null, OP: null, detalleCierre: [] };
    if (!fechaCorteOperativa) {
      this.loading = false;
      return;
    }
    // console.log(this.fechaCorte);

    this.cerrar.forEach(centroCosto => {
      arrObservable.push(this.OrdenCompra.getOrdenComprabyCentroCosto(centroCosto));
      arrObservablePedido.push(this.OrdenPedido.getOrdenPedidobyCentroCosto(centroCosto));
    });
    forkJoin(...arrObservable).subscribe(res => {
      // let mapa = res.map(el => el.filter(fil => new Date(this.retEstadoPagoMayor(fil.estadosPagos)) <= new Date(this.fechaCorte)))
      let mapa = res
        .map(el => el
          .filter(fil => fil.estadosPagos
            .filter(element => new Date(element.fecha) <= new Date(fechaCorteOperativa)).length)
          .map(mapa => ({ ...mapa, estadosPagos: this.retEP(mapa.estadosPagos) })));
      let redu = mapa.reduce((acc, el) => acc.concat(el), []);
      // this.arrConcluir.push(redu);
      cierre.OC = redu;
      forkJoin(...arrObservablePedido).subscribe(Pedido => {
        // let mapa2 = Pedido.map(el => el.filter(fil => new Date(this.retEstadoPagoMayor(fil.estadosPagos)) <= new Date(this.fechaCorte)))
        let mapa2 = Pedido
          .map(el => el
            .filter(fil => fil.estadosPagos
              .filter(element => new Date(element.fecha) <= new Date(fechaCorteOperativa)).length)
            .map(mapa => ({ ...mapa, estadosPagos: this.retEP(mapa.estadosPagos) })));
        let redu2 = mapa2.reduce((acc, el) => acc.concat(el), []);
        // this.arrConcluir.push(redu2);
        cierre.OP = redu2;
        cierre.detalleCierre = [this.buildDetalleCierre()];
        const actualizacionesOrdenes = this.cerrarEP(res[0], cierre.OC, 1).concat(this.cerrarEP(Pedido[0], cierre.OP, 2));

        if (!actualizacionesOrdenes.length) {
          this.persistirCierre(cierre);
          return;
        }

        forkJoin(...actualizacionesOrdenes).subscribe(() => {
          this.persistirCierre(cierre);
        }, (error: any) => this.handleConcluirError(error));
      }, (error: any) => this.handleConcluirError(error));
    }, (error: any) => this.handleConcluirError(error));
  }

  // retPoseeFechaEnRango(el, i, arr): boolean {
  //   return el.estadosPagos.filter(element => new Date(element.fecha) <= new Date(this.fechaCorte)).length;
  //   // fil => 
  //   //                     fil.estadosPagos.filter(element => 
  //   //                       new Date(element.fecha) <= new Date(this.fechaCorte)).length
  // }

  cerrarEP(OC: any[], cierre: any[], tipo: number): Observable<any>[] {
    const fechaCorteOperativa = this.getFechaCorteOperativa();
    let ordenes = OC.filter(ordenes => {
      if (cierre.map(el => el._id).includes(ordenes._id)) {
        ordenes.estadosPagos = ordenes.estadosPagos.map(el => {
          if (el.fecha && fechaCorteOperativa && new Date(el.fecha) <= new Date(fechaCorteOperativa))
            return { ...el, cerrado: true }
          else
            return { ...el }
        })
        return true
      }
      return false
    });
    return ordenes.map(orden => tipo == 1
      ? this.OrdenCompra.putOrdenCompra(orden)
      : this.OrdenPedido.putOrdenPedido(orden));
  }

  persistirCierre(cierre: any) {
    this.Cierre.getCierreByAgno(this.agno).subscribe(cierreHistorico => {
      if (cierreHistorico.length) {
        cierreHistorico[0].OC.length ? cierreHistorico[0].OC = cierreHistorico[0].OC.concat(cierre.OC).filter(this.onlyUnique) : cierreHistorico[0].OC = cierre.OC;
        cierreHistorico[0].OP.length ? cierreHistorico[0].OP = cierreHistorico[0].OP.concat(cierre.OP).filter(this.onlyUnique) : cierreHistorico[0].OP = cierre.OP;
        cierreHistorico[0].detalleCierre = this.mergeDetalleCierre(cierreHistorico[0].detalleCierre, cierre.detalleCierre);

        this.Cierre.putBolsa(cierreHistorico[0]).subscribe(() => {
          this.loading = false;
          this.showConcluirSuccess();
          this.reload.emit(null);
        }, (error: any) => this.handleConcluirError(error));
      } else {
        this.Cierre.postBolsa(cierre).subscribe(() => {
          this.loading = false;
          this.showConcluirSuccess();
          this.reload.emit(null);
        }, (error: any) => this.handleConcluirError(error));
      }
    }, (error: any) => this.handleConcluirError(error));
  }

  handleConcluirError(error: any) {
    console.log(error);
    this.loading = false;
    if (typeof Swal !== 'undefined') {
      Swal.fire(
        'Cierre',
        'No fue posible completar el cierre. Intenta nuevamente.',
        'error'
      );
    }
  }

  retEP(estadoPagos: any[]): any[] {
    const fechaCorteOperativa = this.getFechaCorteOperativa();
    return estadoPagos.filter(el => el.fecha && fechaCorteOperativa && new Date(el.fecha) <= new Date(fechaCorteOperativa) && !el.cerrado);
  }

  retTotalEstadosPago(estadoPagos: any[]): number {
    return (estadoPagos || []).reduce((acc, el) => acc + (el.monto || 0), 0);
  }

  getCentroDetalleHistorico(centroCosto: string): any {
    const cierreMasReciente = this.getUltimoCierrePorCentro(centroCosto);
    if (!cierreMasReciente || !cierreMasReciente.detalleCierre) {
      return null;
    }

    return cierreMasReciente.detalleCierre.find(detalle => detalle.centroCosto === centroCosto) || null;
  }

  getTextoPorcentajeCentro(centroCosto: string): string {
    const cierreMasReciente = this.getUltimoCierrePorCentro(centroCosto);
    if (!cierreMasReciente) {
      return 'Sin cierre registrado';
    }

    const detalle = this.getCentroDetalleHistorico(centroCosto);
    const periodo = this.getPeriodoHistorico(cierreMasReciente, detalle);
    return 'Ultimo cierre registrado: ' + periodo;
  }

  getAgnoUltimoCierreCentro(centroCosto: string): number | null {
    if (Object.prototype.hasOwnProperty.call(this.agnoUltimoCierrePorCentro || {}, centroCosto)) {
      return this.agnoUltimoCierrePorCentro[centroCosto];
    }

    const cierreMasReciente = this.getUltimoCierrePorCentro(centroCosto);
    if (!cierreMasReciente) {
      return null;
    }

    const detalle = this.getDetalleCierreHistorico(cierreMasReciente, centroCosto);
    return detalle && detalle.fechaCorte
      ? new Date(detalle.fechaCorte).getFullYear()
      : cierreMasReciente.agno;
  }

  retEstadoPagoMayor(arr: any[]) {
    let fecha = null;
    arr.forEach(el => {
      if (new Date(fecha) <= new Date(el.fecha))
        fecha = el.fecha
    });
    return fecha
  }

  onlyUnique(value, index, self) {
    return self.findIndex(el => el._id === value._id) === index;
  }

  puedeConcluir(): boolean {
    const etapasValidas = this.tipoCierre !== 'etapas' || this.areEtapasConfiguradas();
    const fechaDirectaValida = this.tipoCierre !== 'directo' || !!this.fechaCorte;
    return !!this.agno && this.cerrar.length === 1 && !!this.tipoCierre && fechaDirectaValida && etapasValidas && !this.loading;
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
    if (!this.cerrar.length) {
      return 'Aun no hay centro seleccionado.';
    }

    return this.cerrar[0];
  }

  getFechaCorteVisible(): string {
    if (!this.fechaCorte) {
      return 'Pendiente';
    }

    const fecha = this.fechaCorte.split('T')[0].split('-');
    return fecha[2] + '/' + fecha[1] + '/' + fecha[0];
  }

  getFechaCorteInputVisible(): string {
    if (!this.fechaCorte) {
      return '';
    }

    return this.fechaCorte.split('T')[0];
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

  seleccionarTodos() {
    this.cerrar = (this.centrosCostoItems || []).map(centro => centro.nombre);
    this.selectCentro.emit(this.cerrar);
  }

  limpiarSeleccion() {
    this.cerrar = [];
    this.selectCentro.emit(this.cerrar);
  }

  setTipoCierre(tipo: string) {
    this.tipoCierre = tipo;
    if (tipo !== 'etapas') {
      this.fechaCorte = null;
      if ($) {
        $('#txtfechaCorte').val('');
      }
      this.cantidadEtapas = null;
      this.etapasCierre = [];
    } else {
      this.fechaCorte = null;
      if ($) {
        $('#txtfechaCorte').val('');
      }

      if (this.cantidadEtapas) {
        this.buildEtapas();
      }
    }
  }

  setCantidadEtapas(cantidad: number) {
    this.cantidadEtapas = cantidad;
    this.buildEtapas();
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

      if (this.etapasCierre[etapaIndex].fechaFin && this.etapasCierre[etapaIndex].fechaInicio && this.etapasCierre[etapaIndex].fechaFin < this.etapasCierre[etapaIndex].fechaInicio) {
        this.etapasCierre[etapaIndex].fechaFin = null;
      }
    }
  }

  onFechaInicioEtapaChange(index: number, value: string) {
    if (index !== 0 || !this.etapasCierre[index]) {
      return;
    }

    this.fechaCorte = value ? this.ReturnFecha(value) : null;
    this.etapasCierre[index].fechaInicio = value || null;
    this.syncEtapasDesdeFechaCorte();
  }

  getResumenEtapas(): string {
    if (this.tipoCierre !== 'etapas') {
      return 'Sin etapas';
    }

    if (!this.cantidadEtapas) {
      return 'Pendiente';
    }

    if (!this.areEtapasConfiguradas()) {
      return this.cantidadEtapas + ' etapas por configurar';
    }

    return this.cantidadEtapas + ' etapas configuradas';
  }

  getCentroCardStyle(centro: any): any {
    const palette = this.buildCentroPalette(centro, this.isActive(centro));
    return {
      'background-color': palette.background,
      'border-color': palette.border,
      'color': palette.text
    };
  }

  getCentroIconStyle(centro: any): any {
    const palette = this.buildCentroPalette(centro, this.isActive(centro));
    return {
      'background-color': palette.iconBackground,
      'color': palette.iconText
    };
  }

  getCentroTextStyle(centro: any): any {
    const palette = this.buildCentroPalette(centro, this.isActive(centro));
    return {
      'color': palette.text
    };
  }

  getCentroMetaStyle(centro: any): any {
    const palette = this.buildCentroPalette(centro, this.isActive(centro));
    return {
      'color': palette.mutedText
    };
  }

  getCentroProgressTrackStyle(centro: any): any {
    const palette = this.buildCentroPalette(centro, this.isActive(centro));
    return {
      'background-color': palette.progressTrack
    };
  }

  getCentroProgressStyle(centro: any): any {
    const palette = this.buildCentroPalette(centro, this.isActive(centro));
    return {
      'background-color': palette.progressFill
    };
  }

  private buildAgnosDisponibles(): number[] {
    const currentYear = new Date().getFullYear();
    const agnos: number[] = [];

    for (let agno = 2018; agno <= currentYear + 1; agno++) {
      agnos.push(agno);
    }

    return agnos.reverse();
  }

  private setAgnoDefault() {
    if (!this.agno) {
      this.agno = new Date().getFullYear();
    }
  }

  private loadCentrosCosto() {
    this.centroCosto$.subscribe(centros => {
      this.centrosCostoItems = (centros || [])
        .reduce((acc, item) => acc.concat(item.subCentroCosto || []), [])
        .filter(item => !!item && !!item.nombre)
        .filter(item => this.isCentroVisible(item.nombre));
      this.rebuildAgnoUltimoCierrePorCentro();
    });
  }

  private isCentroVisible(nombre: string): boolean {
    const centroNormalizado = (nombre || '').trim().toLowerCase();
    if (!centroNormalizado) {
      return false;
    }

    if (this.centrosExcluidos.indexOf(centroNormalizado) !== -1) {
      return false;
    }

    return !this.centrosExcluidosPorCoincidencia.some(fragmento => centroNormalizado.indexOf(fragmento) !== -1);
  }

  private buildEtapas() {
    if (!this.cantidadEtapas || this.cantidadEtapas < 2) {
      this.etapasCierre = [];
      return;
    }

    const etapasPrevias = this.etapasCierre || [];
    const fechaBase = this.getFechaCorteInputValue();
    this.etapasCierre = Array.from({ length: this.cantidadEtapas }, (_, index) => {
      const etapaAnterior = index > 0 ? etapasPrevias[index - 1] : null;
      const etapaActual = etapasPrevias[index] || {};
      const fechaInicio = index === 0
        ? (etapaActual.fechaInicio || fechaBase)
        : this.getNextDateInputValue((this.etapasCierre[index - 1] && this.etapasCierre[index - 1].fechaFin) || (etapaAnterior && etapaAnterior.fechaFin) || null);

      return {
        numero: index + 1,
        fechaInicio: fechaInicio,
        fechaFin: etapaActual.fechaFin || null
      };
    });

    this.syncEtapasDesdeFechaCorte();
  }

  private syncEtapasDesdeFechaCorte() {
    if (!this.etapasCierre || !this.etapasCierre.length) {
      return;
    }

    const fechaBase = this.getFechaCorteInputValue();
    this.etapasCierre[0].fechaInicio = fechaBase;
    if (this.etapasCierre[0].fechaFin && this.etapasCierre[0].fechaInicio && this.etapasCierre[0].fechaFin < this.etapasCierre[0].fechaInicio) {
      this.etapasCierre[0].fechaFin = null;
    }

    for (let index = 1; index < this.etapasCierre.length; index++) {
      this.etapasCierre[index].fechaInicio = this.getNextDateInputValue(this.etapasCierre[index - 1].fechaFin || null);
      if (this.etapasCierre[index].fechaFin && this.etapasCierre[index].fechaInicio && this.etapasCierre[index].fechaFin < this.etapasCierre[index].fechaInicio) {
        this.etapasCierre[index].fechaFin = null;
      }
    }
  }

  private getFechaCorteInputValue(): string | null {
    if (!this.fechaCorte) {
      return null;
    }

    return this.fechaCorte.split('T')[0];
  }

  private getFechaCorteOperativa(): string | null {
    if (this.tipoCierre === 'etapas') {
      const ultimaEtapa = this.etapasCierre && this.etapasCierre.length
        ? this.etapasCierre[this.etapasCierre.length - 1]
        : null;

      return ultimaEtapa && ultimaEtapa.fechaFin
        ? this.ReturnFecha(ultimaEtapa.fechaFin)
        : null;
    }

    return this.fechaCorte;
  }

  private formatDateInput(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  private getNextDateInputValue(value: string): string | null {
    if (!value) {
      return null;
    }

    const fecha = new Date(value + 'T00:00:00');
    fecha.setDate(fecha.getDate() + 1);
    return this.formatDateInput(fecha);
  }

  private areEtapasConfiguradas(): boolean {
    return !!this.cantidadEtapas
      && this.etapasCierre.length === this.cantidadEtapas
      && this.etapasCierre.every(etapa => !!etapa.fechaInicio && !!etapa.fechaFin && etapa.fechaFin >= etapa.fechaInicio);
  }

  private getUltimoCierrePorCentro(centroCosto: string): any {
    return (this.cierresHistoricos || []).reduce((ultimoCierre, cierreActual) => {
      if (!this.cierreIncluyeCentro(cierreActual, centroCosto)) {
        return ultimoCierre;
      }

      if (!ultimoCierre) {
        return cierreActual;
      }

      return this.getFechaCorteHistorica(cierreActual, centroCosto) >= this.getFechaCorteHistorica(ultimoCierre, centroCosto)
        ? cierreActual
        : ultimoCierre;
    }, null);
  }

  private getFechaCorteHistorica(cierre: any, centroCosto: string): number {
    if (!cierre) {
      return 0;
    }

    const detalle = this.getDetalleCierreHistorico(cierre, centroCosto);
    if (detalle && detalle.fechaCorte) {
      return new Date(detalle.fechaCorte).getTime();
    }

    return cierre.agno
      ? new Date(cierre.agno, 11, 31).getTime()
      : 0;
  }

  private getDetalleCierreHistorico(cierre: any, centroCosto: string): any {
    if (!cierre || !cierre.detalleCierre) {
      return null;
    }

    return cierre.detalleCierre.find((item: any) => item && item.centroCosto === centroCosto) || null;
  }

  private cierreIncluyeCentro(cierre: any, centroCosto: string): boolean {
    return !!cierre && (cierre.OC || []).concat(cierre.OP || [])
      .some((orden: any) => orden.ingresoEgreso == 1 && orden.subCentroCosto == centroCosto);
  }

  private rebuildAgnoUltimoCierrePorCentro() {
    const cache: { [key: string]: number } = {};

    (this.centrosCostoItems || []).forEach((centro: any) => {
      const cierreMasReciente = this.getUltimoCierrePorCentro(centro.nombre);
      if (!cierreMasReciente) {
        return;
      }

      const detalle = this.getDetalleCierreHistorico(cierreMasReciente, centro.nombre);
      cache[centro.nombre] = detalle && detalle.fechaCorte
        ? new Date(detalle.fechaCorte).getFullYear()
        : cierreMasReciente.agno;
    });

    this.agnoUltimoCierrePorCentro = cache;
  }

  private getMontoMovimiento(movimiento: any): number {
    if (!movimiento) {
      return 0;
    }

    return movimiento.monto || movimiento.costo || 0;
  }

  private getPeriodoHistorico(cierre: any, detalle: any): string {
    if (!cierre) {
      return 'sin periodo';
    }

    if (!detalle || !detalle.fechaCorte) {
      return cierre.agno ? cierre.agno.toString() : 'sin periodo';
    }

    const agnoFinal = new Date(detalle.fechaCorte).getFullYear();
    return cierre.agno && agnoFinal > cierre.agno
      ? cierre.agno + ' - ' + agnoFinal
      : (cierre.agno ? cierre.agno.toString() : agnoFinal.toString());
  }

  private getTotalCerradoCentro(centroCosto: string): number {
    const pagosRegistrados: { [key: string]: boolean } = {};

    return Math.ceil((this.cierresHistoricos || []).reduce((totalAcumulado, cierre) => {
      const ordenesCentro = (cierre.OC || [])
        .concat(cierre.OP || [])
        .filter((orden: any) => orden.ingresoEgreso == 1 && orden.subCentroCosto == centroCosto);

      const totalCierre = ordenesCentro.reduce((totalOrdenes: number, orden: any) => {
        const totalPagos = (orden.estadosPagos || []).reduce((totalPagosOrden: number, estadoPago: any) => {
          const llavePago = this.buildPagoCerradoKey(orden, estadoPago);
          if (pagosRegistrados[llavePago]) {
            return totalPagosOrden;
          }

          pagosRegistrados[llavePago] = true;
          return totalPagosOrden + (estadoPago.monto || 0);
        }, 0);

        return totalOrdenes + totalPagos;
      }, 0);

      return totalAcumulado + totalCierre;
    }, 0));
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

  private buildDetalleCierre(): any {
    return {
      centroCosto: this.cerrar[0],
      tipoCierre: this.tipoCierre,
      cantidadEtapas: this.tipoCierre === 'etapas' ? this.cantidadEtapas : 1,
      fechaCorte: this.getFechaCorteOperativa(),
      etapas: this.tipoCierre === 'etapas'
        ? (this.etapasCierre || []).map(etapa => ({
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

  private showConcluirSuccess() {
    if (typeof Swal === 'undefined') {
      return;
    }

    const centro = this.cerrar && this.cerrar.length ? this.cerrar[0] : 'centro seleccionado';
    const periodo = this.getPeriodoVisible();
    Swal.fire(
      'Cierre',
      'Se ha realizado correctamente el cierre de ' + centro + ' para el periodo ' + periodo,
      'success'
    );
  }

  private buildCentroPalette(centro: any, active: boolean) {
    const fondo = this.normalizeColor(centro && centro.fondo, '#dfe8ef');
    const letras = this.normalizeColor(centro && centro.letras, '#264052');
    const softenedBackground = this.mixColors(fondo, '#ffffff', active ? 0.78 : 0.88);
    const softenedBorder = this.mixColors(fondo, '#cfd9e1', active ? 0.44 : 0.6);
    const iconBackground = this.mixColors(fondo, '#ffffff', active ? 0.6 : 0.74);
    const progressTrack = this.mixColors(fondo, '#eef3f7', active ? 0.5 : 0.68);
    const progressFill = this.mixColors(fondo, '#8aa1b3', active ? 0.22 : 0.34);

    return {
      background: softenedBackground,
      border: softenedBorder,
      text: this.ensureReadableText(softenedBackground, letras),
      mutedText: this.mixColors(this.ensureReadableText(softenedBackground, letras), '#6c7f8b', active ? 0.2 : 0.42),
      iconBackground: iconBackground,
      iconText: this.ensureReadableText(iconBackground, letras),
      progressTrack: progressTrack,
      progressFill: progressFill
    };
  }

  private ensureReadableText(background: string, preferred: string): string {
    return this.getContrastRatio(background, preferred) >= 4.2
      ? preferred
      : this.getLuminance(background) > 0.62
        ? '#244052'
        : '#ffffff';
  }

  private getContrastRatio(colorA: string, colorB: string): number {
    const luminanceA = this.getLuminance(colorA);
    const luminanceB = this.getLuminance(colorB);
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private getLuminance(color: string): number {
    const rgb = this.hexToRgb(this.normalizeColor(color, '#ffffff'));
    const channels = [rgb.r, rgb.g, rgb.b].map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  private mixColors(primary: string, secondary: string, secondaryWeight: number): string {
    const safeWeight = Math.max(0, Math.min(1, secondaryWeight));
    const primaryRgb = this.hexToRgb(this.normalizeColor(primary, '#ffffff'));
    const secondaryRgb = this.hexToRgb(this.normalizeColor(secondary, '#ffffff'));
    const mixed = {
      r: Math.round(primaryRgb.r * (1 - safeWeight) + secondaryRgb.r * safeWeight),
      g: Math.round(primaryRgb.g * (1 - safeWeight) + secondaryRgb.g * safeWeight),
      b: Math.round(primaryRgb.b * (1 - safeWeight) + secondaryRgb.b * safeWeight)
    };

    return this.rgbToHex(mixed.r, mixed.g, mixed.b);
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
