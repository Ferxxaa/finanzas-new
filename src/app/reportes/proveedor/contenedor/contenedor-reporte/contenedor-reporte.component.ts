import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportEvalProv } from '../../../../models/nestReportEvalProv';
import { reportEvalProvService } from '../../../../services/Nest/reportEvalProv.service';
import { sProveedor } from '../../../../services/sProveedor.service';

@Component({
  selector: 'app-contenedor-reporte',
  templateUrl: './contenedor-reporte.component.html',
  styleUrls: ['./contenedor-reporte.component.css'],
  providers: [
    sProveedor,
    reportEvalProvService
  ]
})
export class ContenedorReporteComponent implements OnInit {

  agno: number;

  loading: boolean[];

  reportEvalProv$: Observable<ReportEvalProv[]>
  reportEvalProv: ReportEvalProv[];

  constructor(
    private reportEvalProvService: reportEvalProvService
  ) {
    this.agno = new Date().getFullYear();

    this.loading = [true, true, true];
    this.reportEvalProv$ = this.reportEvalProvService.getReportByYear(this.agno)
    this.reportEvalProv$.subscribe(res => this.reportEvalProv = res);
  }

  ngOnInit() {
  }

  cambiaAgno(e) {
    console.log(e);
    this.agno = e;
    this.loading = [true, true, true];
  }

  load(event, indice) {
    this.loading[indice] = event.loading;
  }

  cargando() {
    return this.loading.filter(el => el).length
  }

  changeYear(year: number) {
    this.agno = year;
    this.reportEvalProv$ = null;
    this.reportEvalProv$ = this.reportEvalProvService.getReportByYear(year);
    this.reportEvalProv$.subscribe(res => this.reportEvalProv = res);
  }

}