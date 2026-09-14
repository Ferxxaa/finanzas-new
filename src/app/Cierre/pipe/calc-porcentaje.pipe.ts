import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'calcPorcentaje',
})
export class CalcPorcentajePipe implements PipeTransform {

  transform(value: any, args1: any, args2: any, args3?: { [key: string]: number }): any {
    const allOrdenes = (args1.OC || []).concat(args1.OP || []);
    const arrTemp = (value || []).map(el => {
      const totalInfo = args2.find(totales => totales.nombre == el);
      const totalCierre = this.retTotalOC(allOrdenes.filter(oc => oc.ingresoEgreso == 1 && oc.subCentroCosto == el));
      const totalPeriodo = this.getTotalPeriodo(args3, args1, el);

      return {
        nombre: el,
        periodo: this.getPeriodoDetalle(args1, el),
        totalOrdenAgno: totalPeriodo === null ? totalCierre : totalPeriodo,
        totalOrdenCierre: totalCierre,
        totalCentro: totalInfo ? totalInfo.totalCentro : 0,
        ...totalInfo
      };
    })
    return arrTemp.sort((a, b) => a.nombre >= b.nombre ? 1 : -1);
  }

  private getTotalPeriodo(montosPeriodo: { [key: string]: number }, cierre: any, centroCosto: string): number | null {
    if (!montosPeriodo) {
      return null;
    }

    const key = (cierre && cierre._id ? cierre._id : '') + '|' + centroCosto;
    return Object.prototype.hasOwnProperty.call(montosPeriodo, key)
      ? montosPeriodo[key]
      : null;
  }

  private getPeriodoDetalle(cierre: any, centroCosto: string): string {
    const detalle = cierre && cierre.detalleCierre
      ? cierre.detalleCierre.find(item => item && item.centroCosto === centroCosto) || null
      : null;
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

  private formatFecha(fecha: string): string {
    if (!fecha) {
      return 'sin fecha';
    }

    const valor = fecha.split('T')[0].split('-');
    return valor.length === 3 ? valor[2] + '/' + valor[1] + '/' + valor[0] : fecha;
  }

  private retTotalOC(ordenes) {
    return Math.ceil(ordenes.reduce((acc, el) => acc + this.retTotalEP(el.estadosPagos), 0))
  }

  private retTotalEP(estadoPago) {
    return estadoPago.reduce((acc, el) => acc + el.monto, 0)
  }

}
