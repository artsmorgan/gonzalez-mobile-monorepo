import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, notasVozForm } from "./notasVozForm";

const DIGITAL = Buffer.from("sesion-1:20:9.93:-84.08:1788000000000").toString("base64");
const ubic = { empresa: "CH - Empresa", cliente: "Hospital Norte", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Portón" };
const raw = (extra: any = {}) => ({
    id: 40, empresa_id: 9, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, created_by: 20, created_at: new Date("2026-08-01T16:45:10Z"),
    titulo: "Portón con falla", descripcion: "Se reporta que el portón no cierra.", transcripcion: "Buenas tardes, reporto que el portón principal no termina de cerrar.",
    path: "/uploads/voice-notes/40/audio-123.m4a", firma_responsable: DIGITAL, creador_label: "A1 Marta Rojas Vega", isActive: true, ...extra,
});

describe("nota de voz como formulario", () => {
    it("arma título, descripción, transcripción y el indicador de audio", () => {
        const r = armarRegistro(raw(), ubic, false);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-08-01T16:45:10");
        assert.deepEqual(r.valores, {
            titulo: "Portón con falla", descripcion: "Se reporta que el portón no cierra.", transcripcion: "Buenas tardes, reporto que el portón principal no termina de cerrar.",
            con_audio: "Sí", creado_por: "A1 Marta Rojas Vega",
        });
        assert.equal(armarRegistro(raw({ path: "" }), ubic, false).valores.con_audio, "No");
        assert.deepEqual(r.hier, { empresa: 9, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("nunca entrega la ruta ni el nombre del audio, ni la firma en bruto", () => {
        const s = JSON.stringify(armarRegistro(raw(), ubic, true));
        assert.ok(!s.includes("audio-123") && !s.includes("voice-notes") && !s.includes(DIGITAL));
    });
    it("descarta un texto que sea una imagen incrustada", () => {
        const r = armarRegistro(raw({ descripcion: "data:image/png;base64,AAAA", transcripcion: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" }), ubic, false);
        assert.equal(r.valores.descripcion, null);
        assert.equal(r.valores.transcripcion, null);
    });
    it("la firma del responsable es digital (presente, sin imagen); si fuera imagen, solo sale con firmas=1", () => {
        assert.deepEqual(armarRegistro(raw(), ubic, true).firmas, { firma_responsable: null });
        assert.deepEqual(armarRegistro(raw(), ubic, true).firmasPresentes, ["firma_responsable"]);
        assert.deepEqual(armarRegistro(raw({ firma_responsable: SAMPLE_PNG }), ubic, false).firmas, { firma_responsable: null });
        assert.equal(armarRegistro(raw({ firma_responsable: SAMPLE_PNG }), ubic, true).firmas.firma_responsable, SAMPLE_PNG);
        assert.deepEqual(armarRegistro(raw({ firma_responsable: "" }), ubic, true).firmasPresentes, []);
    });
    it("carga en lote: registros, empleados y una consulta por nivel; solo activos y en el orden pedido", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const { creador_label: _l, ...fila } = raw();
        const db: any = {
            c_notas_voz: t("nota", [fila, { ...fila, id: 41 }]),
            c_empleado: t("emp", [{ id: 20, codigo: "A1", nombre: "Marta", primer_apellido: "Rojas", segundo_apellido: "Vega" }]),
            e_estructura_empresa: t("empr", [{ id: 9, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "Hospital Norte" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Portón" }]),
        };
        const out = await notasVozForm.loadRecords(db, [41, 40], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [41, 40]);
        assert.equal(calls.length, 8);
        assert.ok(calls[0]!.includes('"isActive":true'));
        assert.equal(out[0]!.valores.creado_por, "A1 Marta Rojas Vega");
        assert.equal(out[0]!.estructura.puesto, "P1 - Portón");
    });
    it("muestra completa para Guardify", () => {
        const r = armarRegistro(raw(), ubic, true);
        writeFormSample("notas-de-voz", [r]);
        assert.equal(r.valores.con_audio, "Sí");
    });
});
