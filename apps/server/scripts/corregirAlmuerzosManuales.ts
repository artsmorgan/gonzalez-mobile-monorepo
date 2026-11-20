/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Corrige los almuerzos MANUALES ya guardados por la versión anterior de la app (issue #158): inicio, fin y pausas quedaron 6 horas
 * adelantados (lo digitado como 12:00 de Costa Rica se guardó como 18:00Z). Ver `utils/lunchManualLegacy.ts`.
 *
 * Solo toca registros `es_manual = true` con `updated_at` vacío y creados ANTES de la hora de corte (el momento en que se desplegó el
 * servidor con la corrección: desde entonces el servidor corrige solo las peticiones de la versión anterior y la versión nueva ya envía las
 * horas bien). Al corregir un registro se llena `updated_at`, así que repetir el script no vuelve a restar las 6 horas.
 *
 * Uso (desde apps/server, con el mismo .env del servidor: DATABASE_URL de Planillas, SERVER_URL y MOBILE_ACCESS_TOKEN):
 *   npx tsx scripts/corregirAlmuerzosManuales.ts --antes-de=2026-10-21T08:00:00            # simulacro: lista lo que cambiaría
 *   npx tsx scripts/corregirAlmuerzosManuales.ts --antes-de=2026-10-21T08:00:00 --apply    # escribe
 * La hora de corte es hora de Costa Rica (la misma con la que se guarda `created_at`). Revisa el simulacro antes de usar --apply.
 */
import dotenv from "dotenv";

dotenv.config();

import { callDynamicPrisma } from "../utils/callDynamicPrisma";
import { createReportServiceRequest, createWorkerReportDb } from "../utils/reportDynamicPrisma";
import { corregirHorasManualLegado } from "../utils/lunchManualLegacy";

const APPLY = process.argv.includes("--apply");
const corteArg = process.argv.find((a) => a.startsWith("--antes-de="))?.split("=")[1];
const db = createWorkerReportDb();
const req = createReportServiceRequest();
const PAGE = 500;

/** Hora de reloj de Costa Rica «ahora», guardada como UTC (mismo convenio que `created_at`). */
const ahoraCR = () => new Date(Date.now() - 6 * 60 * 60 * 1000);

const actualizar = (id: number, data: Record<string, unknown>) =>
    callDynamicPrisma({ req, shouldVerifyAccessToken: false, data: { action: "UPDATE", table: "c_empleado_almuerzo", operation: "updateMany", where: { id, updated_at: null }, data } });

async function main() {
    if (!corteArg || Number.isNaN(new Date(`${corteArg}Z`).getTime())) {
        console.error("Falta --antes-de=AAAA-MM-DDTHH:mm:ss (hora de Costa Rica en que se desplegó la corrección en el servidor).");
        process.exit(1);
    }
    const corte = new Date(`${corteArg}Z`);
    console.log(APPLY ? "== APLICANDO ==" : "== SIMULACRO (use --apply para escribir) ==", `| registros manuales anteriores a ${corteArg} (hora de CR)`);

    const candidatos: any[] = [];
    for (let last = 0; ; ) {
        const rows: any[] = await (db as any).c_empleado_almuerzo.findMany({
            where: { es_manual: true, updated_at: null, id: { gt: last }, OR: [{ created_at: null }, { created_at: { lt: corte } }] },
            select: { id: true, inicio: true, fin: true, pausas: true, minutos_almuerzo: true, created_at: true },
            orderBy: { id: "asc" },
            take: PAGE,
        });
        candidatos.push(...rows);
        if (rows.length < PAGE) break;
        last = Number(rows[rows.length - 1].id);
    }

    console.log(`c_empleado_almuerzo: ${candidatos.length} registros manuales por corregir`);
    candidatos.slice(0, 10).forEach((r) => {
        const fixed = corregirHorasManualLegado({ inicio: r.inicio, fin: r.fin, pausas: r.pausas });
        console.log(`  #${r.id}  inicio ${new Date(r.inicio).toISOString()} → ${fixed.inicio} | fin ${new Date(r.fin).toISOString()} → ${fixed.fin} | ${Number(r.minutos_almuerzo)} min`);
    });
    if (candidatos.length > 10) console.log(`  … y ${candidatos.length - 10} más`);

    if (APPLY) {
        const now = ahoraCR();
        let n = 0;
        for (const r of candidatos) {
            const fixed = corregirHorasManualLegado({ inicio: r.inicio, fin: r.fin, pausas: r.pausas });
            await actualizar(Number(r.id), { inicio: fixed.inicio, fin: fixed.fin, pausas: fixed.pausas, updated_at: now.toISOString() });
            n++;
        }
        console.log(`corregidos: ${n}`);
    }
    process.exit(0);
}

main().catch((e) => {
    console.error("Error en la corrección:", e?.message ?? e);
    process.exit(1);
});
