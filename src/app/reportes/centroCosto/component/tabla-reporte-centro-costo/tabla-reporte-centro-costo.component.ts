import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { ReporteCentroCostoService } from '../../../../services/Nest/reporteCentroCostoConsolidado.service';
import 'rxjs/add/observable/of';

@Component({
  selector: 'app-tabla-reporte-centro-costo',
  templateUrl: './tabla-reporte-centro-costo.component.html',
  styleUrls: ['./tabla-reporte-centro-costo.component.css'],
  providers: [
    ReporteCentroCostoService
  ]
})
export class TablaReporteCentroCostoComponent implements OnInit, OnChanges {

  // data;
  @Input() areaNegocio;

  desplegar$: Observable<any>;

  original;
  private initialized = false;
  private expandedItem: any;

  constructor(
    private reporteCentroCostoService: ReporteCentroCostoService
  ) { }

  ngOnInit() {
    this.initialized = true;
    this.loadReport();
  }

  private loadReport() {
    this.reporteCentroCostoService.getReporteCentroCostoConsolidado().subscribe(res => {
      const filtered = this.filterByArea(res || []);

      if (!filtered.length) {
        this.desplegar$ = Observable.of([]);
        return;
      }

      // Detail data is loaded only when the user expands a center.
      this.desplegar$ = Observable.of(filtered.map(item => this.getInitialRow(item)));
    });
    // this.desplegar$.subscribe(res => console.log(res))
  }

  ngOnChanges(cambio: SimpleChanges) {
    if (this.initialized && cambio.areaNegocio && !cambio.areaNegocio.firstChange) {
      this.loadReport();
    }
  }

  toggleItem(item: any) {
    if (!item || !item.idCentroCosto) {
      return;
    }

    if (this.expandedItem && this.expandedItem !== item) {
      this.expandedItem.view = false;
    }

    item.view = !item.view;
    this.expandedItem = item.view ? item : null;
  }

  private filterByArea(data: any[]): any[] {
    const areaId = Number(this.areaNegocio);
    if (!areaId) {
      return data;
    }

    return data.filter(item => item.idAreaNegocio === areaId ||
      (item.areaNegocio && item.areaNegocio.id === areaId));
  }

  // filter() {
  //   if (this.areaNegocio != '0' && this.original)
  //     this.desplegar = this.original.filter(el => el.areaNegocio._id == this.areaNegocio);
  // }

  private getFallbackMonto(item: any): number {
    return this.toNumber(item.totalOrden) || this.toNumber(item.sumaEP) || this.toNumber(item.total) || 0;
  }

  private getInitialRow(item: any): any {
    const total = this.getFallbackMonto(item);
    const ingresos = this.toNumber(item.contratos) || this.toNumber(item.ingresos) || 0;
    return { ...item, contratos: ingresos, totalOrden: total, sumaEP: total, ingresos: ingresos };
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numberValue = Number(value);
    return isNaN(numberValue) ? null : numberValue;
  }

}
