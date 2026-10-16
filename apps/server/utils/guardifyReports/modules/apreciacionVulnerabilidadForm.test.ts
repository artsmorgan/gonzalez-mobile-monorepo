import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { apreciacionVulnerabilidadForm, armarRegistro, firmaImagen, nivelLegible, respuestaLegible } from "./apreciacionVulnerabilidadForm";

const FIRMA = "data:image/png;base64," + "A".repeat(300);
/** Bloques como los arma la pantalla móvil (BOLETA_DEFAULTS): `key`, `title` e ítems con `label` y `answer` («si» / «no» / null). */
const bloque = (key: string, title: string, labels: string[], answer: "si" | "no" | null = "si") => ({
    key, title, items: labels.map((label, i) => ({ id: `${key}-${i}`, label, answer: i % 2 ? "no" : answer, isOriginal: true, description: "detalle libre", image: { name: "foto.jpg" } })),
});
const boleta = [
    bloque("entorno", "Entorno", ["Las instalaciones están ubicadas en zona industrial", "Las instalaciones están ubicadas en zona residencial"]),
    bloque("transito_accesos", "Tránsito y accesos", ["Las puertas permiten la fácil evacuación", "Hay un control definido de acceso a las instalaciones"]),
    bloque("perimetro", "Perímetro", ["Existen barreras que impiden el fácil acceso", "La altura de los muros es igual o superior a los 2.50 metros", "Existe un sistema de iluminación para áreas críticas"]),
    bloque("seguridad_electronica", "Seguridad electrónica", ["Existe un centro de monitoreo", "Existen las condiciones para la implementación de un centro de monitoreo"]),
    bloque("estructura_instalaciones_1", "Estructura e instalaciones", ["Están acondicionadas todas las estructuras con sistemas contra incendios", "Hay un plan preventivo estructurado de brigada"]),
    bloque("estructura_instalaciones_2", "Estructura e instalaciones", ["La iluminación abarca todo el area a cuidar", "Existe planta electrica"]),
    { key: "porcentaje_vulnerabilidad", title: "Porcentaje de vulnerabilidad", items: [], vulnerabilityLevel: "media" },
];
const raw = {
    id: 8, fecha: new Date("2026-09-18T15:00:00Z"), enlace: "María Rojas", nombre_solicitante: "Carlos Mora", isActive: true,
    boleta: JSON.stringify(boleta), metricas_vulnerablidad: JSON.stringify(["Muros bajos en el costado norte", "Sin iluminación en el parqueo"]), observaciones: "Se recomienda reforzar el perímetro.",
    firma_solicitante: FIRMA, firma_responsable: "TOKEN-QR-GPS-999",
    empresa_id: 9, cliente_id: 4, division_id: 0, contrato_id: 0, corpo_id: 55, puesto_id: 140,
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("apreciación de vulnerabilidad como formulario", () => {
    it("normaliza respuestas, niveles y firma", () => {
        assert.equal(respuestaLegible("si"), "SI");
        assert.equal(respuestaLegible("Sí"), "SI");
        assert.equal(respuestaLegible("no"), "NO");
        assert.equal(respuestaLegible(null), null);
        assert.equal(nivelLegible("alta"), "Alta");
        assert.equal(nivelLegible("otra"), null);
        assert.equal(firmaImagen(FIRMA), FIRMA);
        assert.equal(firmaImagen("firma.png"), null);
    });
    it("arma el registro: una lista por bloque, nivel, métricas numeradas, sin fotos ni descripciones", () => {
        const r = armarRegistro(raw, ubic, false);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-09-18T15:00:00");
        assert.deepEqual([r.valores.enlace, r.valores.solicitante, r.valores.fecha, r.valores.nivel_vulnerabilidad], ["María Rojas", "Carlos Mora", "2026-09-18", "Media"]);
        assert.equal(r.valores.metricas, "1. Muros bajos en el costado norte\n2. Sin iluminación en el parqueo");
        assert.equal(r.valores.observaciones, "Se recomienda reforzar el perímetro.");
        assert.deepEqual(Object.keys(r.listas), ["entorno", "transito_accesos", "perimetro", "seguridad_electronica", "estructura_instalaciones_1", "estructura_instalaciones_2"]);
        assert.deepEqual(r.listas.entorno, [
            { item: "Las instalaciones están ubicadas en zona industrial", valor: "SI", observacion: null },
            { item: "Las instalaciones están ubicadas en zona residencial", valor: "NO", observacion: null },
        ]);
        const json = JSON.stringify(r);
        for (const s of ["detalle libre", "foto.jpg", "TOKEN-QR"]) assert.equal(json.includes(s), false, s);
    });
    it("ítems agregados en la app y respuestas sin contestar se entregan igual", () => {
        const b = [{ key: "entorno", title: "Entorno", items: [{ id: "x", label: "Pregunta propia", answer: null, isOriginal: false }] }];
        const r = armarRegistro({ ...raw, boleta: JSON.stringify(b), metricas_vulnerablidad: "[]", observaciones: null }, ubic, false);
        assert.deepEqual(r.listas.entorno, [{ item: "Pregunta propia", valor: null, observacion: null }]);
        assert.equal(r.valores.nivel_vulnerabilidad, null);
        assert.equal(r.valores.metricas, null);
    });
    it("firma solo con firmas=1; dice si la tiene", () => {
        assert.deepEqual(armarRegistro(raw, ubic, false).firmas, { firma_solicitante: null });
        assert.deepEqual(armarRegistro(raw, ubic, false).firmasPresentes, ["firma_solicitante"]);
        assert.equal(armarRegistro(raw, ubic, true).firmas.firma_solicitante, FIRMA);
        const sin = armarRegistro({ ...raw, firma_solicitante: null }, ubic, true);
        assert.deepEqual([sin.firmas, sin.firmasPresentes], [{}, []]);
    });
    it("boleta rota no tumba el registro", () => {
        const r = armarRegistro({ ...raw, boleta: "{roto", metricas_vulnerablidad: "{roto" }, ubic, false);
        assert.deepEqual([r.listas, r.valores.nivel_vulnerabilidad, r.valores.metricas], [{}, null, null]);
    });
    it("carga en lote: una consulta por tabla, solo activos; los registros sin división se ubican por su puesto", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); const ids: number[] | undefined = a.where?.id?.in; return ids ? rows.filter((x) => ids.includes(x.id)) : rows; } });
        const db: any = {
            c_boleta_apreciacion_vulnerabilidad: t("bol", [raw, { ...raw, id: 9 }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato", cliente_id: 4, empresa_id: 9, division_id: 2 }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede", contrato_id: 31 }]),
            e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón", sucursal_id: 55 }]),
        };
        const out = await apreciacionVulnerabilidadForm.loadRecords(db, [8, 9], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [8, 9]);
        assert.deepEqual(out[0]!.estructura, ubic);
        assert.deepEqual(out[0]!.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
        assert.ok(calls[0]!.includes('"isActive":true'));
        assert.equal(calls.filter((c) => c.startsWith("bol:")).length, 1);
        assert.ok(calls.length <= 12); // nunca una consulta por registro
    });
    it("sin registros no consulta nada más", async () => {
        const db: any = { c_boleta_apreciacion_vulnerabilidad: { findMany: async () => [] } };
        assert.deepEqual(await apreciacionVulnerabilidadForm.loadRecords(db, [1], { firmas: true }), []);
    });
    it("muestra COMPLETA para Guardify: todos los bloques con respuesta, nivel, métricas y firma", () => {
        const todas = boleta.map((s) => ({ ...s, items: s.items.map((it) => ({ ...it, answer: "si" })) }));
        const r = armarRegistro({ ...raw, boleta: JSON.stringify(todas), firma_solicitante: SAMPLE_PNG }, ubic, true);
        assert.deepEqual(r.firmasPresentes, ["firma_solicitante"]);
        writeFormSample("apreciacion-de-vulnerabilidad", [r]);
    });
});
