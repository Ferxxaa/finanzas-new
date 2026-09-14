import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Cotizacion } from '../../../models/nestCotizacion';
import { Item } from '../../../models/nestItem';
import { Empresa } from '../../../models/Empresa';
import { sMonto } from '../../../services/sMonto.service';
import { empresaService } from '../../../services/empresaService.service';

@Component({
  selector: 'app-item-pop-up',
  templateUrl: './item-pop-up.component.html',
  styleUrls: ['./item-pop-up.component.css'],
  providers: [
    empresaService,
    sMonto
  ]
})
export class ItemPopUpComponent implements OnInit {

  @Input() items: Item[]
  @Input() cotizacion: Cotizacion;

  totalOC: number;
  boleta: number;
  afecta: number;
  url: string;
  env: any;

  empresa$: Observable<Empresa>

  constructor(
    private empresaService: empresaService,
    private montoService: sMonto
  ) {
    this.totalOC = 0;
    this.boleta = 0;
    this.afecta = 0;
    this.env = { iva: 0, boleta: 0 };
    this.empresa$ = this.empresaService.getEmpresaById(environment.empresa);
    this.url = environment.node + "adjuntar/";
  }

  ngOnInit() {
    if (this.cotizacion && this.cotizacion.nombreAdjunto) {
      this.url += this.cotizacion.nombreAdjunto;
    } else {
      this.url = null;
    }

    this.loadTaxes();
  }

  private loadTaxes() {
    this.montoService.getMonto().subscribe(res => {
      if (res && res.length > 0) {
        this.env = {
          iva: this.parsePercentage(res[0].iva),
          boleta: this.parsePercentage(res[0].boleta)
        };
        this.calcularTotales();
        return;
      }
      this.loadCompanyTaxes();
    }, () => this.loadCompanyTaxes());
  }

  private loadCompanyTaxes() {
    this.empresa$.subscribe(res => {
      this.env = {
        iva: this.parsePercentage(res.valIVA),
        boleta: this.parsePercentage(res.valBoleta)
      };
      this.calcularTotales();
    });
  }

  private parsePercentage(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    if (typeof value === 'string') {
      return Number(value.replace(',', '.')) || 0;
    }
    return Number(value) || 0;
  }

  private calcularTotales() {
    this.totalOC = 0;
    this.boleta = 0;
    this.afecta = 0;

    const porcentajeBoleta = this.env.boleta / 100;
    const porcentajeIva = this.env.iva / 100;

    this.items.forEach(item => {
      const totalItem = item.precioUnitario * item.cantidad;
      this.totalOC += totalItem;

      if (item.tipoDeclaracion == environment.declaracion.boleta && porcentajeBoleta > 0 && porcentajeBoleta < 1) {
        this.boleta += totalItem / (1 - porcentajeBoleta) - totalItem; // gross-up
      }

      if (item.tipoDeclaracion == environment.declaracion.afecto) {
        this.afecta += totalItem * porcentajeIva;
      }
    });
  }

}