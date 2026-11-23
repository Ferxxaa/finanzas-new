import { AfterViewInit, Component, OnInit, ViewChild } from "@angular/core";

import { mOrdenCompra } from "../../../models/mOrdenCompra";
import { mCuentas } from "../../../models/mCuentas";

import { sOrdenComra } from "../../../services/sOrdenComra.service";
import { sCuentas } from "../../../services/sCuentas.service";
import { sCotizacion } from "../../../services/sCotizacion.service";

//Config
import { sMonto } from "../../../services/sMonto.service";
import { sUsuario } from "../../../services/sUsuario.service";
import { sOrdenPedido } from "../../../services/sOrdenPedido.service";

import { comunesFechas } from "./../../../share/fechas";
import { sCajaChica } from "../../../services/sCajaChica";
import { sProfesionales } from "../../../services/sProfesionales.service";
import { Observable, Subject } from "rxjs";
import { CuentaCorriente } from "../../../models/mCuentaCorriente";
import { SCuentaCorrienteService } from "../../../services/s-cuenta-corriente.service";
import { Buscador } from "../../../models/buscadoEntity";
import { BuscadorComponent } from "../../../shared/components/buscador/buscador.component";

declare var $: any;
declare var Swal: any;

/** Llave donde se guarda la búsqueda activa (dura mientras la pestaña del navegador esté abierta). */
const KEY_FILTRO_CUENTA_CORRIENTE = "cuentaCorriente.filtro";

@Component({
  selector: "app-cuenta-corriente",
  templateUrl: "./cuenta-corriente.component.html",
  styleUrls: ["./cuenta-corriente.component.css"],
  providers: [
    sOrdenComra,
    sCuentas,
    sCotizacion,
    sMonto,
    sUsuario,
    sOrdenPedido,
    comunesFechas,
    sCajaChica,
    sProfesionales,
    SCuentaCorrienteService
  ],
})
export class CuentaCorrienteComponent implements OnInit, AfterViewInit {
  Flujos: Array<any>;
  Pendientes: Array<any>;
  Confirmados: Array<any>;
  ordenesPedido: Array<any>;
  ordenCompra: mOrdenCompra;
  ordenPedido: any;

  total: number;
  actual: number;
  imprimir: boolean;

  Ordenes$: Observable<mOrdenCompra[]>
  ngUnsubscribe: Subject<void> = new Subject<void>();

  @ViewChild(BuscadorComponent) BuscadorComponent: BuscadorComponent;

  //OC
  adjunto: any;
  pagar: number;
  totalOC: number;
  afecto: number;
  TotalPagar: number;
  indice: number;

  pagarSinFactura: boolean;
  /** Muestra/oculta el panel del buscador. El buscador queda siempre creado (solo se oculta) para no perder lo escrito. */
  buscador: boolean;
  /** Búsqueda activa. Se mantiene al abrir/cerrar un movimiento, al actualizar y al volver a la pantalla, hasta que el usuario la limpie. */
  filtro: Buscador | null;

  creador: string;

  //PopUp
  grafico: boolean;
  bolsas: boolean;
  paraDesplegar: any;
  loading: boolean;
  idOC: string;
  idOP: string;
  idIngresoEgreso: string;

  //nest
  cuentaCorrienteConfirmados$: Observable<CuentaCorriente[]>
  cuentaCorrientePendientes$: Observable<CuentaCorriente[]>

