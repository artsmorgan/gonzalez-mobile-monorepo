import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, diaMov, horaMov, llaverosForm } from "./llaverosForm";

const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };
const FIRMA = SAMPLE_PNG;
const DIGITAL = "c2Vzc2lvbjoxOjk6LTg0OjE3MDAwOjk5OTk5"; // sesión + empleado + GPS en base64: no es una imagen
const mov = (extra: Record<string, unknown> = {}) => ({
    id: 1, llavero_id: 5, nombre_persona_entrega: "Ana Mora", nombre_persona_recibe: "Luis Vega", departamento: "Mantenimiento", telefono: "8888-1111",
    fecha: new Date("2026-05-02T00:00:00Z"), hora: new Date("1970-01-01T09:30:00Z"), firma_entrega: FIRMA, firma_recibe: null, ...extra,
});
const llave = (extra: Record<string, unknown> = {}) => ({
    id: 5, numero_llavero: "LV-3", nombre_llavero: "Llavero principal", observaciones: "Se guarda en recepción", firma_responsable: DIGITAL,
    created_at: new Date("2026-05-01T10:00:00Z"), empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, movimientos: [mov()], ...extra,
});

describe("llaveros como formulario", () => {
    it("lee día y hora de un movimiento (fecha Date, hora Time en Date o texto)", () => {
        assert.equal(diaMov(mov()), "2026-05-02");
        assert.equal(horaMov(mov()), "09:30");
        assert.equal(horaMov({ hora: "14:05:00" }), "14:05");
        assert.equal(horaMov({ hora: "1970-01-01T23:59:00.000Z" }), "23:59");
        assert.equal(horaMov({ hora: null }), null);
    });
    it("arma el llavero con sus movimientos, pone la imagen de la firma de cada renglón y nunca la firma digital del responsable", () => {
        const r = armarRegistro(llave(), ubic, true);
        assert.deepEqual([r.variante, r.valores.numero_llavero, r.valores.nombre_llavero, r.valores.observaciones], [null, "LV-3", "Llavero principal", "Se guarda en recepción"]);
        assert.deepEqual(r.listas.movimientos, [{ entrega: "Ana Mora", recibe: "Luis Vega", departamento: "Mantenimiento", telefono: "8888-1111", dia: "2026-05-02", hora: "09:30", firma_entrega: FIRMA, firma_recibe: null }]);
        assert.deepEqual(r.firmas, { firma_responsable: null });
        assert.deepEqual(r.firmasPresentes, ["firma_responsable"]);
        assert.ok(!JSON.stringify(r).includes(DIGITAL));
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("firmas por renglón: imagen con firmas=1, «Firmada» sin pedirla, «Firmada» si no es imagen y vacía si no hay", () => {
        const movimientos = [mov({ firma_entrega: FIRMA, firma_recibe: SAMPLE_PNG.split(",")[1] }), mov({ firma_entrega: DIGITAL, firma_recibe: "   " }), mov({ firma_entrega: "/9j/4AAQSkZJRgABAQ==", firma_recibe: "A".repeat(400) })];
        const con = armarRegistro(llave({ movimientos }), ubic, true).listas.movimientos as any[];
        assert.deepEqual(con.map((m) => [m.firma_entrega, m.firma_recibe]), [[FIRMA, FIRMA], ["Firmada", null], ["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==", "Firmada"]]);
        const sin = armarRegistro(llave({ movimientos }), ubic, false);
        assert.deepEqual((sin.listas.movimientos as any[]).map((m) => [m.firma_entrega, m.firma_recibe]), [["Firmada", "Firmada"], ["Firmada", null], ["Firmada", "Firmada"]]);
        assert.ok(!JSON.stringify(sin).includes("data:image") && !JSON.stringify(sin).includes("iVBOR"));
        assert.ok(!JSON.stringify(con).includes(DIGITAL) && !JSON.stringify(sin).includes(DIGITAL));
    });
    it("un llavero sin movimientos ni firma de responsable", () => {
        const r = armarRegistro(llave({ movimientos: [], firma_responsable: "", observaciones: "" }), ubic, false);
        assert.deepEqual(r.listas.movimientos, []);
        assert.deepEqual([r.firmas, r.firmasPresentes, r.valores.observaciones], [{}, [], null]);
    });
    it("carga en lote: llaveros activos, una consulta de movimientos y una por nivel de estructura", async () => {
        const calls: { name: string; args: any }[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push({ name, args: a }); return rows; } });
        const { movimientos: _m, ...base } = llave();
        const db: any = {
            e_llavero: t("llavero", [base, { ...base, id: 6 }]),
            e_movimiento_llavero: t("mov", [mov(), mov({ id: 2, llavero_id: 6 }), mov({ id: 3, llavero_id: 6 })]),
            e_estructura_empresa: t("e", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await llaverosForm.loadRecords(db, [5, 6], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.listas.movimientos.length]), [[5, 1], [6, 2]]);
        assert.equal(out[0]!.estructura.sucursal, "S1 - Sede");
        assert.equal(calls.length, 8);
        assert.equal(calls[0]!.args.where.isActive, true);
        assert.ok(!("firma_responsable" in (calls.find((c) => c.name === "mov")!.args.select)));
    });
    it("muestra completa para Guardify (varios movimientos, todas las firmas)", () => {
        const movimientos = [1, 2, 3].map((i) => mov({ id: i, nombre_persona_entrega: `Entrega ${i}`, nombre_persona_recibe: `Recibe ${i}`, firma_recibe: FIRMA, hora: new Date(`1970-01-01T0${i}:15:00Z`) }));
        const { hier: _h, ...rec } = armarRegistro(llave({ movimientos }), ubic, true);
        writeFormSample("llaveros", [rec]);
    });
});
