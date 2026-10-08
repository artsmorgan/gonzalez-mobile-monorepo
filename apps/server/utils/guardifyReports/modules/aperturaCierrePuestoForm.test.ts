import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { aperturaCierrePuestoForm, armarRegistro, firmaImagen, respuestaLegible } from "./aperturaCierrePuestoForm";

const FIRMA = "data:image/png;base64," + "A".repeat(300);
const raw = {
    id: 21, tipo: "Apertura", fecha: new Date("2026-09-09T06:00:00Z"), created_at: new Date("2026-09-09T06:10:30Z"), isActive: true,
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    actividades: JSON.stringify([
        { pregunta: "Presentese al lugar", respuesta: "Ok", observaciones: "" },
        { pregunta: "Llaves de acceso", respuesta: "N/A", observaciones: "No hay" },
        { pregunta: "Recorrido", respuesta: null, observaciones: "" },
    ]),
    inventario: JSON.stringify([{ activos_equipos: "Radio", tipo_nombre: "Comunicación", numero_activo: "FC-1", numero_serie: "S1", marca: "Motorola", modelo: "X1", descripcion: "Con batería" }]),
    otras_observaciones: "Todo en orden.",
    nombre_representante_cliente: "Rosa Vega", nombre_representante_empresa_saliente: "Pedro Mena", nombre_representante_empresa_entrante: "Juan Sol",
    firma_representante_cliente: FIRMA, firma_representante_empresa_saliente: "", firma_representante_empresa_entrante: null,
    firma_responsable: "GPS-QR-TOKEN-123", // nunca sale
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("apertura/cierre del puesto como formulario", () => {
    it("normaliza respuestas y firmas", () => {
        assert.equal(respuestaLegible("Ok"), "OK");
        assert.equal(respuestaLegible("N/A"), "NA");
        assert.equal(respuestaLegible("na"), "NA");
        assert.equal(respuestaLegible(null), null);
        assert.equal(firmaImagen(FIRMA), FIRMA);
        assert.equal(firmaImagen("A".repeat(200)), "data:image/png;base64," + "A".repeat(200));
        assert.equal(firmaImagen("firma_1.png"), null); // un nombre de archivo no es una imagen
        assert.equal(firmaImagen(""), null);
    });
    it("arma el registro: sin firmas por defecto, pero dice cuáles tiene; nunca la firma del responsable ni fotos", () => {
        const r = armarRegistro(raw, ubic, false, { codigo: "P140", nombre: "Portón" });
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-09-09T06:10:30");
        assert.equal(r.valores.cliente, "Cliente Uno");
        assert.equal(r.valores.corpo, "55 - Sede");
        assert.equal(r.valores.numero_puesto, "P140");
        assert.equal(r.valores.nombre_puesto, "Portón");
        assert.equal(r.valores.fecha, "2026-09-09");
        assert.equal(r.valores.tipo, "Apertura");
        assert.equal(r.valores.tipo_marcado, "( X ) Apertura    (   ) Cierre");
        assert.equal(r.valores.nombre_representante_saliente, "Pedro Mena");
        assert.deepEqual(r.listas.actividades, [
            { item: "Presentese al lugar", valor: "OK", observacion: null },
            { item: "Llaves de acceso", valor: "NA", observacion: "No hay" },
            { item: "Recorrido", valor: null, observacion: null },
        ]);
        assert.deepEqual(r.listas.inventario[0], { activos_equipos: "Radio", tipo: "Comunicación", numero_activo: "FC-1", numero_serie: "S1", marca: "Motorola", modelo: "X1" });
        assert.deepEqual(r.firmas, { firma_cliente: null });
        assert.deepEqual(r.firmasPresentes, ["firma_cliente"]);
        assert.ok(!JSON.stringify(r).includes("GPS-QR-TOKEN"));
        assert.deepEqual(r.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
    });
    it("con firmas=1 entrega la imagen", () => {
        assert.equal(armarRegistro(raw, ubic, true).firmas.firma_cliente, FIRMA);
    });
    it("el cierre marca el otro paréntesis", () => {
        assert.equal(armarRegistro({ ...raw, tipo: "cierre" }, ubic, false).valores.tipo_marcado, "(   ) Apertura    ( X ) Cierre");
    });
    it("carga en lote: una consulta por tabla, solo activos; los registros antiguos se ubican por su puesto", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); const ids: number[] | undefined = a.where?.id?.in; return ids ? rows.filter((x) => ids.includes(x.id)) : rows; } });
        const db: any = {
            c_apertura_cierre_puesto: t("ap", [{ ...raw, id: 21 }, { ...raw, id: 22, empresa_id: 0, division_id: 0, contrato_id: 0, cliente_id: 0, corpo_id: 0, tipo: "Cierre" }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato", cliente_id: 4, empresa_id: 9, division_id: 2 }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede", contrato_id: 31 }]),
            e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón", sucursal_id: 55 }]),
        };
        const out = await aperturaCierrePuestoForm.loadRecords(db, [21, 22], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [21, 22]);
        assert.equal(out[0]!.valores.numero_puesto, "P140");
        // El registro antiguo (ids en 0) hereda la ubicación de su puesto.
        assert.equal(out[1]!.estructura.contrato, "C-31 - Contrato");
        assert.deepEqual(out[1]!.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
        assert.ok(calls[0]!.includes('"isActive":true'));
        // En lote: el contrato, la sucursal y el puesto se leen a lo sumo dos veces (jerarquía de los antiguos + textos), nunca una por registro.
        for (const name of ["ap", "emp", "cli", "div"]) assert.equal(calls.filter((c) => c.startsWith(`${name}:`)).length, 1, name);
        for (const name of ["con", "suc", "pue"]) assert.ok(calls.filter((c) => c.startsWith(`${name}:`)).length <= 3, name);
    });
    it("sin registros no consulta nada más", async () => {
        const db: any = { c_apertura_cierre_puesto: { findMany: async () => [] } };
        assert.deepEqual(await aperturaCierrePuestoForm.loadRecords(db, [1], { firmas: true }), []);
    });
    it("muestra COMPLETA para Guardify: todas las claves con valor", () => {
        const full = {
            ...raw,
            actividades: JSON.stringify([
                { pregunta: "Presentese al lugar", respuesta: "Ok", observaciones: "Sin novedad" },
                { pregunta: "Tome posesión de la(s) caseta(s)", respuesta: "N/A", observaciones: "No hay caseta" },
            ]),
            firma_representante_cliente: SAMPLE_PNG, firma_representante_empresa_saliente: SAMPLE_PNG, firma_representante_empresa_entrante: SAMPLE_PNG,
        };
        const r = armarRegistro(full, ubic, true, { codigo: "P140", nombre: "Portón" });
        assert.deepEqual(r.firmasPresentes.sort(), ["firma_cliente", "firma_entrante", "firma_saliente"]);
        writeFormSample("apertura-cierre-de-puesto", [r]);
    });
});
