import { Component, OnInit, Input } from '@angular/core';
import { mOrdenCompra } from '../../../models/mOrdenCompra';
import { MovimientoRelationShip } from '../../../models/movimiento';

@Component({
  selector: 'app-card-oc',
  templateUrl: './card-oc.component.html',
  styleUrls: ['./card-oc.component.css']
})
export class CardOcComponent implements OnInit {

  @Input() ordenCompra: mOrdenCompra | MovimientoRelationShip;

  constructor() { }

  ngOnInit() {
  }

  retTotal(estadosPago: any[]) {
    return (estadosPago || []).reduce((total, estadoPago) => total + (estadoPago.monto || 0), 0);
  }

  getEstadosPago() {
    return this.ordenCompra ? ((this.ordenCompra as any).estadosPagos || (this.ordenCompra as any).estadoPago || []) : [];
  }

  getCentroCosto() {
    if (!this.ordenCompra) {
      return '';
    }

    return (this.ordenCompra as any).subCentroCosto || ((this.ordenCompra as any).centroCosto && (this.ordenCompra as any).centroCosto.nombreCentroCosto) || '';
  }

  getTipoGasto() {
    const tipoGasto = this.ordenCompra && (this.ordenCompra as any).tipoGasto;
    return tipoGasto ? (tipoGasto.nombre || tipoGasto.nombreTipoGasto || '') : '';
  }

  getSubTipoGasto() {
    const subTipoGasto = this.ordenCompra && (this.ordenCompra as any).subTipoGasto;

    if (!subTipoGasto) {
      return '';
    }

    return typeof subTipoGasto === 'string' ? subTipoGasto : subTipoGasto.nombreSubtipoGasto || '';
  }

  getMetodoPago() {
    const estadosPago = this.getEstadosPago();
    const metodoPago = estadosPago.length ? estadosPago[0].metodoPago : (this.ordenCompra as any).metodoPago;

    switch (Number(metodoPago)) {
      case 2:
        return 'Efectivo';
      case 3:
        return 'Cheque';
      case 4:
        return 'Transferencia';
      default:
        return metodoPago || '';
    }
  }

}
