import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { toZonedTime } from "date-fns-tz";
import { horaDePared } from "./horaAccion";

const server = path.resolve(__dirname, "..");
const leer = (rel: string) => fs.readFileSync(path.join(server, rel), "utf8").replace(/\r\n/g, "\n");

describe("#218 · hora_accion se guarda como hora de Costa Rica", () => {
    // El servidor corre en UTC (la hora de pared se guarda «como si fuera UTC»): el valor exacto se comprueba en un proceso con TZ=UTC.
    const enUtc = (codigo: string) =>
        execFileSync(process.execPath, ["--import", "tsx", "-e", codigo], { cwd: server, env: { ...process.env, TZ: "UTC" }, encoding: "utf8" }).trim();

    it("con hora_accion 17:30:51 UTC se guarda 11:30:51 (6 horas menos), igual que sin hora_accion", () => {
        const sal = enUtc(`{ const { horaDePared } = require("./utils/horaAccion"); console.log(horaDePared(new Date("2026-11-24T17:30:51.000Z")).toISOString()); }`);
        assert.equal(sal, "2026-11-24T11:30:51.000Z");
    });

    it("con y sin hora_accion se convierte igual, y una fecha inválida o ausente usa la hora actual", () => {
        const t = new Date("2026-11-24T17:30:51.000Z");
        assert.equal(horaDePared(t).toISOString(), toZonedTime(t, "America/Costa_Rica").toISOString());
        for (const vacia of [null, undefined, new Date("no es fecha")]) assert.equal(horaDePared(vacia, t).toISOString(), horaDePared(t).toISOString());
        const sal = enUtc(`{ const { horaDePared } = require("./utils/horaAccion"); console.log(horaDePared(null, new Date("2026-11-23T19:42:24.000Z")).toISOString()); }`);
        assert.equal(sal, "2026-11-23T13:42:24.000Z");
    });

    it("el entorno de las acciones de Guardify aplica la misma conversión (aprobar/rechazar con hora_accion)", () => {
        const src = leer("utils/guardifyActions/envFactory.ts");
        assert.match(src, /nowIso: \(hora\) => \(hora \? horaDePared\(hora\)\.toISOString\(\) : deps\.ahoraPared\(\)\.toISOString\(\)\),/);
    });

    it("las rutas que guardan la hora usan el helper y ninguna guarda el instante UTC tal cual", () => {
        const permiso = leer("app/api/permit-request/route.ts");
        assert.match(permiso, /const now = horaDePared\(horaAccion\)\.toISOString\(\);/);
        assert.equal(/horaAccion \? horaAccion\.toISOString\(\)/.test(permiso), false);
        assert.match(leer("app/api/mutuos-acuerdos/route.ts"), /const createdAt = horaDePared\(horaAccion\);/);
        assert.match(leer("app/api/activities/equipo/[id]/route.ts"), /const nowIso = horaDePared\(hora_accion \? new Date\(hora_accion\) : null\)\.toISOString\(\);/);
        assert.match(leer("app/api/checklist-supervision/[id]/route.ts"), /fechaNotificacion: horaDePared\(accionAt\),/);
    });
});
