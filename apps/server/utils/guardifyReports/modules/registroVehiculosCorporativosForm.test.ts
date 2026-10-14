import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, imagenDeFirma, registroVehiculosCorporativosForm, varianteDe } from "./registroVehiculosCorporativosForm";

const PNG_SUELTO = SAMPLE_PNG.split(",")[1]!; // base64 sin prefijo
const DIGITAL = "c2Vzc2lvbjoxOjk6LTg0OjE3MDAw"; // sesión + empleado + GPS en base64: no es una imagen
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };
const D = (s: string) => new Date(s);
const vehiculo = (extra: Record<string, unknown> = {}) => ({
    id: 11, tipo: "Vehículo", placa: "BCD-123", tipo_autoria: "Corporativo", estado: "Activo", marca: "Toyota", modelo: "Hilux", anno: 2022, kilometraje: 45210, prox_cambio_aceite: 50000,
    descripcion: "Pick-up de patrullaje", titulo_propiedad: true, rtv: true, marchamo: false, firma_responsable: DIGITAL, created_at: D("2026-04-20T08:12:30Z"), created_by: 77,
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, sucursal_id: 5, puesto_id: 6, creador: "Ana Soto",
    usos: [{ nombre_conductor: "Luis Mora", codigo_conductor: "E-100", fecha: D("2026-04-21T00:00:00Z"), inicio: D("2026-04-21T07:30:00Z"), fin: D("2026-04-21T12:45:00Z"), km_inicio: 45210, km_fin: 45290, motivo: "Ronda", combustible_inicio: "Lleno", combustible_fin: "Medio", firma_conductor: SAMPLE_PNG }],
    mantenimientos: [{ fecha: D("2026-04-25T00:00:00Z"), tipo: "Preventivo", mantenimiento: "Cambio de aceite", diagnostico: "Sin novedad", kilometraje_siguiente_revision: 50000, nombre_mecanico: "Pedro Vega", firma_mecanico: null }],
    ...extra,
});

