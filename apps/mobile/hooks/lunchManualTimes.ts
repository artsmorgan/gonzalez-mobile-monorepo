/**
 * Registro MANUAL del tiempo de alimentación (issue #158): la persona escribe la hora de inicio y la de fin (y sus pausas) y aquí se
 * convierten a instantes y se validan.
 *
 * Todas las horas son «hora de reloj de Costa Rica» guardada como UTC (el mismo convenio que `getHoraAccion` y que el temporizador):
 * 12:00 digitadas se guardan como 12:00Z. NO se debe usar `fromZonedTime`/`toZonedTime` aquí: sumaba 6 horas a lo digitado y el fin
 * quedaba, por ejemplo, 19:00 para un almuerzo de 12:00 a 13:00.
 *
 * Una hora del día se ubica en el PRIMER instante igual o posterior al ancla: el inicio se ancla al inicio del turno (así un almuerzo de
 * madrugada en un turno nocturno cae al día siguiente), el fin al inicio del almuerzo y cada pausa al inicio del almuerzo.
 */

/** Marca que envía la app corregida con un almuerzo manual: sus horas son «hora de reloj de CR» como UTC. Sin ella el servidor las trata como de la versión anterior (+6 h). */
export const FORMATO_HORA_CR_RELOJ = 'cr_reloj';

const MIN_MS = 60 * 1000;
const DAY_MIN = 24 * 60;

export type ManualPausaInput = { startHour: string; startMinute: string; endHour: string; endMinute: string; reason?: string };

/** Turno como se guarda en `current_marca`: `fecha` ISO y `hora_inicio` / `hora_fin` ISO con la hora en UTC. */
export type MarcaVentana = { fecha: unknown; hora_inicio: unknown; hora_fin: unknown };

export type ManualLunchInput = {
  marca: MarcaVentana;
  inicio: { hour: string; minute: string };
  fin: { hour: string; minute: string };
  pausas: ManualPausaInput[];
  /** Minutos de alimentación disponibles (sin contar las pausas). */
  minutosDisponibles: number;
};

export type ManualLunchPausa = { startMs: number; endMs: number; reason: string };

export type ManualLunchResult =
  | { ok: true; inicioMs: number; finMs: number; pausas: ManualLunchPausa[]; minutosAlmuerzo: number }
  | { ok: false; errors: string[] };

const mod = (n: number, m: number) => ((n % m) + m) % m;

function minutosDelDia(hour: string, minute: string): number | null {
  const h = Number(hour);
  const m = Number(minute);
  if (hour === '' || minute === '' || !Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function relojDeMs(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Primer instante igual o posterior a `anclaMs` cuya hora de reloj es `minDelDia`. */
function ubicarDesde(anclaMs: number, minDelDia: number): number {
  return anclaMs + mod(minDelDia - relojDeMs(anclaMs), DAY_MIN) * MIN_MS;
}

/** Inicio y fin del turno como instantes (hora de reloj de CR como UTC); el fin suma un día si el turno cruza la medianoche. */
export function ventanaDeMarca(marca: MarcaVentana): { inicioMs: number; finMs: number } | null {
  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(marca.fecha ?? ''));
  const ini = new Date(String(marca.hora_inicio ?? ''));
  const fin = new Date(String(marca.hora_fin ?? ''));
  if (!dia || Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return null;
  const base = Date.UTC(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3]));
  const iniMin = ini.getUTCHours() * 60 + ini.getUTCMinutes();
  const finMin = fin.getUTCHours() * 60 + fin.getUTCMinutes();
  const duracion = mod(finMin - iniMin, DAY_MIN) || DAY_MIN;
  const inicioMs = base + iniMin * MIN_MS;
  return { inicioMs, finMs: inicioMs + duracion * MIN_MS };
}

/** `AAAA-MM-DD HH:mm` de un instante «naive» (hora de reloj de CR como UTC), para mostrar en pantalla. */
export function formatNaive(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function resolveManualLunch(input: ManualLunchInput): ManualLunchResult {
  const errors: string[] = [];
  const ventana = ventanaDeMarca(input.marca);
  if (!ventana) return { ok: false, errors: ['No se pudo leer el horario de la marca actual.'] };

  const iniMin = minutosDelDia(input.inicio.hour, input.inicio.minute);
  const finMin = minutosDelDia(input.fin.hour, input.fin.minute);
  if (iniMin == null) errors.push('Ingresa la hora de inicio del tiempo de alimentación.');
  if (finMin == null) errors.push('Ingresa la hora de fin del tiempo de alimentación.');
  if (iniMin == null || finMin == null) return { ok: false, errors };

  const inicioMs = ubicarDesde(ventana.inicioMs, iniMin);
  if (inicioMs >= ventana.finMs) errors.push('La hora de inicio del tiempo de alimentación debe estar dentro del turno.');

  if (finMin === iniMin) errors.push('La hora de fin debe ser posterior a la hora de inicio.');
  const finMs = ubicarDesde(inicioMs, finMin) === inicioMs ? inicioMs + DAY_MIN * MIN_MS : ubicarDesde(inicioMs, finMin);
  if (finMs > ventana.finMs) errors.push('La hora de fin del tiempo de alimentación no puede ser posterior a la hora de fin de la marca actual.');

  const pausas: ManualLunchPausa[] = [];
  input.pausas.forEach((p, i) => {
    const s = minutosDelDia(p.startHour, p.startMinute);
    const e = minutosDelDia(p.endHour, p.endMinute);
    if (s == null || e == null) {
      errors.push(`La pausa #${i + 1} tiene campos vacíos`);
      return;
    }
    const startMs = ubicarDesde(inicioMs, s);
    if (e === s) {
      errors.push(`La pausa #${i + 1} no puede tener una hora de inicio igual a la hora de fin`);
      return;
    }
    const endMs = ubicarDesde(startMs, e);
    if (startMs < inicioMs || endMs > finMs) errors.push(`La pausa #${i + 1} debe estar dentro del tiempo de alimentación (entre el inicio y el fin)`);
    pausas.push({ startMs, endMs, reason: (p.reason ?? '').trim() || 'Sin razón determinada' });
  });

  const ordenadas = [...pausas].sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < ordenadas.length - 1; i++) {
    if (ordenadas[i]!.endMs > ordenadas[i + 1]!.startMs) errors.push('Hay pausas con horarios que se solapan');
  }

  const minutosPausas = pausas.reduce((t, p) => t + (p.endMs - p.startMs) / MIN_MS, 0);
  const minutosAlmuerzo = (finMs - inicioMs) / MIN_MS - minutosPausas;
  if (errors.length === 0) {
    if (!(minutosAlmuerzo > 0)) errors.push('El tiempo efectivo de alimentación debe ser mayor a cero (las pausas no pueden cubrir todo el tiempo).');
    else if (minutosAlmuerzo > input.minutosDisponibles + 1e-9) {
      errors.push(`El tiempo efectivo de alimentación (${minutosAlmuerzo.toFixed(1)} minutos) excede los ${input.minutosDisponibles} minutos disponibles`);
    }
  }

  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, inicioMs, finMs, pausas, minutosAlmuerzo };
}
