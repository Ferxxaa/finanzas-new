import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

declare var jQuery: any;
declare var $: any;

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit {

  header:boolean=localStorage.hasOwnProperty('usuario');
  nav:boolean=localStorage.hasOwnProperty('usuario');

  constructor(private router:Router) { 
    this.header=localStorage.hasOwnProperty('usuario');
    this.nav=localStorage.hasOwnProperty('usuario');
    if (this.header == false){
      router.navigate(["/Login"]);
    }
  }

  ngOnInit() {
    this.header=localStorage.hasOwnProperty('usuario');
    this.nav=localStorage.hasOwnProperty('usuario');
    if (this.header == false){
      this.router.navigate(["/Login"]);
    }
  }

}
