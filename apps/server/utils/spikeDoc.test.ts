import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(__dirname, "..", "..", "..");
const doc = fs.readFileSync(path.join(root, "docs", "guardify", "spike-funcionalidades-stephanie.md"), "utf8");

const SKIP_DIRS = new Set(["node_modules", ".next", ".expo", ".git", "android", "ios", "vendor"]);
const files: string[] = [];
(function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else files.push(p.replace(/\\/g, "/"));
    }
})(path.join(root, "apps"));

const rootPosix = root.replace(/\\/g, "/");

/** Resuelve una referencia completa (`apps/...`) o abreviada (`permit-request/[id]/route.ts`) a un archivo único del repositorio. */
function resolve(ref: string): string | null {
    const full = path.join(root, ref).replace(/\\/g, "/");
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    const matches = files.filter((f) => f.endsWith("/" + ref));
    return matches.length === 1 ? matches[0]! : null;
}

const refs = [...doc.matchAll(/`([A-Za-z0-9_\-\[\]\/.]+\.(?:ts|tsx|md|prisma|js)):(\d+)(?:[-,](\d+))?/g)]
    .map((m) => ({ file: m[1]!, line: Number(m[2]), end: m[3] ? Number(m[3]) : null }))
    .filter((r) => !r.file.startsWith("dynamic-api"));

describe("referencias del spike #189", () => {
    it("el documento cita bastantes referencias", () => {
        assert.ok(refs.length >= 60, `solo ${refs.length}`);
    });
    it("cada archivo citado existe de forma única y la línea está dentro del archivo", () => {
        const problemas: string[] = [];
        for (const r of refs) {
            const f = resolve(r.file);
            if (!f) { problemas.push(`${r.file}: no existe o es ambiguo`); continue; }
            const n = fs.readFileSync(f, "utf8").split("\n").length;
            if (r.line < 1 || r.line > n || (r.end && r.end > n)) problemas.push(`${r.file}:${r.line} fuera de rango (${n} líneas)`);
        }
        assert.deepEqual(problemas, []);
    });

    /** Afirmaciones clave del documento: la línea citada (o la siguiente) contiene lo que se dice. */
    const claves: Array<[string, number, RegExp]> = [
        ["apps/server/utils/guardifyActions/permisos.ts", 6, /ejecutivo_cuenta/],
        ["apps/server/utils/guardifyActions/permisos.ts", 38, /esEjecutivoDelPermiso/],
        ["apps/server/utils/guardifyActions/mutuos.ts", 6, /supervisorDelActor/],
        ["apps/server/utils/guardifyActions/aprobar-permiso.ts", 15, /planillasToken/],
        ["apps/server/utils/guardifyActions/aprobar-permiso.ts", 34, /No autorizado para aprobar/],
        ["apps/server/utils/guardifyActions/aprobar-permiso.ts", 55, /length < 10/],
        ["apps/server/utils/guardifyActions/aprobar-permiso.ts", 107, /for \(const turno of turnosUpdated\)/],
        ["apps/server/utils/guardifyActions/aprobar-permiso.ts", 245, /coordinado_por_id: 3/],
        ["apps/server/utils/guardifyActions/aprobar-permiso.ts", 249, /acciones\/permisos/],
        ["apps/server/utils/guardifyActions/aprobar-mutuo.ts", 25, /length < 10/],
        ["apps/server/utils/guardifyActions/aprobar-mutuo.ts", 61, /out_of_scope/],
        ["apps/server/utils/guardifyActions/aprobar-mutuo.ts", 99, /revertir/],
        ["apps/server/utils/guardifyActions/aprobar-mutuo.ts", 108, /\/cdg/],
        ["apps/server/utils/guardifyActions/aprobar-mutuo.ts", 115, /coordinado_por_id: 3/],
        ["apps/server/utils/guardifyActions/inventario.ts", 134, /createdEntregas\+\+/],
        ["apps/server/utils/guardifyActions/inventario.ts", 147, /formattedList\.find/],
        ["apps/server/utils/guardifyActions/inventario.ts", 158, /cargarInventarioPuesto/],
        ["apps/server/utils/guardifyActions/inventario.ts", 172, /plan\.send\.length === 0/],
        ["apps/server/utils/guardifyActions/inventario.ts", 175, /carga-masiva/],
        ["apps/server/app/api/mantenimiento-equipo/bulk-articulos/route.ts", 26, /cargarInventarioPuesto/],
        ["apps/server/app/api/permit-request/[id]/route.ts", 31, /payload/],
        ["apps/server/utils/guardifyActions/handler.ts", 121, /signature_required: 400/],
        ["apps/server/utils/guardifyActions/handler.ts", 133, /planillas_unavailable/],
        ["apps/server/utils/guardifyActions/handler.ts", 150, /enCurso/],
        ["apps/server/utils/guardifyActions/handler.ts", 160, /verifyGuardifyApiKey/],
        ["apps/server/utils/guardifyActions/handler.ts", 164, /401/],
        ["apps/server/utils/guardifyActions/handler.ts", 235, /idempotency-key/],
        ["apps/server/utils/guardifyActions/handler.ts", 244, /Idempotencia por estado/],
        ["apps/server/utils/guardifyActions/handler.ts", 274, /conIdempotencia\(idem/],
        ["apps/server/utils/guardifyActions/handler.ts", 342, /conIdempotencia\(clave/],
        ["apps/server/utils/idempotency.ts", 75, /export async function ejecutarIdempotente/],
        ["apps/server/utils/guardifyActions/handler.ts", 258, /Planillas/],
        ["apps/server/utils/guardifyActions/handler.ts", 283, /handleLookupEmpleado/],
        ["apps/server/utils/guardifyActions/handler.ts", 304, /IMPORT_MAX_ROWS = 2000/],
        ["apps/server/utils/guardifyActions/handler.ts", 312, /handleImport/],
        ["apps/server/utils/guardifyActions/handler.ts", 336, /creados/],
        ["apps/server/utils/guardifyActions/handler.ts", 340, /import:\$\{tipo\}/],
        ["apps/server/utils/guardifyActions/actor.ts", 12, /ACTOR_MAX_SKEW_MS/],
        ["apps/server/utils/guardifyActions/actor.ts", 25, /verifyActorHeaders/],
        ["apps/server/utils/guardifyActions/actor.ts", 50, /resolveActorEmployee/],
        ["apps/server/utils/guardifyActions/actor.ts", 51, /"BA"/],
        ["apps/server/docs/guardify-actions-api.md", 20, /misma/],
        ["apps/server/docs/guardify-actions-api.md", 24, /a_mobile_token_for_planillas/],
        ["apps/server/docs/guardify-actions-api.md", 40, /Sin evidencia/],
        ["apps/server/docs/guardify-actions-api.md", 44, /vuelve a pendiente/],
        ["apps/server/docs/protocolo-acciones.md", 46, /Idempotencia/],
        ["apps/server/docs/protocolo-acciones.md", 77, /5000 filas/],
        ["apps/server/app/api/activities/route.ts", 29, /marca_id/],
        ["apps/server/app/api/activities/route.ts", 108, /createMany/],
        ["apps/server/app/api/articulo-mantenimiento/route.ts", 188, /last_estado/],
        ["apps/server/utils/guardifyReports/auth.ts", 27, /x-guardify-user/],
        ["apps/server/utils/verifyPlanillasToken.ts", 6, /60 \* 60/],
        ["apps/server/utils/getPlanillasToken.ts", 44, /password: ""/],
        ["apps/server/utils/createTokenPlanillas.ts", 33, /username: cedula/],
        ["apps/server/app/api/auth/login/route.ts", 205, /a_mobile_token_for_planillas/],
        ["apps/server/app/api/modules-release/route.ts", 15, /n_app_module_visibility/],
        ["apps/server/app/api/lunch-time/route.ts", 172, /es_manual/],
        ["apps/mobile/screens/ActivitiesScreen.tsx", 50, /'Bueno' \| 'Malo' \| 'No está'/],
        ["apps/mobile/screens/MantenimientoEquipoScreen.tsx", 3412, /'Reemplazar'/],
        ["apps/mobile/screens/MantenimientoEquipoScreen.tsx", 3418, /'Reparar en taller'/],
        ["apps/mobile/hooks/mantenimientoEquipoPlantillaLocal.ts", 12, /PLANTILLA_TABLE1_HEADERS/],
        ["apps/mobile/App.tsx", 4706, /uniform_request/],
        ["apps/server/app/prisma/schema.prisma", 2845, /model c_marca_dia/],
        ["apps/server/app/prisma/schema.prisma", 3605, /e_estructura_articulo_corpo_puesto_plan/],
        ["apps/server/app/prisma/schema.prisma", 3585, /e_estructura_articulo_corpo_puesto_entrega/],
        ["apps/server/app/prisma/schema.prisma", 174, /model c_articulo_mantenimiento/],
        ["apps/server/app/prisma/schema.prisma", 914, /model e_actividades /],
        ["apps/server/app/prisma/schema.prisma", 938, /model e_actividades_puesto_plaza/],
        ["apps/server/app/prisma/schema.prisma", 812, /model c_solicitud_permiso/],
        ["apps/server/app/prisma/schema.prisma", 1187, /model e_mutuos_acuerdos/],
        ["apps/server/app/prisma/schema.prisma", 1528, /model a_mobile_token_for_planillas/],
        ["apps/server/app/prisma/schema.prisma", 681, /model c_producto_no_conforme/],
        ["apps/server/app/prisma/schema.prisma", 21, /model c_acta_entre_producto/],
        ["apps/server/utils/objectAccess.ts", 40, /authorizeSelfOrAdmin/],
        ["apps/server/utils/objectAccess.ts", 48, /authorizeMarcaAccess/],
    ];
    for (const [file, line, re] of claves) {
        it(`${file}:${line} contiene ${re}`, () => {
            const f = resolve(file);
            assert.ok(f, "archivo no encontrado");
            const lines = fs.readFileSync(f!, "utf8").split("\n");
            const window = lines.slice(Math.max(0, line - 2), line + 1).join("\n");
            assert.match(window, re, `la línea ${line} ya no dice lo que el documento afirma`);
        });
    }
});