  constructor(
    private _sOrdenComra: sOrdenComra,
    private _sCuentas: sCuentas,
    private _sCotizacion: sCotizacion,
    private _sMonto: sMonto,
    private _sUsuario: sUsuario,
    private _sOrdenPedido: sOrdenPedido,
    private _sComunesFechas: comunesFechas,
    private _sCajaChica: sCajaChica,
    private _sCuentaCorriente: SCuentaCorrienteService
  ) {
    this.buscador = false;
    this.filtro = this.leerFiltroGuardado();
    this.imprimir = false;
    this.Flujos = [];
    this.Pendientes = [];
    this.Confirmados = [];
    this.total = 0;
    this.actual = 0;
    // this.eCentroCosto = null;
    this.ordenCompra = null;
    this.indice = 0;
    this.pagarSinFactura = false;
    // this.ordenCompra = { _id: null, folio: null, proveedor: null, centroCosto: null, subCentroCosto: null, tipoGasto: null, subTipoGasto: null, metodoPago: null, Items: null, estadosPagos: null, solicita: null, descripcion: null, despacho: null, usuarioCreador: null, usuarioAprovador: null, evaluacionCantidad: null, evaluacionCalidad: null, observacionCantidad: null, observacionCalidad: null, Estado: null, fechaCreacion: null }
    this.grafico = false;
    this.bolsas = false;
    this.loading = true;
    this.idOC = null;
    this.idOP = null;
    // this.Ordenes$ = this._sOrdenComra.getCuentaCorriente();
    // Si hay una búsqueda guardada se aplica en ngAfterViewInit (necesita el buscador ya creado)
    if (!this.filtro) {
      this.cuentaCorrienteConfirmados$ = this._sCuentaCorriente.getCuentaCorrienteConfirmados();
      this.cuentaCorrientePendientes$ = this._sCuentaCorriente.getCuentaCorrientePendientes();
    }
  }

  ngOnInit() {
    // console.clear();
    this.loading = false;
    // this._sMonto.getMonto().subscribe((res) => {
    //   this.total = res[0].partida;
    // this.cargaDatos();
    // });
    // this.cuentaCorrienteConfirmados$.subscribe(el => console.log(el.map(tr => tr.nombreSubTipoGasto)));
  }

  ngAfterViewInit() {
    // Al volver a la pantalla se reaplica la búsqueda guardada.
    // setTimeout: evita el "ExpressionChangedAfterItHasBeenChecked" al cambiar los observables en este ciclo.
    if (this.filtro) {
      setTimeout(() => this.recargar());
    }
  }

  // ---------------- Búsqueda persistente ----------------

  /** true si la búsqueda tiene al menos un criterio. */
  private tieneCriterios(e: Buscador | null): boolean {
    return !!(e && (e.cCosto || Number(e.estado) > 0 || e.factura || e.inicio || e.oc || e.pago || e.proveedor || e.termino));
  }

  private leerFiltroGuardado(): Buscador | null {
    try {
      const texto = sessionStorage.getItem(KEY_FILTRO_CUENTA_CORRIENTE);
      const filtro = texto ? JSON.parse(texto) : null;
      return this.tieneCriterios(filtro) ? filtro : null;
    } catch (err) {
      return null;
    }
  }

  private guardarFiltro(filtro: Buscador | null) {
    try {
      if (filtro) {
        sessionStorage.setItem(KEY_FILTRO_CUENTA_CORRIENTE, JSON.stringify(filtro));
      } else {
        sessionStorage.removeItem(KEY_FILTRO_CUENTA_CORRIENTE);
      }
    } catch (err) { }
  }

  /**
   * Vuelve a traer los datos respetando la búsqueda activa.
   * Se usa al actualizar, al cerrar un movimiento y al volver a la pantalla.
   */
  recargar() {
    if (this.filtro && this.BuscadorComponent) {
      this.cuentaCorrienteConfirmados$ = this.BuscadorComponent.retCuentacorrienteConfirmados(this.filtro);
      this.cuentaCorrientePendientes$ = this.BuscadorComponent.retCuentacorrientePendientes(this.filtro);
    } else {
      this.cuentaCorrienteConfirmados$ = this._sCuentaCorriente.getCuentaCorrienteConfirmados();
      this.cuentaCorrientePendientes$ = this._sCuentaCorriente.getCuentaCorrientePendientes();
    }
  }

  /** Quita la búsqueda (solo cuando el usuario lo pide) y vuelve a mostrar todo. */
  limpiarBusqueda() {
    this.filtro = null;
    this.guardarFiltro(null);
    this.recargar();
  }

