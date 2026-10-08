import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample } from "../formSamples";
import { armarRegistro, incidentesForm } from "./incidentesForm";

const raw = {
    id: 12, created_at: new Date("2026-09-10T14:30:05Z"), empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    ejecutivo_cuenta: 3, fecha_incidente: new Date("2026-09-09T00:00:00Z"), fecha_reporte: new Date("2026-09-10T00:00:00Z"),
    nombre_responsable: "Ana Soto", clasificacion: 3, n_clasificacion_incidente: { id: 3, nombre: "Robo" },
    descripcion: "Se reporta el faltante de un equipo.", estado: true, nombre_responsable_atencion: "Luis Mora",
    involucrados: JSON.stringify([{ nombre: "Pedro Rojas", codigo: "E1" }, { nombre: "Juan Mora", codigo: "E2" }, { nombre: "", codigo: "" }]),
    fecha_libro_novedades: JSON.stringify([{ numero: "45", fecha: "2026-09-09" }]),
    solucion: "Se repuso el equipo.", fecha_solucion: new Date("2026-09-12T00:00:00Z"), fecha_real_solucion: new Date("2026-09-13T00:00:00Z"),
    costo_asociado: "₡15000", consecutivo_informe: "INF-2026-009", link_informe: "https://secreto/informe.pdf",
    c_contribucion_incidente: [
        { id: 2, empleado_id: 7, rol_aporte: "Supervisor", nombre_aporte: null, aporte: "Segundo aporte", created_at: new Date("2026-09-11T10:00:00Z"), firma_aporte_tercero: null },
        { id: 1, empleado_id: 8, rol_aporte: "Tercero", nombre_aporte: "Carlos Vega", aporte: "Primer aporte", created_at: new Date("2026-09-10T16:00:00Z"), firma_aporte_tercero: "data:image/png;base64,AAAA" },
    ],
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };
const empleados = new Map([[7, "Eva Chaves"], [8, "Marta Solís"]]);

describe("incidentes como formulario", () => {
    it("arma el registro: valores legibles, listas planas y sin enlace ni firmas", () => {
        const r = armarRegistro(raw, ubic, true, { ejecutivo: "Eva Ruiz", empleados });
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-09-10T14:30:05");
        assert.equal(r.valores.numero, 12);
        assert.equal(r.valores.fecha_incidente, "2026-09-09");
        assert.equal(r.valores.fecha_real_solucion, "2026-09-13");
        assert.equal(r.valores.clasificacion, "Robo");
        assert.equal(r.valores.estado, "Solucionado");
        assert.equal(r.valores.ejecutivo_cuenta, "Eva Ruiz");
        assert.equal("link_informe" in r.valores, false);
        assert.deepEqual(r.listas.involucrados, [{ nombre: "Pedro Rojas", codigo: "E1" }, { nombre: "Juan Mora", codigo: "E2" }]);
        assert.deepEqual(r.listas.novedades, [{ numero: "45", fecha: "2026-09-09" }]);
        // aportes en orden cronológico, con el nombre del empleado y solo si traen firma (nunca la imagen)
        assert.deepEqual(r.listas.aportes.map((a) => [a.aporte, a.empleado, a.firma]), [["Primer aporte", "Marta Solís", "Sí"], ["Segundo aporte", "Eva Chaves", "No"]]);
        assert.ok(!JSON.stringify(r).includes("AAAA"));
        assert.deepEqual(r.firmas, {});
        assert.deepEqual(r.firmasPresentes, []);
        assert.deepEqual(r.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
    });
    it("tolera datos vacíos o JSON roto", () => {
        const r = armarRegistro({ ...raw, involucrados: "no es json", fecha_libro_novedades: null, c_contribucion_incidente: undefined, estado: false, solucion: "  ", fecha_solucion: null }, ubic, false);
        assert.deepEqual(r.listas, { involucrados: [], novedades: [], aportes: [] });
        assert.equal(r.valores.estado, "No solucionado");
        assert.equal(r.valores.solucion, null);
        assert.equal(r.valores.fecha_solucion, null);
    });
    it("carga en lote: una consulta de incidentes, una por nivel de estructura, ejecutivos y empleados", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_incidente: t("inc", [raw, { ...raw, id: 13 }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
            n_ejecutivo_cuenta: t("eje", [{ id: 3, nombre: "Eva Ruiz" }]),
            c_empleado: t("empl", [{ id: 7, nombre: "Eva", primer_apellido: "Chaves" }, { id: 8, nombre: "Marta", primer_apellido: "Solís" }]),
        };
        const out = await incidentesForm.loadRecords(db, [12, 13], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [12, 13]);
        assert.equal(out[0]!.estructura.puesto, "P140 - Portón");
        assert.equal(out[0]!.valores.ejecutivo_cuenta, "Eva Ruiz");
        assert.equal(out[0]!.listas.aportes[0]!.empleado, "Marta Solís");
        assert.equal(calls.length, 9);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
    it("muestra completa para Guardify", () => {
        // Completa: todos los aportes con nombre y firma, para que cualquier clave mal escrita en la definición se note.
        const completo = { ...raw, c_contribucion_incidente: raw.c_contribucion_incidente.map((a) => ({ ...a, nombre_aporte: a.nombre_aporte ?? "Nombre del aporte", firma_aporte_tercero: "data:image/png;base64,AAAA" })) };
        const r = armarRegistro(completo, ubic, true, { ejecutivo: "Eva Ruiz", empleados });
        writeFormSample("registro-de-incidentes", [r]);
    });
});
