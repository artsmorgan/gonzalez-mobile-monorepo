import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { armarRegistro, estadoLegible, revisionVehiculosForm, varianteDe } from "./revisionVehiculosForm";

const FIRMA = "data:image/png;base64," + "A".repeat(300);
const raw = {
    id: 7, tipo: "bicicleta", created_at: new Date("2026-04-20T08:12:30Z"), empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, sucursal_id: 5, puesto_id: 6,
    informacion_general: JSON.stringify([
        { key: "nombre_oficial_corporacion", label: "Nombre oficial", value: "Ana Soto" },
        { key: "firma_oficial_corporacion", kind: "signature", value: FIRMA },
        { key: "numero_placa", value: "BCI-204" },
        { key: "foto_suelta", value: FIRMA }, // una imagen que no es firma no se entrega
        { key: "encabezado", kind: "heading", value: "x" },
    ]),
    informacion_revision: JSON.stringify([{ key: "rev_llantas", label: "Llantas", value: "bueno", observation: "Desgaste leve" }, { key: "rev_foco", label: "Foco", value: "No existe" }, { key: "llaves", label: "Llaves", value: "Sí" }, { key: "funciona_motor", label: "¿Funciona el motor?", value: "No" }, { kind: "heading", label: "Parte delantera" }]),
    movimientos_vehiculos: JSON.stringify([{ movimiento: "Ingreso a taller", fecha: "20/04/26", hora: "09:30", realizado_por: "M. Vargas", autorizado_por: "R. Quesada" }]),
    observaciones: "Se retira para cambio de cable.", firma_responsable: "",
};
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("revisión de vehículos como formulario", () => {
    it("normaliza el tipo y los estados", () => {
        assert.equal(varianteDe("bicicleta"), "Bicicleta");
        assert.equal(varianteDe("Motocicleta"), "Motocicleta");
        assert.equal(varianteDe("Vehículo"), "Vehículo");
        assert.equal(varianteDe("vehiculo"), "Vehículo");
        assert.equal(varianteDe("Otro"), "Otro");
        assert.equal(estadoLegible("No existe"), "No está");
        assert.equal(estadoLegible("MALO"), "Malo");
        assert.equal(estadoLegible(""), null);
    });
    it("arma el registro sin firmas por defecto, pero dice cuáles tiene", () => {
        const r = armarRegistro(raw, ubic, false);
        assert.equal(r.variante, "Bicicleta");
        assert.equal(r.valores.numero_placa, "BCI-204");
        assert.equal("foto_suelta" in r.valores, false);
        assert.equal("encabezado" in r.valores, false);
        assert.deepEqual(r.firmas, { firma_oficial_corporacion: null });
        assert.deepEqual(r.firmasPresentes, ["firma_oficial_corporacion"]);
        assert.equal(r.valores.cliente, "CCSS"); // de la estructura si el formulario no lo trae
        assert.equal(r.valores.fecha, "2026-04-20");
        assert.equal(r.valores.hora, "08:12");
        assert.deepEqual(r.listas.revision, [
            { clave: "rev_llantas", item: "Llantas", valor: "Bueno", observacion: "Desgaste leve" },
            { clave: "rev_foco", item: "Foco", valor: "No está", observacion: null },
        ]);
        // Datos sueltos que el móvil guarda dentro de la revisión: son campos del papel, no ítems de la lista.
        assert.equal(r.valores.llaves, "Sí");
        assert.equal(r.valores.funciona_motor, "No");
        assert.equal(r.listas.revision.some((e) => e.clave === "llaves" || e.clave === "funciona_motor"), false);
        assert.deepEqual(r.listas.movimientos[0], { movimiento: "Ingreso a taller", fecha: "20/04/26", hora: "09:30", realizado_por: "M. Vargas", autorizado_por: "R. Quesada" });
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("la firma digital del móvil (sesión y GPS en base64) no es imagen: no se entrega ni se cuenta", () => {
        const digital = Buffer.from("sesion-abc:12345:9.9348:-84.0877:1760000000000").toString("base64").repeat(6);
        const r = armarRegistro({ ...raw, firma_responsable: digital }, ubic, true);
        assert.equal("firma_responsable" in r.firmas, false);
        assert.equal(r.firmasPresentes.includes("firma_responsable"), false);
    });
    it("con firmas=1 entrega la imagen", () => {
        assert.equal(armarRegistro(raw, ubic, true).firmas.firma_oficial_corporacion, FIRMA);
    });
    it("carga en lote: una consulta de registros y una por nivel de estructura, solo activos", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_bitacora_vehiculo_detenido: t("bit", [raw, { ...raw, id: 8, tipo: "Motocicleta" }]),
            e_estructura_empresa: t("emp", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await revisionVehiculosForm.loadRecords(db, [7, 8], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.variante]), [[7, "Bicicleta"], [8, "Motocicleta"]]);
        assert.equal(out[0]!.estructura.puesto, "P1 - Puesto");
        assert.equal(calls.length, 7);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
});
