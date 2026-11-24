import { normalizeTiposTurno, tipoTurnoRespaldo, type TipoTurnoActividad } from "../actividadTipoTurno";
import { jerarquiaComun } from "../syncActividadHierarchy";
import { fail, type ActionEnv, type ActionHttp } from "./env";
import { INVENTARIO_MAX_FILAS, MOTIVO_NO_PROCESADA, parseFechaEntregaParts, resumenDe, type ResultadoFila, type ResumenCarga } from "./inventario";

/**
 * Carga masiva de ACTIVIDADES DE PUESTO para Guardify (issue #213): `POST /api/guardify/actions/imports/actividades-puesto`, con el mismo contrato que
 * `inventario-puesto` (`modo: "validar" | "aplicar"`, `Idempotency-Key` en «aplicar», resultado por fila).
 *
 * Crea lo mismo que `POST /api/activities` (una actividad en `e_actividades`, sus puestos en `e_actividades_puesto`, sus tipos de turno en
 * `c_actividades_tipo_turno`, la jerarquía propia de la actividad, el aviso a las plazas y el rastro en `c_cambios_apps_modules`), pero SIN depender de la
 * marca del día: quien firma la acción es la persona que Guardify identifica (actor). La firma del responsable es la firma digital del actor
 * (`firmaDigitalDeActor`), que el servidor genera; el cliente no la manda.
 *
 * Una actividad que aplica a varios puestos ocupa UNA FILA POR PUESTO con los mismos datos. Repetir una carga no duplica: una fila se OMITE si ya hay una
 * actividad con ese nombre en ese puesto. Si hay errores en alguna fila no se escribe nada (como en el inventario): cada fila dice qué pasó.
 *
 * Columnas de la fila (propuesta inicial; la plantilla definitiva la fija González):
 *   codigo_puesto, nombre_actividad, descripcion_actividad, fecha_inicio, fecha_fin?, frecuencia, horarios?, tipos_turno, es_revision_equipo?
 * `reglas` (que la app manda al crear) no se guarda en ningún lado, así que no es una columna.
 */
export const ACTIVIDADES_MAX_FILAS = INVENTARIO_MAX_FILAS;

export type FilaActividadRaw = Record<string, unknown>;

export type FrecuenciaTipo = "diaria" | "semanal" | "laborables" | "mensual" | "anual";
export const FRECUENCIAS: readonly FrecuenciaTipo[] = ["diaria", "semanal", "laborables", "mensual", "anual"];

export type FilaActividad = {
    codigo_puesto: string;
    nombre_actividad: string;
    descripcion_actividad: string;
    /** `YYYY-MM-DD` */
    fecha_inicio: string;
    /** `YYYY-MM-DD` o null. */
    fecha_fin: string | null;
    frecuencia: FrecuenciaTipo;
    horarios: string[];
    tipos_turno: TipoTurnoActividad[];
    es_revision_equipo: boolean;
};

