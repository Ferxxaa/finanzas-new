import { Component, Input, OnInit } from '@angular/core';
import { Proveedor } from '../../../models/nestProveedor';

@Component({
  selector: 'app-proveedor-pop-up',
  templateUrl: './proveedor-pop-up.component.html',
  styleUrls: ['./proveedor-pop-up.component.css']
})
export class ProveedorPopUpComponent implements OnInit {

  @Input() proveedor: Proveedor;
  @Input() fecha: Date | string;

  constructor() { }

  ngOnInit() {
  }

  formatFechaDocumento(fecha: Date | string): string {
    if (!fecha) {
      return '';
    }

    if (typeof fecha === 'string') {
      const fechaBase = fecha.indexOf('T') >= 0 ? fecha.split('T')[0] : fecha;
      const partes = fechaBase.split('-');

      if (partes.length === 3) {
        return partes[2] + '/' + partes[1] + '/' + partes[0];
      }

      const fechaParseada = new Date(fecha);
      if (!isNaN(fechaParseada.getTime())) {
        return this.formatFechaDocumento(fechaParseada);
      }

      return fecha;
    }

    const dia = fecha.getUTCDate().toString().padStart(2, '0');
    const mes = (fecha.getUTCMonth() + 1).toString().padStart(2, '0');
    const agno = fecha.getUTCFullYear();

    return dia + '/' + mes + '/' + agno;
  }

}
