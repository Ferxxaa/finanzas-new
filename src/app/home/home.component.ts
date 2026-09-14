import { Component, OnInit } from '@angular/core';
import { Http, Response, Headers } from '@angular/http';
import 'rxjs/add/operator/map'
import { style } from '@angular/core/src/animation/dsl';
import { AppComponent } from '../app.component';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

declare var jQuery: any;
declare var $: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})

export class HomeComponent implements OnInit {

  SubProy : any;
  Tareas: any;
  pgProy1 : string;
  status : boolean;
  

  'ProgBar'
  Proyectos= [];
  nombreProy : string;
  AvanceProyBar : string;
  datos:any ={}
  usuario: any = null;
  
  constructor(private _http: Http, private router: Router) {

    this.status=true;

    this.Tareas = [
      {Tarea: "Tarea", id: "1"},
      {Tarea: "Tarea1", id: "2"},
      {Tarea: "Tarea2", id: "3"},
    ]

   }

   CargaDatosReporteSP(){
    if (!this.usuario) {
      this.status = false;
      return;
    }

    this.Proyectos = [];
    this.status = false;
   }

  ngOnInit() {
    this.status=true;
    $('#content').attr('class','content foo');

    if (localStorage.hasOwnProperty('usuario')) {
      this.usuario = JSON.parse(localStorage.usuario);
    }

    this.CargaDatosReporteSP()

    if (!this.usuario) {
      this.status = false;
      return;
    }

    $.ajax({
      url: environment.url + 'Tarea/GetTareaByidUsuarioResponsable/idUsuarioResponsable=' + this.usuario.idUsuario
      }).then((data) => {
        $('#lblTareasPendientes').append(data.length);
        $('#lblTarPen').append(data.length);
      }).fail(() => {
        this.status = false;
      });

    this.status=false;

    //console.log("cargue el home");

  }

  setMyStyles(index:number){
    let styles = {
      'width': this.Proyectos[index].Avance + '%',
    };
    return styles;
  }

  getClase(Estado:string):string{
    var clase : string
    if (Estado=="warning" ){
      clase="progress-warning";
    }else if(Estado=="danger"){
      clase="progress-danger";
    }else{
      clase="progress-success";
    }
    
    return clase
  }

}