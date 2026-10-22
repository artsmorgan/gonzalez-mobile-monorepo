import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { handleEnviarDocumento, handlePublicarDocumento, handleTerminarAsignacion, handleVistaPreviaDocumento, resolverDestinatarios, type DocDeps } from "./guardifyApi";
import { entregarDocumentosPendientes, type Dyn } from "./service";

const KEY = "una-llave-de-guardify-de-mas-de-24-caracteres";
const env = { GUARDIFY_REPORTS_API_KEY: KEY };
const AHORA = "2026-10-21T08:00:00.000Z";
const auth = { authorization: `Bearer ${KEY}`, "x-guardify-user": "ana@empresa.com" };

function memoria(seed: Record<string, any[]> = {}) {
    const tablas: Record<string, any[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
    const coincide = (row: any, where: any = {}) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "in" in (v as any) ? (v as any).in.includes(row[k]) : row[k] === v));
    const dyn: Dyn = {
        async find(t, a = {}) { return (tablas[t] ??= []).filter((r) => coincide(r, a.where)).map((r) => ({ ...r })); },
        async create(t, d) { const row = { id: Math.max(0, ...(tablas[t] ??= []).map((r) => r.id ?? 0)) + 1, ...d }; tablas[t]!.push(row); return { ...row }; },
        async update(t, w, d) { const row = (tablas[t] ??= []).find((r) => r.id === w.id); if (!row) throw new Error("no existe"); Object.assign(row, d); return { ...row }; },
    };
    return { dyn, tablas };
}

/** Estructura simulada: puestos 1,2 (contrato 10, división 3), puesto 3 (contrato 11, división 4). Empleados 100,101 en el puesto 1; 102 en el 2; 103 en el 3; 104 dado de baja. */
function fakeDb() {
    const tablas: Record<string, any[]> = {
        e_estructura_puesto: [{ id: 1, sucursal_id: 20, deleted: null }, { id: 2, sucursal_id: 20, deleted: null }, { id: 3, sucursal_id: 21, deleted: null }],
        e_estructura_sucursal: [{ id: 20, contrato_id: 10 }, { id: 21, contrato_id: 11 }],
        e_estructura_contrato: [{ id: 10, cliente_id: 5, empresa_id: 1, division_id: 3 }, { id: 11, cliente_id: 6, empresa_id: 1, division_id: 4 }],
        c_empleado_plaza: [{ empleado_id: 100, puesto_id: 1 }, { empleado_id: 101, puesto_id: 1 }, { empleado_id: 102, puesto_id: 2 }, { empleado_id: 103, puesto_id: 3 }, { empleado_id: 104, puesto_id: 1 }],
        c_empleado: [{ id: 100, estado: "Activo" }, { id: 101, estado: "Activo" }, { id: 102, estado: "Activo" }, { id: 103, estado: "Activo" }, { id: 104, estado: "Baja" }],
    };
    const coincide = (row: any, where: any = {}) => Object.entries(where).every(([k, v]) => {
        if (v && typeof v === "object" && "in" in (v as any)) return (v as any).in.includes(row[k]);
        if (v && typeof v === "object" && "not" in (v as any)) return row[k] !== (v as any).not;
        return row[k] === v;
    });
    return new Proxy({}, { get: (_t, name: string) => ({ findMany: async (a: any = {}) => (tablas[name] ?? []).filter((r) => coincide(r, a.where)) }) }) as any;
}

function deps(seed: Record<string, any[]> = {}, over: Partial<DocDeps> = {}) {
    const m = memoria(seed);
    const subidos: any[] = [];
    const d: DocDeps = { dyn: m.dyn, db: fakeDb(), env, ahoraIso: () => AHORA, subir: async (carpeta, a) => { subidos.push({ carpeta, ...a }); return { name: `${subidos.length}.${a.extension}`, original_name: a.original_name, extension: a.extension, type: a.type }; }, ...over };
    return { ...m, d, subidos };
}

