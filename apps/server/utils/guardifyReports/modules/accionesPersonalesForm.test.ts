import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample } from "../formSamples";
import { accionesPersonalesForm, armarRegistro } from "./accionesPersonalesForm";

// Fila como la deja `select: COLS`; la tabla guarda ids y el módulo de lista resuelve los nombres en lote.
const raw = {
    id: 81, empleado_id: 5, reemplazo_id: 6, tipoAccion_id: 2, empresa_id: 1, cliente_id: 2, contrato_id: 4, corpo_id: 5, puesto_id: 6, plaza_id: 7, horario_id: 8,
    consecutivo: "AP-2026-0412", usuario_insercion: "9", fecha_inicio: new Date("2026-04-20T00:00:00Z"), fecha_fin: new Date("2026-04-22T00:00:00Z"),
    fecha_insercion: new Date("2026-04-19T14:35:10Z"), comentarios: "Cubre incapacidad", document: "adjuntos/ap-412-secreto.pdf", reversible: true, estado_aprobacion: "APR", cantidad_horas: 8,
    // Lo que la tabla guarda pero la función NUNCA debe dejar pasar, aunque llegara en la fila:
    salario: "850000.00", salario_base_mensual: "900000.00", usuario_aprueba_ec: "jefe1", usuario_reversion: "x",
};
const lookups = {
    empleados: new Map<number, any>([[5, { id: 5, codigo: "E-100", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Mora", cedula: "1-0555-0666" }], [6, { id: 6, codigo: "E-101", nombre: "Luis", primer_apellido: "Rojas", segundo_apellido: null, cedula: "2-0111-0222" }]]),
    tipos: new Map<number, any>([[2, { id: 2, codigo: "AUS", nombre: "Ausencia" }]]),
    plazas: new Map<number, any>([[7, { id: 7, codigo_plaza: "PZ-12", nombre: "Oficial 1" }]]),
    horarios: new Map<number, any>([[8, { id: 8, titulo: "Diurno 6-14" }]]),
    usuarios: new Map<number, string>([[9, "Marta Quesada"]]),
};
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("acción de personal como formulario", () => {
    it("arma los valores con los mismos datos que el módulo de lista", () => {
        const r = armarRegistro(raw, ubic, false, lookups, 3);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-04-19T14:35:10");
        assert.deepEqual(r.valores, {
            consecutivo: "AP-2026-0412", tipo_accion: "AUS — Ausencia", estado_aprobacion: "APR", fecha_inicio: "2026-04-20", fecha_fin: "2026-04-22", cantidad_horas: 8, reversible: "Sí",
            empleado: "E-100 - Ana Soto Mora", cedula: "1-0555-0666", reemplazo: "Luis Rojas", horario: "Diurno 6-14", plaza: "PZ-12 - Oficial 1", comentarios: "Cubre incapacidad",
            adjunto: "Sí", registrada: "2026-04-19 14:35", registrada_por: "Marta Quesada",
        });
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("nunca salen salarios, montos, usuarios de aprobación ni la ruta del adjunto", () => {
        const s = JSON.stringify(armarRegistro(raw, ubic, true, lookups, 3));
        for (const prohibido of ["850000", "900000", "jefe1", "secreto", "adjuntos/"]) assert.ok(!s.includes(prohibido), prohibido);
    });
    it("sin firmas: la tabla no las guarda", () => {
        const r = armarRegistro(raw, ubic, true, lookups, 3);
        assert.deepEqual(r.firmas, {});
        assert.deepEqual(r.firmasPresentes, []);
    });
    it("campos vacíos quedan en null, sin inventar (sin fin, sin reemplazo, sin adjunto, usuario como texto)", () => {
        const r = armarRegistro({ ...raw, fecha_fin: null, reemplazo_id: null, document: " ", reversible: null, cantidad_horas: null, comentarios: "", usuario_insercion: "jperez", estado_aprobacion: null, horario_id: null }, ubic, false, lookups, null);
        assert.equal(r.valores.fecha_fin, null);
        assert.equal(r.valores.reemplazo, null);
        assert.equal(r.valores.adjunto, "No");
        assert.equal(r.valores.reversible, null);
        assert.equal(r.valores.cantidad_horas, null);
        assert.equal(r.valores.comentarios, null);
        assert.equal(r.valores.registrada_por, "jperez");
        assert.equal(r.valores.estado_aprobacion, null);
        assert.equal(r.valores.horario, null);
        assert.equal(r.hier.division, null);
    });
    it("carga en lote: una consulta por tabla (no por registro), con las mismas columnas seguras del módulo de lista", async () => {
        const run = async (n: number) => {
            const calls: string[] = [];
            const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); (t as any).last = a; return rows; } });
            let selectUsado: any;
            const db: any = {
                c_accion_personal: { findMany: async (a: any) => { selectUsado = a.select; calls.push("acc"); return Array.from({ length: n }, (_, i) => ({ ...raw, id: 81 + i })); } },
                c_empleado: t("emp", [...lookups.empleados.values(), { id: 9, nombre: "Marta", primer_apellido: "Quesada", segundo_apellido: null }]),
                c_tipo_accion: t("tip", [...lookups.tipos.values()]), e_estructura_plazas: t("plz", [...lookups.plazas.values()]), c_horario: t("hor", [...lookups.horarios.values()]),
                e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato", division_id: 3 }]),
                e_estructura_empresa: t("empr", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
                e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
            };
            const out = await accionesPersonalesForm.loadRecords(db, Array.from({ length: n }, (_, i) => 81 + i), { firmas: false });
            return { out, calls, selectUsado };
        };
        const a = await run(2), b = await run(7);
        assert.equal(a.out.length, 2);
        assert.equal(a.out[0]!.valores.empleado, "E-100 - Ana Soto Mora");
        assert.equal(a.out[0]!.valores.registrada_por, "Marta Quesada");
        assert.equal(a.out[0]!.estructura.division, "Seguridad");
        assert.deepEqual(a.out[0]!.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
        assert.equal(a.calls.length, b.calls.length, "las consultas no crecen con el número de registros");
        for (const prohibido of ["salario", "salario_base_mensual", "usuario_aprueba_ec", "usuario_reversion", "monto_descontar_turnos"]) assert.equal(prohibido in a.selectUsado, false, prohibido);
    });
    it("escribe la muestra COMPLETA para Guardify", () => {
        const r = armarRegistro(raw, ubic, true, lookups, 3);
        writeFormSample("acciones-de-personal", [r]);
        assert.ok(Object.values(r.valores).every((v) => v !== null && v !== ""));
    });
});
