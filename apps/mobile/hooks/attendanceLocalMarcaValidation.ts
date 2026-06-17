/** Reglas de asistencia en dispositivo (alineadas con attendance/user/[id]/route.ts). */

import { toZonedTime } from 'date-fns-tz';
import { DEFAULT_MONITORING_PREVIOUS_MINUTES } from './monitoringPreviousMinutesStorage';

export const MARCA_LOCATION_RADIUS_METERS = 50;
const COSTA_RICA_TZ = 'America/Costa_Rica';

export type LocalMarcaValidationResult = {
  markingBlocked: boolean;
  canMarkEntrada: boolean;
  canMarkSalida: boolean;
  message?: string;
  absent?: boolean;
  should_response?: boolean;
  revertMarcaId?: number | null;
};

function isoDatePart(fecha: unknown): string {
  if (typeof fecha === 'string') return fecha.split('T')[0];
  if (fecha instanceof Date) return fecha.toISOString().split('T')[0];
  return String(fecha ?? '').split('T')[0];
}

function isoTimePart(hora: unknown): string {
  if (typeof hora === 'string') {
    const part = hora.includes('T') ? hora.split('T')[1] : hora;
    return part.split('.')[0];
  }
  if (hora instanceof Date) {
    return hora.toISOString().split('T')[1].split('.')[0];
  }
  const raw = String(hora ?? '');
  return raw.includes('T') ? raw.split('T')[1].split('.')[0] : raw.split('.')[0];
}

export function getDistanceFromLatLonInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseMarcaFechaParts(fecha: unknown): { y: number; m: number; d: number } | null {
  const s = isoDatePart(fecha);
  const parts = s.split('-');
  if (parts.length < 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2].slice(0, 2), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m: m - 1, d };
}

