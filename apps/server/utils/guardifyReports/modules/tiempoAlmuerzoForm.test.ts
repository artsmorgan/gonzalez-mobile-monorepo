import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, horaDe, parsePausas, tiempoAlmuerzoForm } from "./tiempoAlmuerzoForm";

// La firma digital del móvil: base64 de «sesión:empleado:latitud:longitud:marca de tiempo». Lleva coordenadas, nunca debe salir.
const HASH = Buffer.from("sess-9f2:77:9.9341:-84.0877:1776690000000").toString("base64");
const raw = {
    id: 61, empleadoId: 77, empleado_nombre: "Ana Soto Mora", cedula_empleado: "1-0555-0666", es_manual: false, minutos_almuerzo: 42.5, marca_id: 5,
    inicio: new Date("2026-04-20T11:30:00Z"), fin: new Date("2026-04-20T12:25:00Z"), isActive: true,
    pausas: JSON.stringify([{ startTime: "2026-04-20T11:50:00.000Z", endTime: "2026-04-20T12:02:00.000Z", reason: "Llamada del supervisor" }, { startTime: "2026-04-20T12:10:00.000Z", endTime: "2026-04-20T12:13:00.000Z", reason: "Sin razón determinada" }]),
    firma_empleado: HASH, empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
};
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("tiempo de almuerzo como formulario", () => {
    it("lee la hora de las pausas en los formatos que guarda el móvil", () => {
        assert.equal(horaDe("2026-04-20T11:50:00.000Z"), "11:50");
        assert.equal(horaDe("2026-04-20 11:50:00"), "11:50");
        assert.equal(horaDe("11:50:00"), "11:50");
        assert.equal(horaDe(Date.UTC(2026, 3, 20, 11, 50)), "11:50");
        assert.equal(horaDe(null), null);
        assert.deepEqual(parsePausas("no es json"), []);
        assert.deepEqual(parsePausas("[]"), []);
        assert.deepEqual(parsePausas(JSON.stringify([{ inicio: "10:00", fin: "10:05", razon: "Baño" }, {}, null])), [{ inicio: "10:00", fin: "10:05", motivo: "Baño" }]);
    });
    it("arma los valores y las pausas", () => {
        const r = armarRegistro(raw, ubic, false, { codigo: "E-77", nombre: "Ana" });
        assert.equal(r.variante, null);
        assert.deepEqual(r.valores, {
            empleado: "E-77 - Ana Soto Mora", cedula: "1-0555-0666", fecha_inicio: "2026-04-20", hora_inicio: "11:30", fecha_fin: "2026-04-20", hora_fin: "12:25", minutos_almuerzo: 42.5, es_manual: "No",
        });
        assert.deepEqual(r.listas.pausas, [
            { inicio: "11:50", fin: "12:02", motivo: "Llamada del supervisor" },
            { inicio: "12:10", fin: "12:13", motivo: "Sin razón determinada" },
        ]);
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("la firma digital (con coordenadas) nunca sale: solo se dice que existe", () => {
        for (const pedir of [false, true]) {
            const r = armarRegistro(raw, ubic, pedir);
            assert.deepEqual(r.firmasPresentes, ["firma_empleado"]);
            assert.deepEqual(r.firmas, { firma_empleado: null });
            assert.ok(!JSON.stringify(r).includes(HASH));
            assert.ok(!JSON.stringify(r).includes("9.9341"));
        }
        const sin = armarRegistro({ ...raw, firma_empleado: "" }, ubic, true);
        assert.deepEqual(sin.firmasPresentes, []);
        assert.deepEqual(sin.firmas, {});
    });
    it("si la columna trajera una imagen real, solo viaja con firmas=1", () => {
        assert.equal(armarRegistro({ ...raw, firma_empleado: SAMPLE_PNG }, ubic, true).firmas.firma_empleado, SAMPLE_PNG);
        assert.equal(armarRegistro({ ...raw, firma_empleado: SAMPLE_PNG }, ubic, false).firmas.firma_empleado, null);
    });
    it("registro manual y sin pausas", () => {
        const r = armarRegistro({ ...raw, es_manual: true, pausas: "[]", minutos_almuerzo: null, empleado_nombre: "" }, ubic, false);
        assert.equal(r.valores.es_manual, "Sí");
        assert.equal(r.valores.minutos_almuerzo, null);
        assert.equal(r.valores.empleado, null);
        assert.deepEqual(r.listas.pausas, []);
    });
    it("carga en lote: una consulta de registros, una de empleados y una por nivel de estructura, solo activos", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_empleado_almuerzo: t("alm", [raw, { ...raw, id: 62 }]), c_empleado: t("emp", [{ id: 77, codigo: "E-77", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Mora" }]),
            e_estructura_empresa: t("empr", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await tiempoAlmuerzoForm.loadRecords(db, [61, 62], { firmas: true });
        assert.deepEqual(out.map((r) => r.id), [61, 62]);
        assert.equal(out[0]!.valores.empleado, "E-77 - Ana Soto Mora");
        assert.equal(out[0]!.estructura.sucursal, "S1 - Sede");
        assert.equal(calls.length, 8);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
    it("escribe la muestra COMPLETA para Guardify", () => {
        const r = armarRegistro(raw, ubic, true, { codigo: "E-77", nombre: "Ana" });
        writeFormSample("tiempo-de-almuerzo", [r]);
        assert.equal(r.listas.pausas!.length, 2);
    });
});
