import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, clasificarFirma, registroCapacitacionesForm } from "./registroCapacitacionesForm";

const DIGITAL = Buffer.from("sesion-1:20:9.93:-84.08:1788000000000").toString("base64");
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };
const raw = {
    id: 5, fecha: new Date("2026-09-03T00:00:00Z"), titulo: "Uso de extintores", descripcion: "Práctica con extintores de CO2 y polvo químico.", tipo: "Presencial", observaciones: "Sin novedades.",
    nombre_responsable: "Marta Rojas Vega", cedula_responsable: "1-1111-2222", responsable_label: "S-1 - Marta Rojas", firma_responsable: DIGITAL,
    file: "/uploads/cap/5/lista.pdf", resultado: null,
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empleados_cap: [{ id: 1, label: "A1 - Luis Vega Mora", cedula: "3-0111-0222", resultado: "Bueno" }, { id: 2, label: "A2 - Eva Soto Ruiz", cedula: "3-0333-0444", resultado: null }],
    puestos_cap: [{ id: 70, label: "P70 - Recepción", resultado: "Regular" }],
};

describe("registro de capacitaciones como formulario", () => {
    it("distingue una firma de imagen de la firma digital de la app", () => {
        assert.deepEqual(clasificarFirma(""), null);
        assert.deepEqual(clasificarFirma(SAMPLE_PNG), { imagen: SAMPLE_PNG });
        assert.equal(clasificarFirma("iVBORw0KGgoAAAANSUhEUg")!.imagen, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg");
        assert.deepEqual(clasificarFirma(DIGITAL), { imagen: null });
    });
    it("arma el registro: valores, listas y la firma digital (presente, sin imagen)", () => {
        const r = armarRegistro(raw, ubic, true);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-09-03T00:00:00");
        assert.equal(r.valores.fecha, "2026-09-03");
        assert.equal(r.valores.nombre_responsable, "Marta Rojas Vega");
        assert.deepEqual(r.listas.empleados[1], { empleado: "A2 - Eva Soto Ruiz", cedula: "3-0333-0444", resultado: null });
        assert.deepEqual(r.listas.puestos, [{ puesto: "P70 - Recepción", resultado: "Regular" }]);
        assert.deepEqual(r.firmasPresentes, ["firma_responsable"]);
        assert.deepEqual(r.firmas, { firma_responsable: null }); // la firma digital no es una imagen
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("el nombre del responsable cae al empleado de la sesión y las firmas de imagen solo salen con firmas=1", () => {
        const sinNombre = { ...raw, nombre_responsable: "", firma_responsable: SAMPLE_PNG };
        assert.equal(armarRegistro(sinNombre, ubic, false).valores.nombre_responsable, "S-1 - Marta Rojas");
        assert.deepEqual(armarRegistro(sinNombre, ubic, false).firmas, { firma_responsable: null });
        assert.deepEqual(armarRegistro(sinNombre, ubic, false).firmasPresentes, ["firma_responsable"]);
        assert.equal(armarRegistro(sinNombre, ubic, true).firmas.firma_responsable, SAMPLE_PNG);
        assert.deepEqual(armarRegistro({ ...raw, firma_responsable: "" }, ubic, true).firmasPresentes, []);
    });
    it("nunca entrega el archivo adjunto ni la firma en bruto", () => {
        const s = JSON.stringify(armarRegistro(raw, ubic, true));
        assert.ok(!s.includes("lista.pdf") && !s.includes(DIGITAL));
    });
    it("carga en lote: una consulta por tabla, solo activos, en el orden pedido y con la división del contrato", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const fila = (id: number, extra: any = {}) => ({ ...raw, id, empleados_cap: undefined, puestos_cap: undefined, responsable_id: 20, e_capacitacion_empleado: [{ empleado_id: 1, resultado: "Bueno" }, { empleado_id: 99, resultado: null }], e_capacitacion_puesto: [{ puesto_id: 70, resultado: "Malo" }], ...extra });
        const db: any = {
            e_registro_capacitaciones: t("cap", [fila(8), fila(7)]),
            c_empleado: t("emp", [{ id: 1, codigo: "A1", nombre: "Luis", primer_apellido: "Vega", segundo_apellido: "Mora", cedula: "3-0111-0222" }, { id: 20, codigo: "S-1", nombre: "Marta", primer_apellido: "Rojas", segundo_apellido: null, cedula: "1-1" }]),
            e_estructura_puesto: t("pue", [{ id: 70, codigo: "P70", nombre: "Recepción" }, { id: 6, codigo: "P1", nombre: "Puesto" }]),
            e_estructura_empresa: t("empr", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }, { id: 9, nombre: "Aseo" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato", division_id: 9 }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]),
        };
        const out = await registroCapacitacionesForm.loadRecords(db, [7, 8, 999], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [7, 8]);
        assert.ok(calls[0]!.includes('"isActive":true'));
        const n = (p: string) => calls.filter((c) => c.startsWith(p)).length;
        assert.equal(n("cap:"), 1);
        assert.equal(n("emp:"), 1);
        assert.equal(n("pue:"), 2); // los puestos de los vínculos y el puesto de la ubicación
        assert.equal(out[0]!.estructura.division, "Aseo"); // la del contrato manda sobre la de la cabecera
        assert.equal(out[0]!.estructura.puesto, "P1 - Puesto");
        assert.deepEqual(out[0]!.listas.empleados, [
            { empleado: "A1 - Luis Vega Mora", cedula: "3-0111-0222", resultado: "Bueno" },
            { empleado: "#99", cedula: null, resultado: null },
        ]);
        assert.deepEqual(out[0]!.listas.puestos, [{ puesto: "P70 - Recepción", resultado: "Malo" }]);
        assert.equal(out[0]!.valores.nombre_responsable, "Marta Rojas Vega");
    });
    it("no consulta nada más si no hay registros", async () => {
        const db: any = { e_registro_capacitaciones: { findMany: async () => [] } };
        assert.deepEqual(await registroCapacitacionesForm.loadRecords(db, [1], { firmas: true }), []);
    });
    it("muestra completa para Guardify (todos los campos, filas y firma)", () => {
        const completo = armarRegistro(
            {
                ...raw, firma_responsable: DIGITAL,
                empleados_cap: [
                    { id: 1, label: "A1 - Luis Vega Mora", cedula: "3-0111-0222", resultado: "Bueno" }, { id: 2, label: "A2 - Eva Soto Ruiz", cedula: "3-0333-0444", resultado: "Regular" },
                    { id: 3, label: "A3 - Pedro Mora Díaz", cedula: "3-0555-0666", resultado: "Malo" },
                ],
                puestos_cap: [{ id: 70, label: "P70 - Recepción", resultado: "Bueno" }, { id: 71, label: "P71 - Bodega", resultado: "Regular" }],
            },
            ubic, true,
        );
        writeFormSample("registro-de-capacitaciones", [completo]);
        assert.equal(completo.listas.empleados.length, 3);
    });
});
