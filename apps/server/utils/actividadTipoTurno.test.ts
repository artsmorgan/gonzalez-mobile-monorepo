import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
    actividadAplicaAlTurno,
    actividadTieneTurno,
    conTiposTurno,
    loadTiposTurnoFromDb,
    normalizeTiposTurno,
    tipoTurnoRespaldo,
    tiposTurnoDeLaPeticion,
    tiposTurnoLabel,
} from "./actividadTipoTurno";
import { armarMisPuestos, hoyEnCostaRica, hoyEnCostaRicaComoFecha, proximaFechaPorPuesto } from "./misPuestos";
import { TIPOS_TURNO_OPCIONES, tiposTurnoDeActividad, toggleTipoTurno } from "../../mobile/hooks/actividadTiposTurno";
import { misPuestoTitulo, parseMisPuestos } from "../../mobile/hooks/misPuestos";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const dynamicApi = path.resolve(__dirname, "..", "..", "..", "..", "gonzalez-mobile-dynamic-api");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

describe("actividades: varios tipos de turno", () => {
    it("normaliza arreglos, textos con comas y valores sueltos: solo D, M y N, sin repetir y en ese orden", () => {
        assert.deepEqual(normalizeTiposTurno(["N", "d", "D", "x", "", null]), ["D", "N"]);
        assert.deepEqual(normalizeTiposTurno("m, n"), ["M", "N"]);
        assert.deepEqual(normalizeTiposTurno("M"), ["M"]);
        assert.deepEqual(normalizeTiposTurno(null), []);
        assert.deepEqual(normalizeTiposTurno("L"), []);
    });

    it("de la petición: manda `tipos_turno` y, de una app anterior, el `tipo_turno` único", () => {
        assert.deepEqual(tiposTurnoDeLaPeticion({ tipos_turno: ["M", "D"], tipo_turno: "N" }), ["D", "M"]);
        assert.deepEqual(tiposTurnoDeLaPeticion({ tipo_turno: "N" }), ["N"]);
        assert.deepEqual(tiposTurnoDeLaPeticion({ tipos_turno: [] , tipo_turno: "N" }), [], "una lista vacía explícita no se pisa con el valor anterior");
        assert.deepEqual(tiposTurnoDeLaPeticion({}), []);
        assert.equal(tipoTurnoRespaldo(["M", "N"]), "M");
        assert.equal(tipoTurnoRespaldo([]), null);
    });

    it("una actividad aplica al turno si lo incluye; sin tipos usa el valor anterior y, sin ninguno, aplica a todos", () => {
        assert.equal(actividadAplicaAlTurno(["D", "N"], null, "N"), true);
        assert.equal(actividadAplicaAlTurno(["D", "N"], null, "M"), false);
        assert.equal(actividadAplicaAlTurno(["D", "N"], "M", "M"), false, "la tabla manda sobre el respaldo");
        assert.equal(actividadAplicaAlTurno([], "M", "M"), true);
        assert.equal(actividadAplicaAlTurno([], "M", "D"), false);
        assert.equal(actividadAplicaAlTurno([], null, "D"), true);
        assert.equal(actividadAplicaAlTurno(["D"], null, " d "), true);
    });

    it("etiquetas y filtro por tipo", () => {
        assert.equal(tiposTurnoLabel(["M", "D"]), "Diurno, Mixto");
        assert.equal(tiposTurnoLabel([], "N"), "Nocturno");
        assert.equal(tiposTurnoLabel([], null), "Sin definir");
        assert.equal(tiposTurnoLabel([], null, ""), "");
        assert.equal(actividadTieneTurno(["D", "M"], null, "M"), true);
        assert.equal(actividadTieneTurno([], "N", "N"), true);
        assert.equal(actividadTieneTurno(["D"], "N", "N"), false);
        const r = conTiposTurno([{ id: 1, tipo_turno: "D" }, { id: 2, tipo_turno: null }], new Map([[2, ["M", "N"] as ("M" | "N")[]]]));
        assert.deepEqual(r.map((a) => a.tipos_turno), [["D"], ["M", "N"]]);
    });

    it("el reporte lee los tipos con el acceso a datos y es tolerante si la tabla no existe todavía", async () => {
        const db = { c_actividades_tipo_turno: { findMany: async () => [{ actividad_id: 5, tipo_turno: "N" }, { actividad_id: 5, tipo_turno: "D" }] } };
        assert.deepEqual([...(await loadTiposTurnoFromDb(db, [5, 6])).entries()], [[5, ["D", "N"]]]);
        assert.equal((await loadTiposTurnoFromDb({}, [5])).size, 0);
        const roto = { c_actividades_tipo_turno: { findMany: async () => { throw new Error("tabla inexistente"); } } };
        assert.equal((await loadTiposTurnoFromDb(roto, [5])).size, 0);
    });

    it("la migración de dynamic-api crea la tabla c_actividades_tipo_turno con clave única, borrado en cascada y copia lo ya guardado", () => {
        const dir = path.join(dynamicApi, "app", "prisma", "migrations", "20261110120001_actividades_tipo_turno");
        const sql = fs.readFileSync(path.join(dir, "migration.sql"), "utf8");
        assert.match(sql, /CREATE TABLE `c_actividades_tipo_turno`/);
        assert.match(sql, /`actividad_id` INTEGER NOT NULL/);
        assert.match(sql, /`tipo_turno` VARCHAR\(1\) NOT NULL/);
        assert.match(sql, /UNIQUE INDEX [^\n]*\(`actividad_id`, `tipo_turno`\)/);
        assert.match(sql, /FOREIGN KEY \(`actividad_id`\) REFERENCES `e_actividades`\(`id`\) ON DELETE CASCADE/);
        assert.match(sql, /INSERT INTO `c_actividades_tipo_turno`[\s\S]*FROM `e_actividades`/);
        const schema = leer(dynamicApi, "app/prisma/schema.prisma");
        assert.match(schema, /model c_actividades_tipo_turno \{[\s\S]*?@@unique\(\[actividad_id, tipo_turno\]/);
        assert.match(schema, /c_actividades_tipo_turno c_actividades_tipo_turno\[\]/);
    });

    it("todo uso de e_actividades pasa los tipos por callDynamicPrisma: alta, edición, copia, listado, turno de la marca y reportes", () => {
        assert.match(leer(server, "app/api/activities/route.ts"), /replaceTiposTurno\(req, Number\(actividad\.id\), tiposTurno\)/);
        const editar = leer(server, "app/api/activities/created/[id]/route.ts");
        assert.match(editar, /await replaceTiposTurno\(req, actividadId, tiposTurno\)/);
        assert.match(editar, /tipos_turno: tiposAntes/);
        assert.match(leer(server, "app/api/activities/created/[id]/duplicate/route.ts"), /replaceTiposTurno\(req, newId, tiposOrigen\)/);
        assert.match(leer(server, "app/api/activities/created/puesto/[id]/route.ts"), /conTiposTurno\(/);
        const crear = leer(server, "utils/createActivities.ts");
        assert.match(crear, /actividadAplicaAlTurno\(tiposTurnoPorActividad\.get\(Number\(actividad\.id\)\) \?\? \[\], actividad\.tipo_turno, marcaDia\.tipo_turno\)/);
        assert.equal(/actividad\.tipo_turno !== marcaDia\.tipo_turno/.test(crear), false, "ya no compara solo el valor único");
        const helper = leer(server, "utils/actividadTipoTurno.ts");
        assert.equal((helper.match(/callDynamicPrisma\(/g) ?? []).length >= 3, true);
        assert.match(leer(server, "utils/reports-functions/actividadesReport.ts"), /loadTiposTurnoFromDb\(prisma, acts\.map/);
        assert.match(leer(server, "utils/guardifyReports/modules/actividades.ts"), /tiposTurnoLabel\(act\.tipos_turno \?\? \[\], act\.tipo_turno, ""\)/);
    });

    it("la pantalla usa casillas para elegir varios tipos, exige al menos uno y manda la lista", () => {
        const p = leer(mobile, "screens/ActivitiesScreen.tsx");
        assert.match(p, /TIPOS_TURNO_OPCIONES\.map\(\(opcion\)/);
        assert.match(p, /accessibilityRole="checkbox"/);
        assert.match(p, /Debes seleccionar al menos un tipo de turno\./);
        assert.equal((p.match(/tipos_turno: tiposTurno,/g) ?? []).length, 2, "al crear y al editar");
        assert.match(p, /setTiposTurno\(tiposTurnoDeActividad\(activity\)\)/);
        assert.equal(/selectedValue=\{tipoTurno\}/.test(p), false, "ya no es un selector de uno solo");
    });

    it("en la app: marcar y desmarcar conserva el orden D, M, N y una actividad vieja carga su tipo único", () => {
        assert.deepEqual(TIPOS_TURNO_OPCIONES.map((o) => o.label), ["Diurno", "Mixto", "Nocturno"]);
        assert.deepEqual(toggleTipoTurno(["D"], "N"), ["D", "N"]);
        assert.deepEqual(toggleTipoTurno(["D", "M", "N"], "M"), ["D", "N"]);
        assert.deepEqual(toggleTipoTurno(["N"], "N"), []);
        assert.deepEqual(tiposTurnoDeActividad({ tipos_turno: ["M", "N"], tipo_turno: "D" }), ["M", "N"]);
        assert.deepEqual(tiposTurnoDeActividad({ tipo_turno: "N" }), ["N"]);
        assert.deepEqual(tiposTurnoDeActividad({ tipo_turno: null }), ["D"]);
    });
});

describe("Mis puestos (módulo Ubicación del puesto)", () => {
    it("la fecha de hoy es la de Costa Rica (UTC-6), no la del servidor", () => {
        assert.equal(hoyEnCostaRica(new Date("2026-11-10T05:59:00.000Z")), "2026-11-09");
        assert.equal(hoyEnCostaRica(new Date("2026-11-10T06:00:00.000Z")), "2026-11-10");
        assert.equal(hoyEnCostaRicaComoFecha(new Date("2026-11-10T20:00:00.000Z")).toISOString(), "2026-11-10T00:00:00.000Z");
    });

    it("la marca más próxima por puesto, ignorando marcas sin puesto o con fecha inválida", () => {
        const m = proximaFechaPorPuesto([
            { puesto_id: 7, fecha: new Date("2026-11-12T00:00:00.000Z") },
            { puesto_id: 7, fecha: "2026-11-10T00:00:00.000Z" },
            { puesto_id: 8, fecha: new Date("2026-11-11T00:00:00.000Z") },
            { puesto_id: null, fecha: new Date("2026-11-10T00:00:00.000Z") },
            { puesto_id: 9, fecha: "no es fecha" },
        ]);
        assert.deepEqual([...m.entries()], [[7, "2026-11-10"], [8, "2026-11-11"]]);
    });

    it("arma los puestos con coordenadas (o sin ellas), sucursal y orden alfabético", () => {
        const r = armarMisPuestos(
            [
                { id: 2, nombre: "Zona Norte", codigo: "ZN", sucursal_id: 5, coordenadas_gpslat: "9.934739", coordenadas_gpslng: "-84.087502" },
                { id: 1, nombre: "Almacén", codigo: null, sucursal_id: null, coordenadas_gpslat: null, coordenadas_gpslng: "" },
            ],
            new Map([[2, "2026-11-12"]]),
            new Map([[5, "Sucursal Centro"]]),
        );
        assert.deepEqual(r.map((p) => p.nombre), ["Almacén", "Zona Norte"]);
        assert.deepEqual(r[1].ubicacion, { lat: 9.934739, lng: -84.087502 });
        assert.deepEqual(r[0].ubicacion, { lat: null, lng: null });
        assert.deepEqual(r[1].sucursal, { id: 5, nombre: "Sucursal Centro" });
        assert.equal(r[1].proxima_fecha, "2026-11-12");
        assert.equal(r[0].proxima_fecha, null);
    });

    it("la ruta busca por empleadoFijo_id o empleadoReemplaza_id del empleado del token y solo marcas de hoy en adelante", () => {
        const ruta = leer(server, "app/api/puestos/mis-puestos/route.ts");
        assert.match(ruta, /Number\(payload\?\.id\)/);
        assert.match(ruta, /OR: \[\{ empleadoFijo_id: empleadoId \}, \{ empleadoReemplaza_id: empleadoId \}\]/);
        assert.match(ruta, /fecha: \{ gte: hoyEnCostaRicaComoFecha\(\) \}/);
        assert.match(ruta, /puesto_id: \{ not: null \}/);
        assert.match(ruta, /prisma\.c_marca_dia\.findMany/);
    });

    it("en la app: interpreta la respuesta y el módulo Ubicación del puesto ofrece la sección", () => {
        const lista = parseMisPuestos({ puestos: [{ id: 2, codigo: "ZN", nombre: "Zona Norte", sucursal: { id: 5, nombre: "Centro" }, ubicacion: { lat: 9.9, lng: -84.1 }, proxima_fecha: "2026-11-12" }, { id: 2, nombre: "repetido" }, { nombre: "sin id" }] });
        assert.equal(lista.length, 1);
        assert.equal(misPuestoTitulo(lista[0]), "ZN · Zona Norte");
        assert.deepEqual(parseMisPuestos(null), []);
        const pantalla = leer(mobile, "screens/PuestoUbicacionScreen.tsx");
        assert.match(pantalla, /<MisPuestosSection refreshAccessToken=\{refreshAccessToken\} logout=\{logout\} \/>/);
        const seccion = leer(mobile, "components/MisPuestosSection.tsx");
        assert.match(seccion, /necesitas conexión a internet/);
        assert.match(seccion, /\/api\/puestos\/mis-puestos/);
        assert.match(seccion, /<Collapsible key=\{puesto\.id\}/);
        assert.match(seccion, /<PuestoLocationBlock ubicacion=\{puesto\.ubicacion\}[^>]*initiallyOpen \/>/);
    });
});
