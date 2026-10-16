import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample } from "../formSamples";
import { armarRegistro, cambiosUbicacionPuestoForm, metrosEntre } from "./cambiosUbicacionPuestoForm";

const raw = { id: 3, puesto_id: 140, latitud_anterior: "9.9300", longitud_anterior: "-84.0800", latitud_nueva: "9.9390", longitud_nueva: "-84.0800", created_at: new Date("2026-09-10T14:05:30Z"), created_by: 50 };
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("cambio de ubicación del puesto como formulario", () => {
    it("calcula la distancia como el módulo de lista", () => {
        const m = metrosEntre("9.93", "-84.08", "9.939", "-84.08");
        assert.ok(m !== null && m > 990 && m < 1010, String(m));
        assert.equal(metrosEntre(null, null, "10", "-84"), null);
        assert.equal(metrosEntre("200", "0", "10", "-84"), null);
    });
    it("arma el registro SIN coordenadas, solo si tenía ubicación anterior y cuántos metros se movió", () => {
        const r = armarRegistro(raw, ubic, true, "E50 - Ana Soto");
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-09-10T14:05:30");
        assert.deepEqual([r.valores.fecha, r.valores.hora], ["2026-09-10", "14:05"]);
        assert.equal(r.valores.tenia_ubicacion_anterior, "Sí");
        assert.match(String(r.valores.distancia), /^\d+ m$/);
        assert.equal(r.valores.responsable, "E50 - Ana Soto");
        const json = JSON.stringify(r);
        for (const s of ["9.93", "-84.08", "latitud", "longitud"]) assert.equal(json.includes(s), false, s);
        assert.deepEqual([r.firmas, r.firmasPresentes, r.listas], [{}, [], {}]);
    });
    it("sin ubicación anterior no hay distancia", () => {
        const r = armarRegistro({ ...raw, latitud_anterior: null, longitud_anterior: "" }, ubic, false, null);
        assert.equal(r.valores.tenia_ubicacion_anterior, "No");
        assert.equal(r.valores.distancia, "No aplica (sin ubicación anterior)");
        assert.equal(r.valores.responsable, null);
    });
    it("carga en lote: una consulta por tabla; la ubicación sale del puesto", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); const ids: number[] | undefined = a.where?.id?.in; return ids ? rows.filter((x) => ids.includes(x.id)) : rows; } });
        const db: any = {
            c_ubicacion_puesto_registro_cambios: t("cam", [raw, { ...raw, id: 4 }]),
            c_empleado: t("emp2", [{ id: 50, codigo: "E50", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato", cliente_id: 4, empresa_id: 9, division_id: 2 }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede", contrato_id: 31 }]),
            e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón", sucursal_id: 55 }]),
        };
        const out = await cambiosUbicacionPuestoForm.loadRecords(db, [3, 4], { firmas: true });
        assert.deepEqual(out.map((r) => r.id), [3, 4]);
        assert.deepEqual(out[0]!.estructura, ubic);
        assert.equal(out[0]!.valores.responsable, "E50 - Ana Soto");
        assert.deepEqual(out[0]!.hier, { puesto: 140, corpo: 55, contrato: 31, cliente: 4, empresa: 9, division: 2 });
        for (const name of ["cam", "emp2"]) assert.equal(calls.filter((c) => c.startsWith(`${name}:`)).length, 1, name);
        assert.ok(calls.length <= 12); // nunca una consulta por registro
    });
    it("sin registros no consulta nada más", async () => {
        const db: any = { c_ubicacion_puesto_registro_cambios: { findMany: async () => [] } };
        assert.deepEqual(await cambiosUbicacionPuestoForm.loadRecords(db, [1], { firmas: true }), []);
    });
    it("muestra COMPLETA para Guardify: todas las claves con valor", () => {
        writeFormSample("cambios-de-ubicacion-del-puesto", [armarRegistro(raw, ubic, true, "E50 - Ana Soto")]);
    });
});
