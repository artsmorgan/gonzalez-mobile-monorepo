/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

/**
 * Tipos de turno de una actividad (tabla `c_actividades_tipo_turno`, una fila por combinación actividad + tipo): una actividad puede aplicar a
 * varios de «Diurno» (D), «Mixto» (M) y «Nocturno» (N). El valor único `e_actividades.tipo_turno` se conserva como respaldo (el primer tipo) para lo que
 * aún lo lea; la fuente de verdad es la tabla nueva. Todo acceso a la base pasa por `callDynamicPrisma`.
 */
export const TIPOS_TURNO_ACTIVIDAD = ["D", "M", "N"] as const;
export type TipoTurnoActividad = (typeof TIPOS_TURNO_ACTIVIDAD)[number];

const NOMBRES: Record<TipoTurnoActividad, string> = { D: "Diurno", M: "Mixto", N: "Nocturno" };

/** Acepta un arreglo, un texto con comas («D,M») o un solo valor; devuelve los tipos válidos, sin repetir y en el orden D, M, N. */
export function normalizeTiposTurno(raw: unknown): TipoTurnoActividad[] {
    const items: unknown[] = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : raw == null ? [] : [raw];
    const found = new Set<string>();
    for (const item of items) {
        const t = String(item ?? "").trim().toUpperCase();
        if ((TIPOS_TURNO_ACTIVIDAD as readonly string[]).includes(t)) found.add(t);
    }
    return TIPOS_TURNO_ACTIVIDAD.filter((t) => found.has(t));
}

/** Valor del respaldo `e_actividades.tipo_turno`: el primer tipo, o `null` si no hay ninguno. */
export function tipoTurnoRespaldo(tipos: readonly string[]): TipoTurnoActividad | null {
    return normalizeTiposTurno(tipos)[0] ?? null;
}

/**
 * Lo que mandó la app al crear o editar: `tipos_turno` (arreglo) y, de una app anterior, `tipo_turno` (uno solo). Con `tipos_turno` presente manda
 * ese; si no, el valor único. Sin ninguno devuelve un arreglo vacío (la actividad no se restringe por turno).
 */
export function tiposTurnoDeLaPeticion(body: { tipos_turno?: unknown; tipo_turno?: unknown }): TipoTurnoActividad[] {
    if (body.tipos_turno !== undefined && body.tipos_turno !== null) return normalizeTiposTurno(body.tipos_turno);
    return normalizeTiposTurno(body.tipo_turno);
}

/**
 * ¿La actividad aplica al turno de la marca? Con tipos definidos, solo si incluyen el del turno. Sin tipos en la tabla se usa el valor único de
 * respaldo (actividades anteriores a la tabla) y, sin ninguno, aplica a todos los turnos.
 */
export function actividadAplicaAlTurno(tipos: readonly string[], respaldo: string | null | undefined, tipoTurnoMarca: string | null | undefined): boolean {
    const lista = normalizeTiposTurno(tipos);
    const turno = String(tipoTurnoMarca ?? "").trim().toUpperCase();
    if (lista.length > 0) return (lista as readonly string[]).includes(turno);
    const legado = normalizeTiposTurno(respaldo);
    if (legado.length > 0) return (legado as readonly string[]).includes(turno);
    return true;
}

/** «Diurno, Mixto» (en el orden D, M, N). Con tipos vacíos usa el respaldo; sin ninguno, `sinDefinir` («Sin definir» si no se indica). */
export function tiposTurnoLabel(tipos: readonly string[], respaldo?: string | null, sinDefinir = "Sin definir"): string {
    const lista = normalizeTiposTurno(tipos);
    const efectivos = lista.length > 0 ? lista : normalizeTiposTurno(respaldo);
    return efectivos.length > 0 ? efectivos.map((t) => NOMBRES[t]).join(", ") : sinDefinir;
}

/** ¿La actividad tiene el tipo de turno pedido? (los tipos de la tabla y, sin ellos, el valor único de respaldo). */
export function actividadTieneTurno(tipos: readonly string[], respaldo: string | null | undefined, pedido: string): boolean {
    const lista = normalizeTiposTurno(tipos);
    const efectivos = lista.length > 0 ? lista : normalizeTiposTurno(respaldo);
    return (efectivos as readonly string[]).includes(String(pedido ?? "").trim().toUpperCase());
}

