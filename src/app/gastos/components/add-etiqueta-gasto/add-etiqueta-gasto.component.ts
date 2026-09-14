import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { EtiquetaGasto } from '../../../models/nestEtiquetaGasto';
import { etiquetaGastoService } from '../../../services/sEtiquetaGasto.service';

declare var Swal: any;

@Component({
  selector: 'app-add-etiqueta-gasto',
  templateUrl: './add-etiqueta-gasto.component.html',
  styleUrls: ['./add-etiqueta-gasto.component.css'],
  providers: [etiquetaGastoService]
})
export class AddEtiquetaGastoComponent implements OnInit {

  @Output() addEtiquetaGasto: EventEmitter<boolean>;

  etiqueta: EtiquetaGasto;
  etiquetasGastos$: Observable<EtiquetaGasto[]>;

  constructor(
    private etiquetaGastoService: etiquetaGastoService
  ) {
    this.addEtiquetaGasto = new EventEmitter();
    this.Limpiar();
    this.getEtiquetas();
  }

  ngOnInit() {
  }

  getEtiquetas() {
    this.etiquetasGastos$ = this.etiquetaGastoService.getEtiquetasGastos();
  }

  AgregarEtiqueta() {
    if (!this.etiqueta.nombreEtiqueta || !this.etiqueta.nombreEtiqueta.trim()) {
      Swal.fire('Etiqueta de gasto', 'Debe ingresar un nombre de etiqueta', 'error');
      return;
    }
    this.etiquetaGastoService.addEtiquetaGasto(this.etiqueta).subscribe(res => {
      this.Limpiar();
      this.getEtiquetas();
      Swal.fire('Etiqueta de gasto', 'Se ha creado correctamente la etiqueta', 'success');
      this.addEtiquetaGasto.emit(true);
    });
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
          this.getEtiquetas();
          this.addEtiquetaGasto.emit(true);
          Swal.fire('Etiqueta eliminada', 'La etiqueta se eliminó correctamente', 'success');
        } else {
          Swal.fire('Etiqueta de gasto', 'No se pudo eliminar la etiqueta', 'error');
        }
      });
    });
  }

  Limpiar() {
    this.etiqueta = this.etiquetaGastoService.init();
  }
}