describe("registro de vehículos corporativos como formulario", () => {
    it("normaliza el tipo y reconoce solo imágenes como firma", () => {
        assert.equal(varianteDe("bicicleta"), "Bicicleta");
        assert.equal(varianteDe("Motocicleta"), "Motocicleta");
        assert.equal(varianteDe("vehiculo"), "Vehículo");
        assert.equal(varianteDe("Otro"), "Otro");
        assert.equal(varianteDe(""), null);
        assert.equal(imagenDeFirma(SAMPLE_PNG), SAMPLE_PNG);
        assert.equal(imagenDeFirma(PNG_SUELTO), `data:image/png;base64,${PNG_SUELTO}`);
        assert.equal(imagenDeFirma("/9j/4AAQSkZJRgABAQ=="), "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==");
        assert.equal(imagenDeFirma(DIGITAL), null); // el código de sesión del responsable no es una imagen
        assert.equal(imagenDeFirma("A".repeat(300)), null); // un base64 largo cualquiera tampoco
        assert.equal(imagenDeFirma(""), null);
    });
    it("arma el registro con valores legibles, documentos y tablas hijas", () => {
        const r = armarRegistro(vehiculo(), ubic, true);
        assert.equal(r.variante, "Vehículo");
        assert.deepEqual([r.valores.placa, r.valores.anno, r.valores.kilometraje], ["BCD-123", 2022, 45210]);
        assert.deepEqual([r.valores.fecha_creacion, r.valores.hora_creacion, r.valores.creado_por], ["2026-04-20", "08:12", "Ana Soto"]);
        assert.deepEqual(r.listas.documentos, [{ item: "Título de propiedad", valor: "Sí" }, { item: "RTV", valor: "Sí" }, { item: "Marchamo", valor: "No" }]);
        assert.deepEqual(r.listas.usos[0], { conductor: "Luis Mora", codigo: "E-100", fecha: "2026-04-21", inicio: "07:30", fin: "12:45", km_inicio: 45210, km_fin: 45290, motivo: "Ronda", combustible_inicio: "Lleno", combustible_fin: "Medio", firma_conductor: SAMPLE_PNG });
        assert.deepEqual(r.listas.mantenimientos[0], { fecha: "2026-04-25", tipo: "Preventivo", mantenimiento: "Cambio de aceite", diagnostico: "Sin novedad", km_siguiente: 50000, mecanico: "Pedro Vega", firma_mecanico: null });
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
        assert.deepEqual(r.firmasPresentes, ["firma_responsable"]);
        assert.deepEqual(r.firmas, { firma_responsable: null });
    });
    it("la bicicleta no lleva documentos; sin firma del responsable no hay firma presente", () => {
        const r = armarRegistro(vehiculo({ tipo: "Bicicleta", placa: null, firma_responsable: "", titulo_propiedad: null }), ubic, true);
        assert.equal(r.variante, "Bicicleta");
        assert.deepEqual(r.listas.documentos, []);
        assert.deepEqual(r.firmasPresentes, []);
        assert.deepEqual(r.firmas, {});
        assert.equal(r.valores.placa, null);
    });
    it("con firmas=1 entrega la imagen solo si la firma del responsable es una imagen", () => {
        assert.equal(armarRegistro(vehiculo({ firma_responsable: SAMPLE_PNG }), ubic, true).firmas.firma_responsable, SAMPLE_PNG);
        assert.equal(armarRegistro(vehiculo({ firma_responsable: SAMPLE_PNG }), ubic, false).firmas.firma_responsable, null);
        assert.equal(armarRegistro(vehiculo(), ubic, true).firmas.firma_responsable, null);
    });
    it("firmas por renglón: imagen con firmas=1, «Firmada» sin pedirla o si no es imagen, vacía si no hay", () => {
        const usos = [{ ...vehiculo().usos[0], firma_conductor: PNG_SUELTO }, { ...vehiculo().usos[0], firma_conductor: DIGITAL }, { ...vehiculo().usos[0], firma_conductor: "" }];
        const mantenimientos = [{ ...vehiculo().mantenimientos[0], firma_mecanico: SAMPLE_PNG }, { ...vehiculo().mantenimientos[0], firma_mecanico: DIGITAL }, { ...vehiculo().mantenimientos[0], firma_mecanico: null }];
        const con = armarRegistro(vehiculo({ usos, mantenimientos }), ubic, true);
        assert.deepEqual(con.listas.usos.map((u: any) => u.firma_conductor), [SAMPLE_PNG, "Firmada", null]);
        assert.deepEqual(con.listas.mantenimientos.map((m: any) => m.firma_mecanico), [SAMPLE_PNG, "Firmada", null]);
        const sin = armarRegistro(vehiculo({ usos, mantenimientos }), ubic, false);
        assert.deepEqual(sin.listas.usos.map((u: any) => u.firma_conductor), ["Firmada", "Firmada", null]);
        assert.deepEqual(sin.listas.mantenimientos.map((m: any) => m.firma_mecanico), ["Firmada", "Firmada", null]);
        for (const r of [con, sin]) assert.ok(!JSON.stringify(r).includes(DIGITAL));
        assert.ok(!JSON.stringify(sin).includes("data:image") && !JSON.stringify(sin).includes("iVBOR"));
    });
    it("carga en lote: una consulta por tabla, sin columnas de fotos y con las firmas solo de conductor y mecánico", async () => {
        const calls: { name: string; args: any }[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push({ name, args: a }); return rows; } });
        const { usos, mantenimientos, creador: _c, ...base } = vehiculo();
        const db: any = {
            c_vehiculos_corporativos: t("veh", [base, { ...base, id: 12, tipo: "Bicicleta" }]),
            c_usos_vehiculos_corporativos: t("usos", usos.map((u) => ({ ...u, vehiculo_id: 11 }))),
            c_mantenimiento_vehiculos_corporativos: t("mant", mantenimientos.map((m) => ({ ...m, vehiculo_id: 12 }))),
            c_empleado: t("emp", [{ id: 77, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Ruiz" }]),
            e_estructura_empresa: t("e", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await registroVehiculosCorporativosForm.loadRecords(db, [11, 12], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.variante, r.listas.usos.length, r.listas.mantenimientos.length]), [[11, "Vehículo", 1, 0], [12, "Bicicleta", 0, 1]]);
        assert.equal(out[0]!.estructura.puesto, "P1 - Puesto");
        assert.equal(out[0]!.valores.creado_por, "Ana Soto Ruiz");
        assert.equal(calls.length, 10); // vehículos, usos, mantenimientos, empleados y las seis consultas de estructura
        const hijas = calls.filter((c) => c.name === "usos" || c.name === "mant");
        for (const c of hijas) for (const k of Object.keys(c.args.select)) assert.ok(!/imagen/i.test(k) && (!/firma/i.test(k) || ["firma_conductor", "firma_mecanico"].includes(k)), `no debe pedir ${k}`);
    });
    it("sin registros no consulta nada más", async () => {
        const calls: string[] = [];
        const db: any = new Proxy({}, { get: (_t, n: string) => ({ findMany: async () => { calls.push(n); return []; } }) });
        assert.deepEqual(await registroVehiculosCorporativosForm.loadRecords(db, [1], { firmas: false }), []);
        assert.deepEqual(calls, ["c_vehiculos_corporativos"]);
    });

    it("muestra completa por variante para Guardify", () => {
        const usos = [1, 2].map((i) => ({ nombre_conductor: `Conductor ${i}`, codigo_conductor: `E-10${i}`, fecha: D(`2026-04-2${i}T00:00:00Z`), inicio: D(`2026-04-2${i}T07:30:00Z`), fin: D(`2026-04-2${i}T12:45:00Z`), km_inicio: 1000 * i, km_fin: 1000 * i + 80, motivo: `Ronda ${i}`, combustible_inicio: "Lleno", combustible_fin: "Medio", firma_conductor: SAMPLE_PNG }));
        const mantenimientos = [1, 2].map((i) => ({ fecha: D(`2026-04-2${i + 4}T00:00:00Z`), tipo: i === 1 ? "Preventivo" : "Correctivo", mantenimiento: `Trabajo ${i}`, diagnostico: `Diagnóstico ${i}`, kilometraje_siguiente_revision: 50000 + i, nombre_mecanico: `Mecánico ${i}`, firma_mecanico: SAMPLE_PNG }));
        const completo = (tipo: string, id: number) => {
            const bici = tipo === "Bicicleta";
            const r = armarRegistro(vehiculo({ id, tipo, usos, mantenimientos, firma_responsable: SAMPLE_PNG, ...(bici ? { placa: null, modelo: null, anno: null, kilometraje: null, prox_cambio_aceite: null } : {}) }), ubic, true);
            const { hier: _h, ...resto } = r;
            return resto;
        };
        const recs = [completo("Vehículo", 101), completo("Motocicleta", 102), completo("Bicicleta", 103)];
        assert.deepEqual(recs.map((r) => r.variante), ["Vehículo", "Motocicleta", "Bicicleta"]);
        assert.equal(recs[0]!.firmas.firma_responsable, SAMPLE_PNG);
        writeFormSample("registro-de-vehiculos", recs);
    });
});
