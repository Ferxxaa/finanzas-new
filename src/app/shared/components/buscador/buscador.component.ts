import { Component, OnInit, Output, EventEmitter, Input, HostListener, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { comunesFechas } from '../../../share/fechas';

import { mProveedor } from '../../../models/mProveedor';
import { mGastos } from '../../../models/mGastos';
import { sProveedor } from '../../../services/sProveedor.service';
import { sCentroCosto } from '../../../services/sCentroCosto.service';
import { sGastos } from '../../../services/sGastos.service';
import { Observable } from 'rxjs/Observable';
import { Buscador } from '../../../models/buscadoEntity';
import { Proveedor } from '../../../models/nestProveedor';
import { TipoGasto } from '../../../models/nestTipoGasto';
import { tipoGastoService } from '../../../services/sTipoGasto.service';
import { SubTipoGasto } from '../../../models/nestSubTipoGasto';
import { subTipoGastoService } from '../../../services/sSubTipoGasto.service';
import { CentroCosto } from '../../../models/nestCentroCosto';
import { centroCostoService } from '../../../services/sCentroCostoNest.service';
import { CuentaCorriente } from '../../../models/mCuentaCorriente';
import { ViewCentroCosto } from '../../../models/nestViewCentroCosto';
import { ViewListadoMovimiento } from '../../../models/nestViewListadoMovimientos';
import { sViewListadoMovimientosService } from '../../../services/sViewListadoMovimientos';
import { viewCentroCostoService } from '../../../services/sViewCentroCosto.service';
import { SCuentaCorrienteService } from '../../../services/s-cuenta-corriente.service';
import { nestProveedorService } from '../../../services/nestProfesional.service';

declare var $: any;

@Component({
  selector: 'buscador',
  templateUrl: './buscador.component.html',
  styleUrls: ['./buscador.component.css'],
  providers: [
    sProveedor,
    comunesFechas,
    tipoGastoService,
    subTipoGastoService,
    centroCostoService,
    SCuentaCorrienteService,
    viewCentroCostoService,
    sViewListadoMovimientosService,
    nestProveedorService
  ]
})
export class BuscadorComponent implements OnInit, OnChanges {

  @Input() vista: any;
  @Input() tipoGasto?: boolean;
  /**
   * Opcional: si el padre deja el buscador siempre creado (con [hidden]), le avisa si está a la vista.
   * Oculto no reacciona a clics afuera. Si no se pasa, se comporta como antes (siempre visible).
   */
  @Input() visible: boolean = true;
  /** Opcional: búsqueda activa del padre. Rellena los campos (ej. al volver a la pantalla) y los limpia si llega vacía. */
  @Input() valores: Buscador | null;
  @Output() event = new EventEmitter<Buscador>();
  /**
   * Opcional: clic afuera del buscador. Si el padre lo escucha, el clic afuera solo cierra (no busca).
   * Si no lo escucha, el clic afuera emite `event` como siempre (pantallas antiguas).
   */
  @Output() cerrar = new EventEmitter<void>();

  //Observables
  // proveedores$: Observable<Proveedor>;
  tiposGastos$: Observable<TipoGasto[]>;
  subTipoGasto$: Observable<SubTipoGasto[]>;
  centroCosto$: Observable<CentroCosto[]>;

  //Array
  proveedores: Array<mProveedor>;
  proveedores$: Observable<Proveedor[]>;
  tiposGastos: mGastos[];

  buscador: Buscador;

  contadorCerrar: number;
  /** Momento en que se mostró: el mismo clic que lo abre no debe cerrarlo. */
  private abiertoEn: number = 0;

  constructor(
    private _sProveedor: sProveedor,
    private _sComunesFechas: comunesFechas,
    private eRef: ElementRef,
    private tipoGastoService: tipoGastoService,
    private subTipoGastoService: subTipoGastoService,
    private centroCostoService: centroCostoService,
    private cuentaCorrienteService: SCuentaCorrienteService,
    private viewCentrocostoService: viewCentroCostoService,
    private viewListadoMovimientoService: sViewListadoMovimientosService,
    private proveedorService: nestProveedorService
  ) {
    this.vista = true;
    this.buscador = this.buscadorVacio();
    this.contadorCerrar = 0;
    this.tiposGastos$ = this.tipoGastoService.getTiposGastos()
    this.subTipoGasto$ = this.subTipoGastoService.getSubTiposGastos();
    this.centroCosto$ = this.centroCostoService.getCentroCosto();
    this.proveedores$ = this.proveedorService.getProveedores();
  }

  ngOnInit() {
    this._sComunesFechas.calendario();
    this.cargaDatos();
    $.getScript("https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.js", (data, textStatus, jqxhr) => {
      $("#drdProveedor").select2();
      $("#drdProveedor").show();
      // Si ya venía una búsqueda, el proveedor se marca cuando select2 está listo
      if (this.buscador.proveedor) { this.marcarProveedorEnSelect(this.buscador.proveedor); }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.visible && this.visible) {
      this.abiertoEn = Date.now();
      this.contadorCerrar = 1;
    }
    if (changes.valores) {
      this.cargarValores(this.valores);
    }
  }

  private buscadorVacio(): Buscador {
    return { inicio: null, termino: null, oc: null, proveedor: '', cCosto: '', factura: null, pago: null, tipoGasto: '', subTipoGasto: '', estado: 0 };
  }

  /** Copia una búsqueda en los campos (o los deja vacíos si no viene ninguna). */
  private cargarValores(valores: Buscador | null) {
    this.buscador = valores ? { ...this.buscadorVacio(), ...JSON.parse(JSON.stringify(valores)) } : this.buscadorVacio();
    // Fechas y proveedor no van por ngModel (datetimepicker y select2): se escriben a mano
    setTimeout(() => {
      $("#txtInicio").val(this.fechaParaInput(this.buscador.inicio));
      $("#txtTermino").val(this.fechaParaInput(this.buscador.termino));
      this.marcarProveedorEnSelect(this.buscador.proveedor || '');
    });
  }

  /** 'YYYY-MM-DD...' -> 'DD/MM/YYYY' para el input con calendario. */
  private fechaParaInput(valor: any): string {
    if (!valor) { return ''; }
    const texto = String(valor);
    const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : texto;
  }

  /** Marca el proveedor en el select2. Reintenta mientras llegan las opciones (vienen por async). */
  private marcarProveedorEnSelect(nombre: string, intento: number = 0) {
    const select = $("#drdProveedor");
    if (!select.length) { return; }
    if (!nombre) {
      select.val('').trigger('change');
      return;
    }
    const existe = select.find('option').filter(function () { return $(this).val() === nombre; }).length > 0;
    if (!existe) {
      if (intento < 20) { setTimeout(() => this.marcarProveedorEnSelect(nombre, intento + 1), 250); }
      return;
    }
    select.val(nombre).trigger('change');
  }

  cargaDatos() {
    this.cargaProveedor();
  }

  private cargaProveedor() {
    this.proveedores = [];
    this._sProveedor.getProveedor().subscribe(res => {
      this.proveedores = res;
    });
  }

  asignaFechaInicio() {
    let temp = ($("#txtInicio").val() || '').trim();
    this.buscador.inicio = temp ? this._sComunesFechas.retFechaParaGuardar(temp) : null;
  }

  asignaFechaTermino() {
    let temp = ($("#txtTermino").val() || '').trim();
    this.buscador.termino = temp ? this._sComunesFechas.retFechaParaGuardar(temp) : null;
  }

  Buscar() {
    // Las fechas se vuelven a leer: si se eligieron con el calendario puede no haber pasado el focusout
    this.asignaFechaInicio();
    this.asignaFechaTermino();

    // Proveedor desde select2; "--- Seleccione ---" o vacío = sin proveedor
    let proveedor = ($('#select2-drdProveedor-container').text() || '').trim();
    if (!$('#select2-drdProveedor-container').length) { proveedor = (this.buscador.proveedor || '').trim(); }
    this.buscador.proveedor = proveedor && !proveedor.includes('---') ? proveedor : '';

    // Textos sin espacios sobrantes; estado "0" (sin elegir) queda en 0
    // (en el modelo son number, pero desde los inputs de texto llegan como string)
    const limpiar = (v: any): any => (v === null || v === undefined) ? null : (String(v).trim() || null);
    const b: any = this.buscador;
    b.oc = limpiar(b.oc);
    b.factura = limpiar(b.factura);
    b.pago = limpiar(b.pago);
    this.buscador.estado = Number(this.buscador.estado) || 0;

    this.contadorCerrar = 0;
    this.event.emit(this.buscador);
  }

  /** Deja todos los campos vacíos y emite la búsqueda vacía (el padre la toma como "limpiar"). */
  Limpiar() {
    this.cargarValores(null);
    this.contadorCerrar = 0;
    this.event.emit(this.buscador);
  }

  @HostListener('document:click', ['$event'])
  clickout(event) {
    if (!this.visible) { return; }
    const target = event ? event.target : null;
    // Clics que no cuentan como "afuera": el mismo que lo abrió, elementos que ya no están en la página
    // y las listas de select2 / calendario, que se dibujan fuera del buscador
    if (Date.now() - this.abiertoEn < 300) { return; }
    if (target && !document.body.contains(target)) { return; }
    if (target && $(target).closest('.select2-container, .select2-dropdown, .bootstrap-datetimepicker-widget, .datepicker').length) { return; }

    if (!this.eRef.nativeElement.contains(target) && this.contadorCerrar) {
      if (this.cerrar.observers.length > 0) {
        this.cerrar.emit();
      } else {
        this.event.emit(this.buscador);
      }
    }
    if (!this.contadorCerrar)
      this.contadorCerrar = 1;
  }

  retCuentacorrienteConfirmados(buscador: Buscador): Observable<CuentaCorriente[]> {
    return this.cuentaCorrienteService.getCuentaCorrienteConfirmadosFilter(buscador)
  }

  retCuentacorrientePendientes(buscador: Buscador): Observable<CuentaCorriente[]> {
    return this.cuentaCorrienteService.getCuentaCorrientePendientesfilter(buscador)
  }

  retViewCentroCostoConfirmados(id: number, buscador: Buscador): Observable<ViewCentroCosto[]> {
    return this.viewCentrocostoService.getViewCentroCostoByConfirmadosFilter(id, buscador)
  }

  retViewCentroCostoPendientes(id: number, buscador: Buscador): Observable<ViewCentroCosto[]> {
    return this.viewCentrocostoService.getViewCentroCostoByPendientesFilter(id, buscador)
  }

  retViewListadoMovimientos(buscador: Buscador): Observable<ViewListadoMovimiento[]> {
    return this.viewListadoMovimientoService.getViewListadoMovimientosFilter(buscador)
  }

}