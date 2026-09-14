import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css']
})
export class UserComponent implements OnInit {

  usuario:any={}
  rolUsuario: string = 'Sin rol';


  constructor(private route: Router) {
    if (!localStorage.hasOwnProperty('usuario')) {
      console.log("usuario no logueado");
    }else{
      try {
        this.usuario=JSON.parse(localStorage.usuario);
        this.rolUsuario = this.getRolUsuario();
      }
      catch(err) {
          console.log(err.message);
      }
    }
  }

  ngOnInit() {
  }

  CerrarSesion(){
    localStorage.removeItem("usuario");
    this.route.navigate(['/Login']);
  }

  private getRolUsuario(): string {
    if (!localStorage.hasOwnProperty('perfiles')) {
      return 'Sin rol';
    }

    try {
      const perfiles = JSON.parse(localStorage.perfiles) || [];
      const ids: number[] = perfiles
        .map(p => Number(p.idPerfil))
        .filter(id => !Number.isNaN(id));

      if (!ids.length) {
        return 'Sin rol';
      }

      const prioridadRoles = [10, 12, 11, 1, 2, 3, 7, 8, 9, 4];
      const rolPrincipal = prioridadRoles.find(id => ids.includes(id));

      if (rolPrincipal) {
        return this.getNombreRol(rolPrincipal);
      }

      return this.getNombreRol(ids[0]);
    } catch (err) {
      return 'Sin rol';
    }
  }

  private getNombreRol(idPerfil: number): string {
    switch (idPerfil) {
      case 1: return 'Subgerente';
      case 2: return 'Director Proyecto';
      case 3: return 'Coordinador Proyecto';
      case 4: return 'Sistema';
      case 7: return 'Director Licitaciones';
      case 8: return 'Coordinador Licitaciones';
      case 9: return 'Seguridad';
      case 10: return 'Administración';
      case 11: return 'Gerente Administración';
      case 12: return 'Jefe Administración';
      default: return 'Sin rol';
    }
  }

}
