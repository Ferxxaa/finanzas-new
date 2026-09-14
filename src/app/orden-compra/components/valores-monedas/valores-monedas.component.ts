import { Component, OnInit } from '@angular/core';

import { sMonedas } from '../../../services/sMonedas';

@Component({
  selector: 'app-valores-monedas',
  templateUrl: './valores-monedas.component.html',
  styleUrls: ['./valores-monedas.component.css']
})
export class ValoresMonedasComponent implements OnInit {
  monedas: Array<{ titulo: string, valor: string }> = [
    { titulo: 'UF', valor: 'Cargando...' },
    { titulo: 'USD', valor: 'Cargando...' },
    { titulo: 'UTM', valor: 'Cargando...' },
    { titulo: 'Euro', valor: 'Cargando...' }
  ];

  constructor(private monedasService: sMonedas) {}

  ngOnInit() {
    this.monedasService.getMonedas().subscribe((res) => {
      this.monedas = [
        { titulo: 'UF', valor: this.formatearValor(res && res.uf ? res.uf.valor : null) },
        { titulo: 'USD', valor: this.formatearValor(res && res.dolar ? res.dolar.valor : null) },
        { titulo: 'UTM', valor: this.formatearValor(res && res.utm ? res.utm.valor : null) },
        { titulo: 'Euro', valor: this.formatearValor(res && res.euro ? res.euro.valor : null) }
      ];
    });
  }

  private formatearValor(valor: number | null): string {
    if (valor === null || valor === undefined) {
      return 'No disponible';
    }

    return '$ ' + new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  }

}
