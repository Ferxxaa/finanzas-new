import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { EvalProveedoresYear } from '../../../models/nestReportEvalProv';

declare var Chart: any;

@Component({
  selector: 'app-grafico',
  templateUrl: './grafico.component.html',
  styleUrls: ['./grafico.component.css']
})
export class GraficoComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() data: EvalProveedoresYear[] = [];

  @ViewChild('chartCanvas') chartCanvas: ElementRef;

  myChart: any;
  private viewReady = false;

  constructor() { }

  ngAfterViewInit() {
    this.viewReady = true;
    this.genGraph();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewReady && changes.data) {
      this.actualizarDatos();
    }
  }

  ngOnDestroy() {
    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null;
    }
  }

  genGraph() {
    if (!this.chartCanvas) {
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    if (this.myChart) {
      this.myChart.destroy();
    }

    this.myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.getAgnos(this.data),
        datasets: [{
          label: 'Evaluación de proveedores por año',
          backgroundColor: 'transparent',
          borderColor: 'rgb(79, 129, 189)',
          data: this.getCalificacion(this.data),
          lineTension: 0,
          pointBackgroundColor: '#64bd63',
          pointBorderColor: '#64bd63',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: false
        }
      }
    });
  }

  actualizarDatos() {
    if (!this.myChart) {
      this.genGraph();
      return;
    }
    this.myChart.data.labels = this.getAgnos(this.data);
    this.myChart.data.datasets[0].data = this.getCalificacion(this.data);
    this.myChart.update();
  }

  getAgnos(arr: EvalProveedoresYear[]): string[] {
    const ret: string[] = [];
    if (arr && arr.length) {
      arr.forEach(el => {
        const year = el.year.toString();
        if (!ret.includes(year)) {
          ret.push(year);
        }
      });
    }
    return ret;
  }

  getCalificacion(arr: EvalProveedoresYear[]): any[] {
    const ret: any[] = [];
    const vistos: string[] = [];
    if (arr && arr.length) {
      arr.forEach(el => {
        const year = el.year.toString();
        if (!vistos.includes(year)) {
          vistos.push(year);
          ret.push(el.notaPromedio);
        }
      });
    }
    return ret;
  }

}