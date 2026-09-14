import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { SubTipoGasto } from '../../../models/nestSubTipoGasto';
import { TipoGasto } from '../../../models/nestTipoGasto';
import { etiquetaGastoService } from '../../../services/sEtiquetaGasto.service';
import { subTipoGastoService } from '../../../services/sSubTipoGasto.service';
import { tipoGastoService } from '../../../services/sTipoGasto.service';

@Component({
  selector: 'app-tipo-gasto-pop-up',
  templateUrl: './tipo-gasto-pop-up.component.html',
  styleUrls: ['./tipo-gasto-pop-up.component.css'],
  providers: [
    tipoGastoService,
    subTipoGastoService,
    etiquetaGastoService
  ]
})
export class TipoGastoPopUpComponent implements OnInit, OnChanges {

  @Input() tipoGasto: TipoGasto;
  @Input() subTipoGasto: SubTipoGasto;
  @Input() mostrarEtiqueta: boolean;
  @Input() etiquetaGasto: number;

  @Output() emitSubTipoGasto: EventEmitter<SubTipoGasto>
  @Output() emitEtiquetaGasto: EventEmitter<number>

  tipoGasto$: Observable<TipoGasto[]>
  subTipoGasto$: Observable<SubTipoGasto[]>
  etiquetasGastos$: Observable<any[]>;
  idsubTipoGasto: number;
  idEtiquetaGasto: number;

  constructor(
    private tipoGastoService: tipoGastoService,
    private subTipoGastoService: subTipoGastoService,
    private etiquetaGastoService: etiquetaGastoService
  ) {
    this.emitSubTipoGasto = new EventEmitter<SubTipoGasto>();
    this.emitEtiquetaGasto = new EventEmitter<number>();
    this.tipoGasto$ = this.tipoGastoService.getTiposGastos();
    this.etiquetasGastos$ = this.etiquetaGastoService.getEtiquetasGastos();
    this.mostrarEtiqueta = false;
    this.idEtiquetaGasto = 0;
  }

  ngOnInit() {
    if (this.tipoGasto)
      this.subTipoGasto$ = this.subTipoGastoService.getSubTipoGastoByIdTipoGasto(this.tipoGasto.idTipoGasto);
    else {
      this.tipoGasto = this.tipoGastoService.init();
      this.subTipoGasto = this.subTipoGastoService.init();
      this.idsubTipoGasto = this.subTipoGastoService.init().idSubTipoGasto;
    }
    this.idsubTipoGasto = this.subTipoGasto && this.subTipoGasto.idSubTipoGasto ? this.subTipoGasto.idSubTipoGasto : 0;
    this.idEtiquetaGasto = Number(this.etiquetaGasto) || 0;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.etiquetaGasto) {
      this.idEtiquetaGasto = Number(changes.etiquetaGasto.currentValue) || 0;
    }

    if (changes.subTipoGasto && changes.subTipoGasto.currentValue) {
      this.idsubTipoGasto = Number(changes.subTipoGasto.currentValue.idSubTipoGasto) || 0;
    }
  }

  loadSubTipoGasto() {
    if (this.tipoGasto)
      this.subTipoGasto$ = this.subTipoGastoService.getSubTipoGastoByIdTipoGasto(this.tipoGasto.idTipoGasto);
  }

  changeSubTipoGasto(idSubtipo: number) {
    this.subTipoGastoService.getSubTiposGastosById(idSubtipo).subscribe(res => {
      // console.log(res);
      // this.subTipoGasto = res;
      this.emitSubTipoGasto.emit(res);
    })
  }

  changeEtiquetaGasto(etiqueta: number) {
    this.emitEtiquetaGasto.emit(Number(etiqueta) || 0);
  }

}
