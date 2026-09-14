import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditCentroCostoNestComponent } from './edit-centro-costo-nest.component';

describe('EditCentroCostoNestComponent', () => {
  let component: EditCentroCostoNestComponent;
  let fixture: ComponentFixture<EditCentroCostoNestComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EditCentroCostoNestComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditCentroCostoNestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should enter editing mode for an existing centro costo label', () => {
    component.editarEtiqueta({ idEtiquetaGasto: 7, nombreEtiqueta: 'Etiqueta A', idCentroCosto: 10 } as any);

    expect(component.nuevaEtiqueta).toBe('Etiqueta A');
    expect(component.editingEtiquetaId).toBe(7);
  });
});