  /** Texto corto de la búsqueda activa, para mostrarlo sobre la tabla. */
  get resumenFiltro(): Array<{ etiqueta: string; valor: string }> {
    const f: any = this.filtro;
    if (!f) { return []; }
    const estados: any = { "1": "Pagado", "2": "Cobrado", "3": "OC / OP", "4": "Comprometido / Facturado", "5": "Proyección Egresos", "6": "Proyección Ingreso" };
    const lista: Array<{ etiqueta: string; valor: string }> = [];
    if (f.inicio || f.termino) { lista.push({ etiqueta: "Fechas", valor: this.fechaFiltroTexto(f.inicio) + " al " + this.fechaFiltroTexto(f.termino) }); }
    if (f.oc) { lista.push({ etiqueta: "OC", valor: f.oc }); }
    if (f.proveedor) { lista.push({ etiqueta: "Proveedor", valor: f.proveedor }); }
    if (f.cCosto) { lista.push({ etiqueta: "Centro de costo", valor: f.cCosto }); }
    if (f.factura) { lista.push({ etiqueta: "Factura", valor: f.factura }); }
    if (f.pago) { lista.push({ etiqueta: "N° pago", valor: f.pago }); }
    if (Number(f.estado) > 0) { lista.push({ etiqueta: "Estado", valor: estados[f.estado] || f.estado }); }
    return lista;
  }

  private fechaFiltroTexto(valor: any): string {
    if (!valor) { return "..."; }
    const texto = String(valor);
    const partes = texto.substring(0, 10).split("-");
    return partes.length === 3 ? partes[2] + "/" + partes[1] + "/" + partes[0] : texto;
  }

  calendario() {
    if ($ && $.fn && typeof $.fn.datetimepicker === 'function') {
      $(".date").datetimepicker({
        format: "DD/MM/YYYY",
      });
    }
  }

  /** Botón actualizar del encabezado: vuelve a traer los datos SIN borrar la búsqueda. */
  cargaDatosOrigen() {
    this.recargar();
  }

  update() {
    this.recargar();
    Swal.fire(
      "Movimiento",
      "Se ha actualizado correctamente el movimiento",
      "success"
    );
  }

  cargaDatos() {
    // console.log("Solicitando:", new Date());
    // console.time();
    // console.time("Proceso completo")

    this.loading = true;
    // let saldo = this.total;
    this.Flujos = [];
    let ordenes = this._sOrdenComra.getCuentaCorriente();
    ordenes.subscribe((res) => {
      // console.log("Tiempo que tardo en traer", hora1 - hora2);
      this.ProcesaData(res);
      // if (this.filtro.oc == null)
      this.filtrando(this.filtro);
      // console.timeEnd("Proceso completo");
    },
      error => {
        Swal.fire(
          "Cuenta Corriente",
          "Ha ocurrido un error: " + error,
          "error"
        );
        this.loading = false;
      });
    return null;
  }

  ProcesaData(res: any[]) {
    this.Flujos = res;
    let tempPendientes = res.filter(
      (el) =>
        el.estadoPago < 4 &&
        (el.estado == 2 || el.estadoPago == -1 || el.estado == 6)
    );
    let tempConfirmados = res.filter(
      (el) =>
        el.estadoPago == 4 &&
        (el.estado == 2 || el.estadoPago == -1 || el.estado == 6)
    );
    // console.log(tempConfirmados.filter(el =>el.descripcion=='Caja chica Trazas Oficina'));

    this.AsignaSaldos(tempConfirmados, tempPendientes);
    // console.log(tempConfirmados.length);

    this.Confirmados = tempConfirmados;//.slice(-500)
    // console.log(this.Confirmados.length);
    this.Pendientes = tempPendientes;
    this.irFinal();
  }

  getAdjunto(el) {
    if (el.cotizacion)
      this._sCotizacion
        .getCotizacionesbyID(el.cotizacion)
        .subscribe((res) => {
          el.adjunto = res.adjunto;
        });
  }

