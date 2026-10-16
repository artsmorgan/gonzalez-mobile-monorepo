import { NextRequest } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

/**
 * `c_registro_induccion_recorrido.participantes` (LongText JSON) fue reemplazado por la tabla
 * `c_participantes_induccion_recorrido` (una fila por participante, FK a `registro_id`, ON DELETE
 * CASCADE). Estos helpers mantienen el contrato de la API sin cambios: el cliente sigue enviando y
 * recibiendo `participantes` como un string JSON de `{ nombre_completo, cedula, firma }[]`.
 */
export type ParticipanteRow = {
    nombre_completo: string;
    cedula: string;
    firma: string;
};

/**
 * Columnas reales de `c_registro_induccion_recorrido` (sin `participantes`, `empleado_id` ni
 * `firma_empleado`, eliminadas de la base externa). Cualquier `findMany`/`findUnique`/`create`/
 * `update`/`delete` sobre esta tabla vía `callDynamicPrisma` debe usar este `select` explícito — uno
 * ausente hace que Prisma pida todas las columnas del modelo, incluidas las eliminadas, y la consulta
 * falla con "Unknown field ... does not exist"/"column ... does not exist".
 */
export const INDUCTION_TOUR_SAFE_SELECT = {
    id: true,
    empresa_id: true,
    cliente_id: true,
    contrato_id: true,
    corpo_id: true,
    puesto_id: true,
    plaza_id: true,
    fecha: true,
    renglon_edificio: true,
    supervisor_cliente: true,
    supervisor_corporacion: true,
    temas_desarrollados: true,
    aspectos_especificos: true,
    firma_supervisor: true,
    created_at: true,
    created_by: true,
    division: true,
    firma_responsable: true,
    isActive: true,
    division_id: true,
} as const;

export function parseParticipantesInput(raw: unknown): ParticipanteRow[] {
    let arr: any[] = [];
    if (Array.isArray(raw)) {
        arr = raw;
    } else if (typeof raw === "string" && raw.trim().length > 0) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) arr = parsed;
        } catch {
            arr = [];
        }
    }
    return arr
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
            nombre_completo: p.nombre_completo != null ? String(p.nombre_completo) : "",
            cedula: p.cedula != null ? String(p.cedula) : "",
            firma: p.firma != null ? String(p.firma) : "",
        }));
}

export async function createParticipantesForRegistro(
    req: NextRequest,
    registroId: number,
    participantesInput: unknown
): Promise<ParticipanteRow[]> {
    const parsed = parseParticipantesInput(participantesInput);
    for (const p of parsed) {
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_participantes_induccion_recorrido",
                operation: "create",
                data: {
                    registro_id: registroId,
                    nombre_completo: p.nombre_completo,
                    cedula: p.cedula,
                    firma: p.firma,
                },
            },
        });
    }
    return parsed;
}

export async function replaceParticipantesForRegistro(
    req: NextRequest,
    registroId: number,
    participantesInput: unknown
): Promise<ParticipanteRow[]> {
    await callDynamicPrisma({
        req,
        data: {
            action: "DELETE",
            table: "c_participantes_induccion_recorrido",
            operation: "deleteMany",
            where: { registro_id: registroId },
        },
    });
    return createParticipantesForRegistro(req, registroId, participantesInput);
}

/** Adjunta `participantes` (string JSON) a cada registro, tal como lo esperaba el cliente antes de la migración. */
export async function hydrateParticipantesForRecords(req: NextRequest, records: any[]): Promise<any[]> {
    const ids = [...new Set(records.map((r) => Number(r.id)).filter((n) => Number.isFinite(n)))];
    if (ids.length === 0) return records.map((r) => ({ ...r, participantes: "[]" }));

    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "c_participantes_induccion_recorrido",
            operation: "findMany",
            where: { registro_id: { in: ids } },
        },
    });
    const rowsArray = Array.isArray(rows) ? rows : [];
    const byRegistro = new Map<number, ParticipanteRow[]>();
    for (const p of rowsArray as any[]) {
        const rid = Number(p.registro_id);
        if (!byRegistro.has(rid)) byRegistro.set(rid, []);
        byRegistro.get(rid)!.push({
            nombre_completo: p.nombre_completo,
            cedula: p.cedula,
            firma: p.firma,
        });
    }

    return records.map((r) => ({
        ...r,
        participantes: JSON.stringify(byRegistro.get(Number(r.id)) ?? []),
    }));
}
