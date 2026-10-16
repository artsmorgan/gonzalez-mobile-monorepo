import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, firmaDigital, maestroQuejasForm } from "./maestroQuejasForm";

// Firma digital de la app: base64 de «sesión:empleado:latitud:longitud:ms». 1_776_000_000_000 ms = 2026-04-12 13:20 UTC = 07:20 en Costa Rica.
const HASH = Buffer.from("sess-abc:15:9.93:-84.08:1776000000000").toString("base64");
const raw = {
    id: 21, created_at: new Date("2026-04-20T09:30:00Z"), empresa_id: 9, cliente_id: 4, division_id: 0, contrato_id: 31, corpo_id: 55, puesto_id: 140, plaza_id: 8,
    sociedad: "Seguridad SA", nombre_realiza_queja: "Ana Soto", cliente: "Cliente Uno", empresa_presenta_queja: "Comercial Sol", persona_presenta_queja: "Carlos Vega",
    medio_recepcion_queja: "Correo", tipo_cliente: "Público", tipo_queja: "Servicio", ubicacion: "Sede central", nivel_queja: "Grave",
    fecha_queja: "2026-04-18", motivo_queja: "Ausencia del oficial", descripcion_queja: "El oficial no se presentó al turno.", estimacion_dannio: "₡50000",
    fecha_inicio: "2026-04-19", fecha_revision: "2026-04-20T00:00:00", resolucion_queja: "Se envió reemplazo.", estado: "Resuelto", accion_correctiva_preventiva: "AC-2026-014",
    firma_responsable: HASH,
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: null, contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("maestro de quejas como formulario", () => {
    it("decodifica la firma digital sin exponer la sesión ni la ubicación", () => {
        assert.deepEqual(firmaDigital(HASH), { empleadoId: 15, cuando: "2026-04-12 07:20" });
        assert.equal(firmaDigital(""), null);
        assert.equal(firmaDigital("no es una firma"), null);
        assert.equal(firmaDigital(SAMPLE_PNG), null);
    });
    it("arma el registro: textos tal cual, fechas como día, firma digital solo como texto", () => {
        const r = armarRegistro(raw, ubic, true, { plaza: "12 - P-8 - Plaza", empleados: new Map([[15, "Eva Ruiz"]]), division: "Seguridad" });
        assert.equal(r.variante, null);
        assert.equal(r.valores.recibida_por, "Ana Soto");
        assert.equal(r.valores.fecha_realizacion, "2026-04-20");
        assert.equal(r.valores.tipo_queja, "Servicio");
        assert.equal(r.valores.plaza, "12 - P-8 - Plaza");
        assert.equal(r.valores.firma_responsable_digital, "Firmada digitalmente por Eva Ruiz el 2026-04-12 07:20");
        assert.equal(r.estructura.division, "Seguridad"); // la del contrato cuando la queja no guardó la suya
        // la firma es digital: aunque se pidan firmas no hay imagen, y el texto original (sesión, ubicación) nunca sale
        assert.deepEqual(r.firmas, { firma_responsable: null });
        assert.deepEqual(r.firmasPresentes, ["firma_responsable"]);
        assert.ok(!JSON.stringify(r).includes(HASH) && !JSON.stringify(r).includes("sess-abc") && !JSON.stringify(r).includes("-84.08"));
    });
    it("una firma antigua que sí es imagen sale solo con firmas=1", () => {
        const sinFirmas = armarRegistro({ ...raw, firma_responsable: SAMPLE_PNG }, ubic, false);
        assert.deepEqual(sinFirmas.firmas, { firma_responsable: null });
        assert.deepEqual(sinFirmas.firmasPresentes, ["firma_responsable"]);
        assert.equal(armarRegistro({ ...raw, firma_responsable: SAMPLE_PNG }, ubic, true).firmas.firma_responsable, SAMPLE_PNG);
        assert.equal(armarRegistro({ ...raw, firma_responsable: SAMPLE_PNG }, ubic, true).valores.firma_responsable_digital, null);
    });
    it("sin firma: ni presente ni texto; los vacíos quedan en null", () => {
        const r = armarRegistro({ ...raw, firma_responsable: "", estimacion_dannio: null, tipo_queja: null }, ubic, true);
        assert.deepEqual(r.firmasPresentes, []);
        assert.deepEqual(r.firmas, {});
        assert.equal(r.valores.firma_responsable_digital, null);
        assert.equal(r.valores.estimacion_dannio, null);
    });
    it("carga en lote: una consulta de quejas, una por nivel, plazas, empleados y divisiones", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_maestro_quejas: t("q", [raw, { ...raw, id: 22 }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato", division_id: 2 }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
            e_estructura_plazas: t("pla", [{ id: 8, nro_plaza: 12, codigo_plaza: "P-8", nombre: "Plaza" }]),
            c_empleado: t("empl", [{ id: 15, nombre: "Eva", primer_apellido: "Ruiz" }]),
        };
        const out = await maestroQuejasForm.loadRecords(db, [21, 22], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [21, 22]);
        assert.equal(out[0]!.valores.plaza, "12 - P-8 - Plaza");
        assert.equal(out[0]!.valores.firma_responsable_digital, "Firmada digitalmente por Eva Ruiz el 2026-04-12 07:20");
        assert.equal(out[0]!.estructura.division, "Seguridad");
        assert.deepEqual(out[0]!.firmas, { firma_responsable: null });
        // queja + 5 niveles (la división está en 0: no se consulta) + plazas + empleados + contratos y divisiones para la división que faltaba
        assert.equal(calls.length, 10);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
    it("muestra completa para Guardify", () => {
        // Completa: con firma presente (digital: no existe imagen que dibujar) y todo con valor.
        const r = armarRegistro(raw, { ...ubic, division: "Seguridad" }, true, { plaza: "12 - P-8 - Plaza", empleados: new Map([[15, "Eva Ruiz"]]) });
        writeFormSample("maestro-de-quejas-y-reclamos", [r]);
    });
});
