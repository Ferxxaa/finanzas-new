import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { centroCostoService } from '../../../services/sCentroCostoNest.service';
import { sOrdenComra } from '../../../services/sOrdenComra.service';
import { sCierre } from '../../../services/sCierre.service';

@Component({
  selector: 'app-contenedor-cierre',
  templateUrl: './contenedor-cierre.component.html',
  styleUrls: ['./contenedor-cierre.component.css'],
  providers: [
    centroCostoService,
    sOrdenComra,
    sCierre
  ]
})
export class ContenedorCierreComponent implements OnInit, OnDestroy {

  mostrarGrafico = false;

  totales: any[];
  cierresHistoricos: any[] = [];
  centrosSeleccionados: string[] = [];

  private totalesSub: Subscription;
  private cierresSub: Subscription;

  constructor(
    private CentroCosto: centroCostoService,
    private OrdenCompra: sOrdenComra,
    private Cierre: sCierre
  ) { }

  ngOnInit() {
    this.cargarTotales();
    this.cargarCierres();
  }

  ngOnDestroy() {
    if (this.totalesSub) {
      this.totalesSub.unsubscribe();
    }

    if (this.cierresSub) {
      this.cierresSub.unsubscribe();
    }
  }

  /** Se dispara cuando cierre-anual termina un cierre: recarga el historico para ambos paneles. */
  onCierreRealizado() {
    this.cargarCierres();
  }

  selectCentro(centros: string[]) {
    this.centrosSeleccionados = centros ? centros.slice() : [];
  }

  private cargarCierres() {
    if (this.cierresSub) {
      this.cierresSub.unsubscribe();
    }

    this.cierresSub = this.Cierre.getCierre().subscribe(
      (cierres: any[]) => this.cierresHistoricos = cierres || [],
      (error: any) => console.log(error)
    );
  }

  private cargarTotales() {
    this.totalesSub = this.CentroCosto.getCentroCostoWithParentFull()
      .pipe(
        map((centros: any[]) => (centros || []).filter(centro => centro.isActive)),
        switchMap((centros: any[]) => this.OrdenCompra.getCuentaCorriente()
          .pipe(map((cuentaCorriente: any[]) => this.buildTotales(centros, cuentaCorriente || []))))
      )
      .subscribe(
        totales => this.totales = totales,
        (error: any) => console.log(error)
      );
  }

  private buildTotales(centrosCosto: any[], cuentaCorriente: any[]): any[] {
    return centrosCosto.map(centro => {
      const movimientos = cuentaCorriente.filter(el =>
        !!el.subCentro
        && el.subCentro.nombre == centro.nombreCentroCosto
        && el.ingresoEgreso == 1
      );

      return {
        nombre: centro.nombreCentroCosto,
        fondo: centro.fondo,
        letras: centro.letras,
        totalCentro: Math.ceil(movimientos.reduce((acc, movimiento) => acc + this.getMontoMovimiento(movimiento), 0)),
        movimientos
      };
    });
  }

  private getMontoMovimiento(movimiento: any): number {
    if (!movimiento) {
      return 0;
    }

    return movimiento.monto || movimiento.costo || 0;
  }

}