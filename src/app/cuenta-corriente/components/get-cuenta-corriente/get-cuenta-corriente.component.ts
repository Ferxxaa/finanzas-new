import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { EstadosEP } from '../../../models/estadosEP';
import { CuentaCorriente } from '../../../models/mCuentaCorriente';
import { subTipoGastoEnv } from '../../../models/subTipoGastoEnv';
import { TiposMovimientos } from '../../../models/tiposMovimientos';
import { etiquetaGastoService } from '../../../services/sEtiquetaGasto.service';

declare var $: any;
declare var Swal: any;


@Component({
  selector: 'app-get-cuenta-corriente',
  templateUrl: './get-cuenta-corriente.component.html',
  styleUrls: ['./get-cuenta-corriente.component.css']
})
export class GetCuentaCorrienteComponent implements OnInit, OnChanges {

  @Input() flujos: CuentaCorriente[];
  @Input() tipo: number;

  @Output() updateElement: EventEmitter<boolean>;

  tiposMovimiento: TiposMovimientos;
  estadosEP: EstadosEP;
  nombreSubTipoGasto: subTipoGastoEnv;
  idMovimiento: number | null;
  idMovimientoEP: number | null;
  egreso: number | null;
  ingreso: number | null;

  constructor(private etiquetaGastoService: etiquetaGastoService) {
    this.tiposMovimiento = environment.tiposOC;
    this.estadosEP = environment.estadoEP;
    this.nombreSubTipoGasto = environment.nombreSubTipoGasto;
    this.idMovimiento = null;
    this.idMovimientoEP = null;
    this.egreso = null;
    this.ingreso = null;
    this.updateElement = new EventEmitter();
  }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.flujos && this.flujos && this.flujos.length) {
      this.cargarEtiquetasEnFlujos();
    }
  }

  private cargarEtiquetasEnFlujos() {
    if (!this.flujos || !this.flujos.length) {
      return;
    }

    this.etiquetaGastoService.getEtiquetasRelaciones().subscribe(relaciones => {
      this.etiquetaGastoService.getEtiquetasGastos().subscribe(etiquetas => {
        const nombresPorId = {};
        (etiquetas || []).forEach((etiqueta: any) => {
          nombresPorId[Number(etiqueta.idEtiquetaGasto)] = etiqueta.nombreEtiqueta || 'Etiqueta ' + etiqueta.idEtiquetaGasto;
        });

        this.flujos.forEach((flujo: any) => {
          const idMovimiento = Number(flujo.idMovimiento) || 0;
          const etiquetaRelacion = Number(relaciones && relaciones[idMovimiento]) || 0;
          flujo.idEtiquetaGasto = etiquetaRelacion;
          flujo.nombreEtiquetaGasto = etiquetaRelacion ? (nombresPorId[etiquetaRelacion] || 'Etiqueta ' + etiquetaRelacion) : null;
        });
      });
    });
  }

  MesAprobadas(actual, indice) {
    if (!actual) return false;
    actual = new Date(actual);
    if (!this.flujos[indice - 1]) return true
    if (
      new Date(actual).getMonth() !=
      new Date(this.flujos[indice - 1].fechaPago).getMonth()
    )
      return true;
    else return false;
  }

  Mes(actual: string, array: CuentaCorriente[], indice) {
    const fechaActual = new Date(actual)
    if (!actual || this.esPasado(fechaActual)) return false;
    if (!array[indice - 1] || fechaActual.getMonth() != new Date(array[indice - 1].fechaPago).getMonth()) {
      return true
    }
    else return false;
  }

  esPasado(fecha: Date) {
    const fechaGuardada = new Date(fecha);
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

  PopUp(movimiento: CuentaCorriente) {
    switch (movimiento.tipoOC) {
      case this.tiposMovimiento.ordenCompra:
        this.idMovimiento = movimiento.idMovimiento;
        break;
      case this.tiposMovimiento.egreso:
      case this.tiposMovimiento.cajaChica:
        this.egreso = movimiento.idMovimiento;
        break;
      case this.tiposMovimiento.ingreso:
        this.ingreso = movimiento.idMovimiento;
        break;
      case this.tiposMovimiento.contrato:
        this.ingreso = movimiento.idMovimiento;
        break;
      case this.tiposMovimiento.ordenPedido:
        this.idMovimientoEP = movimiento.idMovimiento
        break;
      default:
        break;
    }
  }

  getReferenciaTexto(flujo: CuentaCorriente): string {
    if (!flujo) {
      return '';
    }

    return flujo.numeroPago || flujo.anotacion || flujo.observacion || '';
  }

  getReferenciaStyle(flujo: CuentaCorriente): any {
    if (!flujo) {
      return { color: '#000000', 'background-color': 'transparent' };
    }

    if (flujo.nombreEtiquetaGasto) {
      return {
        color: flujo.letras || flujo.colorLetrasSTP || '#000000',
        'background-color': flujo.fondo || flujo.colorFondoSTP || 'transparent'
      };
    }

    return {
      color: flujo.colorLetrasSTP || '#000000',
      'background-color': flujo.colorFondoSTP || 'transparent'
    };
  }

  cargaDatos() {

  }

  update() {
    this.updateElement.emit(true);
  }

}
