import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { CentroCosto } from '../../../models/nestCentroCosto';
import { centroCostoService } from '../../../services/sCentroCostoNest.service';
import { etiquetaGastoService } from '../../../services/sEtiquetaGasto.service';

declare var Swal: any;

@Component({
  selector: 'app-reporte-etiquetas',
  templateUrl: './reporte-etiquetas.component.html',
  styleUrls: ['./reporte-etiquetas.component.css'],
  providers: [centroCostoService, etiquetaGastoService]
})
export class ReporteEtiquetasComponent implements OnInit {

  centrosCostos$: Observable<CentroCosto[]>;

  detalle: Array<{
    idMovimiento: number,
    etiquetaId: number,
    nombreEtiqueta: string,
    nombreCentroCosto: string,
    tipoLabel: string,
    descripcion: string,
    solicitante: string,
    fecha: string | Date,
    pendiente: number,
    pagado: number,
    total: number
  }>;

  centroCostoSeleccionado: number | null;
  loading: boolean;

  constructor(
    private centroCostoService: centroCostoService,
    private etiquetaGastoService: etiquetaGastoService
  ) {
    this.detalle = [];
    this.centroCostoSeleccionado = null;
    this.loading = false;
  }

  ngOnInit() {
    this.centrosCostos$ = this.centroCostoService.getCentroCosto();
    this.CargarDetalle();
  }

  CargarDetalle() {
    this.loading = true;
    const idCentroCosto = this.centroCostoSeleccionado ? Number(this.centroCostoSeleccionado) : undefined;

    this.etiquetaGastoService.getDetalleEtiquetas(idCentroCosto).subscribe(
      (res) => {
        this.detalle = res;
        this.loading = false;
      },
      (error) => {
        this.detalle = [];
        Swal.fire('Reporte de Etiquetas', 'Error al cargar el detalle, favor intentar nuevamente', 'error');
        this.loading = false;
      }
    );
  }

  tipoBadgeClass(tipo: string): string {
    switch (tipo) {
      case 'Orden de Compra':
        return 'badge-primary';
      case 'Egreso':
        return 'badge-danger';
      case 'Ingreso':
        return 'badge-success';
      case 'Caja Chica':
        return 'badge-warning';
      default:
        return 'badge-light';
    }
  }

  get totalPendiente(): number {
    return this.detalle.reduce((acc, item) => acc + Number(item.pendiente || 0), 0);
  }

  get totalPagado(): number {
    return this.detalle.reduce((acc, item) => acc + Number(item.pagado || 0), 0);
  }

  get totalGeneral(): number {
    return this.detalle.reduce((acc, item) => acc + Number(item.total || 0), 0);
  }
}