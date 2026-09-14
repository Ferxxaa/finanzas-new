import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Http, Response } from '@angular/http';

import { environment } from '../../../../environments/environment';
import { cotizacionService } from '../../../services/cotizacionService.service';
import { sMovimientoService } from '../../../services/sMovimiento.service';

import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/forkJoin';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/of';

type BellNotificationKind = 'cotizacion' | 'oc-aprobar' | 'oc-rechazada' | 'oc-aprobada';

interface BellNotification {
  id: string;
  kind: BellNotificationKind;
  title: string;
  body: string;
  link: string;
  createdAt: Date | null;
  createdAtText?: string;
  priority: number | null; // 1=baja, 2=media, 3=alta
  priorityLabel?: string;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  providers: [cotizacionService, sMovimientoService]
})
export class HeaderComponent implements OnInit {

  private static lastGlobalAutoRefreshAtMs: number = 0;

  notifications: BellNotification[] = [];
  unreadCount: number = 0; // pendientes NO vistos (derivado de conteos)

  isRefreshing: boolean = false;
  lastUpdatedAt: Date | null = null;

  viewMode: 'new' | 'all' = 'new';

  private userId: number = 0;
  private profileIds: number[] = [];

  private usuario: any = null;

  private pollSub: Subscription | null = null;
  private visibilityHandler: any = null;

  private initializedSnapshot: boolean = false;
  private lastUnseenIds: { [id: string]: 1 } = {};
  private lastToastAtMs: number = 0;

  private allNotifications: BellNotification[] = [];

  private lastCotizaciones: any[] = [];
  private lastOcPorAprobar: any[] = [];
  private lastOcRechazadas: any[] = [];
  private lastOcAprobadas: any[] = [];
  private lastOcAprobadasFetchAtMs: number = 0;

  private readonly seenStorageKeyBase: string = 'finanza.notifications.seen.v2';
  private seenIds: { [id: string]: 1 } = {};
  private seenList: string[] = [];

  private profilesLoaded: boolean = false;
  private profilesLoading: boolean = false;

  constructor(
    private route: Router,
    private http: Http,
    private cotizacionesService: cotizacionService,
    private movimientoService: sMovimientoService
  ) {
    if (localStorage.hasOwnProperty('usuario')) {
      try {
        this.usuario = JSON.parse(localStorage.usuario);
        // Distintos módulos guardan distintas propiedades; intenta cubrir todas
        this.userId = Number(this.usuario.idUsuario || this.usuario.IdUsuario || this.usuario.id || this.usuario.Id || 0);
      } catch (e) {
        this.userId = 0;
      }
    }

    // Perfiles NO se leen desde localStorage: se cargan desde BD vía API

    this.loadSeenFromStorage();
  }

  ngOnInit() {
    this.refreshPending(false);

    // Polling para que sea "real" entre usuarios sin websockets
    this.pollSub = Observable.interval(environment.notificationsPollMs || 30000).subscribe(() => {
      try {
        if (typeof document !== 'undefined' && document && document.hidden === true) {
          return;
        }
      } catch (_) {
        // ignore
      }
      this.refreshPending(false);
    });

    // Al volver a la pestaña, refresca al tiro
    this.visibilityHandler = () => {
      try {
        if (typeof document !== 'undefined' && document && document.hidden === false) {
          this.refreshPending(false);
        }
      } catch (_) {
        this.refreshPending(false);
      }
    };
    try {
      if (typeof document !== 'undefined' && document && document.addEventListener) {
        document.addEventListener('visibilitychange', this.visibilityHandler);
      }
    } catch (_) {
      // ignore
    }
  }

  onBellClick(event: any) {
    // Evita el salto al tope por el href="#" pero deja que Bootstrap maneje el toggle del dropdown
    if (event && event.preventDefault) event.preventDefault();
    // Request permission bajo gesto de usuario (mejor compatibilidad con navegadores)
    this.requestBrowserNotificationPermission();
    this.refreshPending(true);
  }

