import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

const MONTH_KEYS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

@Component({
  selector: 'app-contenido-tabla-operacional',
  templateUrl: './contenido-tabla-operacional.component.html',
  styleUrls: ['./contenido-tabla-operacional.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContenidoTablaOperacionalComponent implements OnChanges {

  @Input() contenido;
  @Input() inversiones?;

  contenidoView: any[];
  inversionesView: any[];
  totalMeses: { [key: string]: number };
  totalMesesInversiones: { [key: string]: number };
  totalGeneral: number;
  totalGeneralInversiones: number;

  constructor() {
    this.contenido = [];
    this.contenidoView = [];
    this.inversionesView = [];
    this.totalMeses = {};
    this.totalMesesInversiones = {};
    this.totalGeneral = 0;
    this.totalGeneralInversiones = 0;
  }

  ngOnChanges() {
    this.prepareViewModel();
  }

  trackByTipo(index: number, item: any): string {
    return item.tipo;
  }

  private prepareViewModel() {
    this.contenidoView = (this.contenido || []).map(item => ({
      ...item,
      totalCategoria: this.sumMonths(item)
    }));
    this.inversionesView = (this.inversiones || []).map(item => ({
      ...item,
      totalCategoria: this.sumMonths(item)
    }));

    this.totalMeses = MONTH_KEYS.reduce((acc, month) => {
      acc[month] = this.contenidoView.reduce((sum, item) => sum + this.toNumber(item[month]), 0);
      return acc;
    }, {} as { [key: string]: number });
    this.totalMesesInversiones = MONTH_KEYS.reduce((acc, month) => {
      acc[month] = this.totalMeses[month] + this.inversionesView.reduce((sum, item) => sum + this.toNumber(item[month]), 0);
      return acc;
    }, {} as { [key: string]: number });
    this.totalGeneral = MONTH_KEYS.reduce((sum, month) => sum + (this.totalMeses[month] || 0), 0);
    this.totalGeneralInversiones = MONTH_KEYS.reduce((sum, month) => sum + (this.totalMesesInversiones[month] || 0), 0);
  }

  private sumMonths(item: any): number {
    return MONTH_KEYS.reduce((sum, month) => sum + this.toNumber(item[month]), 0);
  }

  private toNumber(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'string') {
      const normalized = value.replace(/\./g, '').replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

}