  AsignaSaldos(confirmados: Array<any>, pendientes: Array<any>) {
    let saldo = this.total;
    this.actual = this.retSaldo(confirmados, saldo);
    this.retSaldo(pendientes, this.actual);
    this.loading = false;
  }

  retSaldo(arr, saldo) {
    arr.forEach((el) => {
      el.saldo =
        el.ingresoEgreso == 2 ? saldo + el.costo : (el.descripcion == 'Gastos Generales' || el.descripcion == 'Materiales - Sub Contrato' || el.descripcion == 'Mano de Obra Sueldos' || el.descripcion == 'Impuesto' || el.descripcion == 'Mano de Obra Imposiciones') && el.costo < 0 ? saldo : saldo - Math.abs(el.costo);
      saldo = el.saldo;
    });
    // let temp = arr.reduce((acc,el) => acc + )
    return saldo
  }

  PopUp(id, indice, folio?: string, estado?: number, flujo?: any) {
    this.idOC = null;
    this.idOP = null;
    this.ordenPedido = null;
    this.ordenCompra = null;
    this.pagar = null;
    this.totalOC = 0;
    this.afecto = 0;
    this.TotalPagar = 0;
    this.indice = indice - 1;
    // console.log(id);
    // console.log(estado)y
    if (estado && estado == -1) {
      return false;
    }
    console.log("Folio:", folio);
    console.log("Flujo:", flujo);
    if (folio === undefined) {
      this.idOP = id;
      return false
    }
    if (folio && folio.includes("00")) {
      if (folio.includes("OP")) {
        this.idOP = id;
        return false
      } else {
        this.idOC = id;
        return false
      }
    } else {
      this.idIngresoEgreso = id;
    }
  }

  isIngresoEgreso(): boolean {
    return true
  }

  getOp(id) {
    // console.log(id);
    this.ordenesPedido = [];
    this._sOrdenPedido.getOrdenPedidobyOrdenCompra(id).subscribe((res) => {
      this.ordenesPedido = res;
      // console.log(this.ordenesPedido);
    });
  }

  getDetalleOP(id) {
    this._sOrdenPedido.getOrdenPedidobyID(id).subscribe((res) => {
      this.ordenPedido = res;
      this.ordenCompra = res;
      this._sComunesFechas.DespliegaFecha(
        "#txtCompromiso",
        this.ordenCompra.estadosPagos[this.indice].fecha
      );
      this._sComunesFechas.calendario();
    },
      error => {
        this.ordenCompra = null;
      });
  }

  getContrato(OC): string {
    return OC.subCentro.contrato[parseInt(OC.ordenCompra)].nombre + " " + OC.indice + "/" + OC.maxIndice
  }

  retUsuario(id) {
    this.creador = null;
    this._sUsuario.getUsuarioPersonaByIdUsuario(id).subscribe((res) => {
      this.creador = res.nombre + " " + res.paterno;
    });
  }

  Limpiar() {
    this.Flujos = [];
    this.Pendientes = [];
    this.Confirmados = [];
    this.ordenCompra = null;
    this.ordenPedido = null;
  }

  cerrarReporte() {
    this.grafico = false;
  }

  getItem(id) {
    this._sOrdenComra.getOrdenComprabyID(id).subscribe((res) => {
      // console.log(res);
      return res.item;
    });
    // return id;
  }

  graficar() {
    this.grafico = true;
  }

  MesAprobadas(actual, array, indice) {
    if (!actual) return false;
    if (!array[indice - 1]) {
      return true
    }
    if (
      new Date(actual).getMonth() !=
      new Date(array[indice - 1].fecha).getMonth()
    )
      return true;
    else return false;
  }

  Mes(actual, array, indice) {
    if (!actual) return false;
    if (this.esPasado(actual))
      return false
    if (!array[indice - 1]) {
      return true
    }
    if (
      new Date(actual).getMonth() !=
      new Date(array[indice - 1].fecha).getMonth()
    )
      return true;
    else return false;
  }

