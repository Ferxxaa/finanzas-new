import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { operacionalYears } from '../../../models/nestReporteOperacional';
import { Comunes } from '../../../Share/Comunes';

declare var Chart;

const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COLOR_STACK = [
  'rgba(0, 99, 132, 0.6)',
  'rgba(255, 0, 0, 0.6)',
  'rgba(0, 255, 0, 0.6)',
  'rgba(0, 0, 255, 0.6)',
  'rgba(255, 153, 0, 0.6)'
];

@Component({
  selector: 'app-grafico-operacional-agnos',
  templateUrl: './grafico-operacional-agnos.component.html',
  styleUrls: ['./grafico-operacional-agnos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    Comunes
  ]
})
export class GraficoOperacionalAgnosComponent implements OnChanges, AfterViewInit, OnDestroy {

  @ViewChild('graphOperacionalAgnosCanvas') canvasRef: ElementRef;

  @Input() tiposGastos: operacionalYears[];

  agnos: number[];

  myChart: any;

  private viewReady = false;
  private renderFrameId: number = null;
  private latestData: operacionalYears[] = [];
  private chartOptions: any;
  private lastRenderKey = '';

  constructor(
    private Comunes: Comunes,
    private ngZone: NgZone
  ) {
    this.chartOptions = Object.assign({}, this.Comunes.retOpcionesGrafico('Meses', 'Millones', 'MM$ '), {
      animation: {
        duration: 0
      },
      hover: {
        animationDuration: 0
      },
      responsiveAnimationDuration: 0,
      maintainAspectRatio: false,
      elements: {
        line: {
          tension: 0,
          borderWidth: 2
        },
        point: {
          radius: 0,
          hitRadius: 8,
          hoverRadius: 4
        }
      },
      tooltips: {
        mode: 'index',
        intersect: false
      }
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.queueGraphRender(this.tiposGastos);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tiposGastos']) {
      this.queueGraphRender(this.tiposGastos);
    }
  }

  ngOnDestroy() {
    if (this.renderFrameId !== null) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }

    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null;
    }
  }

  // getAgnos(agnoOrigen: number) {
  //   let arr = [];
  //   for (let i = 0; i < 5; i++) {
  //     const element = new Date('01-01-' + agnoOrigen + '');
  //     arr.push(element.getFullYear() - i)
  //   }
  //   return arr
  // }

  // getOperacional(tiposGasto: string[]) {
  //   // console.log(tiposGasto);
  //   this.OrdenCompra.getCuentaCorriente().subscribe(res => {

  //     let OrdenesAgnos = res.filter(el => this.agnos.includes(new Date(el.fecha).getFullYear()));
  //     // console.log('Filtro años:', OrdenesAgnos);
  //     let operacionalesRegistrados = OrdenesAgnos.filter(el => {
  //       if (el.tipoGasto && el.tipoGasto.nombre)
  //         return tiposGasto.includes(el.tipoGasto.nombre.trim())
  //       else
  //         return false
  //     });
  //     // console.log('Filtro TipoGasto:', operacionalesRegistrados);

  //     let operacional = operacionalesRegistrados.filter(el => el.estado == 2 && el.subCentro.nombre == "Trazas Operacional" && (el.ingresoEgreso == 1 || el.ingresoEgreso == 3) && el.subTipoGasto != '0')
  //     // console.log("Operacionales:", operacional);
  //     let data = this.gendata(operacional.filter(el => el.subTipoGasto != 'INVERSIONES BANCARIAS'));
  //     // console.log(data);
  //     this.genGraph(data);
  //   });
  // }

  // gendata(operacionales: any[]): any[] {
  //   let arr = []
  //   this.agnos.forEach(agno => {
  //     let operacionalesAgno = operacionales.filter(el => new Date(el.fecha).getFullYear() == agno);
  //     // console.log('Registros año ' + agno, operacionalesAgno);

  //     arr.push(this.retDataMes(operacionalesAgno))
  //   })
  //   return arr
  // }

  // retDataMes(operacionalAgno: any[]): any {
  //   let obj = { agno: new Date(operacionalAgno[0].fecha).getFullYear() };
  //   let meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  //   // console.log("Año:", , operacionalAgno);
  //   for (let i = 0; i < meses.length; i++) {
  //     let operacionalMes = operacionalAgno.filter(el => new Date(el.fecha).getMonth() == i)
  //     // console.log(meses[i], operacionalMes);
  //     let mes = meses[i]
  //     let totalOperacional = operacionalMes.reduce((acc, el) => acc + el.costo, 0);
  //     obj[mes] = (totalOperacional / environment.factor).toFixed(3);
  //   }
  //   // console.log(obj);
  //   return obj
  // }

  queueGraphRender(data: operacionalYears[]) {
    this.latestData = data && data.length ? data.slice(-3) : [];

    if (this.buildRenderKey(this.latestData) === this.lastRenderKey && this.myChart) {
      return;
    }

    if (!this.viewReady) {
      return;
    }

    if (this.renderFrameId !== null) {
      cancelAnimationFrame(this.renderFrameId);
    }

    this.ngZone.runOutsideAngular(() => {
      this.renderFrameId = requestAnimationFrame(() => {
        this.renderFrameId = null;
        this.renderGraph();
      });
    });
  }

  private renderGraph() {
    const domElement = this.canvasRef && this.canvasRef.nativeElement as HTMLCanvasElement;
    const datasets = this.retFormatData(this.latestData);
    const renderKey = this.buildRenderKey(this.latestData);

    if (!domElement) {
      return;
    }

    if (!datasets.length) {
      if (this.myChart) {
        this.myChart.destroy();
        this.myChart = null;
      }
      this.lastRenderKey = '';
      return;
    }

    const ctx = domElement.getContext('2d');

    if (!this.myChart) {
      this.myChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: MONTH_LABELS,
          datasets: datasets
        },
        options: this.chartOptions
      });
      this.lastRenderKey = renderKey;
      return;
    }

    this.myChart.data.labels = MONTH_LABELS;
    this.myChart.data.datasets = datasets;
    this.myChart.update(0);
    this.lastRenderKey = renderKey;
  }

  retFormatData(data: operacionalYears[]) {
    let arrTemp = [];

    if (data && data.length) {
      data.forEach((el, i) => {
        let obj = {
          label: null,
          data: [],
          borderColor: 'rgba(0, 99, 132, 0.6)',
          backgroundColor: 'rgba(0, 99, 132, 0)',
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4,
          lineTension: 0,
          borderWidth: 2
        }
        obj.label = el.year;
        obj.data = this.retArrData(el);
        obj.borderColor = COLOR_STACK[i % COLOR_STACK.length]
        if (obj.data.reduce((acc, el) => acc + el, 0))
          arrTemp.push(obj)
      });
    }
    return arrTemp
  }

  retArrData(el: operacionalYears): number[] {
    let arr = [];
    MONTH_LABELS.forEach(mes => {
      arr.push(+((el[mes.toLowerCase()] || 0) / environment.factor).toFixed(3))
    })
    return arr;
  }

  private buildRenderKey(data: operacionalYears[]): string {
    return (data || []).map(item => {
      return [item.year].concat(MONTH_LABELS.map(month => item[month.toLowerCase()] || 0)).join('|');
    }).join('||');
  }

  genRandomColor(): string {
    let r = Math.floor(Math.random() * (255 - 0)) + 0;
    let g = Math.floor(Math.random() * (255 - 0)) + 0;
    let b = Math.floor(Math.random() * (255 - 0)) + 0;
    return `rgba(${r}, ${g}, ${b}, 0.6)`
  }

}
