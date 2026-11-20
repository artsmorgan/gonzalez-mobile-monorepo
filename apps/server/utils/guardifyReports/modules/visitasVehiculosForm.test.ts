import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample } from "../formSamples";
import { armarRegistro, personaLugar, visitasVehiculosForm } from "./visitasVehiculosForm";

const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };
const raw = {
    id: 9, hora_entrada: new Date("2026-09-12T14:05:00Z"), hora_salida: new Date("2026-09-12T15:30:00Z"), created_at: new Date("2026-09-12T14:06:10Z"),
    placa: "ABC-123", nombre: "Pedro Gómez", razon_visita: "Entrega de insumos", persona_visita: "Carlos", departamento_visita: "Bodega", responsable: "Ana Mora",
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
};

describe("visitas de vehículos como formulario", () => {
    it("persona o lugar que visita: persona / departamento, o la razón si no hay", () => {
        assert.equal(personaLugar(raw), "Carlos / Bodega");
        assert.equal(personaLugar({ ...raw, persona_visita: null }), "Bodega");
        assert.equal(personaLugar({ ...raw, persona_visita: "", departamento_visita: " " }), "Entrega de insumos");
        assert.equal(personaLugar({}), null);
    });
    it("arma una fila de la bitácora con horas HH:mm y sin cédula ni archivo", () => {
        const r = armarRegistro({ ...raw, cedula: "2-0111-0222", file_name: "/uploads/foto.jpg" }, ubic, true);
        assert.equal(r.variante, null);
        assert.equal(r.valores.fecha, "2026-09-12");
        assert.deepEqual(r.listas.ingresos, [{ placa: "ABC-123", visitante: "Pedro Gómez", hora_entrada: "14:05", hora_salida: "15:30", oficial: "Ana Mora", visita: "Carlos / Bodega" }]);
        assert.ok(!JSON.stringify(r).includes("2-0111") && !JSON.stringify(r).includes("foto.jpg"));
        assert.deepEqual([r.firmas, r.firmasPresentes], [{}, []]);
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("una visita que todavía no sale queda con la salida vacía", () => {
        const r = armarRegistro({ ...raw, hora_salida: null }, ubic, false);
        assert.equal(r.listas.ingresos[0]!.hora_salida, null);
    });
    it("carga en lote: una consulta de registros, una de empleados y una por nivel de estructura; solo activos y sin file_name", async () => {
        const calls: { name: string; args: any }[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push({ name, args: a }); return rows; } });
        const db: any = {
            e_registro_vehiculos: t("reg", [{ ...raw, responsable_id: 20 }, { ...raw, id: 10, responsable_id: 20 }]),
            c_empleado: t("emp", [{ id: 20, nombre: "Ana", primer_apellido: "Mora", segundo_apellido: null }]),
            e_estructura_empresa: t("e", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await visitasVehiculosForm.loadRecords(db, [9, 10], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [9, 10]);
        assert.equal(out[0]!.listas.ingresos[0]!.oficial, "Ana Mora");
        assert.equal(out[0]!.estructura.puesto, "P1 - Puesto");
        assert.equal(calls.length, 8);
        assert.equal(calls[0]!.args.where.isActive, true);
        assert.ok(!("file_name" in calls[0]!.args.select) && !("cedula" in calls[0]!.args.select));
    });
    it("muestra completa para Guardify", () => {
        const { hier: _h, ...rec } = armarRegistro(raw, ubic, true);
        writeFormSample("visitas-de-vehiculos", [rec]);
    });
});
