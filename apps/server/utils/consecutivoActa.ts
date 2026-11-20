/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Consecutivo de las actas de entrega de productos (issue #138): por EMPRESA, desde 1, se muestra con ceros a la izquierda (`0001`).
 *
 * El número se guarda como entero en `c_acta_entre_producto.consecutivo` y el índice único `(empresa_id, consecutivo)` impide repetirlo.
 * Como la lectura del último número y el alta son dos llamadas al servicio dinámico, dos actas simultáneas de la misma empresa pueden
 * calcular el mismo número: la segunda choca con el índice y se reintenta con el número siguiente (`crearConConsecutivo`).
 */
import type { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export const ANCHO_CONSECUTIVO_ACTA = 4;
const MAX_INTENTOS = 6;

/** `1` → `0001`; con más dígitos que el ancho (10000) no se recorta. Vacío o inválido → null. */
export function formatConsecutivoActa(n: unknown): string | null {
    if (n == null || String(n).trim() === "") return null;
    const v = Number(n);
    if (!Number.isInteger(v) || v < 1) return null;
    return String(v).padStart(ANCHO_CONSECUTIVO_ACTA, "0");
}

/** ¿El error es el de «valor duplicado» de un índice único (Prisma P2002 / MySQL 1062)? */
export function esErrorDeDuplicado(e: unknown): boolean {
    const msg = String((e as any)?.message ?? e ?? "");
    return /P2002|unique constraint|duplicate entry|ER_DUP_ENTRY|1062/i.test(msg);
}

/** Siguiente número para la empresa: el mayor ya usado + 1 (1 si todavía no hay actas numeradas). */
export async function siguienteConsecutivoActa(req: NextRequest, empresaId: number): Promise<number> {
    const last: any = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "c_acta_entre_producto",
            operation: "findFirst",
            where: { empresa_id: Number(empresaId), consecutivo: { not: null } },
            orderBy: { consecutivo: "desc" },
            select: { consecutivo: true },
        },
    });
    const n = Number(last?.consecutivo);
    return Number.isInteger(n) && n >= 1 ? n + 1 : 1;
}

/**
 * Crea el registro con el siguiente consecutivo. Si otra acta de la misma empresa tomó el número primero (error de duplicado), vuelve
 * a pedir el siguiente y reintenta; cualquier otro error se propaga tal cual.
 */
export async function crearConConsecutivo<T>(opts: {
    siguiente: () => Promise<number>;
    crear: (consecutivo: number) => Promise<T>;
    maxIntentos?: number;
}): Promise<T> {
    const max = opts.maxIntentos ?? MAX_INTENTOS;
    let ultimo: unknown;
    for (let i = 0; i < max; i++) {
        const consecutivo = await opts.siguiente();
        try {
            return await opts.crear(consecutivo);
        } catch (e) {
            if (!esErrorDeDuplicado(e)) throw e;
            ultimo = e;
        }
    }
    throw ultimo instanceof Error ? ultimo : new Error("No se pudo asignar el consecutivo del acta");
}
