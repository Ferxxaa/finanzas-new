import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { AreaNegocio } from '../../../models/nestAreaNegocio';
import { CentroCosto } from '../../../models/nestCentroCosto';
import { Observable } from 'rxjs';
import { areaNegocioService } from '../../../services/Nest/areaNegocioService.service';
import { centroCostoService } from '../../../services/sCentroCostoNest.service';
import { sMovimientoService } from '../../../services/sMovimiento.service';
import { comunesFechas } from '../../../share/fechas';
import { etiquetaGastoService } from '../../../services/sEtiquetaGasto.service';
import { EtiquetaGasto } from '../../../models/nestEtiquetaGasto';

declare var $: any;
declare var Swal: any;

@Component({
  selector: 'app-edit-centro-costo-nest',
  templateUrl: './edit-centro-costo-nest.component.html',
  styleUrls: ['./edit-centro-costo-nest.component.css'],
  providers: [areaNegocioService, centroCostoService, sMovimientoService, comunesFechas, etiquetaGastoService]
})
export class EditCentroCostoNestComponent implements OnInit {

  @Input() eCentroCosto: CentroCosto;
  @Input() eCentroCostoStatus: boolean;
  @Input() canReactivate: boolean;
  @Output() eCerrar: EventEmitter<boolean>;
  @Output() eUpdate: EventEmitter<boolean>;

  areasNegocios$: Observable<AreaNegocio[]>;
  etiquetas$: Observable<EtiquetaGasto[]>;
  nuevaEtiqueta: string;
  editingEtiquetaId: number;
  desplazaminetoDias: number;

  constructor(
    private areaNegocioService: areaNegocioService,
    private centroCostoService: centroCostoService,
    private sMovimientoService: sMovimientoService,
    private _sComunesFechas: comunesFechas,
    private etiquetaGastoService: etiquetaGastoService
  ) {
    this.eCerrar = new EventEmitter();
    this.eUpdate = new EventEmitter();
    this.areasNegocios$ = this.areaNegocioService.getAreasNegocio();
    this.desplazaminetoDias = 0;
    this.nuevaEtiqueta = '';
    this.editingEtiquetaId = null;
    this.canReactivate = false;
  }

  ngOnInit() {
    this.eCentroCostoStatus = this.eCentroCosto.isActive;
    this._sComunesFechas.calendario();
    this._sComunesFechas.DespliegaFechaDateUTC("#txtInicio", this.eCentroCosto.fechaInicio);
    this._sComunesFechas.DespliegaFechaDateUTC("#txtTermino", this.eCentroCosto.fechaTermino);
    this.cargarEtiquetas();
  }

  cargarEtiquetas() {
    this.etiquetas$ = this.etiquetaGastoService.getEtiquetasGastos()
      .map((etiquetas) => (etiquetas || []).filter((etiqueta) =>
        Number(etiqueta.idCentroCosto) === Number(this.eCentroCosto.idCentroCosto)));
  }

  crearEtiqueta() {
    const nombre = (this.nuevaEtiqueta || '').trim();
    if (!nombre || !this.eCentroCosto || !this.eCentroCosto.idCentroCosto) {
      return;
    }

    if (this.editingEtiquetaId) {
      const etiqueta = this.etiquetaGastoService.init(Number(this.eCentroCosto.idCentroCosto));
      etiqueta.idEtiquetaGasto = Number(this.editingEtiquetaId);
      etiqueta.nombreEtiqueta = nombre;
      etiqueta.idCentroCosto = Number(this.eCentroCosto.idCentroCosto);
      etiqueta.isActive = true;

      this.etiquetaGastoService.updateEtiquetaGasto(etiqueta).subscribe(() => {
        this.nuevaEtiqueta = '';
        this.editingEtiquetaId = null;
        this.cargarEtiquetas();
        Swal.fire('Etiqueta actualizada', 'La etiqueta se editó correctamente', 'success');
      }, () => {
        Swal.fire('Etiqueta', 'No se pudo actualizar la etiqueta', 'error');
      });
      return;
    }

    const etiqueta = this.etiquetaGastoService.init(Number(this.eCentroCosto.idCentroCosto));
    etiqueta.nombreEtiqueta = nombre;
    this.etiquetaGastoService.addEtiquetaGasto(etiqueta).subscribe(() => {
      this.nuevaEtiqueta = '';
      this.cargarEtiquetas();
    });
  }

  editarEtiqueta(etiqueta: EtiquetaGasto) {
    if (!etiqueta || !etiqueta.idEtiquetaGasto) {
      return;
    }

    this.editingEtiquetaId = Number(etiqueta.idEtiquetaGasto);
    this.nuevaEtiqueta = etiqueta.nombreEtiqueta || '';
  }

  cancelarEdicionEtiqueta() {
    this.editingEtiquetaId = null;
    this.nuevaEtiqueta = '';
  }

  eliminarEtiqueta(etiqueta: EtiquetaGasto) {
    if (!etiqueta || !etiqueta.idEtiquetaGasto) {
      return;
    }

    Swal.fire({
      title: 'Eliminar etiqueta',
      text: '¿Desea eliminar la etiqueta "' + etiqueta.nombreEtiqueta + '"?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.value) {
        return;
      }

      this.etiquetaGastoService.deleteEtiquetaGasto(Number(etiqueta.idEtiquetaGasto)).subscribe((ok) => {
        if (ok) {
          this.cargarEtiquetas();
          Swal.fire('Etiqueta eliminada', 'La etiqueta se eliminó correctamente', 'success');
        } else {
          Swal.fire('Etiqueta', 'No se pudo eliminar la etiqueta', 'error');
        }
      });
    });
  }

  findAreaNegocio() {
    this.areaNegocioService.getAreaNegocioById(this.eCentroCosto.areaNegocio.idAreaNegocio).subscribe(res => {
      this.eCentroCosto.areaNegocio = res;
    })
  }

  asignaFechaInicio() {
    const temp = $("#txtInicio").val()
    this.eCentroCosto.fechaInicio = new Date(this._sComunesFechas.retFechaParaGuardar(temp));
  }

  asignaFechaTermino() {
    const temp = $("#txtTermino").val()
    this.eCentroCosto.fechaTermino = new Date(this._sComunesFechas.retFechaParaGuardar(temp));
  }

  Actualizar() {
    if (!this.canReactivate && !this.eCentroCostoStatus && this.eCentroCosto.isActive) {
      this.eCentroCosto.isActive = false;
      return;
    }

    this.centroCostoService.updateCentroCosto(this.eCentroCosto).subscribe(res => {
      if (this.eCentroCostoStatus || this.eCentroCostoStatus == this.eCentroCosto.isActive) {
        this.eUpdate.emit(true);
      }
    });
    if (!this.eCentroCostoStatus && this.eCentroCostoStatus != this.eCentroCosto.isActive) {
      this.sMovimientoService.addDayToCentroCosto(this.desplazaminetoDias, this.eCentroCosto.idCentroCosto).subscribe(res => {
        this.eUpdate.emit(true);
      });
    }
  }

  cerrar() {
    this.eCerrar.emit(false)
  }

}
