import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Cotizacion } from '../../../models/nestCotizacion';
import { Empresa } from '../../../models/Empresa';
import { EstadoPago } from '../../../models/nestEstadoPago';
import { Item } from '../../../models/nestItem';
import { sMonto } from '../../../services/sMonto.service';
import { empresaService } from '../../../services/empresaService.service';

declare var $: any;

@Component({
  selector: 'app-oc-item',
  templateUrl: './oc-item.component.html',
  styleUrls: ['./oc-item.component.css'],
  providers: [
    empresaService,
    sMonto
  ]
})
export class OcItemComponent implements OnInit, OnChanges {

  @Input() item: Item[];
  @Input() estadoPago: EstadoPago[];
  @Input() cotizacion: Cotizacion;
  @Output() changeTotal = new EventEmitter<number>();
  @Output() changeItem = new EventEmitter<Item[]>();
  env: any;
  total: number;
  url: string;

  empresa$: Observable<Empresa>

  constructor(
    private empresaService: empresaService,
    private montoService: sMonto
  ) {
    this.env = { iva: 0, boleta: 0 };
    this.total = 0;
    this.empresa$ = this.empresaService.getEmpresaById(environment.empresa);
    this.url = environment.node + "adjuntar/";
  }

  ngOnInit() {
    if (this.cotizacion) {
      this.url = environment.node + "adjuntar/" + this.cotizacion.nombreAdjunto
    } else {
      this.url = null;
    }

    this.addItem()
    this.loadTaxes();
    this.AsignaTotal();
  }

  private loadTaxes() {
    this.montoService.getMonto().subscribe(res => {
      if (res && res.length > 0) {
        this.env = {
          iva: this.parsePercentage(res[0].iva),
          boleta: this.parsePercentage(res[0].boleta)
        };
        this.AsignaTotal();
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
      this.AsignaTotal();
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

  private calculaRetencionBoleta(totalItem: number): number {
  const porcentaje = this.env.boleta / 100;

  if (!porcentaje || porcentaje >= 1) {
    return 0;
  }

  return totalItem / (1 - porcentaje) - totalItem; // gross-up, no porcentaje simple
}

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
    if (changes.hasOwnProperty("item")) {
      // this.cambiaTodosMontos
      this.AsignaTotal();
    }
    if (changes.hasOwnProperty("idCotizacion") || changes.hasOwnProperty("cotizacion")) {
      console.log("Ingrese a Cotizacion");
      if (this.cotizacion) {
        this.url = environment.node + "adjuntar/" + this.cotizacion.nombreAdjunto
      }
      console.log("URL", this.url);
    }
    
  }

  addItem(linea?: number) {
    let add: Item = {
      codigo: null,
      detalle: null,
      cantidad: 1,
      declaracion: null,
      moneda: "CLP",
      precioUnitario: null,
      tipoDeclaracion: 2,
      isActive: true,
      fechaCreacion: new Date(),
      idItem: null
    };
    if (linea != undefined && linea != null) {
      if (
        !this.item[linea].codigo &&
        !this.item[linea].detalle &&
        this.item.length <= linea + 1
      )
        this.item.push(add);
    }
    else
      this.item.push(add);

  }

  AsignaTotal() {
    this.total = 0;
    this.item
      .filter((el) => el.precioUnitario)
      .forEach((item) => {
        const totalItem = item.precioUnitario * item.cantidad;
        switch (Number(item.tipoDeclaracion)) {
          case 2:
            item.declaracion = totalItem * (this.env.iva / 100)
            this.total += totalItem + item.declaracion;
            break;
          case 3:
            item.declaracion = this.calculaRetencionBoleta(totalItem)
            this.total += totalItem + item.declaracion;
            break;
          default:
            item.declaracion = 0;
            this.total += totalItem;
            break;
        }
      });
    this.changeItem.emit(this.item);
    this.changeTotal.emit(this.total);
    this.cambiaTodosMontos();
  }

  cambiaTodosMontos() {
    let indice = 0;
    let origin = this;
    $("[name='txtEstadoPagoMonto']").each(function () {
      origin.estadoPago[indice].monto = (origin.total * this.value) / 100;
      indice++;
    });
  }

}
