import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, firmaDigital, productoNoConformeForm } from "./productoNoConformeForm";

// Firma digital de la app: base64 de «sesión:empleado:latitud:longitud:ms». 1_776_000_000_000 ms = 2026-04-12 13:20 UTC = 07:20 en Costa Rica.
const HASH = Buffer.from("sess-xyz:15:9.93:-84.08:1776000000000").toString("base64");
const raw = {
    id: 31, created_at: new Date("2026-04-20T09:30:00Z"), empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    responsable_cuenta: "Luis Mora", fecha_identificacion: new Date("2026-04-18T00:00:00Z"), tipo_servicio_no_conforme: "Incumplimiento de horario",
    persona_identifico_pnc: "Ana Soto", descripcion: "El oficial llegó tarde.", persona_origino_pnc: "Pedro Rojas", accion_implementada: "Llamada de atención.",
    fecha_solucion: new Date("2026-04-19T00:00:00Z"), responsable_aprobar: "Eva Ruiz",
    firma_persona_identifico_pnc: SAMPLE_PNG.replace("data:image/png;base64,", ""), // la app guarda el base64 puro
    firma_persona_origino_pnc: SAMPLE_PNG, firma_responsable: HASH,
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("producto no conforme como formulario", () => {
    it("arma el registro: textos, días y firmas dibujadas solo con firmas=1", () => {
        const r = armarRegistro(raw, ubic, false, new Map([[15, "Eva Ruiz"]]));
        assert.equal(r.variante, null);
        assert.equal(r.valores.fecha_identificacion, "2026-04-18");
        assert.equal(r.valores.tipo_servicio, "Incumplimiento de horario");
        assert.deepEqual(r.firmas, { firma_persona_identifico_pnc: null, firma_persona_origino_pnc: null, firma_responsable: null });
        assert.deepEqual(r.firmasPresentes, ["firma_persona_identifico_pnc", "firma_persona_origino_pnc", "firma_responsable"]);
        const con = armarRegistro(raw, ubic, true, new Map([[15, "Eva Ruiz"]]));
        assert.equal(con.firmas.firma_persona_identifico_pnc, SAMPLE_PNG); // el base64 puro se entrega como data URL
        assert.equal(con.firmas.firma_persona_origino_pnc, SAMPLE_PNG);
        assert.equal(con.firmas.firma_responsable, null); // digital: sin imagen
        assert.equal(con.valores.firma_responsable_digital, "Firmada digitalmente por Eva Ruiz el 2026-04-12 07:20");
        assert.ok(!JSON.stringify(con).includes("sess-xyz") && !JSON.stringify(con).includes(HASH) && !JSON.stringify(con).includes("-84.08"));
        assert.deepEqual(con.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
    });
    it("firma digital: solo empleado y hora; lo demás no es firma", () => {
        assert.deepEqual(firmaDigital(HASH), { empleadoId: 15, cuando: "2026-04-12 07:20" });
        assert.equal(firmaDigital("abc"), null);
        assert.equal(firmaDigital(null), null);
    });
    it("las firmas opcionales ausentes o que no son imagen no cuentan; un texto con aspecto de imagen no sale como valor", () => {
        const r = armarRegistro({ ...raw, firma_persona_identifico_pnc: null, firma_persona_origino_pnc: "pnc_firma_origino_123.png", firma_responsable: "", descripcion: SAMPLE_PNG }, ubic, true);
        assert.deepEqual(r.firmas, {});
        assert.deepEqual(r.firmasPresentes, []);
        assert.equal(r.valores.descripcion, null);
        assert.equal(r.valores.firma_responsable_digital, null);
    });
    it("carga en lote: una consulta de registros, una por nivel y los empleados que firmaron", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_producto_no_conforme: t("pnc", [raw, { ...raw, id: 32 }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
            c_empleado: t("empl", [{ id: 15, nombre: "Eva", primer_apellido: "Ruiz" }]),
        };
        const out = await productoNoConformeForm.loadRecords(db, [31, 32], { firmas: true });
        assert.deepEqual(out.map((r) => r.id), [31, 32]);
        assert.equal(out[0]!.estructura.sucursal, "55 - Sede");
        assert.equal(out[1]!.valores.firma_responsable_digital, "Firmada digitalmente por Eva Ruiz el 2026-04-12 07:20");
        assert.equal(calls.length, 8);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
    it("muestra completa para Guardify", () => {
        writeFormSample("producto-no-conforme", [armarRegistro(raw, ubic, true, new Map([[15, "Eva Ruiz"]]))]);
    });
});