  esPasado(fecha) {
    let fechaGuardada = new Date(fecha);
    let mesActual = new Date().getMonth();
    let agnoActual = new Date().getFullYear();

    // console.log("Fecha Registro", fecha);
    // console.log(fechaGuardada.getFullYear(), "vs", agnoActual);
    if (fechaGuardada.getFullYear() < agnoActual)
      return true
    if (fechaGuardada.getMonth() < mesActual && fechaGuardada.getFullYear() <= agnoActual)
      return true
    else
      return false
  }

  month(fecha) {
    let fechaGuardada = new Date(fecha);
    let mesActual = new Date().getMonth();
    let agnoActual = new Date().getFullYear();
    if (fechaGuardada.getMonth() < mesActual && fechaGuardada.getFullYear() < agnoActual)
      return false
    // else if (fechaGuardada.getMonth() >= mesActual) 
    return fechaGuardada;
  }

  retrazado(fecha) {
    let fechaGuardada = new Date(fecha);
    let fechaActual = new Date();
    if (fechaGuardada.getMonth() < fechaActual.getMonth()) {
      // console.log("Esta retrazado", fechaGuardada);
      return true;
    } else return false;
  }

  bolsasFn() {
    this.bolsas = true;
  }

  /** Al cerrar un movimiento se recarga manteniendo la búsqueda activa. */
  cerrarOrden() {
    this.idOC = null;
    this.idOP = null;
    this.idIngresoEgreso = null;
    this.recargar();
  }

  imprSelec() {
    this.imprimir = true;
    // console.log()
    let header = `
    <link rel="shortcut icon" href="/assets/favicon.ico">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js"></script>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    `;
    let css = `
    <style>
    *{
      font-size: 12px;
      -webkit-print-color-adjust:exact;
    }
  
    .table td {
        line-height: 0.8;
    }
    
    .table-bordered thead th,
    .table-bordered thead td {
        border-bottom-width: 1px;
    }
    
    .descrip {
        min-width: 45%;
    }
    
    .right {
        text-align: right;
    }
    
    .cuenta {
        margin-bottom: 1em;
    }
    
    thead {
        background-color: white;
        font-weight: bold;
        color: black;
    }
    
    .row {
        margin-bottom: 0.7rem;
    }
    
    .Folio {
        font-weight: 600;
    }
    
    .flex {
        display: flex;
        align-items: center;
    }
    
    .Fcenter {
        justify-content: center;
    }
    
    .Fcenter .btn {
        margin: 0px 4px;
    }
    
    .Proveedor {
        padding: 0.5em 2px;
    }

    .linea{
       border-bottom: 1px solid rgb(95, 95, 95);
    }

    .lineatop{
        border-top: 1px solid rgb(95, 95, 95);
    }
    
    .linealeft{
        border-left: 1px solid rgb(95, 95, 95);
    }
  
    .lineafull{
        border: 1px solid rgb(95, 95, 95);
    }

    .gray {
        background-color: #ababab;
    }
    
    .center {
        text-align: center;
    }

    .fs{
      font-size: 16px;
    }
    
    .TzS .row {
        margin-bottom: 3px;
    }
    
    .caja {
        margin-top: 1em;
        border: 1px solid gray;
        padding: 0.4em 0px;
    }
    
    .labelHeder {
        font-weight: 100;
        margin-bottom: 0px;
    }
    
    .bgWhite {
        background-color: white !important;
    }
    
    .bgWhite td {
        border: 1px solid white;
    }
    
    .brRigt {
        border-right: 1px solid rgb(232, 232, 232) !important;
    }
    
    .firmas {
        margin-top: 7em;
    }
    
    .Firma {
      list-style: none;
      padding-left: 0px;
    }
    
    .FloatRight {
        float: right;
    }
    
    .Firma li {
        border: 1px solid rgb(99, 99, 99);
        width: 300px;
    }

    .justificado{
      text-align: justify;
    }

    .bold {
      font-weight: bold !important;
    }

    .TzS .col-2{
      max-width: 12em;
    }
    
    .texto {
      margin-top: 3em;
    }
    
    .marginR{
      margin-right: 2em;
    }

    body{
      padding : 3em 5em;
    }
  </style>
    `;
    setTimeout(() => {
      let html = $("#popUp")[0].innerHTML;
      let ventimp = window.open(" ", "popimpr");
      ventimp.document.write(header + html + css);
      ventimp.document.close();
      setTimeout(() => {
        ventimp.print();
        ventimp.close();
        this.imprimir = false;
      }, 300);
    }, 300);
  }