const MAX_NOMBRE = 255;
const MAX_DESCRIPCION = 5000;
const MAX_CODIGO = 40;

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s: string) => sinTildes(String(s ?? "")).trim().toLowerCase().replace(/\s+/g, " ");
const limpio = (v: unknown) => String(v ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

/** `DD-MM-AAAA`, `DD/MM/AAAA` o `AAAA-MM-DD` (con o sin hora) → `AAAA-MM-DD`, solo si el día existe en el calendario. */
export function fechaAYmd(value: unknown): string | null {
    const s = limpio(value);
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
    if (iso) {
        const y = Number(iso[1]);
        const m = Number(iso[2]);
        const d = Number(iso[3]);
        const real = new Date(Date.UTC(y, m - 1, d));
        if (m < 1 || m > 12 || real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return null;
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    const p = parseFechaEntregaParts(s);
    return p ? `${p.yyyy}-${p.mm}-${p.dd}` : null;
}

const TURNOS_POR_NOMBRE: Record<string, TipoTurnoActividad> = { d: "D", diurno: "D", m: "M", mixto: "M", n: "N", nocturno: "N" };

/** «D,M», «Diurno; Nocturno», «Mixto» → `["D","M"]`; null si alguno no se reconoce o no hay ninguno. */
export function parseTiposTurno(value: unknown): TipoTurnoActividad[] | null {
    const items = (Array.isArray(value) ? value : String(value ?? "").split(/[,;/|]/)).map((t) => clave(String(t))).filter(Boolean);
    if (items.length === 0) return null;
    const out: string[] = [];
    for (const it of items) {
        const t = TURNOS_POR_NOMBRE[it];
        if (!t) return null;
        out.push(t);
    }
    const tipos = normalizeTiposTurno(out);
    return tipos.length > 0 ? tipos : null;
}

const SI = new Set(["si", "s", "true", "1", "x", "yes", "y", "verdadero"]);
const NO = new Set(["no", "n", "false", "0", "falso", ""]);
export function parseBooleano(value: unknown): boolean | null {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
    const k = clave(String(value ?? ""));
    if (SI.has(k)) return true;
    if (NO.has(k)) return false;
    return null;
}

const FRECUENCIAS_ALIAS: Record<string, FrecuenciaTipo> = {
    diaria: "diaria", diario: "diaria", "cada dia": "diaria", daily: "diaria",
    semanal: "semanal", "cada semana": "semanal", weekly: "semanal",
    laborables: "laborables", "dias laborables": "laborables", "lunes a viernes": "laborables", weekdays: "laborables",
    mensual: "mensual", "cada mes": "mensual", monthly: "mensual",
    anual: "anual", "cada ano": "anual", yearly: "anual",
};
export function parseFrecuencia(value: unknown): FrecuenciaTipo | null {
    return FRECUENCIAS_ALIAS[clave(String(value ?? "")).replace(/ñ/g, "n")] ?? null;
}

/** «08:00, 14:30» → `["08:00","14:30"]` ordenados y sin repetir; null si alguno no es una hora válida HH:mm. Vacío → `[]`. */
export function parseHorarios(value: unknown): string[] | null {
    const items = (Array.isArray(value) ? value : String(value ?? "").split(/[,;|]/)).map((h) => limpio(h)).filter(Boolean);
    const out = new Set<string>();
    for (const it of items) {
        const m = /^(\d{1,2}):(\d{2})$/.exec(it);
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
        out.add(`${m[1]!.padStart(2, "0")}:${m[2]}`);
    }
    return [...out].sort();
}

export type ParseFila = { ok: true; fila: FilaActividad } | { ok: false; motivo: string };

/** Valida UNA fila y la lleva a su forma normal. No consulta la base. */
export function parseFilaActividad(raw: unknown): ParseFila {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, motivo: "la fila no es un objeto." };
    const r = raw as FilaActividadRaw;
    const codigo = limpio(r.codigo_puesto);
    if (!codigo) return { ok: false, motivo: "código de puesto obligatorio." };
    if (codigo.length > MAX_CODIGO) return { ok: false, motivo: "el código de puesto es demasiado largo." };
    const nombre = limpio(r.nombre_actividad);
    if (!nombre) return { ok: false, motivo: "nombre de la actividad obligatorio." };
    if (nombre.length > MAX_NOMBRE) return { ok: false, motivo: `el nombre de la actividad es demasiado largo (máximo ${MAX_NOMBRE}).` };
    const descripcion = String(r.descripcion_actividad ?? "").trim();
    if (!descripcion) return { ok: false, motivo: "descripción de la actividad obligatoria." };
    if (descripcion.length > MAX_DESCRIPCION) return { ok: false, motivo: `la descripción es demasiado larga (máximo ${MAX_DESCRIPCION}).` };
    const inicio = fechaAYmd(r.fecha_inicio);
    if (!inicio) return { ok: false, motivo: "fecha de inicio obligatoria, con formato DD-MM-AAAA y un día que exista." };
    let fin: string | null = null;
    if (limpio(r.fecha_fin) !== "") {
        fin = fechaAYmd(r.fecha_fin);
        if (!fin) return { ok: false, motivo: "la fecha de fin debe tener formato DD-MM-AAAA y un día que exista." };
        if (fin < inicio) return { ok: false, motivo: "la fecha de fin es anterior a la fecha de inicio." };
    }
    const frecuencia = parseFrecuencia(r.frecuencia);
    if (!frecuencia) return { ok: false, motivo: `frecuencia inválida; use ${FRECUENCIAS.join(", ")}.` };
    const horarios = parseHorarios(r.horarios);
    if (horarios === null) return { ok: false, motivo: "los horarios deben ser horas HH:mm separadas por coma." };
    const tipos = parseTiposTurno(r.tipos_turno);
    if (!tipos) return { ok: false, motivo: "tipos de turno inválidos; use D, M y/o N (o Diurno, Mixto, Nocturno) separados por coma." };
    const revision = parseBooleano(r.es_revision_equipo);
    if (revision === null) return { ok: false, motivo: "«es_revision_equipo» debe ser sí o no." };
    return {
        ok: true,
        fila: { codigo_puesto: codigo, nombre_actividad: nombre, descripcion_actividad: descripcion, fecha_inicio: inicio, fecha_fin: fin, frecuencia, horarios, tipos_turno: tipos, es_revision_equipo: revision },
    };
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ORDINALES = ["primer", "segundo", "tercer", "cuarto", "último"];

/**
 * El JSON que guarda `e_actividades.frecuencia`, con la misma forma y los mismos títulos que arma la app (`ActivitiesScreen`) y que lee
 * `createActivities.ts`. Siempre cada 1 (día, semana, mes o año); el día de la semana, del mes o del año sale de la fecha de inicio.
 */
export function construirFrecuencia(f: Pick<FilaActividad, "frecuencia" | "fecha_inicio" | "fecha_fin" | "horarios">): string {
    const [y, m, d] = f.fecha_inicio.split("-").map(Number) as [number, number, number];
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const config: Record<string, unknown> = { type: "daily", interval: 1 };
    let title = "";
    switch (f.frecuencia) {
        case "diaria":
            title = "Cada día";
            break;
        case "laborables":
            config.type = "weekdays";
            title = "Todos los días laborables (lunes a viernes)";
            break;
        case "semanal":
            config.type = "weekly";
            config.weekday = weekday;
            title = `Cada semana el ${DIAS[weekday]}`;
            break;
        case "mensual": {
            // Ordinal real del día de la semana en el mes (el 5.º o más = «último»).
            const ordinal = Math.floor((d - 1) / 7) + 1;
            config.weekday = weekday;
            if (ordinal >= 5) {
                config.type = "monthly-last";
                config.weekOrdinal = 5;
                title = `Cada mes el último ${DIAS[weekday]}`;
            } else {
                config.type = "monthly-weekday";
                config.weekOrdinal = ordinal;
                title = `Cada mes el ${ORDINALES[ordinal - 1]} ${DIAS[weekday]}`;
            }
            break;
        }
        case "anual":
            config.type = "yearly";
            config.day = d;
            config.month = m;
            title = `Anualmente el ${d} de ${MESES[m - 1]}`;
            break;
    }
    if (f.fecha_fin) {
        config.endType = "date";
        config.endDate = f.fecha_fin;
    } else {
        config.endType = "never";
    }
    config.title = title;
    if (f.horarios.length > 0) config.schedule = f.horarios;
    return JSON.stringify(config);
}

/** Lo que identifica una actividad dentro del archivo: el nombre sin tildes, mayúsculas ni espacios de más. */
export const nombreClave = (nombre: string) => clave(nombre);

/** Todo lo que debe coincidir entre las filas de una misma actividad (todo menos el puesto). */
const huellaDatos = (f: FilaActividad) => JSON.stringify([f.descripcion_actividad, f.fecha_inicio, f.fecha_fin, f.frecuencia, f.horarios, f.tipos_turno, f.es_revision_equipo]);

export type ActividadPlan = { nombre: string; datos: FilaActividad; puestoIds: number[]; filas: number[] };

export type PlanActividades =
    | { kind: "invalid"; message: string; errors: string[]; filas: ResultadoFila[] }
    | { kind: "ok"; actividades: ActividadPlan[]; filas: ResultadoFila[] };

/**
 * Valida y planifica la carga: qué actividades se crearían (cada una con sus puestos) y qué filas se omiten, fila por fila. No escribe nada.
 * Una fila con error (formato, puesto inexistente, o datos distintos a otra fila de la misma actividad) rechaza toda la carga.
 */
export async function planificarCargaActividades(prisma: any, filasRaw: unknown): Promise<PlanActividades> {
    if (!Array.isArray(filasRaw) || filasRaw.length === 0) return { kind: "invalid", message: "Debe indicar al menos una fila.", errors: [], filas: [] };
    const total = filasRaw.length;
    const motivos = new Map<number, string>();
    const errores: string[] = [];
    const marcar = (fila: number, motivo: string) => {
        errores.push(`Fila ${fila}: ${motivo}`);
        if (!motivos.has(fila)) motivos.set(fila, motivo);
    };

    const parsed: { fila: number; f: FilaActividad }[] = [];
    for (let i = 0; i < total; i++) {
        const r = parseFilaActividad(filasRaw[i]);
        if (!r.ok) marcar(i + 1, r.motivo);
        else parsed.push({ fila: i + 1, f: r.fila });
    }

    // Puestos por código.
    const codigos = [...new Set(parsed.map((p) => p.f.codigo_puesto))];
    const puestoPorCodigo = new Map<string, number>();
    if (codigos.length > 0) {
        const puestos: any[] = await prisma.e_estructura_puesto.findMany({ where: { codigo: { in: codigos } }, select: { id: true, codigo: true } });
        for (const p of puestos) {
            const c = String(p.codigo ?? "").trim();
            if (c) puestoPorCodigo.set(c, Number(p.id));
        }
    }
    for (const { fila, f } of parsed) if (!puestoPorCodigo.has(f.codigo_puesto)) marcar(fila, `El código de puesto «${f.codigo_puesto}» no existe.`);

    // Las filas de una misma actividad (mismo nombre) deben traer los mismos datos.
    const primera = new Map<string, { fila: number; huella: string }>();
    for (const { fila, f } of parsed) {
        if (motivos.has(fila)) continue;
        const k = nombreClave(f.nombre_actividad);
        const h = huellaDatos(f);
        const antes = primera.get(k);
        if (!antes) primera.set(k, { fila, huella: h });
        else if (antes.huella !== h) marcar(fila, `La actividad «${f.nombre_actividad}» tiene datos distintos a los de la fila ${antes.fila}: las filas de una misma actividad (una por puesto) deben coincidir en todo menos el puesto.`);
    }

    if (motivos.size > 0) {
        const filas: ResultadoFila[] = Array.from({ length: total }, (_, i) => (motivos.has(i + 1) ? { fila: i + 1, estado: "error" as const, motivo: motivos.get(i + 1)! } : { fila: i + 1, estado: "omitida" as const, motivo: MOTIVO_NO_PROCESADA }));
        return { kind: "invalid", message: "La carga tiene filas con errores: no se creó nada.", errors: errores, filas };
    }

    // Lo que ya existe: una actividad con ese nombre en ese puesto.
    const puestoIds = [...new Set(puestoPorCodigo.values())];
    const existentes = new Set<string>();
    if (puestoIds.length > 0) {
        const links: any[] = await prisma.e_actividades_puesto.findMany({ where: { puesto_id: { in: puestoIds } }, select: { puesto_id: true, e_actividades: { select: { nombre_actividad: true } } } });
        for (const l of links) existentes.add(`${Number(l.puesto_id)}|${nombreClave(String(l.e_actividades?.nombre_actividad ?? ""))}`);
    }

    const filas: ResultadoFila[] = Array.from({ length: total }, (_, i) => ({ fila: i + 1, estado: "omitida" as const, motivo: null }));
    const porNombre = new Map<string, ActividadPlan>();
    const vistos = new Set<string>();
    for (const { fila, f } of parsed) {
        const puestoId = puestoPorCodigo.get(f.codigo_puesto)!;
        const k = nombreClave(f.nombre_actividad);
        const par = `${puestoId}|${k}`;
        if (existentes.has(par)) {
            filas[fila - 1] = { fila, estado: "omitida", motivo: `Ya existe una actividad «${f.nombre_actividad}» en el puesto ${f.codigo_puesto}.` };
            continue;
        }
        if (vistos.has(par)) {
            filas[fila - 1] = { fila, estado: "omitida", motivo: `Repetida en el archivo: ya se incluyó «${f.nombre_actividad}» para el puesto ${f.codigo_puesto}.` };
            continue;
        }
        vistos.add(par);
        let plan = porNombre.get(k);
        if (!plan) {
            plan = { nombre: f.nombre_actividad, datos: f, puestoIds: [], filas: [] };
            porNombre.set(k, plan);
        }
        plan.puestoIds.push(puestoId);
        plan.filas.push(fila);
        filas[fila - 1] = { fila, estado: "creada", motivo: null };
    }
    return { kind: "ok", actividades: [...porNombre.values()], filas };
}

type ActividadCreada = { actividadId: number; puestoIds: number[]; filas: number[] };

export type ResultadoCargaActividades = {
    modo: "validar" | "aplicar";
    creadas: { actividades: number; puestos: number };
    filas: ResultadoFila[];
    resumen: ResumenCarga;
    actividadIds: number[];
    puestoIds: number[];
    mensaje: string;
};

const ahoraIso = (env: ActionEnv) => env.nowIso(null);

/** Cadena puesto → sucursal → contrato de varios puestos (3 consultas), con el Prisma del entorno. */
async function cadenasDePuestosEnv(prisma: any, puestoIds: number[]) {
    const out = new Map<number, Record<"empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "corpo_id", number | null>>();
    const puestos: any[] = await prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, sucursal_id: true } });
    const sucursalIds = [...new Set(puestos.map((p) => p.sucursal_id).filter((n: unknown): n is number => !!n))];
    const sucursales: any[] = sucursalIds.length ? await prisma.e_estructura_sucursal.findMany({ where: { id: { in: sucursalIds } }, select: { id: true, contrato_id: true } }) : [];
    const contratoIds = [...new Set(sucursales.map((s) => s.contrato_id).filter((n: unknown): n is number => !!n))];
    const contratos: any[] = contratoIds.length ? await prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, cliente_id: true, empresa_id: true, division_id: true } }) : [];
    const sucursalById = new Map(sucursales.map((s) => [s.id, s]));
    const contratoById = new Map(contratos.map((c) => [c.id, c]));
    for (const p of puestos) {
        const s = p.sucursal_id ? sucursalById.get(p.sucursal_id) : undefined;
        const c = s?.contrato_id ? contratoById.get(s.contrato_id) : undefined;
        out.set(p.id, { empresa_id: c?.empresa_id ?? null, cliente_id: c?.cliente_id ?? null, division_id: c?.division_id ?? null, contrato_id: c?.id ?? null, corpo_id: s?.id ?? null });
    }
    return out;
}

