import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs/observable/of';

import { ValoresMonedasComponent } from './valores-monedas.component';
import { sMonedas } from '../../../services/sMonedas';

describe('ValoresMonedasComponent', () => {
  let component: ValoresMonedasComponent;
  let fixture: ComponentFixture<ValoresMonedasComponent>;
  const monedasServiceMock = {
    getMonedas: () => of({
      uf: { valor: 40290.47 },
      dolar: { valor: 894.25 },
      utm: { valor: 70588 },
      euro: { valor: 1053.17 }
    })
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ValoresMonedasComponent ],
      providers: [
        { provide: sMonedas, useValue: monedasServiceMock }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ValoresMonedasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
