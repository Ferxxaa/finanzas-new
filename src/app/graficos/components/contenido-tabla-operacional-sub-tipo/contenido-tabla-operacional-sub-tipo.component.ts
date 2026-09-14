import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { tablaReporteOperacional } from '../../../models/nestReporteOperacional';

const MONTH_KEYS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const EXCLUDED_TYPES = ['RETIROS', 'INVERSIONES'];

@Component({
  selector: 'app-contenido-tabla-operacional-sub-tipo',
  templateUrl: './contenido-tabla-operacional-sub-tipo.component.html',
  styleUrls: ['./contenido-tabla-operacional-sub-tipo.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContenidoTablaOperacionalSubTipoComponent implements OnChanges {

  @Input() contenido: tablaReporteOperacional[];

  viewModel: any[];
  totalMeses: { [key: string]: number };
  totalGeneral: number;
  expandedRows: { [key: string]: boolean };

  constructor() {
    this.contenido = [];
    this.viewModel = [];
    this.totalMeses = {};
    this.totalGeneral = 0;
    this.expandedRows = {};
  }

  ngOnChanges() {
    this.prepareViewModel();
  }

  toggleMes(tipo: string) {
    this.expandedRows[tipo] = !this.expandedRows[tipo];
  }

  isExpanded(tipo: string): boolean {
    return !!this.expandedRows[tipo];
  }

  trackByTipo(index: number, item: any): string {
    return item.nombreTipoGasto;
  }

  trackBySubTipo(index: number, item: any): string {
    return item.subTipo;
  }

  private prepareViewModel() {
    const contenido = this.contenido || [];

    this.viewModel = contenido.map(tipo => ({
      ...tipo,
      totalCategoria: this.sumMonths(tipo),
      gastos: (tipo.gastos || []).map(gasto => ({
        ...gasto,
        totalCategoria: this.sumMonths(gasto)
      }))
    }));

    const visibles = this.viewModel.filter(tipo => !EXCLUDED_TYPES.includes(this.normalizeType(tipo.nombreTipoGasto)));
    this.totalMeses = MONTH_KEYS.reduce((acc, month) => {
      acc[month] = visibles.reduce((sum, tipo) => sum + (tipo[month] || 0), 0);
      return acc;
    }, {});
    this.totalGeneral = MONTH_KEYS.reduce((sum, month) => sum + (this.totalMeses[month] || 0), 0);
    this.expandedRows = this.viewModel.reduce((acc, tipo) => {
      acc[tipo.nombreTipoGasto] = !!this.expandedRows[tipo.nombreTipoGasto];
      return acc;
    }, {});
  }

  private sumMonths(item: any): number {
    return MONTH_KEYS.reduce((sum, month) => sum + (item[month] || 0), 0);
  }

  private normalizeType(value: string): string {
    return (value || '').toUpperCase().trim().replace('O. ', '');
  }

}
