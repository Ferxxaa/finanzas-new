import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { sGastos } from '../../../../services/sGastos.service';
import { sOrdenComra } from '../../../../services/sOrdenComra.service';
import { ReporteDetalleTipoGastoEntity } from '../../../../models/reporteCentroCosto';
import { ReporteCentroCostoService } from '../../../../services/Nest/reporteCentroCostoConsolidado.service';
import { etiquetaGastoService } from '../../../../services/sEtiquetaGasto.service';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/shareReplay';

@Component({
  selector: 'app-detalle-orden',
  templateUrl: './detalle-orden.component.html',
  styleUrls: ['./detalle-orden.component.css'],
  providers: [
    ReporteCentroCostoService
  ]
})
export class DetalleOrdenComponent implements OnInit {

  // @Input() ordenesCentroCosto: mOrdenCompra[];
  // @Input() totalOC: number;

  @Input() idCentroCosto: number;
  @Input() totalOC: number;
  @Input() ingresos: number;
  @Input() duracion: number;

  tiposGasto$: Observable<ReporteDetalleTipoGastoEntity[]>;
  nombreCentroCosto: string;

  graph: boolean;
  etiquetasCargadas = false;
  etiquetasVisibles = false;
  etiquetaTotales$: Observable<any[]>;
  etiquetaDetalle$: Observable<any[]>;

  constructor(
    // private TiposGastos: sGastos,
    private OrdenCompra: sOrdenComra,
    private etiquetaGastoService: etiquetaGastoService,
    private ReporteCentroCostoService: ReporteCentroCostoService
  ) {
    this.tiposGasto$ = null;
    this.graph = false;
  }

  ngOnInit() {
    // console.log("ordenesCentroCosto:", this.ordenesCentroCosto);
    // this.tiposGasto$.subscribe(res => console.log(res))
    // console.log(this.idCentroCosto);
    if (!this.idCentroCosto) {
      this.tiposGasto$ = Observable.of([]);
      return;
    }

    this.tiposGasto$ = this.ReporteCentroCostoService.getReporteTipoGasto(this.idCentroCosto);
  }

  cargarEtiquetas() {
    this.etiquetasVisibles = !this.etiquetasVisibles;
    if (!this.etiquetasCargadas) {
      this.etiquetasCargadas = true;
      this.loadEtiquetaTotales();
    }
  }

  private loadEtiquetaTotales() {
    const detalle$ = this.etiquetaGastoService
      .getDetalleEtiquetas(Number(this.idCentroCosto))
      .shareReplay(1);

    this.etiquetaDetalle$ = detalle$;
    this.etiquetaTotales$ = detalle$.map((filas) => {
      const totals: any = {};

      (filas || []).forEach((fila) => {
        const key = fila.nombreEtiqueta;
        if (!totals[key]) {
          totals[key] = {
            etiquetaId: fila.etiquetaId,
            nombreEtiqueta: fila.nombreEtiqueta,
            pendiente: 0,
            pagado: 0,
            total: 0,
            ingresos: 0,
            gastos: 0
          };
        }

        const esIngreso = Number(fila.tipo) === 3 || Number(fila.tipo) === 5;

        if (esIngreso) {
          totals[key].ingresos += Number(fila.total || 0);
        } else {
          totals[key].pendiente += Number(fila.pendiente || 0);
          totals[key].pagado += Number(fila.pagado || 0);
          totals[key].total += Number(fila.total || 0);
          totals[key].gastos += Number(fila.total || 0);
        }
      });

      return Object.keys(totals)
        .map((key) => {
          const etiqueta = totals[key];
          etiqueta.utilidad = etiqueta.ingresos - etiqueta.gastos;
          etiqueta.utilidadMensual = this.duracion ? etiqueta.utilidad / Number(this.duracion) : 0;
          etiqueta.contratos = etiqueta.ingresos;
          etiqueta.iva = etiqueta.ingresos * 0.19;
          return etiqueta;
        })
        .sort((a, b) => a.nombreEtiqueta.localeCompare(b.nombreEtiqueta));
    });
  }

  getTotalEtiquetas(etiquetas: any[] = []): number {
    return (etiquetas || []).reduce((acc, item) => acc + Number(item.total || 0), 0);
  }

  toggleEtiqueta(etiqueta: any) {
    if (!etiqueta) {
      return;
    }
    etiqueta.view = !etiqueta.view;
  }

  getDetallePorEtiqueta(etiqueta: any, filas: any[] = []): any[] {
    if (!etiqueta || !filas) {
      return [];
    }

    const resumen = {};

    (filas || []).filter((fila) => fila && fila.nombreEtiqueta === etiqueta.nombreEtiqueta).forEach((fila) => {
      const key = fila.nombreTipoGasto || fila.tipoLabel || 'Otro';
      if (!resumen[key]) {
        resumen[key] = { label: key, total: 0 };
      }
      resumen[key].total += Number(fila.total || 0);
    });

    return Object.keys(resumen)
      .map((key) => resumen[key])
      .sort((a, b) => b.total - a.total);
  }

  // getTotalTipoGasto(idTipoGasto: any): number {
  //   let ordenesTipoGasto = this.ordenesCentroCosto.filter(el => el.tipoGasto && el.tipoGasto._id == idTipoGasto._id)
  //   if (ordenesTipoGasto.length)
  //     return this.OrdenCompra.retMontoNetoSinConfirmar(ordenesTipoGasto);
  //   else
  //     return 0
  // }

  // getTotalSubTipoGasto(tipoGasto: any, nombreSubTipoGasto: string): number {
  //   let ordenesSubTipoGasto = this.ordenesCentroCosto.filter(el => el.tipoGasto && el.tipoGasto._id == tipoGasto._id && el.subTipoGasto && el.subTipoGasto == nombreSubTipoGasto);
  //   if (ordenesSubTipoGasto.length)
  //     return this.OrdenCompra.retMontoNetoSinConfirmar(ordenesSubTipoGasto);
  //   else
  //     return 0
  // }

}