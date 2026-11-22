/**
 * Qué pantallas del menú ve la persona cuando Guardify está encendido (fase 2 de roles).
 *
 * Con una sesión de Guardify para la persona que está en la app, Guardify manda: la pantalla se ve si su rol tiene el permiso y se cumplen las
 * condiciones que Guardify fijó (división del turno, marca vigente…), evaluadas con los datos que tiene la app. Sin Guardify en la build, o
 * sin sesión de Guardify para esta persona (p. ej. entró sin conexión), se usa la regla de siempre de la app.
 *
 * Lo que no es de permisos sigue igual en los dos casos: la liberación del módulo (`n_modules_release`) y reglas de funcionamiento como que
 * «Entrega de puestos» necesita una entrada sin salida.
 *
 * Sin dependencias de React Native: lo prueba `apps/server/utils/guardifyMenu.test.ts`.
 */
import { conditionsMet, type Conditions } from '../vendor/guardify-sdk';

/** Nombre de la pantalla en la app (`releaseAction(...)`) → permiso en Guardify (`modulo.accion`). Igual que el manifiesto publicado. */
export const GUARDIFY_SCREENS: Record<string, string> = {
  home: 'general.inicio',
  profile: 'general.perfil',
  'digital-signature': 'general.firma-digital',
  jerarquia: 'general.jerarquia',
  'mis-puestos': 'general.mis-puestos',
  'marcar-ingreso-salida': 'asistencia.marcar-ingreso-salida',
  'lunch-time': 'asistencia.tiempo-de-alimentacion',
  'attendance-control': 'asistencia.control-de-asistencia',
  'mutuos-acuerdos': 'asistencia.mutuos-acuerdos',
  'permit-request': 'asistencia.solicitud-de-permiso',
  notes: 'bitacora.bitacora-de-novedades',
  'voice-notes': 'bitacora.notas-de-voz',
  visitors: 'bitacora.registro-de-personas',
  vehicles: 'bitacora.visitas-de-vehiculos',
  'bitacora-vehiculos-detenidos': 'bitacora.revision-de-vehiculos',
  'physical-minute-agenda': 'bitacora.agenda-minuta',
  incidents: 'incidentes.incidentes',
  'non-conforming-product': 'incidentes.producto-no-conforme',
  'entrega-puestos': 'cambio-de-puesto.entrega-de-puestos',
  'opening-closing-position': 'cambio-de-puesto.apertura-cierre-de-puesto',
  'puesto-ubicacion': 'cambio-de-puesto.ubicacion-del-puesto',
  'mantenimiento-equipo': 'cambio-de-puesto.equipo-del-puesto',
  llaves: 'cambio-de-puesto.llaves',
  'checklist-supervision': 'supervision.checklist-de-supervision',
  surveys: 'supervision.encuestas-de-satisfaccion',
  staffEvaluations: 'supervision.evaluacion-de-personal',
  'complaints-master': 'supervision.maestro-de-quejas',
  'induction-tour-record': 'supervision.induccion-y-recorrido',
  'apreciacion-vulnerabilidad': 'supervision.apreciacion-de-vulnerabilidad',
  activities: 'administracion.actividades',
  'acta-entrega-productos': 'administracion.acta-de-entrega-de-productos',
  'job-manuals': 'administracion.documentos',
  'documentos-entregados': 'administracion.documentos-entregados',
  trainings: 'administracion.registro-de-capacitaciones',
  'general-induction-register': 'administracion.induccion-general',
  'corporate-vehicles': 'administracion.registro-de-vehiculos',
  'traslado-plazas': 'administracion.archivos-de-acciones',
  reportes: 'administracion.reportes',
  'module-visibility': 'administracion.visibilidad-de-modulos',
  'super-admins': 'administracion.super-admins',
  nomencladores: 'administracion.nomencladores',
};

/** Lo que la app sabe de la sesión de Guardify de la persona (lo copia `guardifyClient.ts` desde el SDK). */
export type GuardifyAccess = { externalUserId: string; role: string | null; grants: string[]; conditions: Conditions };

/** Datos del momento con los que se evalúan las condiciones (`context` del manifiesto): marca vigente y división de su puesto. */
export function menuContext(marca: { hasCurrentMarca: boolean; division: string | null }): Record<string, string | null> {
  return { marca: marca.hasCurrentMarca ? 'vigente' : null, division: marca.division };
}

/** ¿Manda Guardify para esta persona? Solo con su propia sesión (no la de otra persona que usó el equipo antes). */
export function guardifyGoverns(access: GuardifyAccess | null | undefined, cedula: string | null | undefined): access is GuardifyAccess {
  return !!access && !!cedula && String(access.externalUserId).trim() === String(cedula).trim();
}

/**
 * ¿Se muestra la pantalla? `legacy` es la regla de siempre de la app (se usa si Guardify no manda o no conoce la pantalla); `released` es la
 * liberación del módulo y `extra`, las reglas de funcionamiento que no son de permisos.
 */
export function screenVisible(
  name: string,
  opts: { access: GuardifyAccess | null | undefined; cedula: string | null | undefined; legacy: boolean; context: Record<string, string | null>; released?: boolean; extra?: boolean },
): boolean {
  const perm = GUARDIFY_SCREENS[name];
  if (!perm || !guardifyGoverns(opts.access, opts.cedula)) return opts.legacy;
  if (opts.released === false || opts.extra === false) return false;
  return opts.access.grants.includes(perm) && conditionsMet(opts.access.conditions[perm], opts.context);
}
