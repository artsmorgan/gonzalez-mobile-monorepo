/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Relleno único de la jerarquía (empresa, cliente, división, contrato, sucursal, puesto) en registros ANTERIORES a las columnas
 * propias (issues #107, #114, #119, #125).
 *
 * Las tablas de estructura (`e_estructura_*`) viven en la base de Planillas y los registros en la base del servicio dinámico, así que el
 * relleno no se puede hacer con SQL en una migración: se hace desde aquí, leyendo la estructura por acceso directo y escribiendo los
 * registros por `callDynamicPrisma` (igual que el worker de reportes).
 *
 * Uso (desde apps/server, con el mismo .env del servidor: DATABASE_URL de Planillas, SERVER_URL y MOBILE_ACCESS_TOKEN):
 *   npx tsx scripts/backfillJerarquia.ts            # simulacro: solo cuenta, no escribe
 *   npx tsx scripts/backfillJerarquia.ts --apply    # escribe
 *
 * Idempotente: solo toca registros que aún no tienen la jerarquía (se puede repetir). Usa la estructura ACTUAL de cada puesto.
 */
import dotenv from "dotenv";

dotenv.config();

import { callDynamicPrisma } from "../utils/callDynamicPrisma";
import { createReportServiceRequest, createWorkerReportDb } from "../utils/reportDynamicPrisma";
import { cadenasDePuestos, jerarquiaComun } from "../utils/syncActividadHierarchy";

const APPLY = process.argv.includes("--apply");
const db = createWorkerReportDb();
const req = createReportServiceRequest();
const PAGE = 1000;

const updateMany = (table: string, where: any, data: any) =>
    callDynamicPrisma({ req, shouldVerifyAccessToken: false, data: { action: "UPDATE", table, operation: "updateMany", where, data } });

/** Todas las filas que cumplen `where`, por páginas de id (la API dinámica no devuelve más de lo pedido en una consulta). */
async function leerTodas(table: string, where: any, select: any): Promise<any[]> {
    const out: any[] = [];
    let last = 0;
    for (;;) {
        const rows = await (db as any)[table].findMany({ where: { ...where, id: { gt: last } }, select: { id: true, ...select }, orderBy: { id: "asc" }, take: PAGE });
        out.push(...rows);
        if (rows.length < PAGE) return out;
        last = Number(rows[rows.length - 1].id);
    }
}

type Config = { tabla: string; sinJerarquia: any; columnas: Array<"empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "corpo_id"> };
const TODAS: Config["columnas"] = ["empresa_id", "cliente_id", "division_id", "contrato_id", "corpo_id"];
const TABLAS_POR_PUESTO: Config[] = [
    { tabla: "c_ubicacion_puesto_registro_cambios", sinJerarquia: { corpo_id: null }, columnas: TODAS },
    // La entrega ya guardaba cliente y sucursal: solo faltan empresa, contrato y división.
    { tabla: "e_registro_entrega_puesto", sinJerarquia: { empresa_id: null }, columnas: ["empresa_id", "contrato_id", "division_id"] },
    { tabla: "c_login_marca_almuerzo", sinJerarquia: { corpo_id: null }, columnas: TODAS },
];

async function rellenarPorPuesto(cfg: Config) {
    const where = { ...cfg.sinJerarquia, puesto_id: { not: null } };
    const rows = await leerTodas(cfg.tabla, where, { puesto_id: true });
    const puestoIds = [...new Set(rows.map((r) => Number(r.puesto_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const cadenas = puestoIds.length ? await cadenasDePuestos(puestoIds) : new Map();
    let puestosConCadena = 0;
    let filasCubiertas = 0;
    for (const puestoId of puestoIds) {
        const c = cadenas.get(puestoId);
        // Solo se escribe si el puesto tiene sucursal y contrato (cadena resoluble); si no, el registro queda como está.
        if (!c || !c.corpo_id || !c.contrato_id) continue;
        puestosConCadena++;
        filasCubiertas += rows.filter((r) => Number(r.puesto_id) === puestoId).length;
        if (APPLY) {
            const data: any = {};
            for (const col of cfg.columnas) data[col] = c[col];
            await updateMany(cfg.tabla, { puesto_id: puestoId, ...cfg.sinJerarquia }, data);
        }
    }
    console.log(`${cfg.tabla}: ${rows.length} registros sin jerarquía, ${puestoIds.length} puestos; con cadena completa: ${puestosConCadena} puestos (${filasCubiertas} registros)${APPLY ? " → actualizados" : " (simulacro)"}`);
}

async function rellenarActividades() {
    const links = await leerTodas("e_actividades_puesto", {}, { actividad_id: true, puesto_id: true });
    const porActividad = new Map<number, number[]>();
    for (const l of links) {
        const a = Number(l.actividad_id);
        const p = Number(l.puesto_id);
        if (!(a > 0) || !(p > 0)) continue;
        porActividad.set(a, [...(porActividad.get(a) ?? []), p]);
    }
    const puestoIds = [...new Set([...porActividad.values()].flat())];
    const cadenas = puestoIds.length ? await cadenasDePuestos(puestoIds) : new Map();
    // Misma jerarquía → un solo updateMany por grupo de actividades.
    const grupos = new Map<string, { data: any; ids: number[] }>();
    for (const [actividadId, ids] of porActividad) {
        const j = jerarquiaComun([...new Set(ids)], cadenas);
        if (Object.values(j).every((v) => v == null)) continue;
        const key = JSON.stringify(j);
        const g = grupos.get(key) ?? { data: j, ids: [] };
        g.ids.push(actividadId);
        grupos.set(key, g);
    }
    let total = 0;
    for (const g of grupos.values()) {
        total += g.ids.length;
        if (APPLY) {
            for (let i = 0; i < g.ids.length; i += 500) {
                await updateMany("e_actividades", { id: { in: g.ids.slice(i, i + 500) } }, g.data);
            }
        }
    }
    console.log(`e_actividades: ${porActividad.size} actividades con puestos; con alguna jerarquía común: ${total} (${grupos.size} grupos)${APPLY ? " → actualizadas" : " (simulacro)"}`);
}

(async () => {
    console.log(APPLY ? "== APLICANDO ==" : "== SIMULACRO (use --apply para escribir) ==");
    for (const cfg of TABLAS_POR_PUESTO) await rellenarPorPuesto(cfg);
    await rellenarActividades();
    process.exit(0);
})().catch((e) => {
    console.error("Error en el relleno:", e?.message ?? e);
    process.exit(1);
});
