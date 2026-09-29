import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { EvalProveedoresYear, ReportEvalProv } from '../../../models/nestReportEvalProv';
import { reportEvalProvService } from '../../../services/Nest/reportEvalProv.service';
import { sProveedor } from '../../../services/sProveedor.service';

@Component({
  selector: 'app-grafico-proveedor',
  templateUrl: './grafico-proveedor.component.html',
  styleUrls: ['./grafico-proveedor.component.css'],
  providers: [reportEvalProvService, sProveedor]
})
export class GraficoProveedorComponent implements OnInit {

  data: EvalProveedoresYear[];
  dataFiltrada: EvalProveedoresYear[] = [];

  rangoAnios: number = 5; // 0 = todos
  opcionesRango: { label: string, value: number }[] = [
    { label: '5 años', value: 5 },
    { label: '10 años', value: 10 },
    { label: '15 años', value: 15 },
    { label: 'Todos', value: 0 }
  ];

  agno: number;
  anios: number[];
  reportEvalProv$: Observable<ReportEvalProv[]>;
  reportEvalProv: ReportEvalProv[];

  loading: boolean;

  constructor(
    private reportEvalProvService: reportEvalProvService
  ) {
    this.loading = false;
    this.agno = new Date().getFullYear();

    this.anios = [];
    for (let i = 0; i < 5; i++) {
      this.anios.push(this.agno - i);
    }

    this.data = [
      { year: 2012, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 26, cantidadEvaluaciones: 0, notaPromedio: 2.49 },
      { year: 2013, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 49, cantidadEvaluaciones: 0, notaPromedio: 2.62 },
      { year: 2014, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 32, cantidadEvaluaciones: 0, notaPromedio: 2.44 },
      { year: 2015, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 57, cantidadEvaluaciones: 0, notaPromedio: 2.48 },
      { year: 2016, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 41, cantidadEvaluaciones: 0, notaPromedio: 2.63 },
      { year: 2017, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 32, cantidadEvaluaciones: 0, notaPromedio: 2.71 },
      { year: 2018, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 33, cantidadEvaluaciones: 0, notaPromedio: 2.75 },
      { year: 2019, tipoProveedor: 'Bienes - Servicios', cantidadProveedores: 61, cantidadEvaluaciones: 0, notaPromedio: 2.81 }
    ];

    this.aplicarFiltroRango();

    this.reportEvalProv$ = this.reportEvalProvService.getReportByYear(this.agno);
    this.reportEvalProv$.subscribe(res => this.reportEvalProv = res);
  }

  ngOnInit() {
    this.reportEvalProvService.getProveedoresYears().subscribe(res => {
      this.data = this.data.concat(res || []);
      this.aplicarFiltroRango();
    });
  }

  changeRango(rango: number) {
    this.rangoAnios = rango;
    this.aplicarFiltroRango();
  }

  aplicarFiltroRango() {
    if (!this.data || this.data.length === 0) {
      this.dataFiltrada = [];
      return;
    }

    if (!this.rangoAnios) {
      this.dataFiltrada = [...this.data];
      return;
    }

    const maxYear = Math.max(...this.data.map(d => Number(d.year)));
    const minYear = maxYear - this.rangoAnios + 1;
    this.dataFiltrada = this.data.filter(d => Number(d.year) >= minYear);
  }

  changeYear(year: number) {
    this.agno = Number(year);
    this.reportEvalProv$ = this.reportEvalProvService.getReportByYear(this.agno);
    this.reportEvalProv$.subscribe(res => this.reportEvalProv = res);
  }

}