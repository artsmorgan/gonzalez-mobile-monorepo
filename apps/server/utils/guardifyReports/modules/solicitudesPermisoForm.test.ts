import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, cargarAdjuntoPermiso, diasPermiso, firmaImagen, mimeAdjunto, solicitudesPermisoForm, tipoPermiso } from "./solicitudesPermisoForm";

const FIRMA = "data:image/png;base64,iVBORw0KGgo" + "A".repeat(300);
const raw = {
    id: 31, created_at: new Date("2026-04-20T08:12:30Z"), created_by: 9, empleado_id: 5, tipo: "Con goce", estado: "pendiente",
    fecha_inicio: new Date("2026-04-22T00:00:00Z"), fecha_fin: new Date("2026-04-24T00:00:00Z"),
    motivo: "Cita médica", observaciones: "Presenta comprobante",
    turnos: JSON.stringify([
        { plaza_id: 7, fecha: "2026-04-22", hora_inicio: "06:00", hora_fin: "14:00", tipo_turno: "Diurno", reemplazo_id: 8 },
        { plaza_id: 7, fecha: "2026-04-23T00:00:00.000Z", hora_inicio: "22:00:00", hora_fin: "6:00", tipo_turno: "nocturno", reemplazo_id: null },
    ]),
    firma_empleado_manual: FIRMA.replace("data:image/png;base64,", ""), // el móvil la guarda sin el prefijo
    firma_ejecutivo_cuenta_manual: null, firma_responsable: "aGFzaC1kZS1sYS1maXJtYS1kaWdpdGFs", firma_ejecutivo_cuenta_digital: "otro-hash",
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, isActive: true,
    c_empleado: { codigo: "E-100", cedula: "1-1111-1111", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Mora" },
};
const reemplazos = new Map<number, any>([[8, { id: 8, codigo: "E-200", nombre: "Luis", primer_apellido: "Vega", segundo_apellido: null }]]);
const archivos = [
    { id: 70, solicitud_id: 31, name: "1713600000-dictamen.pdf", original_name: "Dictamen médico.pdf", type: "file", extension: "pdf" },
    { id: 71, solicitud_id: 31, name: "1713600001-foto.JPG", original_name: "", type: "image", extension: "JPG" },
    { id: 72, solicitud_id: 31, name: "nota.m4a", original_name: "Nota de voz", type: "audio", extension: "zzz" },
];
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("solicitud de permisos como formulario", () => {
    it("arma lo que imprime el generador individual", () => {
        const r = armarRegistro(raw, ubic, false);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-04-20T08:12:30");
        assert.deepEqual(r.valores, {
            fecha: "2026-04-20", nombre_colaborador: "Ana Soto Mora", codigo_colaborador: "E-100", permiso_con_goce: "Sí", permiso_sin_goce: "No",
            motivo: "Cita médica", cantidad_dias: 2, fechas_permiso: "Del: 2026-04-22 — 2026-04-24", observaciones: "Presenta comprobante",
            cedula_colaborador: "1-1111-1111", tipo_permiso: "Con goce de salario", fecha_creacion: "2026-04-20T08:12:30",
            fecha_desde: "2026-04-22", fecha_hasta: "2026-04-24", dias_permiso: 3, cantidad_turnos: 2,
        });
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("la lista de turnos: fecha, horario «HH:mm – HH:mm», tipo y reemplazo «código - nombre»", () => {
        const r = armarRegistro(raw, ubic, false, { reemplazos });
        assert.deepEqual(r.listas.turnos, [
            { fecha: "2026-04-22", horario: "06:00 – 14:00", tipo: "Diurno", reemplazo: "E-200 - Luis Vega" },
            { fecha: "2026-04-23", horario: "22:00 – 06:00", tipo: "Nocturno", reemplazo: null },
        ]);
        const raro = armarRegistro({ ...raw, turnos: JSON.stringify([{ hora_inicio: "06:00", tipo_turno: "especial", reemplazo_id: 99 }]) }, ubic, false, { reemplazos });
        assert.deepEqual(raro.listas.turnos, [{ fecha: null, horario: null, tipo: "Especial", reemplazo: null }]);
        assert.deepEqual(armarRegistro({ ...raw, turnos: "no es json" }, ubic, false).listas.turnos, []);
    });
    it("los adjuntos del registro: id como texto, nombre original (o el guardado), MIME por extensión y sin tamaño", () => {
        const r = armarRegistro(raw, ubic, false, { archivos });
        assert.deepEqual(r.adjuntos, [
            { id: "70", nombre: "Dictamen médico.pdf", tipo: "application/pdf", bytes: null },
            { id: "71", nombre: "1713600001-foto.JPG", tipo: "image/jpeg", bytes: null },
            { id: "72", nombre: "Nota de voz", tipo: null, bytes: null },
        ]);
        assert.deepEqual(armarRegistro(raw, ubic, false).adjuntos, []);
        assert.equal(mimeAdjunto("m4a"), "audio/mp4");
        assert.equal(mimeAdjunto("", "mp3"), "audio/mpeg");
        assert.equal(mimeAdjunto("docx", "file"), null);
    });
    it("tipo de permiso y días: misma regla que la lista", () => {
        assert.equal(tipoPermiso("SIN GOCE"), "Sin goce de salario");
        assert.equal(tipoPermiso("otro"), null);
        assert.equal(diasPermiso({ fecha_inicio: new Date("2026-04-22T00:00:00Z"), fecha_fin: new Date("2026-04-22T17:00:00Z") }), 1);
        assert.equal(diasPermiso({ fecha_inicio: new Date("2026-04-28T00:00:00Z"), fecha_fin: new Date("2026-05-02T00:00:00Z") }), 5);
        assert.equal(diasPermiso({ fecha_inicio: new Date("2026-04-24T00:00:00Z"), fecha_fin: new Date("2026-04-22T00:00:00Z") }), 0);
        assert.equal(diasPermiso({ fecha_inicio: new Date("2026-04-24T00:00:00Z"), fecha_fin: null }), null);
        assert.equal(diasPermiso({ dias_permiso: 4, fecha_inicio: null }), 4);
    });
    it("sin goce, sin turnos ni empleado: vacíos en vez de inventar", () => {
        const r = armarRegistro({ ...raw, tipo: "Sin goce", turnos: "no es json", c_empleado: undefined, motivo: " ", observaciones: null, fecha_fin: null }, ubic, false);
        assert.equal(r.valores.permiso_con_goce, "No");
        assert.equal(r.valores.permiso_sin_goce, "Sí");
        assert.equal(r.valores.cantidad_dias, 0);
        assert.equal(r.valores.nombre_colaborador, null);
        assert.equal(r.valores.motivo, null);
        assert.equal(r.valores.fechas_permiso, "Del: 2026-04-22");
        assert.equal(r.valores.tipo_permiso, "Sin goce de salario");
        assert.equal(r.valores.cedula_colaborador, null);
        assert.equal(r.valores.cantidad_turnos, 0);
        assert.equal(r.valores.dias_permiso, null);
        assert.equal(r.valores.fecha_hasta, null);
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
                c_empleado: t("emp", [{ id: 5, codigo: "E-100", cedula: "1-1111-1111", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Mora" }, { id: 8, codigo: "E-200", nombre: "Luis", primer_apellido: "Vega" }]),
                c_archivos_solicitud_permiso: t("arch", archivos),
                e_estructura_empresa: t("empr", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
                e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato", division_id: 3 }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
            };
            const out = await solicitudesPermisoForm.loadRecords(db, Array.from({ length: n }, (_, i) => 31 + i), { firmas: false });
            return { out, calls };
        };
        const a = await run(2), b = await run(6);
        assert.equal(a.out.length, 2);
        assert.equal(a.out[0]!.valores.nombre_colaborador, "Ana Soto Mora");
        assert.equal(a.out[0]!.valores.cedula_colaborador, "1-1111-1111");
        assert.equal(a.out[0]!.listas.turnos![0]!.reemplazo, "E-200 - Luis Vega");
        assert.deepEqual(a.out[0]!.adjuntos!.map((x) => x.id), ["70", "71", "72"]);
        assert.deepEqual(a.out[1]!.adjuntos, []);
        // empleados y reemplazos en UNA consulta a c_empleado; archivos en una
        assert.equal(a.calls.filter((c) => c.startsWith("emp:")).length, 1);
        assert.ok(a.calls.some((c) => c.startsWith("emp:") && c.includes("8")));
        assert.equal(a.calls.filter((c) => c.startsWith("arch:")).length, 1);
        assert.equal(a.out[0]!.estructura.puesto, "P1 - Puesto");
        assert.equal(a.out[0]!.estructura.division, "Seguridad");
        assert.ok(a.calls[0]!.includes('"isActive":true'));
        assert.equal(a.calls.length, b.calls.length, "las consultas no crecen con el número de registros");
    });
    it("división de la cabecera en 0: sale la del contrato", async () => {
        const t = (rows: any[]) => ({ findMany: async () => rows });
        const db: any = {
            c_solicitud_permiso: t([{ ...raw, division_id: 0 }]), c_empleado: t([]), c_archivos_solicitud_permiso: t([]),
            e_estructura_empresa: t([]), e_estructura_cliente: t([]), n_division: t([{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t([{ id: 4, nro_contrato: "C1", nombre: "Contrato", division_id: 3 }]), e_estructura_sucursal: t([]), e_estructura_puesto: t([]),
        };
        const [r] = await solicitudesPermisoForm.loadRecords(db, [31], { firmas: false });
        assert.equal(r!.estructura.division, "Seguridad");
    });
    it("escribe la muestra COMPLETA para Guardify", () => {
        const r = armarRegistro({ ...raw, firma_ejecutivo_cuenta_manual: SAMPLE_PNG, firma_empleado_manual: SAMPLE_PNG }, ubic, true, { reemplazos, archivos });
        writeFormSample("solicitudes-de-permiso", [r]);
        assert.deepEqual(r.firmasPresentes.sort(), ["firma_colaborador", "firma_ejecutivo"]);
    });
});

describe("solicitud de permisos: un adjunto", () => {
    const sols = [{ ...raw, id: 31, isActive: true }, { ...raw, id: 32, isActive: false }];
    const arch = [...archivos, { id: 80, solicitud_id: 40, name: "otro.pdf", original_name: "De otra solicitud.pdf", type: "file", extension: "pdf" }];
    const match = (row: any, where: any) => Object.entries(where).every(([k, v]) => row[k] === v);
    const db: any = {
        c_solicitud_permiso: { findMany: async (a: any) => sols.filter((r) => match(r, a.where)) },
        c_archivos_solicitud_permiso: { findMany: async (a: any) => arch.filter((r) => match(r, a.where)) },
    };
    const pedidos: string[] = [];
    const fetchFile = async (p: string) => { pedidos.push(p); return p.endsWith("falta.pdf") ? null : { bytes: new TextEncoder().encode("%PDF"), contentType: "application/octet-stream" }; };
    it("baja el archivo con la misma ruta que la app y entrega la ubicación del registro", async () => {
        const f = await cargarAdjuntoPermiso(db, 31, "70", fetchFile);
        assert.ok(f);
        assert.equal(pedidos.at(-1), "permit-request/31/1713600000-dictamen.pdf");
        assert.equal(f!.contentType, "application/pdf");
        assert.equal(f!.nombre, "Dictamen médico.pdf");
        assert.deepEqual(f!.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
        const sinMime = await cargarAdjuntoPermiso(db, 31, "72", fetchFile);
        assert.equal(sinMime!.contentType, "application/octet-stream");
    });
    it("el adjunto debe ser de ESA solicitud, la solicitud activa y el archivo existir", async () => {
        const antes = pedidos.length;
        assert.equal(await cargarAdjuntoPermiso(db, 31, "80", fetchFile), null); // es de la solicitud 40
        assert.equal(await cargarAdjuntoPermiso(db, 32, "70", fetchFile), null); // inactiva
        assert.equal(await cargarAdjuntoPermiso(db, 99, "70", fetchFile), null);
        assert.equal(await cargarAdjuntoPermiso(db, 31, "abc", fetchFile), null);
        assert.equal(await cargarAdjuntoPermiso(db, 31, "70"), null); // sin forma de bajar archivos
        assert.equal(pedidos.length, antes, "no se baja nada si el adjunto no corresponde");
        arch.push({ id: 90, solicitud_id: 31, name: "falta.pdf", original_name: "Falta.pdf", type: "file", extension: "pdf" });
        assert.equal(await cargarAdjuntoPermiso(db, 31, "90", fetchFile), null);
    });
    it("el módulo declara loadAttachment", () => {
        assert.equal(typeof solicitudesPermisoForm.loadAttachment, "function");
    });
});
