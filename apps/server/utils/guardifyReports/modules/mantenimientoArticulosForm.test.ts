import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { ARMAS_CORRECTIVO, ARMAS_PREVENTIVO, armarRegistro, mantenimientoArticulosForm, varianteDe, V_ARMA_CORR, V_ARMA_PREV, V_GENERAL, V_VEHICULO, type MantenimientoRaw } from "./mantenimientoArticulosForm";

const ubic = { empresa: "CH - Corporación González", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede Central", puesto: "P7 - Oficial de recepción" };
const hier = { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 7 };
const FIRMA = "data:image/png;base64," + "A".repeat(300);

/** Como queda en `mant_armas_form` cuando la app lo guarda (ver `MantenimientoEquipoScreen`). */
const formArma = (o: Record<string, any> = {}, tipo = "Preventivo", checks: Record<string, boolean> = {}) =>
    JSON.stringify({
        version: 1,
        caracteristicas: { tipo_arma: "Letal", mecanismo: "Pistola", marca: "Glock", modelo: "G19", serie: "XYZ123", calibre: "9mm", cargador_adicional: true, cargador_cantidad: "2", capacidad_balas: "15" },
        mantenimiento: { tipo, preventivo: tipo === "Preventivo" ? checks : {}, correctivo: tipo === "Correctivo" ? checks : {} },
        diagnostico: "Desgaste normal del resorte", foto_antes_nombre: "arma_foto_antes_1.jpg", foto_despues_nombre: "arma_foto_despues_1.jpg", armero_nombre: "Jorge Salas", firma: FIRMA, ...o,
    });
const fila = (o: Record<string, any> = {}) => ({
    id: 21, articulo_plan_id: 12, articulo_asignado_id: null, estado: "Bueno", cantidad_necesaria: 2, cantidad_real: 2, observaciones: "Se cambió el empaque", fecha_solucion: new Date("2026-09-20T10:00:00Z"),
    accion: "Reemplazar", fecha_inicio: new Date("2026-09-18T08:00:00Z"), numero_boleta_proveeduria: "BP-889", tipo: "Correctivo", marca: "Amerex", modelo: "B402", serie_placa: "A-1",
    marca_nuevo: "Badger", modelo_nuevo: "B10", serie_placa_nuevo: "B-9", categoria: "Seguridad", tipo_mantenimiento_art: "Recarga", fecha_salida: new Date("2026-09-18T12:00:00Z"), fecha_entrada: new Date("2026-09-19T12:00:00Z"),
    kilometraje: null, mant_armas_form: null, categoria_mantinimiento: "Equipo", detalle: "Cambio de válvula", numero_fc: "FC-5543", proveedor: "Extintores del Sur", costo_mo: 15000, costo_i: 8000, iva: 2990, costo_total: 25990,
    fecha_fin: new Date("2026-09-21T00:00:00Z"), reincidencia_treinta_dias: true, tipo_mant_art_reincid: "Correctivo", created_at: new Date("2026-09-18T07:55:30Z"), updated_at: new Date("2026-09-21T09:00:00Z"), ...o,
});
const raw = (m: Record<string, any> = {}, o: Partial<MantenimientoRaw> = {}): MantenimientoRaw => ({ m: fila(m), origen: "Plan", articulo: "Extintor", hier, ...o });

describe("mantenimiento de artículos como formulario", () => {
    it("decide el formato igual que la pantalla: arma, vehículo o artículo", () => {
        assert.equal(varianteDe(fila()), V_GENERAL);
        assert.equal(varianteDe(fila({ kilometraje: 45000 })), V_VEHICULO);
        assert.equal(varianteDe(fila({ kilometraje: 0 })), V_GENERAL);
        assert.equal(varianteDe(fila({ tipo: "Preventivo", mant_armas_form: formArma() })), V_ARMA_PREV);
        assert.equal(varianteDe(fila({ tipo: "Correctivo", mant_armas_form: formArma({}, "Correctivo") })), V_ARMA_CORR);
        // sin tipo en la columna se usa el del formulario del arma; sin ninguno, preventivo
        assert.equal(varianteDe(fila({ tipo: null, mant_armas_form: formArma({}, "Correctivo") })), V_ARMA_CORR);
        assert.equal(varianteDe(fila({ tipo: null, mant_armas_form: formArma({ mantenimiento: {} }) })), V_ARMA_PREV);
        // un JSON dañado no es arma (la pantalla tampoco lo trata como arma)
        assert.equal(varianteDe(fila({ mant_armas_form: "{no es json" })), V_GENERAL);
        assert.equal(varianteDe(fila({ kilometraje: 10, tipo: "Preventivo", mant_armas_form: formArma() })), V_ARMA_PREV);
    });
    it("arma un artículo general: textos, números y fechas legibles", () => {
        const r = armarRegistro(raw(), ubic, false);
        assert.equal(r.id, 21);
        assert.equal(r.variante, V_GENERAL);
        assert.equal(r.creado, "2026-09-18T07:55:30");
        const v = r.valores;
        assert.deepEqual([v.articulo, v.origen, v.estado, v.cantidad_necesaria, v.cantidad_real, v.tipo, v.accion, v.resuelto], ["Extintor", "Plan", "Bueno", 2, 2, "Correctivo", "Reemplazar", "Sí"]);
        assert.deepEqual([v.fecha_inicio, v.fecha_solucion, v.fecha_salida, v.fecha_entrada, v.fecha_fin, v.actualizado], ["2026-09-18", "2026-09-20", "2026-09-18", "2026-09-19", "2026-09-21", "2026-09-21 09:00"]);
        assert.deepEqual([v.costo_mano_obra, v.costo_insumos, v.iva, v.costo_total, v.reincidencia_30_dias, v.boleta_proveeduria, v.numero_fc], [15000, 8000, 2990, 25990, "Sí", "BP-889", "FC-5543"]);
        assert.deepEqual([v.marca_nuevo, v.modelo_nuevo, v.serie_placa_nuevo, v.categoria_mantenimiento, v.tipo_mantenimiento], ["Badger", "B10", "B-9", "Equipo", "Recarga"]);
        assert.equal("arma_tipo" in v, false);
        assert.deepEqual(r.listas, {});
        assert.deepEqual(r.firmasPresentes, []);
        assert.deepEqual(r.hier, hier);
    });
    it("sin solución ni reincidencia: no resuelto, y los nulos quedan nulos", () => {
        const r = armarRegistro(raw({ fecha_solucion: null, reincidencia_treinta_dias: null, accion: null, costo_mo: null, fecha_fin: null }, { articulo: null, origen: "Asignado" }), ubic, false);
        assert.deepEqual([r.valores.resuelto, r.valores.reincidencia_30_dias, r.valores.accion, r.valores.costo_mano_obra, r.valores.fecha_fin, r.valores.articulo], ["No", null, null, null, null, "Artículo inidentificable"]);
    });
    it("un texto que parece imagen no sale como texto", () => {
        const r = armarRegistro(raw({ detalle: FIRMA, observaciones: "A".repeat(10) + "iVBORw0KGgo" }), ubic, false);
        assert.equal(r.valores.detalle, null);
        assert.equal(r.valores.observaciones, "AAAAAAAAAAiVBORw0KGgo");
    });
    it("arma preventivo: lista con los ítems del formato, firma del armero y nada de fotos", () => {
        const form = formArma({}, "Preventivo", { remocion_corrosion: true, revision_est_seguro: true, ya_no_existe: true, lubricacion: false });
        const r = armarRegistro(raw({ tipo: "Preventivo", mant_armas_form: form }), ubic, false);
        assert.equal(r.variante, V_ARMA_PREV);
        assert.deepEqual([r.valores.arma_tipo, r.valores.arma_mecanismo, r.valores.arma_marca, r.valores.arma_serie, r.valores.arma_calibre, r.valores.arma_cargador_adicional, r.valores.arma_cargador_cantidad, r.valores.arma_capacidad_balas, r.valores.armero_nombre, r.valores.arma_diagnostico],
            ["Letal", "Pistola", "Glock", "XYZ123", "9mm", "Sí", "2", "15", "Jorge Salas", "Desgaste normal del resorte"]);
        const l = r.listas.preventivo!;
        assert.equal(l.length, ARMAS_PREVENTIVO.length + 1);
        assert.deepEqual(l[0], { clave: "remocion_corrosion", item: "Remoción de Corrosión", valor: "Realizado" });
        assert.equal(l.find((x) => x.clave === "lubricacion")!.valor, null);
        assert.equal(l.find((x) => x.clave === "revision_est_seguro")!.valor, "Realizado");
        assert.deepEqual(l[l.length - 1], { clave: "ya_no_existe", item: "ya_no_existe", valor: "Realizado" }); // una clave desconocida se nota en Guardify
        assert.equal(r.listas.correctivo, undefined);
        assert.deepEqual(r.firmas, { firma_armero: null });
        assert.deepEqual(r.firmasPresentes, ["firma_armero"]);
        const s = JSON.stringify(r);
        for (const nunca of ["arma_foto_antes_1.jpg", "arma_foto_despues_1.jpg", "base64"]) assert.equal(s.includes(nunca), false, nunca);
    });
    it("con firmas=1 entrega la firma del armero; si la firma no es una imagen no cuenta", () => {
        assert.equal(armarRegistro(raw({ tipo: "Preventivo", mant_armas_form: formArma() }), ubic, true).firmas.firma_armero, FIRMA);
        const sinImagen = armarRegistro(raw({ tipo: "Preventivo", mant_armas_form: formArma({ firma: "firma_local_77.png" }) }), ubic, true);
        assert.deepEqual(sinImagen.firmasPresentes, []);
        assert.equal(armarRegistro(raw({ tipo: "Preventivo", mant_armas_form: formArma({ firma: null }) }), ubic, true).firmasPresentes.length, 0);
    });
    it("arma correctivo: usa la lista correctiva", () => {
        const r = armarRegistro(raw({ tipo: "Correctivo", mant_armas_form: formArma({}, "Correctivo", { percutor: true }) }), ubic, false);
        assert.equal(r.variante, V_ARMA_CORR);
        assert.equal(r.listas.correctivo!.length, ARMAS_CORRECTIVO.length);
        assert.equal(r.listas.correctivo!.find((x) => x.clave === "percutor")!.valor, "Realizado");
        assert.equal(r.listas.preventivo, undefined);
    });
    it("un formulario de arma viejo con las listas en la raíz también se lee", () => {
        const r = armarRegistro(raw({ tipo: "Preventivo", mant_armas_form: JSON.stringify({ caracteristicas: { marca: "Taurus" }, preventivo: { limpieza_suciedad: true } }) }), ubic, false);
        assert.equal(r.valores.arma_marca, "Taurus");
        assert.equal(r.listas.preventivo!.find((x) => x.clave === "limpieza_suciedad")!.valor, "Realizado");
    });

    // Base simulada (where id/in, select) para ver cuántas consultas se hacen y que no se pidan columnas de más.
    const fakeDb = (tables: Record<string, any[]>) => {
        const calls: { table: string; args: any }[] = [];
        const match = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: [string, any]) => (v && typeof v === "object" && "in" in v ? v.in.includes(row[k]) : row[k] === v));
        const db: any = new Proxy({}, {
            get: (_t, table: string) => ({
                findMany: async (args: any) => {
                    calls.push({ table, args });
                    const rows = (tables[table] ?? []).filter((r) => match(r, args?.where));
                    return args?.select ? rows.map((r) => Object.fromEntries(Object.keys(args.select).map((k) => [k, r[k]]))) : rows;
                },
            }),
        });
        return { db, calls };
    };
    const tablas = () => ({
        c_articulo_mantenimiento: [
            fila({ id: 21, articulo_plan_id: 12, articulo_asignado_id: null }),
            fila({ id: 22, articulo_plan_id: null, articulo_asignado_id: 11, kilometraje: 80000 }),
            fila({ id: 23, articulo_plan_id: null, articulo_asignado_id: 12, tipo: "Preventivo", mant_armas_form: formArma() }), // artículo en la sucursal
            fila({ id: 24, articulo_plan_id: 99, articulo_asignado_id: null }), // artículo que ya no existe
            fila({ id: 25, articulo_plan_id: 13, articulo_asignado_id: null }), // puesto dado de baja
        ],
        e_estructura_articulo_corpo_puesto_plan: [
            { id: 12, puesto_id: 7, corpo_id: null, articuloCP_id: 100 }, { id: 13, puesto_id: 9, corpo_id: null, articuloCP_id: 100 },
        ],
        e_estructura_articulo_corpo_puesto_entrega: [{ id: 11, puesto_id: 7, corpo_id: null, nomencladorArticuloCP_id: 101 }, { id: 12, puesto_id: null, corpo_id: 5, nomencladorArticuloCP_id: 102 }],
        n_articulo_corpo_puesto: [{ id: 100, nombre: "Extintor" }, { id: 101, nombre: "Pickup" }, { id: 102, nombre: "Pistola 9mm" }],
        e_estructura_puesto: [{ id: 7, codigo: "P7", nombre: "Oficial de recepción", sucursal_id: 5, deleted: null }, { id: 9, codigo: "P9", nombre: "Baja", sucursal_id: 5, deleted: new Date("2026-01-01T00:00:00Z") }],
        e_estructura_sucursal: [{ id: 5, nro_sucursal: "S1", nombre: "Sede Central", contrato_id: 4 }],
        e_estructura_contrato: [{ id: 4, nro_contrato: "C1", nombre: "Contrato", cliente_id: 2, empresa_id: 1, division_id: 3 }],
        e_estructura_empresa: [{ id: 1, codigo: "CH", nombre: "Corporación González" }], e_estructura_cliente: [{ id: 2, nombre: "CCSS" }], n_division: [{ id: 3, nombre: "Seguridad" }],
    });

    it("carga en lote: cada mantenimiento con su artículo y ubicación; fuera lo huérfano o de un puesto dado de baja", async () => {
        const { db, calls } = fakeDb(tablas());
        const out = await mantenimientoArticulosForm.loadRecords(db, [21, 22, 23, 24, 25], { firmas: true });
        assert.deepEqual(out.map((r) => [r.id, r.variante, r.valores.articulo, r.valores.origen]), [
            [21, V_GENERAL, "Extintor", "Plan"], [22, V_VEHICULO, "Pickup", "Asignado"], [23, V_ARMA_PREV, "Pistola 9mm", "Asignado"],
        ]);
        assert.equal(out[0]!.estructura.puesto, "P7 - Oficial de recepción");
        assert.deepEqual(out[0]!.hier, { puesto: 7, corpo: 5, contrato: 4, cliente: 2, empresa: 1, division: 3 });
        // el artículo de la sucursal se ubica por la sucursal
        assert.deepEqual([out[2]!.estructura.sucursal, out[2]!.estructura.puesto, out[2]!.hier.puesto ?? null, out[2]!.hier.corpo], ["S1 - Sede Central", null, null, 5]);
        assert.equal(out[2]!.firmas.firma_armero, FIRMA);
        const porTabla = new Map<string, number>();
        for (const c of calls) porTabla.set(c.table, (porTabla.get(c.table) ?? 0) + 1);
        assert.ok([...porTabla.entries()].every(([t, n]) => n <= 4), JSON.stringify([...porTabla]));
        assert.equal(porTabla.get("c_articulo_mantenimiento"), 1);
        // no se piden archivos adjuntos ni se lee nada fuera de lo declarado
        assert.equal(calls.some((c) => c.table === "c_archivos_adjuntos_articulo_mantenimiento"), false);
        assert.equal(JSON.stringify(out).includes("arma_foto_"), false);
    });
    it("sin firmas=1 las firmas solo se anuncian", async () => {
        const { db } = fakeDb(tablas());
        const out = await mantenimientoArticulosForm.loadRecords(db, [23], { firmas: false });
        assert.deepEqual([out[0]!.firmas, out[0]!.firmasPresentes], [{ firma_armero: null }, ["firma_armero"]]);
    });

    it("muestras completas para Guardify: una por formato", () => {
        const marcados = (items: [string, string][]) => Object.fromEntries(items.map(([k]) => [k, true]));
        const general = armarRegistro(raw({}, { articulo: "Extintor de 10 libras" }), ubic, true);
        const vehiculo = armarRegistro(raw({ kilometraje: 84250, tipo: "Preventivo", marca: "Toyota", modelo: "Hilux", serie_placa: "BCD-123", accion: "Reparar en taller", tipo_mantenimiento_art: "Cambio de aceite" }, { origen: "Asignado", articulo: "Pickup doble cabina" }), ubic, true);
        const prev = armarRegistro(raw({ tipo: "Preventivo", mant_armas_form: formArma({ firma: SAMPLE_PNG }, "Preventivo", marcados(ARMAS_PREVENTIVO)) }, { origen: "Asignado", articulo: "Pistola 9mm" }), ubic, true);
        const corr = armarRegistro(raw({ tipo: "Correctivo", mant_armas_form: formArma({ firma: SAMPLE_PNG }, "Correctivo", marcados(ARMAS_CORRECTIVO)) }, { origen: "Asignado", articulo: "Pistola 9mm" }), ubic, true);
        assert.deepEqual([general, vehiculo, prev, corr].map((r) => r.variante), [V_GENERAL, V_VEHICULO, V_ARMA_PREV, V_ARMA_CORR]);
        assert.equal(prev.listas.preventivo!.every((x) => x.valor === "Realizado"), true);
        assert.equal(corr.listas.correctivo!.every((x) => x.valor === "Realizado"), true);
        assert.equal(corr.firmas.firma_armero, SAMPLE_PNG);
        writeFormSample("mantenimiento-de-articulos", [general, vehiculo, prev, corr].map(({ hier: _h, ...r }) => r));
    });
});
