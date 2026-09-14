import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'addView'
})
export class AddViewPipe implements PipeTransform {

  transform(value: any, args?: any): any {
    if (!value) {
      return [];
    }

    return value.map(el => ({ ...el, view: false }))
  }

}
