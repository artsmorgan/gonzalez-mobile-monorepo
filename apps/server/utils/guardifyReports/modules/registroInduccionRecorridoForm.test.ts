import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, registroInduccionRecorridoForm, respuestaLegible } from "./registroInduccionRecorridoForm";

const DIGITAL = Buffer.from("sesion-1:20:9.93:-84.08:1788000000000").toString("base64");
const ubic = { empresa: "CH - Empresa", cliente: "Edificio Central", division: "Aseo", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Misceláneo" };
const raw = (extra: any = {}) => ({
    id: 12, empresa_id: 9, cliente_id: 2, corpo_id: 5, division_id: 5, contrato_id: 4, puesto_id: 6, plaza_id: 8, division: "Aseo",
    fecha: new Date("2026-06-02T00:00:00Z"), created_at: new Date("2026-06-02T15:05:09Z"), created_by: "20",
    renglon_edificio: "Torre B", supervisor_cliente: "Rosa Campos", supervisor_corporacion: "Mario León",
    temas_desarrollados: JSON.stringify([
        { tema: "Prueba de cepillo.", respuesta: "SI", comentarios: "Sin novedad" }, { tema: "Presentación de los Supervisores", respuesta: "no", comentarios: "" },
        { tema: "Uso de los ascensores", respuesta: "N/A", comentarios: "No hay ascensor" }, { tema: "Sin responder", respuesta: "", comentarios: "" },
    ]),
    aspectos_especificos: JSON.stringify([{ aspecto: "Introducción a los dispositivos de alarmas", respuesta: "SI", comentarios: "" }]),
    participantes: [{ id: 1, registro_id: 12, nombre_completo: "Ana Mora Soto", cedula: "1-0111-0222", firma: SAMPLE_PNG }, { id: 2, registro_id: 12, nombre_completo: "Luis Vega", cedula: "2-0333-0444", firma: null }],
    firma_supervisor: SAMPLE_PNG, firma_responsable: DIGITAL, ...extra,
});

describe("registro de inducción y recorrido como formulario", () => {
    it("normaliza la respuesta a SI / NO / NA", () => {
        assert.equal(respuestaLegible("si"), "SI");
        assert.equal(respuestaLegible("Sí"), "SI");
        assert.equal(respuestaLegible("N/A"), "NA");
        assert.equal(respuestaLegible(""), null);
    });
    it("arma temas, aspectos y participantes con los textos de la pantalla", () => {
        const r = armarRegistro(raw(), ubic, false);
        assert.equal(r.variante, null);
        assert.equal(r.valores.fecha, "2026-06-02");
        assert.equal(r.valores.renglon_edificio, "Torre B");
        assert.deepEqual(r.listas.temas.map((t) => [t.item, t.valor, t.observacion]), [
            ["Prueba de cepillo.", "SI", "Sin novedad"], ["Presentación de los Supervisores", "NO", null], ["Uso de los ascensores", "NA", "No hay ascensor"], ["Sin responder", null, null],
        ]);
        assert.deepEqual(r.listas.aspectos, [{ clave: null, item: "Introducción a los dispositivos de alarmas", valor: "SI", observacion: null }]);
        assert.deepEqual(r.listas.participantes, [{ nombre_completo: "Ana Mora Soto", firma: "Firmada", cedula: "1-0111-0222" }, { nombre_completo: "Luis Vega", firma: null, cedula: "2-0333-0444" }]);
        assert.deepEqual(r.hier, { empresa: 9, cliente: 2, division: 5, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("firma por participante: la imagen solo con firmas=1; sin pedirla «Firmada»; la firma digital nunca sale; sin firma, null", () => {
        const participantes = [
            { nombre_completo: "Con imagen", cedula: "1", firma: SAMPLE_PNG },
            { nombre_completo: "Base64 JPEG", cedula: "2", firma: "/9j/4AAQSkZJRgABAQ" },
            { nombre_completo: "Digital", cedula: "3", firma: DIGITAL },
            { nombre_completo: "Sin firma", cedula: "4", firma: "" },
            { nombre_completo: "Nula", cedula: "5", firma: null },
        ];
        const con = armarRegistro(raw({ participantes }), ubic, true);
        assert.deepEqual(con.listas.participantes.map((p) => p.firma), [SAMPLE_PNG, "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ", "Firmada", null, null]);
        const sin = armarRegistro(raw({ participantes }), ubic, false);
        assert.deepEqual(sin.listas.participantes.map((p) => p.firma), ["Firmada", "Firmada", "Firmada", null, null]);
        assert.ok(!JSON.stringify(sin).includes("data:image") && !JSON.stringify(sin).includes("/9j/"));
        assert.ok(!JSON.stringify(con).includes(DIGITAL));
    });
    it("la firma del supervisor (imagen) solo sale con firmas=1; la del responsable es digital y nunca es imagen", () => {
        const sin = armarRegistro(raw(), ubic, false);
        assert.deepEqual(sin.firmasPresentes, ["firma_supervisor", "firma_responsable"]);
        assert.deepEqual(sin.firmas, { firma_supervisor: null, firma_responsable: null });
        const con = armarRegistro(raw(), ubic, true);
        assert.equal(con.firmas.firma_supervisor, SAMPLE_PNG);
        assert.equal(con.firmas.firma_responsable, null);
        assert.ok(!JSON.stringify(con).includes(DIGITAL));
        assert.deepEqual(armarRegistro(raw({ firma_supervisor: null, firma_responsable: "" }), ubic, true).firmasPresentes, []);
    });
    it("tolera listas vacías o JSON dañado", () => {
        const r = armarRegistro(raw({ temas_desarrollados: "{no es json", aspectos_especificos: null, participantes: undefined }), ubic, false);
        assert.deepEqual([r.listas.temas, r.listas.aspectos, r.listas.participantes], [[], [], []]);
    });
    it("carga en lote: registros, participantes y una consulta por nivel; solo activos y en el orden pedido", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const { participantes, ...fila } = raw();
        const db: any = {
            c_registro_induccion_recorrido: t("reg", [fila, { ...fila, id: 13 }]),
            c_participantes_induccion_recorrido: t("par", participantes),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "Edificio Central" }]), n_division: t("div", [{ id: 5, nombre: "Aseo" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Misceláneo" }]),
        };
        const out = await registroInduccionRecorridoForm.loadRecords(db, [13, 12], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [13, 12]);
        assert.equal(calls.length, 8);
        assert.ok(calls[0]!.includes('"isActive":true'));
        assert.equal(out[1]!.listas.participantes.length, 2);
        assert.equal(out[0]!.listas.participantes.length, 0); // los participantes son del registro 12
        assert.equal(out[1]!.estructura.puesto, "P1 - Misceláneo");
    });
    it("muestra completa para Guardify (temas con SI/NO/NA, aspectos, participantes y firmas)", () => {
        const completo = armarRegistro(
            raw({
                temas_desarrollados: JSON.stringify([
                    { tema: "Revisión de los documentos del expediente del aspirante.", respuesta: "SI", comentarios: "Completo" }, { tema: "Prueba de cepillo.", respuesta: "NO", comentarios: "Pendiente de equipo" },
                    { tema: "Presentación de los Supervisores", respuesta: "NA", comentarios: "Ya los conoce" },
                ]),
                aspectos_especificos: JSON.stringify([{ aspecto: "Introducción a los dispositivos de alarmas y emergencia del edificio.", respuesta: "SI", comentarios: "Sin novedad" }, { aspecto: "Uso de Equipo de Protección Personal", respuesta: "NO", comentarios: "Falta mascarilla" }]),
                participantes: [1, 2, 3].map((i) => ({ id: i, registro_id: 12, nombre_completo: `Participante ${i} Mora`, cedula: `1-0${i}11-0222`, firma: SAMPLE_PNG })),
            }),
            ubic, true,
        );
        writeFormSample("registro-de-induccion-y-recorrido", [completo]);
        assert.equal(completo.listas.participantes.length, 3);
    });
});
