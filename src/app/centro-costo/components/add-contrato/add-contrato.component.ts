import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";

import { mContrato, mCentroCosto } from "./../../../models/mCentroCosto";
import { sCentroCosto } from "../../../services/sCentroCosto.service";
import { mSubCentroCosto } from "../../../models/mSubCentroCosto";
import { contratoService } from "../../../services/Nest/contratoService.service";
import { Contrato, ContratoAdd } from "../../../models/nestContrato";
import { Observable } from "rxjs";
import { CentroCosto } from "../../../models/nestCentroCosto";

declare var Swal: any;

@Component({
  selector: "app-add-contrato",
  templateUrl: "./add-contrato.component.html",
  styleUrls: ["./add-contrato.component.css"],
  providers: [
    contratoService
  ]
})
export class AddContratoComponent implements OnInit {
  @Input() centroCosto: CentroCosto;
  @Output() cerrar = new EventEmitter();

  contratos$: Observable<Contrato[]>;
  contratos: Contrato[];
  totalMontoContratos: number;

  contrato: ContratoAdd;
  indiceSubCentro: number;
  indiceEditar: number;

  constructor(
    private _sCentroCosto: sCentroCosto,
    private contratoService: contratoService
  ) {
    this.contrato = this.contratoService.init();
    this.indiceSubCentro = null;
    this.indiceEditar = -1;
    this.totalMontoContratos = 0;
    this.contratos = [];
  }

  ngOnInit() {
    console.clear();
    this.reiniciarFormulario();
    this.cargarContratos();
    // this.getCentroCosto(
    //   this.idCentroCosto._id,
    //   this.idCentroCosto.subCentroCosto
    // );
  }

  // getCentroCosto(id: string, subCentro: string) {
  //   this._sCentroCosto.getCentroCostobyID(id).subscribe((centroCosto) => {
  //     this.centroCosto = centroCosto;
  //     this.indiceSubCentro = centroCosto.subCentroCosto.findIndex(
  //       (el) => el.nombre == subCentro
  //     );
  //     this.subCentro = centroCosto.subCentroCosto[this.indiceSubCentro];
  //     this.subCentro.contrato = this.subCentro.contrato.filter(el => el.monto > 0)
  //   });
  // }

  crearContrato() {
    if (!this.contrato || !this.contrato.nombreContrato || this.contrato.monto <= 0) {
      return;
    }

    if (this.indiceEditar >= 0) {
      return;
    }

    this.contratoService.addContrato(this.contrato).subscribe(_ => {
      Swal.fire(
        "Contrato",
        "Se ha creado de forma correcta el contrato",
        "success"
      );
      this.reiniciarFormulario();
      this.cargarContratos();
    });
  }

  guardarEdicionContrato() {
    if (!this.contrato || !this.contrato.nombreContrato || this.contrato.monto <= 0) {
      return;
    }

    if (this.indiceEditar < 0 || !this.contrato.idContrato) {
      return;
    }

    this.contratoService.putContrato(this.contrato).subscribe(_ => {
      Swal.fire(
        "Contrato",
        "Se ha editado de forma correcta el contrato",
        "success"
      );
      this.reiniciarFormulario();
      this.cargarContratos();
    });
    // this.subCentro.contrato = this.subCentro.contrato.filter(el => el.monto > 0)
    // this.centroCosto.subCentroCosto.splice(this.indiceSubCentro, 1, this.subCentro);
    // console.log(this.centroCosto);
    // this._sCentroCosto
    //   .putCentroCosto(this.centroCosto)
    //   .subscribe((centroCosto) => {
    //     this.cancelar();
    //     Swal.fire(
    //       "Contrato",
    //       "Se ha creado de forma correcta el contrato",
    //       "success"
    //     );
    //   },
    //     error => {
    //       Swal.fire(
    //         "Contrato",
    //         "Ha ocurrido un error al guardar el contrato",
    //         "error"
    //       );
    //     });
  }

  cargaContrato(contrato: Contrato, index: number, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.indiceEditar = index;
    this.contratoService.getContratoById(contrato.idContrato).subscribe(res => {
      this.contrato = { ...res, centroCosto: res.centroCosto.idCentroCosto, empresa: res.empresa.idEmpresa };
    })
  }

  cancelarEdicion() {
    this.reiniciarFormulario();
  }

  cancelar() {
    this.cerrar.emit();
  }

  private cargarContratos() {
    this.contratos$ = this.contratoService.getContratoByIdCentroCosto(this.centroCosto.idCentroCosto);
    this.contratos$.subscribe((contratos: Contrato[]) => {
      this.contratos = contratos || [];
      this.totalMontoContratos = this.contratos.reduce((total, item) => {
        const monto = Number(item.monto);
        return total + (isNaN(monto) ? 0 : monto);
      }, 0);
    });
  }

  private reiniciarFormulario() {
    this.contrato = this.contratoService.init();
    this.contrato.centroCosto = this.centroCosto.idCentroCosto;
    this.indiceEditar = -1;
  }
}
