import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportUnavailableError } from "../errors";
import { writeFormSample } from "../formSamples";
import { armarRegistro, legible, solicitudVacacionesForm } from "./solicitudVacacionesForm";

// Fila de `v_vacacion_solicitud` como la deja `select: COLS` (el monto y los usuarios de aprobación no se piden, pero se prueba que no pasarían).
const raw = {
    id: 91, empleado_id: 5, plaza_id: 7, fecha_inicio: new Date("2026-06-01T00:00:00Z"), fecha_fin: new Date("2026-06-14T00:00:00Z"), dias: 12, semanas: 2,
    observaciones: "Vacaciones de medio año", consecutivo: "VAC-2026-33", estado_aprobacion: "ESTADO_SOLICITADO", tipo_vacaciones: "DISFRUTE", periodo: "2025-2026",
    fecha_insercion: new Date("2026-05-12T15:20:00Z"),
    monto: "412000.50", usuario_aprueba_ec: "jefe1", motivo_rechazo: "no debe salir",
};
const lookups = {
    empleados: new Map<number, any>([[5, { id: 5, codigo: "E-100", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Mora", cedula: "1-0555-0666" }]]),
    plazas: new Map<number, any>([[7, { id: 7, puesto_id: 6, codigo_plaza: "PZ-12", nombre: "Oficial 1" }]]),
    ejecutivo: "Carlos Vindas",
};
const hier = { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 };
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("solicitud de vacaciones como formulario", () => {
    it("traduce los códigos de la base a texto legible", () => {
        assert.equal(legible("ESTADO_SOLICITADO"), "Solicitado");
        assert.equal(legible("DISFRUTE"), "Disfrute");
        assert.equal(legible("PAGO_PARCIAL"), "Pago parcial");
        assert.equal(legible(null), null);
    });
    it("arma los valores con los mismos datos que el módulo de lista", () => {
        const r = armarRegistro(raw, ubic, false, lookups, hier);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-05-12T15:20:00");
        assert.deepEqual(r.valores, {
            consecutivo: "VAC-2026-33", fecha_solicitud: "2026-05-12", estado: "Solicitado", tipo_vacaciones: "Disfrute", periodo: "2025-2026", empleado: "E-100 - Ana Soto Mora",
            cedula: "1-0555-0666", plaza: "PZ-12 - Oficial 1", ejecutivo_cuenta: "Carlos Vindas", fecha_inicio: "2026-06-01", fecha_fin: "2026-06-14", dias: 12, semanas: 2,
            observaciones: "Vacaciones de medio año",
        });
        assert.deepEqual(r.hier, hier);
    });
    it("nunca salen el monto, los usuarios de aprobación ni el motivo de rechazo; y no hay firmas", () => {
        const r = armarRegistro(raw, ubic, true, lookups, hier);
        const s = JSON.stringify(r);
        for (const prohibido of ["412000", "jefe1", "no debe salir"]) assert.ok(!s.includes(prohibido), prohibido);
        assert.deepEqual(r.firmas, {});
        assert.deepEqual(r.firmasPresentes, []);
    });
    it("sin plaza ni empleado: ubicación y nombre vacíos, sin inventar", () => {
        const r = armarRegistro({ ...raw, empleado_id: 99, plaza_id: null, dias: null, semanas: "", observaciones: null, tipo_vacaciones: null, estado_aprobacion: null, fecha_insercion: null }, { empresa: null, cliente: null, division: null, contrato: null, sucursal: null, puesto: null }, false, lookups, {});
        assert.equal(r.valores.empleado, null);
        assert.equal(r.valores.plaza, null);
        assert.equal(r.valores.dias, null);
        assert.equal(r.valores.semanas, null);
        assert.equal(r.valores.fecha_solicitud, null);
        assert.equal(r.creado, null);
        assert.deepEqual(r.hier, {});
    });
    const mkDb = (n: number, extra: Record<string, any> = {}) => {
        const calls: string[] = [];
        let selectUsado: any;
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(name); return rows; } });
        const db: any = {
            v_vacacion_solicitud: { findMany: async (a: any) => { selectUsado = a.select; calls.push("vac"); return Array.from({ length: n }, (_, i) => ({ ...raw, id: 91 + i })); } },
            c_empleado: t("emp", [...lookups.empleados.values()]), e_estructura_plazas: t("plz", [...lookups.plazas.values()]),
            e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto", sucursal_id: 5 }]),
            e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede", contrato_id: 4, ejecutivoCuenta_id: 3 }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato", cliente_id: 2, empresa_id: 1, division_id: 3 }]),
            e_estructura_empresa: t("empr", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            n_ejecutivo_cuenta: t("eje", [{ id: 3, nombre: "Carlos Vindas" }]), ...extra,
        };
        return { db, calls, selectUsado: () => selectUsado };
    };
    it("carga en lote: una consulta por tabla (no por registro) y solo columnas seguras", async () => {
        const a = mkDb(2), b = mkDb(7);
        const out = await solicitudVacacionesForm.loadRecords(a.db, [91, 92], { firmas: false });
        await solicitudVacacionesForm.loadRecords(b.db, [91, 92, 93, 94, 95, 96, 97], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [91, 92]);
        assert.equal(out[0]!.valores.empleado, "E-100 - Ana Soto Mora");
        assert.equal(out[0]!.valores.ejecutivo_cuenta, "Carlos Vindas");
        assert.equal(out[0]!.estructura.sucursal, "S1 - Sede");
        assert.equal(out[0]!.estructura.division, "Seguridad");
        assert.deepEqual(out[0]!.hier, hier);
        assert.equal(a.calls.length, b.calls.length, "las consultas no crecen con el número de registros");
        for (const prohibido of ["monto", "usuario_aprueba_ec", "motivo_rechazo", "usuario_insercion"]) assert.equal(prohibido in a.selectUsado(), false, prohibido);
    });
    it("si la base no tiene la tabla, lo dice como el módulo de lista", async () => {
        const db: any = { v_vacacion_solicitud: { findMany: async () => { throw new Error("Tabla no soportada: v_vacacion_solicitud"); } } };
        await assert.rejects(() => solicitudVacacionesForm.loadRecords(db, [1], { firmas: false }), (e) => e instanceof ReportUnavailableError);
    });
    it("escribe la muestra COMPLETA para Guardify", () => {
        const r = armarRegistro(raw, ubic, true, lookups, hier);
        writeFormSample("solicitud-de-vacaciones", [r]);
        assert.ok(Object.values(r.valores).every((v) => v !== null && v !== ""));
    });
});
