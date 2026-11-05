/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Relleno opcional del VIN de los vehículos corporativos (issue #139): copia el VIN de la ÚLTIMA revisión ligada a cada vehículo
 * (`c_bitacora_vehiculo_detenido.informacion_general`, entrada con `key: "vin"`) a `c_vehiculos_corporativos.vin`, solo en los vehículos
 * que todavía no tienen VIN. No toca vehículos que ya lo tengan.
 *
 * Uso (desde apps/server, con el mismo .env del servidor: DATABASE_URL de Planillas, SERVER_URL y MOBILE_ACCESS_TOKEN):
 *   npx tsx scripts/backfillVinVehiculos.ts            # simulacro: solo cuenta, no escribe
 *   npx tsx scripts/backfillVinVehiculos.ts --apply    # escribe
 *
 * Idempotente: se puede repetir.
 */
import dotenv from "dotenv";

dotenv.config();

import { callDynamicPrisma } from "../utils/callDynamicPrisma";
import { createReportServiceRequest, createWorkerReportDb } from "../utils/reportDynamicPrisma";
import { VEHICLE_VIN_MAX } from "../utils/corporateVehiclePayload";

const APPLY = process.argv.includes("--apply");
const db = createWorkerReportDb();
const req = createReportServiceRequest();
const PAGE = 500;

const updateOne = (id: number, vin: string) =>
    callDynamicPrisma({ req, shouldVerifyAccessToken: false, data: { action: "UPDATE", table: "c_vehiculos_corporativos", operation: "updateMany", where: { id, vin: null }, data: { vin } } });

/** VIN escrito en la «información general» de una revisión (arreglo de `{ key, value }`), o null. */
export function vinDeInformacionGeneral(raw: unknown): string | null {
    let items: unknown = raw;
    if (typeof raw === "string") {
        try {
            items = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (!Array.isArray(items)) return null;
    const item = items.find((i: any) => i && String(i.key ?? "").toLowerCase() === "vin");
    const vin = String(item?.value ?? "").trim();
    return vin ? vin.slice(0, VEHICLE_VIN_MAX) : null;
}

async function main() {
    console.log(APPLY ? "== APLICANDO ==" : "== SIMULACRO (use --apply para escribir) ==");
    // Vehículos sin VIN.
    const sinVin = new Set<number>();
    for (let last = 0; ; ) {
        const rows: any[] = await (db as any).c_vehiculos_corporativos.findMany({ where: { vin: null, id: { gt: last } }, select: { id: true }, orderBy: { id: "asc" }, take: PAGE });
        for (const r of rows) sinVin.add(Number(r.id));
        if (rows.length < PAGE) break;
        last = Number(rows[rows.length - 1].id);
    }
    // Revisiones ligadas a un vehículo, de la más reciente a la más antigua: la primera con VIN de cada vehículo gana.
    const vinPorVehiculo = new Map<number, string>();
    for (let last = Number.MAX_SAFE_INTEGER; ; ) {
        const rows: any[] = await (db as any).c_bitacora_vehiculo_detenido.findMany({
            where: { vehiculo_id: { not: null }, id: { lt: last } },
            select: { id: true, vehiculo_id: true, informacion_general: true },
            orderBy: { id: "desc" },
            take: PAGE,
        });
        for (const r of rows) {
            const vid = Number(r.vehiculo_id);
            if (!sinVin.has(vid) || vinPorVehiculo.has(vid)) continue;
            const vin = vinDeInformacionGeneral(r.informacion_general);
            if (vin) vinPorVehiculo.set(vid, vin);
        }
        if (rows.length < PAGE) break;
        last = Number(rows[rows.length - 1].id);
    }
    console.log(`c_vehiculos_corporativos: ${sinVin.size} vehículos sin VIN; con VIN en alguna revisión: ${vinPorVehiculo.size}${APPLY ? "" : " (simulacro)"}`);
    if (APPLY) {
        for (const [id, vin] of vinPorVehiculo) await updateOne(id, vin);
        console.log(`actualizados: ${vinPorVehiculo.size}`);
    }
    process.exit(0);
}

if (require.main === module) {
    main().catch((e) => {
        console.error("Error en el relleno:", e?.message ?? e);
        process.exit(1);
    });
}
