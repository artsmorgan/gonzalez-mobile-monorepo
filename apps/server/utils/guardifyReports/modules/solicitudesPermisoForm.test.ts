import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, firmaImagen, solicitudesPermisoForm } from "./solicitudesPermisoForm";

const FIRMA = "data:image/png;base64,iVBORw0KGgo" + "A".repeat(300);
const raw = {
    id: 31, created_at: new Date("2026-04-20T08:12:30Z"), created_by: 9, empleado_id: 5, tipo: "Con goce", estado: "pendiente",
    fecha_inicio: new Date("2026-04-22T00:00:00Z"), fecha_fin: new Date("2026-04-24T00:00:00Z"),
    motivo: "Cita médica", observaciones: "Presenta comprobante",
    turnos: JSON.stringify([{ puesto: "P1", hora_inicio: "06:00", hora_fin: "14:00", tipo_turno: "Diurno" }, { puesto: "P1", hora_inicio: "06:00", hora_fin: "14:00", tipo_turno: "Diurno" }]),
    firma_empleado_manual: FIRMA.replace("data:image/png;base64,", ""), // el móvil la guarda sin el prefijo
    firma_ejecutivo_cuenta_manual: null, firma_responsable: "aGFzaC1kZS1sYS1maXJtYS1kaWdpdGFs", firma_ejecutivo_cuenta_digital: "otro-hash",
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, isActive: true,
    c_empleado: { codigo: "E-100", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Mora" },
};
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("solicitud de permisos como formulario", () => {
    it("arma lo que imprime el generador individual", () => {
        const r = armarRegistro(raw, ubic, false);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-04-20T08:12:30");
        assert.deepEqual(r.valores, {
            fecha: "2026-04-20", nombre_colaborador: "Ana Soto Mora", codigo_colaborador: "E-100", permiso_con_goce: "Sí", permiso_sin_goce: "No",
            motivo: "Cita médica", cantidad_dias: 2, fechas_permiso: "Del: 2026-04-22 — 2026-04-24", observaciones: "Presenta comprobante",
        });
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("sin goce, sin turnos ni empleado: vacíos en vez de inventar", () => {
        const r = armarRegistro({ ...raw, tipo: "Sin goce", turnos: "no es json", c_empleado: undefined, motivo: " ", observaciones: null, fecha_fin: null }, ubic, false);
        assert.equal(r.valores.permiso_con_goce, "No");
        assert.equal(r.valores.permiso_sin_goce, "Sí");
        assert.equal(r.valores.cantidad_dias, 0);
        assert.equal(r.valores.nombre_colaborador, null);
        assert.equal(r.valores.motivo, null);
        assert.equal(r.valores.fechas_permiso, "Del: 2026-04-22");
    });
    it("las firmas: solo las manuales que son imagen; sin firmas=1 no viaja la imagen pero se dice cuáles hay", () => {
        const sin = armarRegistro(raw, ubic, false);
        assert.deepEqual(sin.firmas, { firma_colaborador: null });
        assert.deepEqual(sin.firmasPresentes, ["firma_colaborador"]);
        const con = armarRegistro({ ...raw, firma_ejecutivo_cuenta_manual: SAMPLE_PNG }, ubic, true);
        assert.equal(con.firmas.firma_colaborador, FIRMA);
        assert.equal(con.firmas.firma_ejecutivo, SAMPLE_PNG);
        // el hash de la firma digital nunca sale, ni como firma ni como valor
        assert.ok(!JSON.stringify(con).includes("aGFzaC1k"));
        assert.ok(!JSON.stringify(con).includes("otro-hash"));
    });
    it("firmaImagen no confunde un hash con una imagen", () => {
        assert.equal(firmaImagen("aGFzaC1kZS1sYS1maXJtYQ=="), null);
        assert.equal(firmaImagen(""), null);
        assert.equal(firmaImagen("/9j/4AAQ"), "data:image/jpeg;base64,/9j/4AAQ");
    });
    it("carga en lote: una consulta por tabla (no por registro) y solo activas", async () => {
        const run = async (n: number) => {
            const calls: string[] = [];
            const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
            const db: any = {
                c_solicitud_permiso: t("sol", Array.from({ length: n }, (_, i) => ({ ...raw, id: 31 + i }))),
                c_empleado: t("emp", [{ id: 5, codigo: "E-100", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Mora" }]),
                e_estructura_empresa: t("empr", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
                e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato", division_id: 3 }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
            };
            const out = await solicitudesPermisoForm.loadRecords(db, Array.from({ length: n }, (_, i) => 31 + i), { firmas: false });
            return { out, calls };
        };
        const a = await run(2), b = await run(6);
        assert.equal(a.out.length, 2);
        assert.equal(a.out[0]!.valores.nombre_colaborador, "Ana Soto Mora");
        assert.equal(a.out[0]!.estructura.puesto, "P1 - Puesto");
        assert.equal(a.out[0]!.estructura.division, "Seguridad");
        assert.ok(a.calls[0]!.includes('"isActive":true'));
        assert.equal(a.calls.length, b.calls.length, "las consultas no crecen con el número de registros");
    });
    it("división de la cabecera en 0: sale la del contrato", async () => {
        const t = (rows: any[]) => ({ findMany: async () => rows });
        const db: any = {
            c_solicitud_permiso: t([{ ...raw, division_id: 0 }]), c_empleado: t([]),
            e_estructura_empresa: t([]), e_estructura_cliente: t([]), n_division: t([{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t([{ id: 4, nro_contrato: "C1", nombre: "Contrato", division_id: 3 }]), e_estructura_sucursal: t([]), e_estructura_puesto: t([]),
        };
        const [r] = await solicitudesPermisoForm.loadRecords(db, [31], { firmas: false });
        assert.equal(r!.estructura.division, "Seguridad");
    });
    it("escribe la muestra COMPLETA para Guardify", () => {
        const r = armarRegistro({ ...raw, firma_ejecutivo_cuenta_manual: SAMPLE_PNG, firma_empleado_manual: SAMPLE_PNG }, ubic, true);
        writeFormSample("solicitudes-de-permiso", [r]);
        assert.deepEqual(r.firmasPresentes.sort(), ["firma_colaborador", "firma_ejecutivo"]);
    });
});
