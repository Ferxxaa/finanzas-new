import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { Movimiento, MovimientoRelationShip } from '../../../models/movimiento';
import { sMovimientoService } from '../../../services/sMovimiento.service';
import { etiquetaGastoService } from '../../../services/sEtiquetaGasto.service';
import { CondicionPopUpComponent } from '../condicion-pop-up/condicion-pop-up.component';
import { TipoGastoPopUpComponent } from '../tipo-gasto-pop-up/tipo-gasto-pop-up.component';

@Component({
  selector: 'app-directo-ingreso-pop-up',
  templateUrl: './directo-ingreso-pop-up.component.html',
  styleUrls: ['./directo-ingreso-pop-up.component.css'],
  providers:[
    sMovimientoService
  ]
})
export class DirectoIngresoPopUpComponent implements OnInit {
  @Input() idMovimiento: number;
  @Output() close = new EventEmitter()
  @Output() update = new EventEmitter()

  @ViewChild(CondicionPopUpComponent) estadoPagoComponent: CondicionPopUpComponent;
  @ViewChild(TipoGastoPopUpComponent) tipoGastoPopUpComponent: TipoGastoPopUpComponent;
  
  movimiento$: Observable<MovimientoRelationShip>
  movimiento: MovimientoRelationShip | null;

  constructor(
    private movimientoService: sMovimientoService,
    private etiquetaGastoService: etiquetaGastoService
  ) { 
    this.movimiento = null;
  }

  ngOnInit() {
    this.movimiento$ = this.movimientoService.getMovimientoById(this.idMovimiento);
    this.movimiento$.subscribe(res => {
      this.movimiento = res;
      this.movimiento.etiquetaGasto = Number(this.movimiento.etiquetaGasto) || 0;
      this.cargarEtiquetaRelacion();
    });
  }

  private cargarEtiquetaRelacion() {
    if (!this.movimiento) {
      return;
    }
    this.etiquetaGastoService.getEtiquetasRelaciones().subscribe(relaciones => {
      const id = Number(this.movimiento.idMovimiento || this.idMovimiento) || 0;
      const etiquetaRelacion = Number(relaciones && relaciones[id]) || 0;
      if (etiquetaRelacion) {
        this.movimiento.etiquetaGasto = etiquetaRelacion;
        if (this.tipoGastoPopUpComponent) {
          this.tipoGastoPopUpComponent.etiquetaGasto = etiquetaRelacion;
          this.tipoGastoPopUpComponent.idEtiquetaGasto = etiquetaRelacion;
        }
      }
    });
  }

  closeEvent() {
    this.close.emit();
  }

  guardar(movimiento: Movimiento) {
    this.estadoPagoComponent.updateEP();
    this.movimientoService.updateMovimiento(movimiento).subscribe(res => {
      this.guardarRelacionEtiqueta(movimiento);
    });
  }

  private guardarRelacionEtiqueta(movimiento: Movimiento) {
    const idMovimiento = Number((movimiento as any).idMovimiento || this.idMovimiento) || 0;
    const etiqueta = Number((movimiento as any).etiquetaGasto) || 0;
    if (!idMovimiento || !etiqueta) {
      return;
    }
    this.etiquetaGastoService.asignarEtiquetaAMovimiento(idMovimiento, etiqueta).subscribe();
  }

  updateEmit(){
    this.update.emit();
    this.Cerrar();
  }

  Cerrar() {
    this.close.emit();
  }

}