  Guardar() {
    let copiaEstadoPago;
    // console.log(this.ordenCompra);
    // console.log(this.indice);
    // console.log(this.ordenPedido);
    if (!this.ordenPedido) {
      // console.log("Guardando orden de compra");
      if (this.pagar) {
        if (
          this.pagar <
          Math.round(this.ordenCompra.estadosPagos[this.indice].monto)
        ) {
          copiaEstadoPago = this.RetValEstadosPagp(
            this.ordenCompra.estadosPagos[this.indice],
            this.pagar
          );
          this.ordenCompra.estadosPagos[this.indice].monto = this.pagar;
          this.ordenCompra.estadosPagos.push(copiaEstadoPago);
        }
      }
      // console.log(this.ordenCompra);

      if (
        this.ordenCompra.estadosPagos[this.indice].numeroPago ||
        this.ordenCompra.estadosPagos[this.indice].metodoPago == "2"
      )
        this.ordenCompra.estadosPagos[this.indice].estado = 2;
      if (this.ordenCompra.estadosPagos[this.indice].factura)
        this.ordenCompra.estadosPagos[this.indice].estado = 3;
      // console.log(this.ordenCompra);
      this._sOrdenComra.putOrdenCompra(this.ordenCompra).subscribe((res) => {
        this.Limpiar();
        this.cargaDatos();
        Swal.fire(
          "Orden de compra",
          "Se ha actualizado correctamente la orden de compra",
          "success"
        );
      });
    } else {
      // console.log("Guardando orden de pedido");
      this.ordenPedido.estadosPagos[
        this.indice
      ].metodoPago = this.ordenCompra.estadosPagos[this.indice].metodoPago;
      this.ordenPedido.estadosPagos[
        this.indice
      ].numeroPago = this.ordenCompra.estadosPagos[this.indice].numeroPago;
      this.ordenPedido.estadosPagos[
        this.indice
      ].factura = this.ordenCompra.estadosPagos[this.indice].factura;
      this.ordenPedido.estadosPagos[
        this.indice
      ].fecha = this.ordenCompra.estadosPagos[this.indice].fecha;
      // console.log(this.indice);
      // console.log(this.ordenPedido);
      if (
        this.ordenPedido.estadosPagos[this.indice].numeroPago ||
        this.ordenCompra.estadosPagos[this.indice].metodoPago == "2"
      )
        this.ordenPedido.estadosPagos[this.indice].estado = 2;
      if (this.ordenPedido.estadosPagos[this.indice].factura)
        this.ordenPedido.estadosPagos[this.indice].estado = 3;
      this._sOrdenPedido.putOrdenPedido(this.ordenPedido).subscribe((res) => {
        this.Limpiar();
        this.cargaDatos();
        Swal.fire(
          "Orden de Pedido",
          "Se ha actualizado correctamente la orden de pedido",
          "success"
        );
      });
    }
  }

  AsignaFechaCompromiso() {
    // console.log("entre!" + indice);
    let dia = $("#txtCompromiso").val().split("/")[0];
    let mes = $("#txtCompromiso").val().split("/")[1];
    let agno = $("#txtCompromiso").val().split("/")[2];
    // if (indice)
    //   indice = 0;
    this.ordenCompra.estadosPagos[this.indice].fecha =
      agno + "-" + mes + "-" + dia + "T00:00:00";
  }

