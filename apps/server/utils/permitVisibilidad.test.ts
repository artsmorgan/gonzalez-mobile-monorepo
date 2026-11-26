import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { permitVisibilityWhere } from "./permitVisibilidad";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

describe("solicitudes de permiso: propias y las que debe aprobar o rechazar", () => {
    it("quien no es ejecutivo de nadie (sin supervisor) ve solo las suyas", () => {
        assert.deepEqual(permitVisibilityWhere({ currentEmployeeId: 50, mySupervisorId: null }), { empleado_id: 50 });
        assert.deepEqual(permitVisibilityWhere({ currentEmployeeId: 50, mySupervisorId: 0 }), { empleado_id: 50 });
    });

    it("quien es el ejecutivo a cargo ve las suyas y las que debe aprobar o rechazar", () => {
        assert.deepEqual(permitVisibilityWhere({ currentEmployeeId: 50, mySupervisorId: 7 }), {
            OR: [{ empleado_id: 50 }, { ejecutivo_cuenta: 7 }],
        });
    });

    it("el servidor decide con el dato y no con un parámetro de la app: el listado ignora `mode`", () => {
        const ruta = leer(server, "app/api/permit-request/route.ts");
        const get = ruta.slice(ruta.indexOf("export async function GET"), ruta.indexOf("export async function POST"));
        assert.match(get, /permitVisibilityWhere\(\{ currentEmployeeId, mySupervisorId \}\)/);
        assert.equal(/searchParams\.get\("mode"\)/.test(get), false, "ya no lee `mode`");
        assert.equal(/mode === "mine"/.test(get), false);
    });

    it("la app ya no limita el listado según el puesto de su marca actual (un ejecutivo sin marca no veía lo que debía resolver)", () => {
        const p = leer(mobile, "screens/PermitRequestScreenV2.tsx");
        assert.equal(/includes\('ejecutivo'\)/.test(p), false);
        assert.equal(/\?mode=/.test(p), false);
        assert.match(p, /url: `\$\{apiUrl\}\/api\/permit-request`,/);
    });

    it("los botones de aprobar y rechazar siguen saliendo solo donde la persona es el ejecutivo y la solicitud está pendiente", () => {
        const ruta = leer(server, "app/api/permit-request/route.ts");
        assert.match(ruta, /const canCompleteByExecutive =\s*isExecutiveForRecord &&\s*estado === "pendiente"/);
        const p = leer(mobile, "screens/PermitRequestScreenV2.tsx");
        assert.match(p, /Boolean\(r\.can_complete_by_executive\)/);
    });
});