/** Igual que `loadTiposTurnoByActividad`, pero con el acceso a datos de los reportes (`db`, sin petición). Tolerante: si la tabla no existe responde vacío. */
export async function loadTiposTurnoFromDb(db: any, actividadIds: unknown[]): Promise<Map<number, TipoTurnoActividad[]>> {
    const result = new Map<number, TipoTurnoActividad[]>();
    const ids = Array.from(new Set(actividadIds.map(Number).filter((v) => Number.isFinite(v) && v > 0)));
    if (ids.length === 0 || !db?.c_actividades_tipo_turno?.findMany) return result;
    try {
        const porActividad = new Map<number, string[]>();
        for (let i = 0; i < ids.length; i += 1000) {
            const rows = await db.c_actividades_tipo_turno.findMany({ where: { actividad_id: { in: ids.slice(i, i + 1000) } }, select: { actividad_id: true, tipo_turno: true } });
            for (const row of Array.isArray(rows) ? rows : []) {
                const id = Number(row?.actividad_id);
                if (Number.isFinite(id)) porActividad.set(id, [...(porActividad.get(id) ?? []), String(row?.tipo_turno ?? "")]);
            }
        }
        for (const [id, list] of porActividad) result.set(id, normalizeTiposTurno(list));
    } catch (error) {
        console.warn("[actividades] no se pudieron leer los tipos de turno para el reporte:", error instanceof Error ? error.message : error);
    }
    return result;
}

/** Tipos de turno de varias actividades de una vez (`actividad_id` → tipos). Si la tabla no existe aún, responde vacío y la actividad usa el respaldo. */
export async function loadTiposTurnoByActividad(req: NextRequest, actividadIds: number[]): Promise<Map<number, TipoTurnoActividad[]>> {
    const result = new Map<number, TipoTurnoActividad[]>();
    const ids = Array.from(new Set(actividadIds.map(Number).filter((v) => Number.isFinite(v) && v > 0)));
    if (ids.length === 0) return result;
    try {
        const rows = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_actividades_tipo_turno", operation: "findMany", where: { actividad_id: { in: ids } }, select: { actividad_id: true, tipo_turno: true } },
        });
        const porActividad = new Map<number, string[]>();
        for (const row of Array.isArray(rows) ? rows : []) {
            const id = Number((row as any)?.actividad_id);
            if (!Number.isFinite(id)) continue;
            porActividad.set(id, [...(porActividad.get(id) ?? []), String((row as any)?.tipo_turno ?? "")]);
        }
        for (const [id, list] of porActividad) result.set(id, normalizeTiposTurno(list));
    } catch (error) {
        console.warn("[actividades] no se pudieron leer los tipos de turno (c_actividades_tipo_turno):", error instanceof Error ? error.message : error);
    }
    return result;
}

/** Reemplaza los tipos de turno de una actividad: borra los anteriores y crea los nuevos. Con la lista vacía la actividad queda sin tipos. */
export async function replaceTiposTurno(req: NextRequest, actividadId: number, tipos: readonly string[]): Promise<void> {
    const lista = normalizeTiposTurno(tipos);
    await callDynamicPrisma({
        req,
        data: { action: "DELETE", table: "c_actividades_tipo_turno", operation: "deleteMany", where: { actividad_id: actividadId } },
    });
    if (lista.length === 0) return;
    await callDynamicPrisma({
        req,
        data: {
            action: "POST",
            table: "c_actividades_tipo_turno",
            operation: "createMany",
            many: true,
            data: lista.map((tipo_turno) => ({ actividad_id: actividadId, tipo_turno })),
        },
    });
}

/** Agrega `tipos_turno` a cada actividad (la tabla y, si no hay filas, el respaldo). */
export function conTiposTurno<T extends { id?: unknown; tipo_turno?: unknown }>(actividades: T[], porActividad: Map<number, TipoTurnoActividad[]>): (T & { tipos_turno: TipoTurnoActividad[] })[] {
    return actividades.map((a) => {
        const guardados = porActividad.get(Number(a.id)) ?? [];
        return { ...a, tipos_turno: guardados.length > 0 ? guardados : normalizeTiposTurno(a.tipo_turno) };
    });
}
