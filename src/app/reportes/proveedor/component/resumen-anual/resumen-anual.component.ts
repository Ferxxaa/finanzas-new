import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { ReportEvalProv } from '../../../../models/nestReportEvalProv';

interface resumenReporte {
  general: number;
  promedio: number;
  cantidadProveedores: number;
  cantidadOC: number;
}

@Component({
  selector: 'app-resumen-anual',
  templateUrl: './resumen-anual.component.html',
  styleUrls: ['./resumen-anual.component.css']
})
export class ResumenAnualComponent implements OnInit, OnChanges {

  @Input() agno: number;
  @Input() reportEvalProv: ReportEvalProv[];
  @Input() inline: boolean = false;
  @Output() cerrar = new EventEmitter();

  reporteProductos: resumenReporte;
  reporteServicios: resumenReporte;
  reporteSubcontrato: resumenReporte;
  reporteSustituir: resumenReporte;

  loading: boolean;

  constructor() {
    this.reporteProductos = { general: 0, promedio: 0, cantidadProveedores: 0, cantidadOC: 0 }
    this.reporteServicios = { general: 0, promedio: 0, cantidadProveedores: 0, cantidadOC: 0 }
    this.reporteSustituir = { general: 0, promedio: 0, cantidadProveedores: 0, cantidadOC: 0 }
    this.reporteSubcontrato = { general: 0, promedio: 0, cantidadProveedores: 0, cantidadOC: 0 }
    this.loading = true;
  }

  ngOnInit() {
    if (this.reportEvalProv)
      this.listaReporte(this.reportEvalProv);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.reportEvalProv && this.reportEvalProv)
      this.listaReporte(this.reportEvalProv);
  }

  listaReporte(res: ReportEvalProv[]) {
    this.loading = true;

    let paraReporte: ReportEvalProv[] = res.filter(el => el.cantidadEval && el.categoria != 0)
    let productos: ReportEvalProv[] = paraReporte.filter(el => el.categoria == 1);
    let servicios: ReportEvalProv[] = paraReporte.filter(el => el.categoria == 2);
    let subcontrato: ReportEvalProv[] = paraReporte.filter(el => el.categoria == 3);
    let sustituir: ReportEvalProv[] = paraReporte.filter(el => (el.categoria == 1 || el.categoria == 2) && el.calificacion < 1.81)

    let totalEvaluaciones: number = paraReporte.reduce((acc, el) => acc + el.cantidadEval, 0);
    this.reporteProductos = this.generaResumen(productos, totalEvaluaciones)
    this.reporteServicios = this.generaResumen(servicios, totalEvaluaciones)
    this.reporteSubcontrato = this.generaResumen(subcontrato, totalEvaluaciones)
    this.reporteSustituir = this.generaResumen(sustituir, totalEvaluaciones)
    this.loading = false;
  }

  generaResumen(arrReporte: ReportEvalProv[], totalEvaluaciones: number): resumenReporte {
    let resumen: resumenReporte = { general: 0, promedio: 0, cantidadProveedores: 0, cantidadOC: 0 }
    resumen.general = arrReporte.reduce((acc, el) => acc + (el.calificacion * el.cantidadEval / totalEvaluaciones), 0)
    resumen.promedio = arrReporte.length ? arrReporte.reduce((acc, el) => acc + el.calificacion, 0) / arrReporte.length : 0
    resumen.cantidadProveedores = arrReporte.length
    resumen.cantidadOC = arrReporte.reduce((acc, el) => acc + el.cantidadEval, 0);
    return resumen
  }

  Cerrar() {
    this.cerrar.emit({})
  }

}