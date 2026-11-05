/**
 * Siguiente turno laboral y formato de la información de la marca. Módulo PURO (sin React Native) para probarlo en Node.
 *
 * El servidor responde `next_shift` junto con la marca actual (`GET /api/attendance/user/[id]`): el turno laboral (tipo distinto de «L») más cercano
 * cuya entrada, restados los minutos previos, es posterior al momento de la consulta. La app lo guarda para mostrarlo sin conexión.
 */
export type ShiftLevel = { id?: number | null; codigo?: string | number | null; nombre?: string | null } | null | undefined;

export type NextShift = {
  id: number;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo_turno: string | null;
  empresa?: ShiftLevel;
  cliente?: ShiftLevel;
  division?: ShiftLevel;
  contrato?: ShiftLevel;
  corpo?: ShiftLevel;
  puesto?: ShiftLevel;
  plaza?: ShiftLevel;
  horario?: ShiftLevel;
};

export type StoredNextShift = {
  empleadoId: number;
  savedAt: number;
  shift: NextShift;
};

/** Código del elemento; si no tiene código, su número (id). `null` si no hay ninguno de los dos. */
export function levelCode(level: ShiftLevel): string | null {
  if (!level) return null;
  const codigo = level.codigo != null ? String(level.codigo).trim() : '';
  if (codigo) return codigo;
  const id = Number(level.id);
  return Number.isFinite(id) && id > 0 ? String(id) : null;
}

/** «CÓDIGO · Nombre» (o solo el nombre si no hay código). */
export function levelLabel(level: ShiftLevel): string {
  const nombre = String(level?.nombre ?? '').trim();
  const code = levelCode(level);
  if (code && nombre) return `${code} · ${nombre}`;
  return nombre || code || '—';
}

/** Solo el nombre del elemento (cliente, rol y horario no muestran código ni número). */
export function levelName(level: ShiftLevel): string {
  return String(level?.nombre ?? '').trim() || '—';
}

/**
 * «código · nombre» usando SOLO el código propio del elemento, sin recurrir al id: la división (código de `n_division`), el contrato
 * (`nro_contrato`) y el corpo (`nro_sucursal`). Sin código muestra solo el nombre.
 */
export function levelLabelCodeOnly(level: ShiftLevel): string {
  const nombre = String(level?.nombre ?? '').trim();
  const codigo = level?.codigo != null ? String(level.codigo).trim() : '';
  if (codigo && nombre) return `${codigo} · ${nombre}`;
  return nombre || codigo || '—';
}

type ShiftInfoSource = {
  empresa?: ShiftLevel;
  cliente?: ShiftLevel;
  division?: ShiftLevel;
  contrato?: ShiftLevel;
  corpo?: ShiftLevel;
  puesto?: ShiftLevel;
  plaza?: ShiftLevel;
  horario?: ShiftLevel;
};

/**
 * Filas de la información laboral de un turno (siguiente turno y lista de 30 días), con la misma regla que la marca principal:
 * cliente, rol y horario sin id; división con su código; contrato con `nro_contrato` y corpo con `nro_sucursal`. Omite los niveles sin nombre.
 */
export function shiftInfoRows(src: ShiftInfoSource): { label: string; value: string }[] {
  const rows: { label: string; value: string | null }[] = [
    { label: 'Empresa', value: hasName(src.empresa) ? levelLabel(src.empresa) : null },
    { label: 'Cliente', value: hasName(src.cliente) ? levelName(src.cliente) : null },
    { label: 'División', value: hasName(src.division) ? levelLabelCodeOnly(src.division) : null },
    { label: 'Contrato', value: hasName(src.contrato) ? levelLabelCodeOnly(src.contrato) : null },
    { label: 'Corpo', value: hasName(src.corpo) ? levelLabelCodeOnly(src.corpo) : null },
    { label: 'Puesto', value: hasName(src.puesto) ? levelLabel(src.puesto) : null },
    { label: 'Plaza', value: hasName(src.plaza) ? levelLabel(src.plaza) : null },
    { label: 'Horario', value: hasName(src.horario) ? levelName(src.horario) : null },
  ];
  return rows.filter((r): r is { label: string; value: string } => r.value != null);
}