  RetValEstadosPagp(estadoPago, pago) {
    let temp: any;
    let dif = estadoPago.monto - pago;
    temp = {
      opcion: estadoPago.opcion,
      fecha: estadoPago.fecha,
      monto: dif,
      metodoPago: estadoPago.metodoPago,
      estado: 1,
      numeroPago: null,
    };
    return temp;
  }

  ConfirmarPago() {
    let copiaEstadoPago;
    if (this.pagar)
      if (
        this.pagar <
        Math.round(this.ordenCompra.estadosPagos[this.indice].monto)
      ) {
        copiaEstadoPago = this.RetValEstadosPagp(
          this.ordenCompra.estadosPagos[this.indice],
          this.pagar
        );
        this.ordenCompra.estadosPagos[this.indice].monto = this.pagar;
        this.ordenCompra.estadosPagos.push(copiaEstadoPago);
      }

    if (!this.pagarSinFactura) {
      this.pagarSinFactura = true;
      return null;
    }
    this.Flujos = [];
    this.Pendientes = [];
    this.Confirmados = [];
    if (!this.ordenPedido) {
      this.ordenCompra.estadosPagos[this.indice].estado = 4;
      this._sOrdenComra.putOrdenCompra(this.ordenCompra).subscribe((res) => {
        this.Limpiar();
        this.cargaDatos();
        Swal.fire(
          "Orden de Compra",
          "Se confirma el pago de la orden de compra",
          "success"
        );
      });
    } else {
      this.ordenPedido.estadosPagos[this.indice].estado = 4;
      this._sOrdenPedido.putOrdenPedido(this.ordenPedido).subscribe((res) => {
        this.Limpiar();
        this.cargaDatos();
        Swal.fire(
          "Orden de Pedido",
          "Se confirma el pago de la orden de pedido",
          "success"
        );
      });
    }
  }

  AnularPago() {
    this.Flujos = [];
    this.Pendientes = [];
    this.Confirmados = [];

    if (!this.ordenPedido) {
      this.ordenCompra.estadosPagos[this.indice].estado = 5;
      this._sOrdenComra.putOrdenCompra(this.ordenCompra).subscribe((res) => {
        this.Limpiar();
        this.cargaDatos();
        Swal.fire(
          "Orden de Compra",
          "Se ha anulado la orden de compra",
          "error"
        );
      });
    } else {
      this.ordenPedido.estadosPagos[this.indice].estado = 5;
      this._sOrdenPedido.putOrdenPedido(this.ordenPedido).subscribe((res) => {
        this.Limpiar();
        this.cargaDatos();
        Swal.fire(
          "Orden de Pedido",
          "Se ha anulado la orden de pedido",
          "error"
        );
      });
    }
  }

  desplegar() {
    if ($(".desplegar").hasClass("desplegado")) {
      $(".desplegar").removeClass("desplegado");
      $("#iconCambiar").addClass("fa-plus-square");
      $("#iconCambiar").removeClass("fa-minus-square");
    } else {
      this.irFinal();
      $(".desplegar").addClass("desplegado");
      $("#iconCambiar").removeClass("fa-plus-square");
      $("#iconCambiar").addClass("fa-minus-square");
    }
  }

  irFinal() {
    let element = document.getElementById("irAlFinal");
    if (!element) { return; }
    element.scrollTop = element.scrollHeight;
  }

  Cerrar() {
    this.ordenCompra = null;
    this.ordenPedido = null;
  }

  /** Abre/cierra el panel del buscador. Cerrarlo NO borra la búsqueda. */
  TraeBuscador() {
    this.buscador = !this.buscador;
  }

  /**
   * Búsqueda emitida por el buscador. Se guarda (sessionStorage) para que no se pierda al abrir un movimiento,
   * actualizar o salir y volver a la pantalla. Si viene sin criterios, se toma como "limpiar".
   */
  Filtrar(e: Buscador) {
    this.buscador = false;
    if (!this.tieneCriterios(e)) {
      this.limpiarBusqueda();
      return;
    }
    // Copia: el buscador puede seguir modificando su objeto después de emitir
    this.filtro = JSON.parse(JSON.stringify(e));
    this.guardarFiltro(this.filtro);
    this.recargar();
  }