function buildMarcaDateTime(
  marca: Record<string, unknown>,
  horaField: 'hora_inicio' | 'hora_fin',
  addDayIfCrossMidnight: boolean
): Date | null {
  const fp = parseMarcaFechaParts(marca.fecha);
  if (!fp || marca[horaField] == null) return null;

  const dt = toZonedTime(new Date(String(marca[horaField])), COSTA_RICA_TZ);
  const crossMidnight =
    marca.hora_inicio != null &&
    marca.hora_fin != null &&
    new Date(String(marca.hora_inicio)) > new Date(String(marca.hora_fin));

  let day = fp.d;
  if (addDayIfCrossMidnight && crossMidnight && horaField === 'hora_fin') {
    day += 1;
  }

  dt.setFullYear(fp.y, fp.m, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function computeMarcaShiftBounds(marca: Record<string, unknown>): {
  inicio: Date | null;
  fin: Date | null;
} {
  if (marca.hora_inicio == null || marca.hora_fin == null) {
    return { inicio: null, fin: null };
  }

  const inicio = buildMarcaDateTime(marca, 'hora_inicio', false);
  if (!inicio) {
    return { inicio: null, fin: null };
  }

  let fin: Date | null = null;
  if (marca.horas_duracion != null && marca.horas_duracion !== '') {
    const horas_duracion = parseFloat(String(marca.horas_duracion));
    if (Number.isFinite(horas_duracion) && horas_duracion > 0) {
      fin = new Date(inicio.getTime() + horas_duracion * 60 * 60 * 1000);
    }
  }

  if (!fin) {
    fin = buildMarcaDateTime(marca, 'hora_fin', true);
  }

  if (fin && Number.isNaN(fin.getTime())) {
    return { inicio, fin: null };
  }

  return { inicio, fin };
}

export function computeChangeAvailable(
  marca: Record<string, unknown>,
  nowMs: number,
  monitoringPreviousMinutes: number = DEFAULT_MONITORING_PREVIOUS_MINUTES
): boolean {
  const estado = marca.hora_entrada_digitada != null ? 'Ingresado' : 'No ingresado';
  const { inicio, fin } = computeMarcaShiftBounds(marca);
  if (!inicio || !fin) return true;

  const nextTime = estado === 'No ingresado' ? inicio : fin;
  const nextChangeTime = new Date(nextTime.getTime());
  nextChangeTime.setMinutes(nextChangeTime.getMinutes() - monitoringPreviousMinutes);

  if (estado === 'No ingresado' && nowMs < nextChangeTime.getTime()) {
    return false;
  }
  return true;
}

export function validateMarcaLocation(
  marca: Record<string, unknown>,
  lat: number,
  lng: number
): { ok: true } | { ok: false; message: string } {
  const puesto = marca.puesto as Record<string, unknown> | undefined;
  const ubicacion = puesto?.ubicacion as { lat?: unknown; lng?: unknown } | undefined;
  const pLat = ubicacion?.lat != null ? Number(ubicacion.lat) : NaN;
  const pLng = ubicacion?.lng != null ? Number(ubicacion.lng) : NaN;

  if (
    marca.hora_entrada_digitada != null ||
    !Number.isFinite(pLat) ||
    !Number.isFinite(pLng) ||
    pLat === 0 ||
    pLng === 0
  ) {
    return { ok: true };
  }

  const distance = getDistanceFromLatLonInMeters(lat, lng, pLat, pLng);
  if (distance <= MARCA_LOCATION_RADIUS_METERS) {
    return { ok: true };
  }

  const marcaUbicacion = `${pLat}, ${pLng}`;
  const ubicacionActual = `${lat}, ${lng}`;
  return {
    ok: false,
    message:
      'Ubicación no válida \n\nDebes estar dentro del radio de 50 metros del puesto para marcar la asistencia.\n\nPuesto: ' +
      marcaUbicacion +
      '\nTu ubicación: ' +
      ubicacionActual,
  };
}

export function evaluateLocalMarcaRules(
  marca: Record<string, unknown>,
  nowMs: number,
  opts?: {
    pendingAbsentReason?: boolean;
    lat?: number | null;
    lng?: number | null;
    /** Si true, incluye validación de ubicación para marcar entrada. */
    validateLocationForEntrada?: boolean;
    monitoringPreviousMinutes?: number;
  }
): LocalMarcaValidationResult {
  const monitoringPreviousMinutes =
    opts?.monitoringPreviousMinutes ?? DEFAULT_MONITORING_PREVIOUS_MINUTES;
  const marcaId = marca.id != null ? Number(marca.id) : null;
  let canMarkEntrada = marca.hora_entrada_digitada == null && marca.hora_salida_digitada == null;
  let canMarkSalida =
    marca.hora_entrada_digitada != null && marca.hora_salida_digitada == null;

  if (marca.hora_salida_digitada != null) {
    return {
      markingBlocked: true,
      canMarkEntrada: false,
      canMarkSalida: false,
      message: 'Ya has marcado la salida',
      revertMarcaId: marcaId,
    };
  }

  const { inicio, fin } = computeMarcaShiftBounds(marca);
  if (!inicio || !fin) {
    return {
      markingBlocked: false,
      canMarkEntrada,
      canMarkSalida,
    };
  }

  if (marca.hora_entrada_digitada == null && nowMs > fin.getTime()) {
    const hora_inicio_display = inicio.toISOString().split('T')[1].split('.')[0];
    const fecha_display = isoDatePart(marca.fecha).split('-').reverse().join('-');
    let should_response = true;
    let extra_reason = '';
    const ausenciaTipo = marca.ausencia_tipo ?? marca.ausenciaTipo;
    if (ausenciaTipo === 'JUS') {
      should_response = false;
      const comment = marca.accion_personal_comentarios ?? marca.ausencia_comentario;
      if (comment != null && String(comment).trim()) {
        extra_reason = ' Razon: ' + String(comment).trim();
      }
    }
    if (opts?.pendingAbsentReason) {
      should_response = false;
    }
    return {
      markingBlocked: true,
      canMarkEntrada: false,
      canMarkSalida: false,
      absent: true,
      should_response,
      message:
        'No has marcado la entrada para el turno del día ' +
        fecha_display +
        ' a las ' +
        hora_inicio_display +
        '.' +
        extra_reason,
      revertMarcaId: null,
    };
  }

  if (marca.hora_entrada_digitada == null) {
    const nextChangeTime = new Date(inicio.getTime());
    nextChangeTime.setMinutes(nextChangeTime.getMinutes() - monitoringPreviousMinutes);
    if (nowMs < nextChangeTime.getTime()) {
      canMarkEntrada = false;
      return {
        markingBlocked: false,
        canMarkEntrada: false,
        canMarkSalida: false,
        message:
          `Aún no puedes marcar entrada. Debes estar mínimo ${monitoringPreviousMinutes} minutos antes del inicio del turno.`,
      };
    }
  }

  if (
    opts?.validateLocationForEntrada &&
    marca.hora_entrada_digitada == null &&
    opts.lat != null &&
    opts.lng != null &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng)
  ) {
    const loc = validateMarcaLocation(marca, opts.lat, opts.lng);
    if (!loc.ok) {
      canMarkEntrada = false;
      return {
        markingBlocked: false,
        canMarkEntrada: false,
        canMarkSalida,
        message: loc.message,
      };
    }
  }

  return {
    markingBlocked: false,
    canMarkEntrada,
    canMarkSalida,
  };
}