/** Plazas activas de los puestos (la misma regla que `fetchActivePlazaIdsForPuestos`). */
async function plazasActivas(env: ActionEnv, puestoIds: number[]): Promise<number[]> {
    if (puestoIds.length === 0) return [];
    const ahora = new Date(ahoraIso(env));
    const rows: any[] = await env.prisma.e_estructura_plazas.findMany({
        where: { puesto_id: { in: puestoIds }, deleted: null, OR: [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: ahora } }] },
        select: { id: true },
    });
    return [...new Set(rows.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0))];
}

/** Crea UNA actividad con todo lo que crea la app. Si algo esencial falla, deshace lo creado (la actividad y lo que cuelga de ella) y lanza. */
async function crearActividad(env: ActionEnv, p: ActividadPlan, actorId: number, firmaDigital: string): Promise<ActividadCreada> {
    const d = p.datos;
    const frecuencia = construirFrecuencia(d);
    const nowIso = ahoraIso(env);
    const actividad = await env.call({
        action: "POST",
        table: "e_actividades",
        data: {
            created_at: nowIso,
            created_by: actorId,
            nombre_actividad: p.nombre,
            fecha_inicio: new Date(d.fecha_inicio).toISOString(),
            fecha_fin: new Date(d.fecha_fin ?? d.fecha_inicio).toISOString(),
            frecuencia,
            es_revision_equipo: d.es_revision_equipo,
            descripcion_actividad: d.descripcion_actividad,
            firma_responsable: firmaDigital,
            tipo_turno: tipoTurnoRespaldo(d.tipos_turno),
        },
    });
    const id = Number(actividad?.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("No se obtuvo el id de la actividad creada.");
    try {
        await env.call({ action: "POST", table: "c_actividades_tipo_turno", operation: "createMany", many: true, data: d.tipos_turno.map((tipo_turno) => ({ actividad_id: id, tipo_turno })) });
        await env.call({ action: "POST", table: "e_actividades_puesto", operation: "createMany", many: true, data: p.puestoIds.map((puesto_id) => ({ actividad_id: id, puesto_id })) });
    } catch (e) {
        // Sin sus puestos y turnos la actividad no sirve: se quita (las filas que cuelgan de ella se borran en cascada o por `deleteMany`).
        await env.call({ action: "DELETE", table: "c_actividades_tipo_turno", operation: "deleteMany", where: { actividad_id: id } }).catch(() => undefined);
        await env.call({ action: "DELETE", table: "e_actividades", operation: "deleteMany", where: { id } }).catch(() => undefined);
        throw e;
    }
    // Lo siguiente es complementario: si falla no se deshace la actividad, ya creada y usable (se informa en el registro de errores).
    try {
        const cadenas = await cadenasDePuestosEnv(env.prisma, p.puestoIds);
        const jerarquia = jerarquiaComun(p.puestoIds, cadenas as any);
        await env.call({ action: "UPDATE", table: "e_actividades", operation: "update", where: { id }, data: { ...jerarquia } });
    } catch (e) {
        await env.report(500, `Carga de actividades de Guardify: no se pudo guardar la jerarquía de la actividad ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
        const plazas = await plazasActivas(env, p.puestoIds);
        if (plazas.length > 0 && env.notifyPlazas) {
            let titulo = "";
            try { titulo = String((JSON.parse(frecuencia) as { title?: string }).title ?? ""); } catch { titulo = ""; }
            await env.notifyPlazas("Actividad asignada", `Se te ha asignado la actividad ${p.nombre}, la cual deberá realizarse "${titulo}"`, plazas);
        }
    } catch (e) {
        await env.report(500, `Carga de actividades de Guardify: no se pudo avisar a las plazas de la actividad ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
        await env.call({
            action: "POST",
            table: "c_cambios_apps_modules",
            operation: "create",
            data: {
                nombre_tabla: "e_actividades",
                registro_id: id,
                cambios: JSON.stringify([
                    {
                        prop: "__created__",
                        before: null,
                        after: {
                            id,
                            nombre_actividad: p.nombre,
                            descripcion_actividad: d.descripcion_actividad,
                            fecha_inicio: d.fecha_inicio,
                            fecha_fin: d.fecha_fin ?? d.fecha_inicio,
                            frecuencia,
                            es_revision_equipo: d.es_revision_equipo,
                            firma_responsable: firmaDigital,
                            tipo_turno: tipoTurnoRespaldo(d.tipos_turno),
                            tipos_turno: d.tipos_turno,
                            puestos_ids: p.puestoIds,
                            origen: "guardify",
                        },
                    },
                ]),
                created_at: nowIso,
                created_by: actorId,
            },
        });
    } catch (e) {
        await env.report(500, `Carga de actividades de Guardify: no se pudo registrar el cambio de la actividad ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
    return { actividadId: id, puestoIds: p.puestoIds, filas: p.filas };
}

export type CargaActividadesResult = { ok: true; status: 200; body: ResultadoCargaActividades } | Extract<ActionHttp, { ok: false }>;

/**
 * `validar`: hace todas las comprobaciones y dice qué se crearía, sin escribir nada. `aplicar`: además crea las actividades, una por una; si una falla por un
 * error de base de datos, esa actividad se deshace, sus filas quedan como `error` (con motivo) y las demás siguen. Repetir una carga no duplica.
 */
export async function cargarActividadesPuesto(env: ActionEnv, input: { filas: unknown; modo: "validar" | "aplicar"; actorId: number; firmaDigital: string }): Promise<CargaActividadesResult> {
    const plan = await planificarCargaActividades(env.prisma, input.filas);
    if (plan.kind === "invalid") {
        await env.report(400, plan.message);
        return fail(400, "invalid_request", plan.message, plan.errors, { filas: plan.filas, resumen: resumenDe(plan.filas) });
    }
    const filas = plan.filas.slice();
    const nPuestos = new Set(plan.actividades.flatMap((a) => a.puestoIds)).size;
    if (input.modo === "validar") {
        const resumen = resumenDe(filas);
        return {
            ok: true,
            status: 200,
            body: {
                modo: "validar",
                creadas: { actividades: plan.actividades.length, puestos: nPuestos },
                filas,
                resumen,
                actividadIds: [],
                puestoIds: [],
                mensaje: `Se crearían ${plan.actividades.length} actividad(es) en ${nPuestos} puesto(s); ${resumen.omitidas} fila(s) se omitirían (ya existen o están repetidas).`,
            },
        };
    }
    const creadas: ActividadCreada[] = [];
    for (const a of plan.actividades) {
        try {
            creadas.push(await crearActividad(env, a, input.actorId, input.firmaDigital));
        } catch (e) {
            const motivo = `No se pudo crear la actividad: ${e instanceof Error ? e.message : String(e)}`;
            for (const f of a.filas) filas[f - 1] = { fila: f, estado: "error", motivo };
            await env.report(500, `Carga de actividades de Guardify: ${a.nombre}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    const resumen = resumenDe(filas);
    const puestosCreados = new Set(creadas.flatMap((c) => c.puestoIds));
    return {
        ok: true,
        status: 200,
        body: {
            modo: "aplicar",
            creadas: { actividades: creadas.length, puestos: puestosCreados.size },
            filas,
            resumen,
            actividadIds: creadas.map((c) => c.actividadId),
            puestoIds: [...puestosCreados],
            mensaje:
                creadas.length === 0 && resumen.errores === 0
                    ? `Se crearon 0 actividad(es): todo ya existía (${resumen.omitidas} fila(s) omitida(s), con su motivo en el detalle por fila).`
                    : `Se crearon ${creadas.length} actividad(es) en ${puestosCreados.size} puesto(s); ${resumen.omitidas} fila(s) omitida(s)${resumen.errores > 0 ? ` y ${resumen.errores} con error (revise el detalle por fila)` : ""}.`,
        },
    };
}
