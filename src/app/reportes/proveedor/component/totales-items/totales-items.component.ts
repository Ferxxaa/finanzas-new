import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { mReporteProveedor } from '../../../../models/mReporteProveedor';
import { ReportEvalProv } from '../../../../models/nestReportEvalProv';
import { sProveedor } from '../../../../services/sProveedor.service';

@Component({
  selector: 'app-totales-items',
  templateUrl: './totales-items.component.html',
  styleUrls: ['./totales-items.component.css']
})
export class TotalesItemsComponent implements OnInit, OnChanges {

  @Input() reportEvalProv: ReportEvalProv[];
  totalEval: number;
  ponderaciontotalEval: number;
  totalProveedores: number;

  constructor() { }

  ngOnInit() {
    this.totalOC()
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.totalOC()
  }

  totalOC() {
    this.totalEval = this.reportEvalProv.reduce((acc, el) => acc + el.cantidadEval, 0)
    this.ponderaciontotalEval = this.reportEvalProv.reduce((acc, el) => acc + (el.calificacion * el.cantidadEval / this.totalEval), 0)
    this.totalProveedores = new Set(this.reportEvalProv.map(el => el.idProveedor)).size
  }

}