function hasName(level: ShiftLevel): boolean {
  return String(level?.nombre ?? '').trim() !== '';
}

/** HH:mm de una hora que puede venir como ISO, «HH:mm:ss» o «HH:mm» (como se ven en los turnos futuros). */
export function formatHoraHHmm(hora: unknown): string {
  if (!hora) return '';
  const text = hora instanceof Date ? hora.toISOString() : String(hora);
  const m = /(\d{2}):(\d{2})(?::\d{2})?/.exec(text);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** «06:00 - 14:00» (o solo la hora de inicio si no hay fin). Vacío si no hay ninguna. */
export function formatHoraRange(inicio: unknown, fin: unknown): string {
  const a = formatHoraHHmm(inicio);
  const b = formatHoraHHmm(fin);
  if (!a) return '';
  return b ? `${a} - ${b}` : a;
}

const TIPO_TURNO: Record<string, string> = { D: 'Diurno', M: 'Mixto', N: 'Nocturno', L: 'Libre' };

export function tipoTurnoLabel(tipo: unknown): string {
  const key = String(tipo ?? '').trim().toUpperCase();
  return TIPO_TURNO[key] ?? 'Indeterminable';
}

/** Valida lo que llega del servidor o del almacenamiento: un turno laboral con fecha y sin ser día libre. */
export function parseNextShift(raw: unknown): NextShift | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const id = Number(s.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const fecha = s.fecha != null ? String(s.fecha) : '';
  if (!/^\d{4}-\d{2}-\d{2}/.test(fecha)) return null;
  const tipo = s.tipo_turno != null ? String(s.tipo_turno).trim().toUpperCase() : '';
  if (tipo === '' || tipo === 'L') return null;
  return {
    id,
    fecha,
    hora_inicio: s.hora_inicio != null ? String(s.hora_inicio) : null,
    hora_fin: s.hora_fin != null ? String(s.hora_fin) : null,
    tipo_turno: tipo,
    empresa: s.empresa as ShiftLevel,
    cliente: s.cliente as ShiftLevel,
    division: s.division as ShiftLevel,
    contrato: s.contrato as ShiftLevel,
    corpo: s.corpo as ShiftLevel,
    puesto: s.puesto as ShiftLevel,
    plaza: s.plaza as ShiftLevel,
    horario: s.horario as ShiftLevel,
  };
}

/** Instante de la entrada «ingenuo» (fecha + hora de inicio como hora de reloj de Costa Rica en UTC, el mismo convenio de `getHoraAccion`). */
export function shiftStartMs(shift: Pick<NextShift, 'fecha' | 'hora_inicio'>): number | null {
  const fecha = String(shift.fecha).slice(0, 10);
  const hora = formatHoraHHmm(shift.hora_inicio) || '00:00';
  const ms = Date.parse(`${fecha}T${hora}:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * ¿Sigue siendo «siguiente» el turno guardado? Mientras su entrada (menos los minutos previos) no haya llegado. Un turno ya vencido no se
 * muestra como siguiente: la próxima consulta con conexión trae el que corresponde.
 */
export function isShiftUpcoming(shift: NextShift, nowMs: number, previousMinutes: number): boolean {
  const start = shiftStartMs(shift);
  if (start == null || !Number.isFinite(nowMs)) return false;
  return start - Math.max(0, Number(previousMinutes) || 0) * 60_000 > nowMs;
}

/** «03-11-2026» a partir de AAAA-MM-DD…, sin pasar por zonas horarias. */
export function formatFechaDMY(fecha: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha ?? ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Fecha y hora del día en una sola línea: «03-11-2026 14:35», a partir de un instante en hora de reloj de CR (UTC). */
export function formatDateTimeLine(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const iso = new Date(ms).toISOString();
  return `${formatFechaDMY(iso)} ${iso.slice(11, 16)}`;
}
