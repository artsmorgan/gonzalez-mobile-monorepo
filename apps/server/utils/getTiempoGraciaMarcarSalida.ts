import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";

export const DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA = 15;

export function parseTiempoGraciaMarcarSalida(raw: unknown): number {
    const n = Number(String(raw ?? "").trim());
    if (!Number.isFinite(n) || n < 0) {
        return DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA;
    }
    return Math.floor(n);
}

/** Minutos previos a la hora de salida (desde c_configuracion.tiempo_gracia_marcar_salida). */
export async function getTiempoGraciaMarcarSalida(req: NextRequest): Promise<number> {
    try {
        const row = await prisma.c_configuracion.findFirst({
            where: {
                id: 1,
            },
        });

        if (!row || typeof row !== "object") {
            return DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA;
        }

        const value = (row as { tiempo_gracia_marcar_salida?: unknown }).tiempo_gracia_marcar_salida;
        if (value == null) {
            return DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA;
        }
        return parseTiempoGraciaMarcarSalida(value);
    } catch (error) {
        console.error("Error obteniendo tiempo_gracia_marcar_salida:", error);
        return DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA;
    }
}
