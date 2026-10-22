import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, CON_ACTIVOS, detallesActivo, imagenDeFirma, registroVisitasForm, SIN_ACTIVOS } from "./registroVisitasForm";

const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };
const visita = (extra: Record<string, unknown> = {}) => ({
    id: 21, nombre: "Pedro Gómez", cedula: "2-0111-0222", hora_entrada: new Date("2026-09-12T14:05:00Z"), hora_salida: new Date("2026-09-12T15:30:00Z"), created_at: new Date("2026-09-12T14:06:00Z"),
    razon_visita: "Reunión", dep_pers_visita: "Contabilidad", pers_autoriza_salida: "Rosa Vega", firma_visitante: SAMPLE_PNG,
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, nro_sucursal: "S1", codigo_puesto: "P1", activos: [] as any[], ...extra,
});
const activo = (extra: Record<string, unknown> = {}) => ({ id: 1, visitante_id: 21, tipo_id: 9, tipo_nombre: "Laptop", numero_id: "SN-998", detalles: JSON.stringify([{ detalle: "Marca", descripcion: "Dell" }, { detalle: "Color", descripcion: "Negro" }]), ...extra });

describe("registro de visitas como formulario", () => {
    it("detalles del activo: una línea por ítem; texto libre tal cual; vacío → null", () => {
        assert.equal(detallesActivo(activo().detalles), "Marca: Dell\nColor: Negro");
        assert.equal(detallesActivo("Cargador incluido"), "Cargador incluido");
        assert.equal(detallesActivo("[]"), null);
        assert.equal(detallesActivo(""), null);
        assert.equal(detallesActivo(null), null);
    });
    it("solo una imagen cuenta como firma", () => {
        assert.equal(imagenDeFirma(SAMPLE_PNG), SAMPLE_PNG);
        assert.equal(imagenDeFirma("A".repeat(300)), `data:image/png;base64,${"A".repeat(300)}`);
        assert.equal(imagenDeFirma("firmado"), null);
        assert.equal(imagenDeFirma(null), null);
    });
    it("visita sin activos: una fila de visitantes y variante «Sin activos»", () => {
        const r = armarRegistro(visita(), ubic, false);
        assert.equal(r.variante, SIN_ACTIVOS);
        assert.deepEqual(r.listas.visitantes, [{ fecha: "2026-09-12", visitante: "Pedro Gómez", cedula: "2-0111-0222", hora_entrada: "14:05", hora_salida: "15:30", motivo: "Reunión — Contabilidad — Rosa Vega" }]);
        assert.deepEqual(r.listas.activos, []);
        assert.deepEqual([r.firmas, r.firmasPresentes], [{ firma_visitante: null }, ["firma_visitante"]]);
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("visita con activos: variante «Con activos», una fila por activo y firma con firmas=1", () => {
        const r = armarRegistro(visita({ activos: [activo(), activo({ id: 2, tipo_nombre: "Tableta", numero_id: "SN-1", detalles: "" })] }), ubic, true);
        assert.equal(r.variante, CON_ACTIVOS);
        assert.deepEqual(r.listas.activos[0], { fecha: "2026-09-12", nro_corpo: "S1", nro_puesto: "P1", cedula: "2-0111-0222", duenio: "Pedro Gómez", tipo_activo: "Laptop", serie: "SN-998", visita: "Reunión", hora_ingreso: "14:05", hora_salida: "15:30", observaciones: "Marca: Dell\nColor: Negro" });
        assert.equal(r.listas.activos[1]!.observaciones, null);
        assert.equal(r.firmas.firma_visitante, SAMPLE_PNG);
    });
    it("sin firma y sin salida", () => {
        const r = armarRegistro(visita({ firma_visitante: null, hora_salida: null }), ubic, true);
        assert.deepEqual([r.firmas, r.firmasPresentes, r.listas.visitantes[0]!.hora_salida], [{}, [], null]);
    });
    it("carga en lote: visitas activas sin foto de cédula, activos en una consulta y estructura por nivel", async () => {
        const calls: { name: string; args: any }[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push({ name, args: a }); return rows; } });
        const { activos: _a, nro_sucursal: _n, codigo_puesto: _c, ...base } = visita();
        const db: any = {
            e_registro_personas: t("reg", [base, { ...base, id: 22 }]),
            e_activo_visitante: t("act", [{ id: 1, visitante_id: 21, tipo_id: 9, detalles: "[]", numero_id: "SN-1" }]),
            n_tipo_activo_visitas: t("tipo", [{ id: 9, nombre: "Laptop" }]),
            e_estructura_empresa: t("e", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await registroVisitasForm.loadRecords(db, [21, 22], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.variante]), [[21, CON_ACTIVOS], [22, SIN_ACTIVOS]]);
        assert.equal(out[0]!.listas.activos[0]!.nro_corpo, "S1");
        assert.equal(out[0]!.listas.activos[0]!.nro_puesto, "P1");
        assert.equal(calls[0]!.args.where.isActive, true);
        assert.ok(!("foto_cedula" in calls[0]!.args.select));
        assert.equal(calls.filter((c) => c.name === "reg").length, 1);
        assert.equal(calls.filter((c) => c.name === "act").length, 1);
    });
    it("sin activos no consulta tipos ni números de sucursal y puesto de más", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async () => { calls.push(name); return rows; } });
        const { activos: _a, nro_sucursal: _n, codigo_puesto: _c, ...base } = visita();
        const db: any = new Proxy({ e_registro_personas: t("reg", [base]), e_activo_visitante: t("act", []) } as any, { get: (o, n: string) => o[n] ?? t(n, []) });
        const out = await registroVisitasForm.loadRecords(db, [21], { firmas: false });
        assert.equal(out[0]!.variante, SIN_ACTIVOS);
        assert.ok(!calls.includes("n_tipo_activo_visitas"));
    });
    it("muestra completa por variante para Guardify", () => {
        const sin = armarRegistro(visita({ id: 31 }), ubic, true);
        const con = armarRegistro(visita({ id: 32, activos: [activo(), activo({ id: 2, tipo_nombre: "Tableta", numero_id: "SN-2" })] }), ubic, true);
        const recs = [sin, con].map(({ hier: _h, ...r }) => r);
        assert.deepEqual(recs.map((r) => r.variante), [SIN_ACTIVOS, CON_ACTIVOS]);
        writeFormSample("registro-de-visitas", recs);
    });
});