  refreshNow(event: any) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    this.refreshPending(true);
  }

  setViewMode(mode: 'new' | 'all', event: any) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    this.viewMode = mode;
    this.rebuildNotificationsView();
  }

  markAllAsRead(event: any) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();

    // Marca como visto todo lo que está en el snapshot actual
    for (const n of (this.allNotifications || [])) {
      this.markSeen(n.id);
    }
    this.rebuildNotificationsView();
  }

  closeNotificationsDropdown(event: any) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();

    try {
      const toggle = document.getElementById('bell-dropdown-toggle') as any;
      if (toggle && toggle.click) {
        // Si está abierto, un click lo cierra (Bootstrap dropdown)
        toggle.click();
      }
    } catch (_) {
      // ignore
    }
  }

  enableBrowserNotifications(event: any) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    this.requestBrowserNotificationPermission();
  }

  getBrowserNotificationPermission(): string {
    try {
      const w: any = window as any;
      if (!w || !w.Notification) return 'unsupported';
      return w.Notification.permission;
    } catch (_) {
      return 'unsupported';
    }
  }

  ngOnDestroy() {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = null;
    }

    try {
      if (this.visibilityHandler && typeof document !== 'undefined' && document && document.removeEventListener) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      }
    } catch (_) {
      // ignore
    }
    this.visibilityHandler = null;
  }

  openNotification(n: BellNotification, event: any) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();

    // Instagram-like: al click se marca como vista SOLO esa notificación
    if (n && n.id) {
      this.markSeen(n.id);
      this.rebuildNotificationsView();
    }

    // Cerrar el dropdown de notificaciones
    this.closeBellDropdown();

    if (n.link) {
      this.route.navigate([n.link]);
    }
  }

  private closeBellDropdown() {
    try {
      const toggle = document.getElementById('bell-dropdown-toggle') as any;
      const dropdownMenu = document.getElementById('bell-dropdown-menu');
      // Solo cerrar si está abierto
      if (toggle && dropdownMenu && dropdownMenu.classList.contains('show')) {
        toggle.click(); // Bootstrap dropdown toggle
      }
    } catch (_) {
      // ignore
    }
  }

  private refreshPending(force: boolean = false) {
    if (this.isRefreshing) {
      return;
    }

    if (!force) {
      const pollMs = Math.max(environment.notificationsPollMs || 30000, 15000);
      const nowMs = Date.now();
      if (nowMs - HeaderComponent.lastGlobalAutoRefreshAtMs < pollMs) {
        return;
      }
      HeaderComponent.lastGlobalAutoRefreshAtMs = nowMs;
    }

    this.isRefreshing = true;

    // Primero carga perfiles reales desde BD
    if (this.userId && !this.profilesLoaded && !this.profilesLoading) {
      this.profilesLoading = true;
      this.loadProfilesFromDb(this.userId).subscribe(ids => {
        this.profileIds = ids;
        this.profilesLoaded = true;
        this.profilesLoading = false;
        this.isRefreshing = false;
        this.refreshPending();
      }, _ => {
        this.profileIds = [];
        this.profilesLoaded = true;
        this.profilesLoading = false;
        // No limpies la UI si falla el endpoint de perfiles; igual podemos notificar rechazadas por creador.
        this.isRefreshing = false;
        this.refreshPending();
      });
      return;
    }

    const isAdministracion = this.profileIds.includes(environment.perfiles.administracion);
    const isJefeAdmin = this.profileIds.includes(environment.perfiles.jefeAdministracion);
    const isGerenteAdmin = this.profileIds.includes(environment.perfiles.gerenteAdmin);
    const isSistema = this.profileIds.includes(environment.perfiles.sistema);
    const isSubgerente = this.profileIds.includes(environment.perfiles.subgerente);

    // Requerimiento: Cotizaciones pendientes solo para JefeAdministracion
    const canSeeCotizacionesPendientes = isJefeAdmin;
    // Requerimiento: OC por aprobar solo para Gerente-Administracion
    const canAprobarOC = isGerenteAdmin;
    // Requerimiento: OC rechazadas debe notificar a Administracion y JefeAdministracion
    const canSeeOcRechazadas = isAdministracion || isJefeAdmin;
    // Requerimiento: OC aprobadas notifica a Administracion y JefeAdministracion
    const canSeeOcAprobadas = isAdministracion || isJefeAdmin;

    const cotizaciones$ = canSeeCotizacionesPendientes
      ? this.cotizacionesService.getCotizacionesPendientes().catch(_ => Observable.of(null))
      : Observable.of([]);

    const aprobacionOc$ = canAprobarOC
      ? this.movimientoService.getPorAprobar()
        .map(list => (list || []).filter(m => Number(m.tipo) === environment.tiposOC.ordenCompra))
        .catch(_ => Observable.of(null))
      : Observable.of([]);

    const rechazadasOc$ = canSeeOcRechazadas
      ? this.movimientoService.getRechazadas()
        .map(list => (list || [])
          // Filtrar: solo usuarios con perfil JefeAdministracion
          .filter(m => Number(m.tipo) === environment.tiposOC.ordenCompra))
        .catch(_ => Observable.of(null))
      : Observable.of([]);

    const aprobadasFetchIntervalMs = 60000;
    const shouldFetchAprobadas = force && canSeeOcAprobadas && (
      this.lastOcAprobadasFetchAtMs === 0 ||
      (Date.now() - this.lastOcAprobadasFetchAtMs) >= aprobadasFetchIntervalMs
    );

    const aprobadasOc$ = shouldFetchAprobadas
      ? this.movimientoService.getAprobadas()
        .map(list => {
          // Filtrar solo OC aprobadas en los últimos 7 días
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          
          return (list || [])
            .filter(m => Number(m.tipo) === environment.tiposOC.ordenCompra)
            .filter(m => {
              // Filtrar por fecha de creación (ya que fechaFirma podría no estar en todos los registros)
              const fecha = this.tryParseAnyDate((m as any).fechaFirma || m.fechaCreacion);
              if (!fecha) return false;
              return fecha >= sevenDaysAgo;
            });
        })
        .catch(_ => Observable.of(null))
      : Observable.of(this.lastOcAprobadas);

    Observable.forkJoin([cotizaciones$, aprobacionOc$, rechazadasOc$, aprobadasOc$]).subscribe((results: any[]) => {
      const cotizaciones = (results && results[0] !== null && results[0] !== undefined) ? results[0] : this.lastCotizaciones;
      const ocPorAprobar = (results && results[1] !== null && results[1] !== undefined) ? results[1] : this.lastOcPorAprobar;
      const ocRechazadas = (results && results[2] !== null && results[2] !== undefined) ? results[2] : this.lastOcRechazadas;
      const ocAprobadas = (results && results[3] !== null && results[3] !== undefined) ? results[3] : this.lastOcAprobadas;

      // Actualiza caches solo cuando la respuesta viene (aunque sea [])
      this.lastCotizaciones = Array.isArray(cotizaciones) ? cotizaciones : [];
      this.lastOcPorAprobar = Array.isArray(ocPorAprobar) ? ocPorAprobar : [];
      this.lastOcRechazadas = Array.isArray(ocRechazadas) ? ocRechazadas : [];
      this.lastOcAprobadas = Array.isArray(ocAprobadas) ? ocAprobadas : [];
      if (shouldFetchAprobadas && results && results[3] !== null && results[3] !== undefined) {
        this.lastOcAprobadasFetchAtMs = Date.now();
      }

      const built = this.buildNotifications(cotizaciones, ocPorAprobar, ocRechazadas, ocAprobadas);
      this.applySnapshot(built);

      this.isRefreshing = false;
      this.lastUpdatedAt = new Date();
    }, _ => {
      // Si falla, no rompemos la UI
      this.isRefreshing = false;
      this.lastUpdatedAt = new Date();
    });
  }

  private requestBrowserNotificationPermission() {
    try {
      const w: any = window as any;
      if (!w || !w.Notification) return;
      if (w.Notification.permission === 'granted') return;
      if (w.Notification.permission === 'denied') return;
      
      const result = w.Notification.requestPermission();
      if (result && typeof result.then === 'function') {
        result.then(() => {});
      }
    } catch (_) {
      // ignore
    }
  }

  private maybeShowBrowserToasts(newUnseenByKind: { cot: number; oc: number; rech: number; aprob: number }) {
    if (!newUnseenByKind) return;
    const total = (newUnseenByKind.cot || 0) + (newUnseenByKind.oc || 0) + (newUnseenByKind.rech || 0) + (newUnseenByKind.aprob || 0);
    if (total <= 0) return;

    // Requiere soporte y permiso
    let permission = 'unsupported';
    try {
      const w: any = window as any;
      permission = (w && w.Notification) ? w.Notification.permission : 'unsupported';
    } catch (_) {
      permission = 'unsupported';
    }
    if (permission !== 'granted') return;

    // Solo cuando la pestaña no está activa (evita ruido)
    try {
      if (typeof document !== 'undefined' && document && document.hidden === false) {
        return;
      }
    } catch (_) {
      // si falla, igual continuamos
    }

    // Throttle simple
    const nowMs = Date.now();
    if (nowMs - this.lastToastAtMs < 10000) return;
    this.lastToastAtMs = nowMs;

    let link = '/Cotizaciones';
    let tag = 'finanza-notifications';
    if ((newUnseenByKind.aprob || 0) > 0) {
      link = '/Ordenes';
      tag = 'oc-aprobadas';
    } else if ((newUnseenByKind.rech || 0) > 0) {
      link = '/EditaOC';
      tag = 'oc-rechazadas';
    } else if ((newUnseenByKind.oc || 0) > 0) {
      link = '/Aprobacion';
      tag = 'oc-por-aprobar';
    }

    const parts: string[] = [];
    if ((newUnseenByKind.cot || 0) > 0) parts.push(`Cotizaciones: ${newUnseenByKind.cot}`);
    if ((newUnseenByKind.oc || 0) > 0) parts.push(`OC por aprobar: ${newUnseenByKind.oc}`);
    if ((newUnseenByKind.rech || 0) > 0) parts.push(`OC rechazadas: ${newUnseenByKind.rech}`);
    if ((newUnseenByKind.aprob || 0) > 0) parts.push(`OC aprobadas: ${newUnseenByKind.aprob}`);

    this.showBrowserToast(
      'Tienes nueva(s) notificación(es)',
      parts.join(' · '),
      link,
      tag
    );
  }

  private showBrowserToast(title: string, body: string, link: string, tag: string) {
    try {
      const w: any = window as any;
      if (!w || !w.Notification) return;
      if (w.Notification.permission !== 'granted') return;

      const notif = new w.Notification(title, {
        body: body,
        tag: tag,
        renotify: true
      });

      notif.onclick = () => {
        try {
          if (w && w.focus) w.focus();
        } catch (_) {
          // ignore
        }
        try {
          this.route.navigate([link]);
        } catch (_) {
          // ignore
        }
        try {
          notif.close();
        } catch (_) {
          // ignore
        }
      };
    } catch (_) {
      // ignore
    }
  }

  private loadProfilesFromDb(userId: number): Observable<number[]> {
    // Mismo endpoint que se usa en LoginComponent.getPerfiles()
    const url = `${environment.url}UsuariosPerfiles/GetUsuariosPerfilesByIdUsuario/IdUsuario=${userId}`;
    return this.http
      .get(url)
      .map((res: Response) => res.json())
      .map((rows: any[]) => {
        if (!Array.isArray(rows)) return [];
        return rows
          .map(r => Number(r.idPerfil))
          .filter(n => !Number.isNaN(n));
      })
      .catch(_ => Observable.of([]));
  }

  private applySnapshot(all: BellNotification[]) {
    const sorted = (all || [])
      .slice()
      .sort((a, b) => (b.createdAt ? b.createdAt.getTime() : 0) - (a.createdAt ? a.createdAt.getTime() : 0));

    this.allNotifications = sorted;
    this.rebuildNotificationsView();

    // Toasts: detecta nuevos NO vistos vs snapshot anterior
    const unseenNow: { [id: string]: 1 } = {};
    const byKind = { cot: 0, oc: 0, rech: 0, aprob: 0 };
    for (const n of sorted) {
      if (!this.isSeen(n.id)) {
        unseenNow[n.id] = 1;
      }
    }

    if (!this.initializedSnapshot) {
      this.initializedSnapshot = true;
      this.lastUnseenIds = unseenNow;
      return;
    }

    // nuevos = unseenNow - lastUnseenIds
    for (const n of sorted) {
      if (!this.isSeen(n.id) && !this.lastUnseenIds[n.id]) {
        if (n.kind === 'cotizacion') byKind.cot++;
        if (n.kind === 'oc-aprobar') byKind.oc++;
        if (n.kind === 'oc-rechazada') byKind.rech++;
        if (n.kind === 'oc-aprobada') byKind.aprob++;
      }
    }

    this.lastUnseenIds = unseenNow;
    this.maybeShowBrowserToasts(byKind);
  }

  private rebuildNotificationsView() {
    const unseen = (this.allNotifications || []).filter(n => !this.isSeen(n.id));
    this.unreadCount = unseen.length;
    this.notifications = this.viewMode === 'all' ? (this.allNotifications || []) : unseen;
  }

  private buildNotifications(cotizaciones: any[], ocPorAprobar: any[], ocRechazadas: any[], ocAprobadas: any[]): BellNotification[] {
    const out: BellNotification[] = [];

    // Cotizaciones pendientes: 1 notificación por cotización
    if (Array.isArray(cotizaciones)) {
      for (const c of cotizaciones) {
        const id = String(c && (c.idCotizacion || c.id || c._id || '')).trim();
        if (!id || id === 'undefined' || id === 'null') continue;
        const rawDate = c && (c.fechaCreacion || c.createdAt || c.fecha);
        const createdAt = this.tryParseAnyDate(rawDate);
        const createdAtText = this.formatDateText(rawDate);
        const priority = this.normalizePriority(c && (c.prioridad || c.Prioridad));
        const priorityLabel = this.getPriorityLabel(priority);
        out.push({
          id: `cot:${id}`,
          kind: 'cotizacion',
          title: `Cotización #${id}`,
          body: (c && c.observacion) ? String(c.observacion) : 'Cotización pendiente para gestionar.',
          link: '/Cotizaciones',
          createdAt: createdAt,
          createdAtText: createdAtText || undefined,
          priority: priority,
          priorityLabel: priorityLabel
        });
      }
    }

    // OC por aprobar: 1 notificación por movimiento
    if (Array.isArray(ocPorAprobar)) {
      for (const m of ocPorAprobar) {
        const idMov = String(m && (m.idMovimiento || m.id || m._id || '')).trim();
        if (!idMov || idMov === 'undefined' || idMov === 'null') continue;
        const folio = (m && (m.folio != null)) ? String(m.folio) : idMov;
        const proveedor = (m && m.proveedor && m.proveedor.nombre) ? String(m.proveedor.nombre) : '';
        const desc = (m && m.descripcion) ? String(m.descripcion) : '';
        const rawDate = m && (m.fechaCreacion || m.createdAt || m.fecha);
        const createdAt = this.tryParseAnyDate(rawDate);
        const createdAtText = this.formatDateText(rawDate);
        const priority = this.normalizePriority(m && (m.prioridad || m.Prioridad));
        const priorityLabel = this.getPriorityLabel(priority);
        const body = [proveedor, desc].filter(Boolean).join(' · ') || 'Orden de compra pendiente de aprobación.';
        out.push({
          id: `oc-apr:${idMov}`,
          kind: 'oc-aprobar',
          title: `OC #${folio} por aprobar`,
          body: body,
          link: '/Aprobacion',
          createdAt: createdAt,
          createdAtText: createdAtText || undefined,
          priority: priority,
          priorityLabel: priorityLabel
        });
      }
    }

    // OC rechazadas (creador): 1 notificación por movimiento
    if (Array.isArray(ocRechazadas)) {
      for (const m of ocRechazadas) {
        const idMov = String(m && (m.idMovimiento || m.id || m._id || '')).trim();
        if (!idMov || idMov === 'undefined' || idMov === 'null') continue;
        const folio = (m && (m.folio != null)) ? String(m.folio) : idMov;
        const motivo = (m && m.motivoRechazo) ? String(m.motivoRechazo) : '';
        const desc = (m && m.descripcion) ? String(m.descripcion) : '';
        const rawDate = m && (m.fechaCreacion || m.createdAt || m.fecha);
        const createdAt = this.tryParseAnyDate(rawDate);
        const createdAtText = this.formatDateText(rawDate);
        const priority = this.normalizePriority(m && (m.prioridad || m.Prioridad));
        const priorityLabel = this.getPriorityLabel(priority);
        const body = [motivo, desc].filter(Boolean).join(' · ') || 'Orden de compra rechazada. Requiere corrección.';
        out.push({
          id: `oc-rech:${idMov}`,
          kind: 'oc-rechazada',
          title: `OC #${folio} rechazada`,
          body: body,
          link: '/EditaOC',
          createdAt: createdAt,
          createdAtText: createdAtText || undefined,
          priority: priority,
          priorityLabel: priorityLabel
        });
      }
    }

    // OC aprobadas: 1 notificación por movimiento
    if (Array.isArray(ocAprobadas)) {
      for (const m of ocAprobadas) {
        const idMov = String(m && (m.idMovimiento || m.id || m._id || '')).trim();
        if (!idMov || idMov === 'undefined' || idMov === 'null') continue;
        const folio = (m && (m.folio != null)) ? String(m.folio) : idMov;
        const proveedor = (m && m.proveedor && m.proveedor.nombre) ? String(m.proveedor.nombre) : '';
        const desc = (m && m.descripcion) ? String(m.descripcion) : '';
        const rawDate = (m as any).fechaFirma || m.fechaCreacion;
        const createdAt = this.tryParseAnyDate(rawDate);
        const createdAtText = this.formatDateText(rawDate);
        const priority = this.normalizePriority(m && (m.prioridad || m.Prioridad));
        const priorityLabel = this.getPriorityLabel(priority);
        const body = [proveedor, desc].filter(Boolean).join(' · ') || 'Orden de compra aprobada.';
        out.push({
          id: `oc-aprob:${idMov}`,
          kind: 'oc-aprobada',
          title: `OC #${folio} aprobada`,
          body: body,
          link: '/Ordenes',
          createdAt: createdAt,
          createdAtText: createdAtText || undefined,
          priority: priority,
          priorityLabel: priorityLabel
        });
      }
    }

    return out;
  }

  private normalizePriority(value: any): number | null {
    try {
      if (value === null || value === undefined) return null;
      const n = Number(value);
      if (Number.isNaN(n)) return null;
      if (n === 1 || n === 2 || n === 3) return n;
      return null;
    } catch (_) {
      return null;
    }
  }

  private getPriorityLabel(priority: number | null): string | undefined {
    if (priority === 1) return 'Baja';
    if (priority === 2) return 'Media';
    if (priority === 3) return 'Alta';
    return undefined;
  }

  private formatDateText(value: any): string | null {
    try {
      if (!value) return null;
      if (value instanceof Date) return null;

      // Caso común que rompe la hora: "YYYY-MM-DD" (JS lo interpreta como UTC y termina mostrando 21:00 en -03)
      // Aquí mostramos solo la fecha (sin hora) para no mentir.
      if (typeof value === 'string') {
        const s = value.trim();
        const onlyDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (onlyDate) {
          const y = Number(onlyDate[1]);
          const mo = Number(onlyDate[2]);
          const d = Number(onlyDate[3]);
          const dd = (d < 10 ? '0' : '') + String(d);
          const mm = (mo < 10 ? '0' : '') + String(mo);
          return `${dd}/${mm}/${y}`;
        }
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  private formatDateParts(y: number, m: number, d: number, hh: number, mm: number): string {
    const dd = (d < 10 ? '0' : '') + String(d);
    const mo = (m < 10 ? '0' : '') + String(m);
    const h = (hh < 10 ? '0' : '') + String(hh);
    const mi = (mm < 10 ? '0' : '') + String(mm);
    return `${dd}/${mo} ${h}:${mi}`;
  }

  private markSeen(id: string) {
    if (!id) return;
    const cleanId = String(id).trim();
    if (!cleanId || cleanId === 'undefined' || cleanId === 'null') return;
    if (this.seenIds[cleanId]) return;
    this.seenIds[cleanId] = 1;
    this.seenList.push(cleanId);

    // Limpieza simple para no crecer sin límite
    const MAX = 1000;
    while (this.seenList.length > MAX) {
      const removed = this.seenList.shift();
      if (removed) {
        delete this.seenIds[removed];
      }
    }
    this.saveSeenToStorage();
  }

  private isSeen(id: string): boolean {
    if (!id) return false;
    const cleanId = String(id).trim();
    if (!cleanId || cleanId === 'undefined' || cleanId === 'null') return false;
    return !!(this.seenIds && this.seenIds[cleanId]);
  }

  private loadSeenFromStorage() {
    try {
      const raw = localStorage.getItem(this.getSeenStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const arr: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed && parsed.seen) ? parsed.seen : []);
      this.seenIds = {};
      this.seenList = [];
      for (const v of arr) {
        const id = String(v || '').trim();
        if (!id || id === 'undefined' || id === 'null') continue;
        if (this.seenIds[id]) continue;
        this.seenIds[id] = 1;
        this.seenList.push(id);
      }
    } catch (_) {
      this.seenIds = {};
      this.seenList = [];
    }
  }

  private saveSeenToStorage() {
    try {
      localStorage.setItem(this.getSeenStorageKey(), JSON.stringify(this.seenList || []));
    } catch (_) {
      // ignore
    }
  }

  private tryParseAnyDate(value: any): Date | null {
    try {
      if (!value) return null;
      if (value instanceof Date && !isNaN(value.getTime())) return value;

      // "YYYY-MM-DD" -> parse como fecha local (evita corrimiento a 21:00 por UTC)
      if (typeof value === 'string') {
        const s = value.trim();
        const onlyDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (onlyDate) {
          const y = Number(onlyDate[1]);
          const m = Number(onlyDate[2]);
          const d = Number(onlyDate[3]);
          const local = new Date(y, m - 1, d, 0, 0, 0, 0);
          return isNaN(local.getTime()) ? null : local;
        }
      }

      // .NET style: /Date(1700000000000)/
      if (typeof value === 'string') {
        const m = /\/Date\((\d+)\)\//.exec(value);
        if (m && m[1]) {
          const ms = Number(m[1]);
          if (!isNaN(ms)) {
            const dotNet = new Date(ms);
            if (!isNaN(dotNet.getTime())) return dotNet;
          }
        }
      }

      // Numeric timestamps
      if (typeof value === 'number') {
        const dNum = new Date(value);
        return isNaN(dNum.getTime()) ? null : dNum;
      }

      // Common backend format: "YYYY-MM-DD HH:mm:ss" (not always parsed reliably)
      if (typeof value === 'string') {
        const s = value.trim();
        const hasSpaceTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s);
        if (hasSpaceTime) {
          const normalized = s.replace(' ', 'T');
          const dNorm = new Date(normalized);
          if (!isNaN(dNorm.getTime())) return dNorm;
        }
      }

      const d = new Date(value);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch (_) {
      return null;
    }
  }

  private getSeenStorageKey(): string {
    // Evita que el "visto" se mezcle entre usuarios en el mismo navegador
    return `${this.seenStorageKeyBase}.${Number(this.userId || 0)}`;
  }

  CerrarSesion(){
    localStorage.removeItem("usuario");
    this.route.navigate(['/Login']);
  }

}
