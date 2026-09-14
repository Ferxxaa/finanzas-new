import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Http, Response } from '@angular/http';
import { Observable } from 'rxjs';
import { CentroCosto } from '../../../models/nestCentroCosto';
import { centroCostoService } from '../../../services/sCentroCostoNest.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-lista-centros-costo',
  templateUrl: './lista-centros-costo.component.html',
  styleUrls: ['./lista-centros-costo.component.css'],
  providers: [centroCostoService]
})
export class ListaCentrosCostoComponent implements OnInit {

  @Output() configBolsa: EventEmitter<CentroCosto>;
  @Output() configIngreso: EventEmitter<CentroCosto>;
  @Output() configContrato: EventEmitter<CentroCosto>;
  @Output() configGarantia: EventEmitter<CentroCosto>;

  p: number;
  centrosCosto$: Observable<CentroCosto[]>;
  mostrandoDesactivados: boolean;
  gerenteAdmin: boolean;
  eCentroCosto: CentroCosto;
  private usuario: any;

  constructor(
    private centroCostoService: centroCostoService,
    private http: Http
  ) {
    this.configBolsa = new EventEmitter();
    this.configIngreso = new EventEmitter();
    this.configContrato = new EventEmitter();
    this.configGarantia = new EventEmitter();
    this.mostrandoDesactivados = false;
    this.gerenteAdmin = false;
    this.centrosCosto$ = null;
    this.eCentroCosto = null;
  }

  ngOnInit() {
    this.cargarPermisos();
    this.cargarCentrosCosto();
  }

  update() {
    this.cargarCentrosCosto();
    this.eCentroCosto = null;
  }

  cambiarVistaDesactivados() {
    this.mostrandoDesactivados = !this.mostrandoDesactivados;
    this.p = 1;
    this.cargarCentrosCosto();
  }

  popUp(centroCoosto: CentroCosto) {
    this.centroCostoService.getCentroCostoById(centroCoosto.idCentroCosto).subscribe((res) => {
      this.eCentroCosto = res;
    });
  }

  configurarBolsas(centroCosto: CentroCosto) {
    this.configBolsa.emit(centroCosto);
  }

  configurarIngresos(centroCosto: CentroCosto) {
    this.configIngreso.emit(centroCosto);
  }

  configurarContratos(centroCosto: CentroCosto) {
    this.configContrato.emit(centroCosto);
  }

  garantiaCentroCostos(centroCosto: CentroCosto) {
    this.configGarantia.emit(centroCosto);
  }

  private cargarCentrosCosto() {
    this.centrosCosto$ = this.centroCostoService
      .getCentroCostoWithParentFull()
      .map((centrosCosto) => (centrosCosto || [])
        .filter((centroCosto) => this.mostrandoDesactivados ? !centroCosto.isActive : centroCosto.isActive));
  }

  private cargarPermisos() {
    if (!localStorage.hasOwnProperty('usuario')) {
      return;
    }

    try {
      this.usuario = JSON.parse(localStorage.usuario);
      this.http
        .get(environment.url + 'UsuariosPerfiles/GetUsuariosPerfilesByIdUsuario/IdUsuario=' + this.usuario.idUsuario)
        .map((res: Response) => res.json())
        .subscribe((perfiles) => {
          this.gerenteAdmin = (perfiles || []).some((perfil) => Number(perfil.idPerfil) === environment.perfiles.gerenteAdmin);
        });
    }
    catch (_error) {
      this.gerenteAdmin = false;
    }
  }

}
