import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, checklistSupervisionForm, filaDe, firmaImagen, hhmm, listasDeEvaluacion, varianteDe } from "./checklistSupervisionForm";

const FOTO = "data:image/png;base64," + "B".repeat(400);
const FIRMA = "data:image/png;base64," + "A".repeat(300);
// Entradas como las arma la pantalla móvil (ChecklistSupervisionScreen).
const foto = (id: string) => ({ id, type: "photo", title: "Foto", value: "", photos: [{ id: "p1", value: FOTO, file_name: "secreto.jpg" }], file_name: "secreto2.jpg" });
const select = (id: string, value: string, options: string[]) => ({ id, type: "select", value, options });
const check = (id: string, value: string) => ({ id, type: "checkbox", title: "Resultado", value });
const texto = (id: string, title: string | undefined, value: string, type = "text") => ({ id, type, ...(title ? { title } : {}), value });
const sub = (title: string, inputs: any[], detalle = "") => ({ id: `s-${title}`, title, inputs, detalle });
const sec = (id: string, title: string, subsections: any[]) => ({ id, title, isPredefined: true, subsections });

const seguridad = [
    sec("carnes", "Carnés", [
        // (La plantilla real no lleva fecha en el carné de la empresa; la muestra la trae para comprobar que la columna se llena.)
        sub("Carne de la empresa", [select("c0", "Bueno", ["Bueno", "Malo"]), { id: "c0d", type: "date", title: "Fecha de vencimiento", value: "2027-01-31" }, foto("f0")], "Plastificado"),
        sub("Carne de Portación de Armas", [select("c1", "Vigente", ["Vigente", "Vencido", "No aplica"]), { id: "c1d", type: "date", title: "Fecha de vencimiento", value: "2027-03-15T00:00:00.000Z" }, foto("f1")], "Al día"),
    ]),
    sec("licencias", "Licencias", [sub("B1 - Vehículo < 4000 kg", [select("l0", "Vencido", ["Vigente", "Vencido", "No aplica"]), { id: "l0d", type: "date", title: "Fecha de vencimiento", value: "2025-01-10" }], "Renovar")]),
    sec("uniforme-seguridad", "Uniforme", [sub("SEG-PO-001 Código de vestimenta Seguridad", [select("u0", "Cumple", ["Cumple", "No cumple"]), foto("f2")], "Completo"), sub("Equipo de invierno", [select("u1", "No existe", ["Bueno", "Malo", "No existe"])], "Sin capa")]),
    sec("bitacora", "Bitácora", [sub("Folios completos", [check("b0", "true"), foto("f3")], "Revisados"), sub("No deben existir espacios en blanco", [check("b1", "false")], "Hay dos")]),
    sec("marcas", "Marcas", [sub("Dispositivos de marcas en buen estado", [check("m0", "true")], "Funcionan")]),
    sec("perimetro", "Perímetro", [sub("Recorrido por el perímetro", [check("p0", "true")], "Sin novedad")]),
    sec("vehiculos", "Vehículos", [sub("Revisar aleatoriamente el/los vehículos custodiados", [check("v0", "true")], "Dos revisados")]),
    sec("capacitacion-iso", "Política integrada", [sub("ISO de calidad", [texto("i0", "¿Cual es?", "ISO 9001"), texto("i1", "¿Cómo aporta?", "Mejora los procesos", "textarea")])]),
    sec("papeleria", "Papelería", [
        sub("SEG-F-023-Control de entrega de puesto", [check("pa0", "true")], "Al día"),
        sub("Número de Serie del arma vrs documento de matrícula", [texto("pa1", undefined, "SN-4455"), foto("f4")], "Coincide"),
    ]),
    sec("funcion", "Función", [sub("Revisar aleatoriamente 3 puntos de la guía de funciones", [check("fu0", "true")], "Se anotaron")]),
    { id: "local-123", title: "Revisión de extintores", isPredefined: false, subsections: [sub("Extintor del pasillo", [texto("x0", "Respuesta", "Vencido"), texto("x1", "Observaciones", "Cargar")], "Segundo piso")] },
];
const aseo = [
    sec("limpieza-general", "Limpieza general del área", [sub("Basureros", [select("g0", "5", ["No aplica", "1", "2", "3", "4", "5"]), texto("g0o", "Observaciones", "Vacíos"), foto("f5")], "Todos")]),
    sec("cuarto-aseo", "Cuarto de aseo", [sub("Pilas Limpias", [select("a0", "4", ["No aplica", "1", "2", "3", "4", "5"]), texto("a0o", "Observaciones", "Una sucia")], "Revisadas")]),
    sec("servicios-sanitarios", "Cuarto de aseo", [sub("Orinales", [select("s0", "No aplica", ["No aplica", "1", "2", "3", "4", "5"]), texto("s0o", "Observaciones", "No hay")], "Sin servicio")]),
    sec("uniforme-presentacion", "Uniforme y presentación", [sub("Uniforme y Carnet", [select("up0", "Bueno", ["Bueno", "Malo", "No aplica"]), texto("up0o", "Observaciones", "Limpio")], "Completo")]),
    sec("calificacion-general", "Estado de los equipos", [sub("Calificación general", [select("cg0", "5", ["1", "2", "3", "4", "5"])], "Excelente")]),
    sec("licencias", "Licencias", [sub("B1 - Vehículo < 4000 kg", [select("l0", "Vigente", ["Vigente", "Vencido", "No aplica"]), { id: "l0d", type: "date", title: "Fecha de vencimiento", value: "2028-06-30" }], "Al día")]),
    { id: "local-456", title: "Bodega de químicos", isPredefined: false, subsections: [sub("Etiquetado", [select("x0", "Bueno", ["Bueno", "Malo"]), texto("x1", "Observaciones", "Falta una etiqueta")], "Estante 2")] },
];
const articulos = [{ id: 1, nombre: "Radio", tipo: "Plan", cantidad_requerida: 2, cantidad_real: 0, estado: "No está", observaciones: "Se perdió", mantenimiento_files: [{ localFileName: "secreto3.jpg" }] }, { id: 2, nombre: "Linterna", tipo: "Asignado", cantidad_requerida: 1, cantidad_real: 1, estado: "Bueno", observaciones: "Con pilas" }];
const raw = {
    id: 5, fecha: new Date("2026-09-10T13:00:00Z"), created_at: new Date("2026-09-10T13:30:00Z"), isActive: true,
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    ejecutivo_cuenta: "7", empleado_id: 90, empleado_nombre: "Ana Soto", empleado_codigo: "E90", hora_inicio: new Date("1970-01-01T08:00:00Z"), hora_fin: "09:30:00",
    evaluacion: JSON.stringify(seguridad), articulos_puesto: JSON.stringify(articulos), firma_supervisor: FIRMA, firma_responsable: "TOKEN-QR-GPS-999",
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("checklist de supervisión como formulario", () => {
    it("variante por división y, si no basta, por las secciones", () => {
        assert.equal(varianteDe("Seguridad", []), "Seguridad");
        assert.equal(varianteDe("Aseo y Limpieza", []), "Aseo y limpieza");
        assert.equal(varianteDe("Limpieza", []), "Aseo y limpieza");
        assert.equal(varianteDe("Otra", ["limpieza-general"]), "Aseo y limpieza");
        assert.equal(varianteDe(null, ["carnes", "licencias"]), "Seguridad");
        assert.equal(varianteDe("Otra", ["licencias"]), null); // las licencias están en los dos formatos
        assert.equal(varianteDe(null, []), null);
    });
    it("hora, firma", () => {
        assert.equal(hhmm(new Date("1970-01-01T08:05:00Z")), "08:05");
        assert.equal(hhmm("09:30:00"), "09:30");
        assert.equal(hhmm(null), null);
        assert.equal(firmaImagen("nombre.png"), null);
    });
    it("un punto: select, casilla, fecha, observaciones, política y texto libre", () => {
        assert.deepEqual(filaDe(seguridad[0]!.subsections[1]), { punto: "Carne de Portación de Armas", resultado: "Vigente", fecha: "2027-03-15", observacion: "Al día", cual: null, aporta: null });
        assert.equal(filaDe(seguridad[3]!.subsections[0]).resultado, "SI");
        assert.equal(filaDe(seguridad[3]!.subsections[1]).resultado, "NO");
        assert.deepEqual(filaDe(seguridad[7]!.subsections[0]), { punto: "ISO de calidad", resultado: null, fecha: null, observacion: null, cual: "ISO 9001", aporta: "Mejora los procesos" });
        assert.equal(filaDe(seguridad[8]!.subsections[1]).resultado, "SN-4455"); // texto sin título = el resultado
        assert.equal(filaDe(aseo[0]!.subsections[0]).observacion, "Vacíos · Todos"); // observaciones del input + detalle
        const rara = filaDe(sub("Punto", [select("a", "Bueno", []), texto("b", "Marca", "Motorola")], "x"));
        assert.deepEqual([rara.resultado, rara.observacion], ["Bueno", "Marca: Motorola · x"]);
    });
    it("NUNCA entrega fotos: ni inputs photo, ni texto «Foto», ni valores que son imágenes", () => {
        const r = armarRegistro(raw, ubic, true);
        const json = JSON.stringify({ ...r, firmas: {} });
        for (const s of ["secreto", "BBBB", "base64", "TOKEN-QR"]) assert.equal(json.includes(s), false, s);
        const f = filaDe(sub("P", [texto("t", "Foto del punto", FOTO), texto("u", "Observaciones", FOTO), select("s", FOTO, [])]));
        assert.deepEqual([f.resultado, f.observacion], [null, null]);
    });
    it("reparte la evaluación por sección conocida y manda lo agregado a «otros»", () => {
        const { listas, seccionIds } = listasDeEvaluacion(JSON.stringify(seguridad));
        assert.deepEqual(Object.keys(listas), ["carnes", "licencias", "uniforme_seguridad", "bitacora", "marcas", "perimetro", "vehiculos", "capacitacion_iso", "papeleria", "funcion", "otros"]);
        assert.equal(listas.carnes!.length, 2);
        assert.deepEqual(listas.otros, [{ seccion: "Revisión de extintores", punto: "Extintor del pasillo", resultado: "Vencido", observacion: "Cargar · Segundo piso" }]);
        assert.equal(seccionIds.length, 10);
        // Una sección sin el id de la plantilla pero con su título se reconoce.
        assert.deepEqual(Object.keys(listasDeEvaluacion(JSON.stringify([{ id: "x1", title: "Bitácora", subsections: [sub("Folios", [check("b", "true")])] }])).listas), ["bitacora", "otros"]);
        assert.deepEqual(listasDeEvaluacion("{roto").listas, { otros: [] });
    });
    it("arma el registro de Seguridad", () => {
        const r = armarRegistro(raw, ubic, false, { ejecutivo: "Mario Vega" });
        assert.equal(r.variante, "Seguridad");
        assert.equal(r.creado, "2026-09-10T13:30:00");
        assert.deepEqual(r.valores, { empleado: "E90 - Ana Soto", ejecutivo: "Mario Vega", fecha: "2026-09-10", hora_inicio: "08:00", hora_fin: "09:30" });
        assert.deepEqual(r.listas.articulos, [
            { nombre: "Radio", tipo: "Plan", cantidad_requerida: 2, cantidad_real: 0, estado: "No está", observaciones: "Se perdió" },
            { nombre: "Linterna", tipo: "Asignado", cantidad_requerida: 1, cantidad_real: 1, estado: "Bueno", observaciones: "Con pilas" },
        ]);
        assert.deepEqual(r.firmas, { firma_supervisor: null });
        assert.deepEqual(r.firmasPresentes, ["firma_supervisor"]);
        assert.equal(armarRegistro(raw, ubic, true).firmas.firma_supervisor, FIRMA);
        assert.deepEqual(r.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
    });
    it("carga en lote: una consulta por tabla, solo activos; ejecutivo por id o texto", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); const ids: number[] | undefined = a.where?.id?.in; return ids ? rows.filter((x) => ids.includes(x.id)) : rows; } });
        const db: any = {
            c_checklist_supervision: t("chk", [raw, { ...raw, id: 6, ejecutivo_cuenta: "Pedro Mena", evaluacion: JSON.stringify(aseo) }, { ...raw, id: 7, ejecutivo_cuenta: "-" }]),
            n_ejecutivo_cuenta: t("eje", [{ id: 7, nombre: "Mario Vega" }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede" }]),
            e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
        };
        const out = await checklistSupervisionForm.loadRecords(db, [5, 6, 7], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.valores.ejecutivo]), [[5, "Mario Vega"], [6, "Pedro Mena"], [7, null]]);
        assert.equal(out[0]!.estructura.puesto, "P140 - Portón");
        assert.equal(out[1]!.variante, "Seguridad"); // la división manda aunque las secciones sean de aseo
        assert.ok(calls[0]!.includes('"isActive":true'));
        for (const name of ["chk", "eje", "emp", "cli", "div", "con", "suc", "pue"]) assert.equal(calls.filter((c) => c.startsWith(`${name}:`)).length, 1, name);
    });
    it("sin registros no consulta nada más", async () => {
        const db: any = { c_checklist_supervision: { findMany: async () => [] } };
        assert.deepEqual(await checklistSupervisionForm.loadRecords(db, [1], { firmas: true }), []);
    });
    it("muestras COMPLETAS para Guardify: una por variante, todas las secciones, columnas y firma", () => {
        const full = { ...raw, firma_supervisor: SAMPLE_PNG };
        const s = armarRegistro(full, ubic, true, { ejecutivo: "Mario Vega" });
        const a = armarRegistro({ ...full, evaluacion: JSON.stringify(aseo) }, { ...ubic, division: "Aseo y limpieza" }, true, { ejecutivo: "Mario Vega" });
        assert.deepEqual([s.variante, a.variante], ["Seguridad", "Aseo y limpieza"]);
        writeFormSample("checklist-de-supervision", [s, a]);
    });
});
