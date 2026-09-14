import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { ReportEvalProv } from '../../../../models/nestReportEvalProv';
import { sProveedor } from '../../../../services/sProveedor.service';

interface itemEstrategico {
  nombre: string;
  rutProveedor: string;
  categoria: number;
  evaluacion: number;
  OcEvaluadas: number;
  condicion: string;
  observacion: string;
}

@Component({
  selector: 'app-proveedores-estrategicos-costo',
  templateUrl: './proveedores-estrategicos-costo.component.html',
  styleUrls: ['../resumen-anual/resumen-anual.component.css']
})
export class ProveedoresEstrategicosCostoComponent implements OnInit, OnChanges {

  @Input() agno: number;
  @Input() reportEvalProv: ReportEvalProv[];
  @Input() inline: boolean = false;
  @Output() cerrar = new EventEmitter();

  arrProducto: itemEstrategico[];
  arrServicio: itemEstrategico[];
  arrSubcontrato: itemEstrategico[];

  rubroPorRut: { [rut: string]: string };

  loading: boolean;

  constructor(
    private Proveedores: sProveedor
  ) {
    this.loading = true;
    this.arrProducto = [];
    this.arrServicio = [];
    this.arrSubcontrato = [];
    this.rubroPorRut = {};
  }

  ngOnInit() {
    this.loading = true;
    this.Proveedores.getProveedor().subscribe(res => {
      this.rubroPorRut = {};
      res.forEach(p => {
        const key = this.normalizaRut(p.rutProveedor);
        if (key)
          this.rubroPorRut[key] = p.observacion || '-';
      });
      if (this.reportEvalProv)
        this.procesar(this.reportEvalProv);
      this.loading = false;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.reportEvalProv && this.reportEvalProv && Object.keys(this.rubroPorRut).length)
      this.procesar(this.reportEvalProv);
  }

  normalizaRut(rut: string): string {
    if (!rut) return '';
    return rut.replace(/[.\s-]/g, '').toUpperCase();
  }

  procesar(res: ReportEvalProv[]) {
    let paraReporte: ReportEvalProv[] = res.filter(el => el.cantidadEval && el.categoria != 0)

    let productos = paraReporte.filter(el => el.categoria == 1).sort(this.ordenaPorCantidad).slice(0, 5);
    let servicios = paraReporte.filter(el => el.categoria == 2).sort(this.ordenaPorCantidad).slice(0, 5);
    let subcontrato = paraReporte.filter(el => el.categoria == 3).sort(this.ordenaPorCantidad).slice(0, 5);

    this.arrProducto = productos.map(el => this.mapea(el));
    this.arrServicio = servicios.map(el => this.mapea(el));
    this.arrSubcontrato = subcontrato.map(el => this.mapea(el));
  }

  mapea(el: ReportEvalProv): itemEstrategico {
    return {
      nombre: el.nombre,
      rutProveedor: el.rutProveedor,
      categoria: el.categoria,
      evaluacion: el.calificacion,
      OcEvaluadas: el.cantidadEval,
      condicion: null,
      observacion: this.rubroPorRut[this.normalizaRut(el.rutProveedor)] || '-'
    }
  }

  ordenaPorCantidad(a: ReportEvalProv, b: ReportEvalProv) {
    if (a.cantidadEval < b.cantidadEval)
      return 1
    if (a.cantidadEval > b.cantidadEval)
      return -1
    return 0
  }

  Cerrar() {
    this.cerrar.emit({})
  }

}