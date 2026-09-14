import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { Cotizacion } from '../../../models/nestCotizacion';
import { cotizacionService } from '../../../services/cotizacionService.service';

declare var Swal: any;

@Component({
  selector: 'app-mis-cotizaciones',
  templateUrl: './mis-cotizaciones.component.html',
  styleUrls: ['./mis-cotizaciones.component.css'],
  providers: [
    cotizacionService
  ]
})
export class MisCotizacionesComponent implements OnInit {

  cotizaciones: Cotizacion[];
  eliminando: boolean;
  url: string

  constructor(
    private _Router: Router,
    private cotizacionesService: cotizacionService
  ) {
    this.cotizaciones = [];
    this.eliminando = false;
    this.url = environment.node + "adjuntar/";
  }

  ngOnInit() {
    console.clear();
    this.cargarCotizaciones();
  }

  cargarCotizaciones() {
    this.cotizacionesService.getCotizacionesPendientes().subscribe(res => {
      this.cotizaciones = res || [];
    });
  }


  Detalle(cot) {
    localStorage.setItem('cotizacion', JSON.stringify(cot));
    this._Router.navigate(['/OrdenCompra']);
  }

  eliminar(cotizacion: Cotizacion) {
    if (this.eliminando || !cotizacion || !cotizacion.idCotizacion) {
      return;
    }

    Swal.fire({
      title: 'Eliminar cotización',
      text: `¿Confirma la eliminación de la cotización ${cotizacion.idCotizacion}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.value) {
        return;
      }

      this.eliminando = true;
      this.cotizacionesService.deleteCotizacion(cotizacion.idCotizacion).subscribe(res => {
        this.cotizaciones = this.cotizaciones.filter(item => item.idCotizacion !== cotizacion.idCotizacion);
        this.eliminando = false;
        Swal.fire('Cotizaciones', 'La cotización se eliminó correctamente.', 'success');
      }, error => {
        this.eliminando = false;
        Swal.fire('Cotizaciones', 'No se pudo eliminar la cotización. Intente nuevamente.', 'error');
      });
    });
  }

}
