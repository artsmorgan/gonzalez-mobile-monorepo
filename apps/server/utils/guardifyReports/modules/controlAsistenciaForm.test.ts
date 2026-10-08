import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, celdaFirma, controlAsistenciaForm, INSTRUCCION, soloHora, turnoLabel, turnoMarcado } from "./controlAsistenciaForm";

const FIRMA = "data:image/png;base64,iVBORw0KGgo" + "A".repeat(300);
// Colaboradores como los guarda `buildColaboradoresFromMarcas` (api/attendance-control).
const colab = (o: any = {}) => ({
    empleado_id: 11, empleado_original_id: 11, empleado_reemplaza_id: null, nombre_original: "Luis Mora", nombre_reemplazo: "", cedula_reemplazo: "", is_reemplazo: false, marca_id: 1, ausente: false,
    nombre: "Luis Mora", cedula: "1-0111-0222", cliente: "CCSS", sucursal: "Sede", puesto: "Puesto", hora_inicio: "2026-04-20T06:00:00.000Z", hora_fin: "2026-04-20T14:00:00.000Z", tipo_turno: "D", ...o,
});
const raw = {
    id: 51, empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, turno: "N", total_presentes: 1, total_empleados_turno: 3,
    fecha: new Date("2026-04-20T06:00:00Z"), created_at: new Date("2026-04-20T15:00:00Z"), created_by: 9, isActive: true,
    nombre_supervisor: "Marta Quesada", comentarios: "Sin novedad", firma_manual_supervisor: FIRMA, firma_responsable: "aGFzaA==",
    colaboradores: JSON.stringify([
        colab(), // titular presente que firmó
        colab({ empleado_id: 12, empleado_original_id: 12, nombre_original: "Rosa Vega", nombre: "Rosa Vega", cedula: "2-0333-0444", ausente: true }), // ausente sin firma
        colab({ empleado_id: 14, empleado_original_id: 13, empleado_reemplaza_id: 14, is_reemplazo: true, nombre_original: "Pedro Rojas", nombre_reemplazo: "Ana Solís", cedula_reemplazo: "3-0555-0666", nombre: "Ana Solís", cedula: "3-0555-0666" }),
    ]),
    c_control_asistencia_empleado_firmas: [{ id: 1, control_id: 51, empleado_id: 11, firma: FIRMA }, { id: 2, control_id: 51, empleado_id: 14, firma: FIRMA }],
};
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("control de asistencia como formulario", () => {
    it("traduce turno, hora y la línea marcada del papel", () => {
        assert.equal(turnoLabel("D"), "Diurno");
        assert.equal(turnoLabel("mixto"), "Mixto");
        assert.equal(turnoLabel("N"), "Nocturno");
        assert.equal(turnoLabel("X"), null);
        assert.equal(turnoMarcado("Mixto"), "DIURNO (   )   MIXTO ( X )   NOCTURNO (   )");
        assert.equal(soloHora("2026-04-20T06:05:00.000Z"), "06:05");
        assert.equal(soloHora("14:30:00"), "14:30");
        assert.equal(soloHora(null), null);
    });
    it("arma los valores del encabezado, el total y el supervisor", () => {
        const r = armarRegistro(raw, ubic, false);
        assert.equal(r.variante, null);
        assert.deepEqual(r.valores, {
            fecha: "2026-04-20", turno: "Nocturno", turno_marcado: "DIURNO (   )   MIXTO (   )   NOCTURNO ( X )", instruccion: INSTRUCCION,
            total_presentes: "1 / 3", nombre_supervisor: "Marta Quesada", comentarios: "Sin novedad",
        });
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("cada renglón casa su firma como el generador: titular, ausente y sustituto (sin pedir imágenes: «Firmada»)", () => {
        const [a, b, c] = armarRegistro(raw, ubic, false).listas.colaboradores!;
        assert.deepEqual(a, { numero: 1, nombre: "Luis Mora", cedula: "1-0111-0222", firma_colaborador: "Firmada", comentario: null, entrada: "06:00", salida: "14:00", sustituto: null, cedula_sustituto: null, firma_sustituto: null, presente: "Sí" });
        assert.equal(b!.firma_colaborador, null);
        assert.equal(b!.comentario, "Ausente");
        assert.equal(b!.presente, null);
        assert.deepEqual(c, { numero: 3, nombre: "Pedro Rojas", cedula: "3-0555-0666", firma_colaborador: null, comentario: "Reemplazado", entrada: "06:00", salida: "14:00", sustituto: "Ana Solís", cedula_sustituto: "3-0555-0666", firma_sustituto: "Firmada", presente: "Sí" });
    });
    it("celdaFirma: imagen solo con firmas=true; sin pedirla o si no es imagen, «Firmada»; sin firma, null", () => {
        assert.equal(celdaFirma(FIRMA, true), FIRMA);
        assert.equal(celdaFirma(FIRMA, false), "Firmada");
        assert.equal(celdaFirma("iVBORw0KGgo" + "A".repeat(50), true), "data:image/png;base64,iVBORw0KGgo" + "A".repeat(50));
        assert.equal(celdaFirma("/9j/" + "A".repeat(50), true), "data:image/jpeg;base64,/9j/" + "A".repeat(50));
        assert.equal(celdaFirma("c2VzaW9uLWVtcGxlYWRvLWdwcw==", true), "Firmada");
        assert.equal(celdaFirma("  ", true), null);
        assert.equal(celdaFirma(null, true), null);
    });
    it("con firmas=true los renglones traen la imagen; con firmas=false jamás; una firma no-imagen sigue en «Firmada»", () => {
        const con = armarRegistro(raw, ubic, true).listas.colaboradores!;
        assert.equal(con[0]!.firma_colaborador, FIRMA);
        assert.equal(con[2]!.firma_sustituto, FIRMA);
        const sin = JSON.stringify(armarRegistro(raw, ubic, false).listas);
        assert.ok(!sin.includes("data:image") && !sin.includes("iVBOR"));
        const digital = armarRegistro({ ...raw, c_control_asistencia_empleado_firmas: [{ empleado_id: 11, firma: "c2VzaW9uLWVtcGxlYWRvLWdwcw==" }, { empleado_id: 14, firma: "" }] }, ubic, true);
        assert.equal(digital.listas.colaboradores![0]!.firma_colaborador, "Firmada");
        assert.equal(digital.listas.colaboradores![2]!.firma_sustituto, null);
        assert.ok(!JSON.stringify(digital).includes("c2VzaW9u"), "la cadena no-imagen nunca sale");
    });
    it("la firma del supervisor solo con firmas=1; la digital del responsable nunca sale", () => {
        const sin = armarRegistro(raw, ubic, false);
        assert.deepEqual(sin.firmas, { firma_supervisor: null });
        assert.deepEqual(sin.firmasPresentes, ["firma_supervisor"]);
        const con = armarRegistro(raw, ubic, true);
        assert.equal(con.firmas.firma_supervisor, FIRMA);
        assert.ok(!JSON.stringify(sin.listas).includes("data:image"));
        assert.ok(!JSON.stringify(con).includes("aGFzaA"), "la firma digital del responsable no sale");
    });
    it("sin colaboradores ni firma de supervisor: listas vacías, sin firmas", () => {
        const r = armarRegistro({ ...raw, colaboradores: "no es json", firma_manual_supervisor: null, c_control_asistencia_empleado_firmas: undefined }, ubic, true);
        assert.deepEqual(r.listas.colaboradores, []);
        assert.deepEqual(r.firmasPresentes, []);
    });
    it("carga en lote: una consulta de controles (con sus firmas) y una por nivel de estructura, solo activos", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}${a.include ? "+include" : ""}`); return rows; } });
        const db: any = {
            c_control_asistencia: t("ctl", [raw, { ...raw, id: 52 }]),
            e_estructura_empresa: t("emp", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await controlAsistenciaForm.loadRecords(db, [51, 52], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [51, 52]);
        assert.equal(out[0]!.estructura.cliente, "CCSS");
        assert.equal(calls.length, 7);
        assert.ok(calls[0]!.includes('"isActive":true') && calls[0]!.endsWith("+include"));
    });
    it("escribe la muestra COMPLETA para Guardify (todos los renglones con sustituto y firmas)", () => {
        const cols = [
            colab({ empleado_id: 14, empleado_original_id: 13, empleado_reemplaza_id: 14, is_reemplazo: true, nombre_original: "Pedro Rojas", nombre_reemplazo: "Ana Solís", cedula_reemplazo: "3-0555-0666", cedula: "3-0555-0666" }),
            colab({ empleado_id: 22, empleado_original_id: 21, empleado_reemplaza_id: 22, is_reemplazo: true, nombre_original: "Rosa Vega", nombre_reemplazo: "Jorge Campos", cedula_reemplazo: "4-0777-0888", cedula: "4-0777-0888", hora_inicio: "2026-04-20T18:00:00.000Z", hora_fin: "2026-04-21T02:00:00.000Z" }),
        ];
        const r = armarRegistro({
            ...raw, firma_manual_supervisor: SAMPLE_PNG, colaboradores: JSON.stringify(cols),
            // Titular y sustituto firmaron: así el renglón de la muestra lleva las dos firmas.
            c_control_asistencia_empleado_firmas: [13, 14, 21, 22].map((empleado_id) => ({ empleado_id, firma: SAMPLE_PNG })),
        }, ubic, true);
        writeFormSample("control-de-asistencia", [r]);
        assert.ok(r.listas.colaboradores!.every((f) => Object.values(f).every((v) => v !== null && v !== "")));
        assert.equal(r.firmas.firma_supervisor, SAMPLE_PNG);
        assert.ok(r.listas.colaboradores!.every((f) => f.firma_colaborador === SAMPLE_PNG && f.firma_sustituto === SAMPLE_PNG));
    });
});
