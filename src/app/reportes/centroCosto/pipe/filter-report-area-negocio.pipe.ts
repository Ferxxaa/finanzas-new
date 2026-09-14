import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterReportAreaNegocio'
})
export class FilterReportAreaNegocioPipe implements PipeTransform {

  transform(value: any, args: number): any {
    if (!value) {
      return [];
    }

    if (args && args > 0) {
      return value.filter(el => el.areaNegocio.id == args)
    }

    return value;
  }

}
