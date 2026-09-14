import { Component, OnInit } from '@angular/core';
import { sCierre } from '../../../services/sCierre.service';
import { sCentroCosto } from '../../../services/sCentroCosto.service';
import { sOrdenComra } from '../../../services/sOrdenComra.service';
import { Comunes } from '../../../Share/Comunes';

declare var Chart;

@Component({
  selector: 'app-garph-cierres',
  templateUrl: './garph-cierres.component.html',
  styleUrls: ['./garph-cierres.component.css'],
  providers: [
    sCierre,
    sCentroCosto,
    Comunes
  ]
})
export class GarphCierresComponent implements OnInit {

  allCerados: any[];
  centrosSeleccionados: string[];
  totalesCentro: any[];
  emptyTitle: string;
  emptyDescription: string;

  domElement: HTMLCanvasElement;
  ctx: any;
  myChart: any;

  constructor(
    private Cierre: sCierre,
    private CentroCosto: sCentroCosto,
    private Comunes: Comunes,
    private Ordenes: sOrdenComra
  ) { }

  ngOnInit() {
    this.centrosSeleccionados = [];
    this.totalesCentro = [];
    this.setEmptyState('Selecciona centros de costo', 'El grafico aparecera aqui apenas marques uno o mas centros en la columna izquierda.');
    this.Cierre.getCierre().subscribe(res => {
      this.allCerados = (res || []).sort((a, b) => a.agno - b.agno);
      this.renderGraph();
    });
    this.loadTotalesCentro();
  }

  genGraph(centrosCosto) {
    this.centrosSeleccionados = centrosCosto || [];
    this.renderGraph();
  }

  private renderGraph() {
    this.domElement = <HTMLCanvasElement>document.getElementById('myChart');
    if (this.myChart)
      this.myChart.destroy();

    if (!this.centrosSeleccionados.length) {
      this.setEmptyState('Selecciona centros de costo', 'El grafico aparecera aqui apenas marques uno o mas centros en la columna izquierda.');
      return;
    }

    if (!this.allCerados || !this.totalesCentro || !this.totalesCentro.length) {
      this.setEmptyState('Cargando datos del grafico', 'Estoy preparando los cierres historicos y el total base de cada centro.');
      return;
    }

    let opciones = this.Comunes.retOpcionesGrafico('Años', 'Porcentaje de cierre', null, '%')
    const datasets = this.retFormatData(this.allCerados, this.centrosSeleccionados);
    if (this.domElement && datasets.length) {
      this.ctx = this.domElement.getContext('2d');
      this.myChart = new Chart(this.ctx, {
        type: 'line',
        data: {
          labels: this.allCerados.map(el => el.agno),
          datasets: datasets
        },
        options: opciones
      });
      this.emptyTitle = null;
      this.emptyDescription = null;
      return;
    }

    this.setEmptyState('Sin cierres comparables', 'Los centros seleccionados no tienen porcentaje de cierre disponible con los datos actuales.');
  }

  retFormatData(cerrados, centros) {
    let arrTemp = [];
    centros.forEach(centroCosto => {
      let totalCentro = this.getTotalCentro(centroCosto);
      if (!totalCentro) {
        return;
      }

      let cerradasCentroCosto = cerrados.map(el => ({
        agno: el.agno,
        totalOrdenAgno: this.retTotalCierreCentro(el, centroCosto)
      }));

      arrTemp.push({
        label: centroCosto,
        data: cerradasCentroCosto.map(el => +(Math.min(100, el.totalOrdenAgno * 100 / totalCentro)).toFixed(2)),
        borderColor: this.Comunes.genRandomColor(),
        backgroundColor: "#66000000"
      })
    });
    return arrTemp
  }

  private loadTotalesCentro() {
    this.CentroCosto.getCentroCosto().subscribe(res => {
      const areasFuncionales = (res || []).filter(el => !el.nombre.includes('Operacional'));
      const centroCosto = areasFuncionales.reduce((acc, el) => acc.concat(el.subCentroCosto || []), []);

      this.Ordenes.getCuentaCorriente().subscribe(cuentaCorriente => {
        this.totalesCentro = centroCosto.map(centro => {
          const ordenesCentro = (cuentaCorriente || []).filter(el => el.subCentro && el.subCentro.nombre == centro.nombre && el.ingresoEgreso == 1);
          const totalCentro = this.Ordenes.retTotalCuentaCorriente(ordenesCentro);
          return { nombre: centro.nombre, totalCentro };
        });
        this.renderGraph();
      });
    });
  }

  private retTotalCierreCentro(cierre: any, centroCosto: string): number {
    const ordenes = cierre.OC
      .concat(cierre.OP)
      .filter(el => el.ingresoEgreso == 1 && el.subCentroCosto == centroCosto);

    return Math.ceil(ordenes.reduce((acc, orden) => acc + this.retTotalEstadosPago(orden.estadosPagos), 0));
  }

  private retTotalEstadosPago(estadoPagos: any[]): number {
    return (estadoPagos || []).reduce((acc, el) => acc + (el.monto || 0), 0);
  }

  private getTotalCentro(centroCosto: string): number {
    const total = (this.totalesCentro || []).find(el => el.nombre == centroCosto);
    return total ? total.totalCentro : 0;
  }

  private setEmptyState(title: string, description: string) {
    this.emptyTitle = title;
    this.emptyDescription = description;
  }

}