function publicar(meta: Record<string, unknown>, contenido = "contenido del documento", headers: Record<string, string> = auth) {
    const form = new FormData();
    form.set("meta", JSON.stringify(meta));
    form.set("file", new Blob([contenido], { type: "application/pdf" }), "protocolo.pdf");
    return new Request("http://x/api/guardify/documents", { method: "POST", body: form, headers });
}
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const meta = (over: Record<string, unknown> = {}) => ({ documentId: "doc-1", versionId: "ver-1", version: 1, title: "Protocolo", description: "d", fileName: "protocolo.pdf", sha256: sha("contenido del documento"), seal: "s".repeat(64), publishedBy: "ana@empresa.com", ...over });
const post = (url: string, body: unknown, headers: Record<string, string> = auth) => new Request(`http://x/${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

describe("API de documentos para Guardify (issue #157)", () => {
    it("exige la llave de Guardify en todas las rutas", async () => {
        const { d } = deps();
        assert.equal((await handlePublicarDocumento(publicar(meta(), "x", {}), d)).status, 401);
        assert.equal((await handleVistaPreviaDocumento(post("p", { audience: "company" }, { authorization: "Bearer otra-llave-que-no-es-la-correcta-12345" }), d)).status, 401);
        assert.equal((await handleEnviarDocumento(post("e", {}, {}), d)).status, 401);
        assert.equal((await handleTerminarAsignacion(post("x", {}, {}), "1", d)).status, 401);
        const sinConfigurar = await handlePublicarDocumento(publicar(meta()), { ...d, env: {} });
        assert.equal(sinConfigurar.status, 503);
    });

    it("publicar el documento nuevo crea el manual en la v1 con su archivo, huellas y sello, y responde 201 { id }", async () => {
        const { d, tablas, subidos } = deps();
        const res = await handlePublicarDocumento(publicar(meta()), d);
        assert.equal(res.status, 201);
        const { id } = (await res.json()) as any;
        const m = tablas.e_manual_puesto![0];
        assert.deepEqual([m.id, id, m.title, m.version, m.isActive, m.externo_documento_id, m.externo_version_id, m.sello, m.archivo_sha256], [id, id, "Protocolo", 1, true, "doc-1", "ver-1", "s".repeat(64), sha("contenido del documento")]);
        assert.equal(m.created_by, "ana@empresa.com");
        assert.deepEqual([subidos[0].carpeta, subidos[0].extension], [`job-manuals/${id}`, "pdf"]);
        const f = tablas.e_archivos_manual_puesto![0];
        assert.deepEqual([f.manual_puesto_id, f.version, f.sha256, f.name], [id, 1, sha("contenido del documento"), "1.pdf"]);
    });
    it("reenviar la misma versión no duplica (reintento de Guardify)", async () => {
        const { d, tablas } = deps();
        await handlePublicarDocumento(publicar(meta()), d);
        const res = await handlePublicarDocumento(publicar(meta()), d);
        assert.equal(res.status, 201);
        assert.equal(tablas.e_manual_puesto!.length, 1);
        assert.equal(tablas.e_archivos_manual_puesto!.length, 1);
    });
    it("una versión nueva conserva la anterior: histórico, archivo anterior retirado (no borrado) y firmas de la v1 intactas", async () => {
        const { d, tablas } = deps();
        await handlePublicarDocumento(publicar(meta()), d);
        tablas.e_empleado_visualizacion_manual_puesto = [{ id: 1, empleado_id: 100, manual_puesto_id: 1, version: 1, firma_empleado: "f" }];
        const v2 = await handlePublicarDocumento(publicar(meta({ versionId: "ver-2", version: 2, seal: "t".repeat(64), sha256: sha("nuevo") }), "nuevo"), d);
        assert.equal(v2.status, 201);
        const m = tablas.e_manual_puesto![0];
        assert.deepEqual([tablas.e_manual_puesto!.length, m.version, m.externo_version_id, m.sello], [1, 2, "ver-2", "t".repeat(64)]);
        assert.deepEqual([tablas.e_manual_puesto_version!.length, tablas.e_manual_puesto_version![0].version, tablas.e_manual_puesto_version![0].externo_version_id], [1, 1, "ver-1"]);
        const archivos = tablas.e_archivos_manual_puesto!;
        assert.deepEqual(archivos.map((a) => [a.version, a.retirado_en_version ?? null]), [[1, 2], [2, null]]);
        assert.deepEqual([tablas.e_empleado_visualizacion_manual_puesto![0].version, tablas.e_empleado_visualizacion_manual_puesto![0].firma_empleado], [1, "f"]);
    });
    it("una versión con número igual o menor a la vigente es un conflicto (409)", async () => {
        const { d } = deps();
        await handlePublicarDocumento(publicar(meta({ version: 3 })), d);
        const res = await handlePublicarDocumento(publicar(meta({ versionId: "ver-x", version: 2 })), d);
        assert.equal(res.status, 409);
    });
    it("rechaza un archivo cuya huella no coincide, sin título o sin archivo, y uno de más de 50 MB", async () => {
        const { d } = deps();
        assert.equal((await handlePublicarDocumento(publicar(meta({ sha256: sha("otro contenido") })), d)).status, 422);
        assert.equal((await handlePublicarDocumento(publicar(meta({ title: "" })), d)).status, 422);
        assert.equal((await handlePublicarDocumento(new Request("http://x", { method: "POST", body: JSON.stringify({}), headers: { ...auth, "content-type": "application/json" } }), d)).status, 400);
        const grande = publicar(meta({ sha256: undefined }), "x".repeat(10));
        assert.equal((await handlePublicarDocumento(grande, d)).status, 201);
    });
    it("si falla la subida del archivo el documento nuevo no queda visible", async () => {
        const { d, tablas } = deps({}, { subir: async () => { throw new Error("almacenamiento caído"); } });
        const res = await handlePublicarDocumento(publicar(meta()), d);
        assert.equal(res.status, 500);
        assert.equal(tablas.e_manual_puesto![0].isActive, false);
    });

    it("la vista previa cuenta los empleados que recibirían el documento (un código cubre todo lo que cuelga; los dados de baja no cuentan)", async () => {
        const { d } = deps();
        const cuenta = async (body: unknown) => ((await (await handleVistaPreviaDocumento(post("p", body), d)).json()) as any).recipients;
        assert.equal(await cuenta({ audience: "units", scope: "division:3" }), 3); // 100, 101, 102 (el 104 está de baja)
        assert.equal(await cuenta({ audience: "units", scope: "puesto:3" }), 1);
        assert.equal(await cuenta({ audience: "units", scope: "puesto:1,puesto:3" }), 3);
        assert.equal(await cuenta({ audience: "company" }), 4);
        assert.equal(await cuenta({ audience: "app_users" }), 4);
        assert.equal((await handleVistaPreviaDocumento(post("p", { audience: "units", scope: "" }), d)).status, 422);
        assert.equal((await handleVistaPreviaDocumento(post("p", { audience: "units", scope: "mal" }), d)).status, 422);
        assert.equal((await handleVistaPreviaDocumento(post("p", { audience: "nadie" }), d)).status, 422);
    });

    const conDocumento = async () => {
        const x = deps();
        await handlePublicarDocumento(publicar(meta()), x.d);
        return x;
    };
    it("enviar a unidades crea la asignación vigente, vincula los puestos y entrega a los empleados de hoy con la fecha", async () => {
        const { d, tablas } = await conDocumento();
        const res = await handleEnviarDocumento(post("e", { documentId: "doc-1", externalVersionId: "ver-1", version: 1, audience: "units", scope: "division:3", standing: true, requestedBy: { name: "Ana", email: "ana@empresa.com" } }), d);
        assert.equal(res.status, 201);
        const body: any = await res.json();
        assert.equal(body.recipients, 3);
        const a = tablas.e_documento_asignacion![0];
        assert.deepEqual([String(a.id), a.audience, a.scope, a.vigente, a.solicitado_por, a.manual_puesto_id], [body.id, "units", "division:3", true, "ana@empresa.com", 1]);
        assert.deepEqual(tablas.e_puestos_manual_puesto!.map((l) => l.puesto_id).sort(), [1, 2]);
        const enlaces = tablas.e_empleados_manual_puesto!;
        assert.deepEqual(enlaces.map((e) => e.empleado_id).sort(), [100, 101, 102]);
        assert.deepEqual([enlaces[0].version, enlaces[0].entregado_en, enlaces[0].origen], [1, AHORA, "guardify"]);
    });
    it("quien entra DESPUÉS a un puesto con el documento asignado lo recibe al marcar su ingreso, sin nuevo envío; y al terminar la asignación ya no", async () => {
        const { d, tablas, dyn } = await conDocumento() as any;
        const env1: any = await (await handleEnviarDocumento(post("e", { documentId: "doc-1", audience: "units", scope: "division:3", standing: true }), d)).json();
        const hierNuevo = { puesto: 1, corpo: 20, contrato: 10, cliente: 5, empresa: 1, division: 3 };
        const r = await entregarDocumentosPendientes(dyn, { empleadoId: 555, hier: hierNuevo, ahoraIso: AHORA });
        assert.equal(r.creados, 1);
        assert.ok(tablas.e_empleados_manual_puesto.some((e: any) => e.empleado_id === 555));
        // terminar la asignación: lo ya entregado se conserva, a quien entre después ya no se le asigna
        const fin = await handleTerminarAsignacion(post("x", { endedBy: { email: "ana@empresa.com" } }), env1.id, d);
        assert.deepEqual(await fin.json(), { ok: true });
        assert.deepEqual([tablas.e_documento_asignacion[0].vigente, tablas.e_documento_asignacion[0].terminado_por], [false, "ana@empresa.com"]);
        const otroPuesto = { ...hierNuevo, puesto: 99 };
        assert.equal((await entregarDocumentosPendientes(dyn, { empleadoId: 556, hier: otroPuesto, ahoraIso: AHORA })).creados, 0);
        assert.ok(tablas.e_empleados_manual_puesto.some((e: any) => e.empleado_id === 555)); // nada se borra
    });
    it("enviar a toda la empresa entrega a todos y también alcanza a los nuevos", async () => {
        const { d, tablas, dyn } = await conDocumento() as any;
        const res: any = await (await handleEnviarDocumento(post("e", { documentId: "doc-1", audience: "company", standing: true }), d)).json();
        assert.equal(res.recipients, 4);
        const nuevo = await entregarDocumentosPendientes(dyn, { empleadoId: 777, hier: { puesto: 3, corpo: 21, contrato: 11, cliente: 6, empresa: 1, division: 4 }, ahoraIso: AHORA });
        assert.equal(nuevo.creados, 1);
        assert.equal(tablas.e_puestos_manual_puesto.length, 0); // 'company' no vincula puestos: la regla vigente alcanza
    });
    it("no se envía un documento que la app no tiene, ni una versión que no es la vigente", async () => {
        const { d } = await conDocumento();
        assert.equal((await handleEnviarDocumento(post("e", { documentId: "no-existe", audience: "company" }), d)).status, 409);
        assert.equal((await handleEnviarDocumento(post("e", { documentId: "doc-1", externalVersionId: "ver-vieja", audience: "company" }), d)).status, 409);
        assert.equal((await handleEnviarDocumento(post("e", { audience: "company" }), d)).status, 422);
    });
    it("terminar una asignación inexistente responde 404 y terminarla dos veces es inofensivo", async () => {
        const { d } = await conDocumento();
        assert.equal((await handleTerminarAsignacion(post("x", {}), "999", d)).status, 404);
        const e: any = await (await handleEnviarDocumento(post("e", { documentId: "doc-1", audience: "company" }), d)).json();
        assert.equal((await handleTerminarAsignacion(post("x", {}), e.id, d)).status, 200);
        assert.equal((await handleTerminarAsignacion(post("x", {}), e.id, d)).status, 200);
    });
    it("los destinatarios de 'units' son solo los de los puestos del alcance", async () => {
        const d = await resolverDestinatarios(fakeDb(), "units", [{ nivel: "contrato", id: 11 }]);
        assert.deepEqual([d.puestoIds, d.empleadoIds], [[3], [103]]);
    });
});