  filtrando(e) {
    if (e) {
      if (e.inicio && e.termino) {
        this.Pendientes = this.Pendientes.filter(
          (el) => el.fecha >= e.inicio && el.fecha <= e.termino
        );
        this.Confirmados = this.Confirmados.filter(
          (el) => el.fecha >= e.inicio && el.fecha <= e.termino
        );
      }
      if (e.oc) {
        this.Pendientes = this.Pendientes.filter(
          (el) => el.ordenCompra != null && el.ordenCompra.includes(e.oc)
        );
        this.Confirmados = this.Confirmados.filter(
          (el) => el.ordenCompra != null && el.ordenCompra.includes(e.oc)
        );
      }
      if (e.proveedor) {
        this.Pendientes = this.Pendientes.filter(
          (el) => el.proveedor.nombre == e.proveedor
        );
        this.Confirmados = this.Confirmados.filter(
          (el) => el.proveedor.nombre == e.proveedor
        );
      }
      if (e.cCosto) {
        this.Pendientes = this.Pendientes.filter(
          (el) => el.subCentro.nombre == e.cCosto
        );
        this.Confirmados = this.Confirmados.filter(
          (el) => el.subCentro.nombre == e.cCosto
        );
      }
      if (e.factura) {
        this.Pendientes = this.Pendientes.filter(el => el.factura && el.factura.includes(e.factura));
        this.Confirmados = this.Confirmados.filter(el => el.factura && el.factura.includes(e.factura));
      }
      if (e.pago) {
        this.Pendientes = this.Pendientes.filter((el) => el.numero == e.pago);
        this.Confirmados = this.Confirmados.filter((el) => el.numero == e.pago);
      }
      // if (e.estado){
      //   console.log(this.Pendientes);
      //   console.log(this.Confirmados);
      //   if (e.estado == "Pagado"){
      //     this.Pendientes = this.Pendientes.filter((el) => el.estadoPago == 4 && el.ingresoEgreso == 1); 
      //     this.Confirmados = this.Confirmados.filter((el) => el.numero == e.pago);
      //   }
      // }
      if (e.estado) {
        this.Pendientes = this.filtraEstado(e.estado, this.Pendientes, 0);
        this.Confirmados = this.filtraEstado(e.estado, this.Confirmados, 1);
      }
    }
  }

  filtraEstado(tipoFiltro: string, arr: Array<any>, tipo: number): Array<any> {
    switch (tipoFiltro) {
      case "1":
        return arr.filter(el => el.estadoPago == 4 && el.ingresoEgreso == 1);
      // break;
      case "2":
        if (tipo)
          return arr.filter(el => el.ingresoEgreso == 2);
        else
          return [];
      case "3":
        return arr.filter(el => el.ingresoEgreso == 3 || (el.ingresoEgreso == 1 && el.estadoPago == 1 && el.ordenCompra));
      case "4":
        if (tipo)
          return [];
        else
          return arr.filter(el => el.ingresoEgreso == 1 && (el.estadoPago == 3 || el.estadoPago == 4) && el.ordenCompra);
      case "5":
        if (tipo)
          return [];
        else
          return arr.filter(el => el.estado == -1);
      case "6":
        if (tipo)
          return [];
        else
          return arr.filter(el => el.estado == 6 || el.ingresoEgreso == 2);
    }
    return arr
  }

  correo(mail, oc) {
    var formattedBody =
      "Estimado, \n\n Adjunto orden de compra N°" +
      oc +
      " para su gestion. \n\n";
    var mailToLink =
      "mailto:" +
      mail +
      "?subject=Orden de compra N°" +
      oc +
      "&body=" +
      encodeURIComponent(formattedBody);
    window.location.href = mailToLink;
  }
}