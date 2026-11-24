import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { cargarActividadesPuesto, construirFrecuencia, fechaAYmd, parseBooleano, parseFilaActividad, parseFrecuencia, parseHorarios, parseTiposTurno, planificarCargaActividades } from "./actividades";
import type { ActionEnv } from "./env";
import { handleImport } from "./handler";
import { makeActionEnv } from "./envFactory";

// Solo estructuras de la lógica (ids, códigos, banderas): ningún registro de negocio inventado.
const KEY = "k".repeat(32);
const IDEM = "0123456789abcdef0123";
const NOW = 1_700_000_000_000;
const binding = (method: string, url: string, body = "") => { const u = new URL(url); return `${method.toUpperCase()}\n${u.pathname}${u.search}\n${crypto.createHash("sha256").update(body, "utf8").digest("hex")}`; };
const sign = (claims: unknown, bind: string) => {
    const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
    return { "x-guardify-actor": payload, "x-guardify-actor-sig": crypto.createHmac("sha256", KEY).update(`${payload}\n${bind}`).digest("hex") };
};
const URL_X = "https://app.test/api/guardify/actions/imports/actividades-puesto";
const req = (body: unknown, extra: Record<string, string> = {}, signed = true) => {
    const text = JSON.stringify(body);
    const firma = signed ? sign({ actor: { email: "a@b.co", name: "n", cedula: "c" }, ts: NOW, tenant: "t" }, binding("POST", URL_X, text)) : {};
    return new Request(URL_X, { method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json", ...firma, ...extra }, body: text });
};

type Call = Record<string, any>;
const PUESTOS = [{ id: 10, codigo: "P-A" }, { id: 11, codigo: "P-B" }, { id: 12, codigo: "P-C" }];

/** Entorno falso: registra lo que se escribe y se notifica; las lecturas salen de `many`. */
function fakeEnv(opts: { existentes?: { puesto_id: number; nombre: string }[]; falla?: string; sinPlazas?: boolean } = {}) {
    const calls: Call[] = [];
    const reports: [number, string][] = [];
    const plazaNotifs: { title: string; message: string; plazas: number[] }[] = [];
    let siguiente = 100;
    const many: Record<string, any[]> = {
        e_estructura_puesto: PUESTOS.map((p) => ({ ...p, sucursal_id: 7 })),
        e_actividades_puesto: (opts.existentes ?? []).map((e) => ({ puesto_id: e.puesto_id, e_actividades: { nombre_actividad: e.nombre } })),
        e_estructura_sucursal: [{ id: 7, contrato_id: 3 }],
        e_estructura_contrato: [{ id: 3, cliente_id: 4, empresa_id: 5, division_id: 6 }],
        e_estructura_plazas: opts.sinPlazas ? [] : [{ id: 501 }, { id: 502 }],
    };
    const table = (n: string) => ({ findUnique: async () => null, findFirst: async () => null, findMany: async () => many[n] ?? [] });
    const env: ActionEnv = {
        call: async (d) => {
            calls.push(d);
            if (opts.falla && d.table === opts.falla && d.action !== "DELETE") throw new Error(`falló ${opts.falla}`);
            if (d.action === "GET") return null;
            return { ...(d.data ?? {}), id: d.table === "e_actividades" && d.action === "POST" ? siguiente++ : d.where?.id ?? 0 };
        },
        prisma: new Proxy({} as Record<string, any>, { get: (t, n: string) => (t[n] ??= table(n)) }),
        notify: async () => undefined,
        notifyPlazas: async (title, message, plazas) => { plazaNotifs.push({ title, message, plazas }); },
        report: async (s, m) => { reports.push([s, m]); },
        nowIso: () => "2026-11-24T20:00:00.000Z",
        planillas: async () => ({ success: true }),
        tokenPlanillas: async () => null,
    };
    return { env, calls, reports, plazaNotifs };
}
const escrituras = (calls: Call[]) => calls.filter((c) => c.action !== "GET");

const fila = (over: Record<string, unknown> = {}) => ({
    codigo_puesto: "P-A",
    nombre_actividad: "Ronda de revisión",
    descripcion_actividad: "Revisar accesos y cerraduras",
    fecha_inicio: "24-11-2026",
    fecha_fin: "",
    frecuencia: "semanal",
    horarios: "08:00, 14:30",
    tipos_turno: "D,M",
    es_revision_equipo: "no",
    ...over,
});

describe("#213: lectura de los valores de una fila", () => {
    it("fechas DD-MM-AAAA, DD/MM/AAAA o AAAA-MM-DD, solo si el día existe", () => {
        assert.equal(fechaAYmd("24-11-2026"), "2026-11-24");
        assert.equal(fechaAYmd("5/1/2026"), "2026-01-05");
        assert.equal(fechaAYmd("2026-11-24"), "2026-11-24");
        assert.equal(fechaAYmd("2026-11-24T00:00:00.000Z"), "2026-11-24");
        for (const v of ["31-02-2026", "2026-13-01", "ayer", "", "24-11-26", null, undefined]) assert.equal(fechaAYmd(v), null, String(v));
    });
    it("tipos de turno por letra o por nombre, sin repetir y en orden D, M, N", () => {
        assert.deepEqual(parseTiposTurno("D,M"), ["D", "M"]);
        assert.deepEqual(parseTiposTurno("nocturno; Diurno"), ["D", "N"]);
        assert.deepEqual(parseTiposTurno(["m", "M"]), ["M"]);
        for (const v of ["", "X", "D,X", null]) assert.equal(parseTiposTurno(v), null, String(v));
    });
    it("frecuencias en español (con o sin tildes) y sí/no", () => {
        assert.equal(parseFrecuencia("Semanal"), "semanal");
        assert.equal(parseFrecuencia("días laborables"), "laborables");
        assert.equal(parseFrecuencia("Cada año"), "anual");
        assert.equal(parseFrecuencia("quincenal"), null);
        assert.equal(parseBooleano("Sí"), true);
        assert.equal(parseBooleano(""), false);
        assert.equal(parseBooleano("quizás"), null);
    });
    it("horarios HH:mm ordenados y sin repetir; vacío es válido", () => {
        assert.deepEqual(parseHorarios("14:30, 8:00,08:00"), ["08:00", "14:30"]);
        assert.deepEqual(parseHorarios(""), []);
        assert.equal(parseHorarios("25:00"), null);
        assert.equal(parseHorarios("8h"), null);
    });
    it("una fila completa se normaliza; cada campo obligatorio o mal escrito dice su motivo", () => {
        const ok = parseFilaActividad(fila());
        assert.equal(ok.ok, true);
        if (ok.ok) assert.deepEqual([ok.fila.fecha_inicio, ok.fila.fecha_fin, ok.fila.frecuencia, ok.fila.horarios, ok.fila.tipos_turno, ok.fila.es_revision_equipo], ["2026-11-24", null, "semanal", ["08:00", "14:30"], ["D", "M"], false]);
        const motivo = (over: Record<string, unknown>) => { const r = parseFilaActividad(fila(over)); return r.ok ? null : r.motivo; };
        assert.match(motivo({ codigo_puesto: "" })!, /código de puesto obligatorio/);
        assert.match(motivo({ nombre_actividad: " " })!, /nombre de la actividad obligatorio/);
        assert.match(motivo({ nombre_actividad: "x".repeat(256) })!, /demasiado largo/);
        assert.match(motivo({ descripcion_actividad: "" })!, /descripción de la actividad obligatoria/);
        assert.match(motivo({ fecha_inicio: "mañana" })!, /fecha de inicio obligatoria/);
        assert.match(motivo({ fecha_fin: "20-11-2026" })!, /anterior a la fecha de inicio/);
        assert.match(motivo({ fecha_fin: "xx" })!, /fecha de fin/);
        assert.match(motivo({ frecuencia: "cada rato" })!, /frecuencia inválida/);
        assert.match(motivo({ tipos_turno: "Q" })!, /tipos de turno inválidos/);
        assert.match(motivo({ horarios: "99:99" })!, /horarios/);
        assert.match(motivo({ es_revision_equipo: "tal vez" })!, /es_revision_equipo/);
        assert.equal(parseFilaActividad("texto").ok, false);
    });
});

describe("#213: la frecuencia se guarda como la guarda la app", () => {
    const f = (frecuencia: any, fecha_inicio: string, extra: object = {}) => JSON.parse(construirFrecuencia({ frecuencia, fecha_inicio, fecha_fin: null, horarios: [], ...extra }));
    it("diaria y laborables", () => {
        assert.deepEqual(f("diaria", "2026-11-24"), { type: "daily", interval: 1, endType: "never", title: "Cada día" });
        assert.deepEqual(f("laborables", "2026-11-24"), { type: "weekdays", interval: 1, endType: "never", title: "Todos los días laborables (lunes a viernes)" });
    });
    it("semanal: el día de la semana sale de la fecha de inicio (24-11-2026 es martes)", () => {
        assert.deepEqual(f("semanal", "2026-11-24"), { type: "weekly", interval: 1, weekday: 2, endType: "never", title: "Cada semana el martes" });
    });
    it("mensual: ordinal real del día de la semana; del 5.º en adelante es «último»", () => {
        assert.deepEqual(f("mensual", "2026-11-03"), { type: "monthly-weekday", interval: 1, weekday: 2, weekOrdinal: 1, endType: "never", title: "Cada mes el primer martes" });
        assert.equal(f("mensual", "2026-11-24").title, "Cada mes el cuarto martes");
        assert.deepEqual(f("mensual", "2026-11-29"), { type: "monthly-last", interval: 1, weekday: 0, weekOrdinal: 5, endType: "never", title: "Cada mes el último domingo" });
    });
    it("anual, con fecha de fin y con horarios", () => {
        assert.deepEqual(f("anual", "2026-11-24"), { type: "yearly", interval: 1, day: 24, month: 11, endType: "never", title: "Anualmente el 24 de noviembre" });
        const c = f("diaria", "2026-11-24", { fecha_fin: "2026-12-31", horarios: ["08:00", "14:30"] });
        assert.deepEqual([c.endType, c.endDate, c.schedule], ["date", "2026-12-31", ["08:00", "14:30"]]);
    });
    it("los títulos son los mismos que genera la pantalla de Actividades", () => {
        const app = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "mobile", "screens", "ActivitiesScreen.tsx"), "utf8");
        for (const t of ["'Cada día'", "`Cada semana el ${weekdayName}`", "`Cada mes el ${ordinalName} ${weekdayName2}`", "`Cada mes el último ${weekdayName3}`", "'Todos los días laborables (lunes a viernes)'", "`Anualmente el ${config.day} de ${monthName}`"]) assert.ok(app.includes(t), t);
    });
});

describe("#213: planificar la carga (no escribe nada)", () => {
    it("sin filas: error; puesto que no existe o datos distintos entre filas de una misma actividad: error por fila y nada se procesa", async () => {
        const f = fakeEnv();
        assert.equal((await planificarCargaActividades(f.env.prisma, [])).kind, "invalid");
        const p: any = await planificarCargaActividades(f.env.prisma, [fila({ codigo_puesto: "NO" }), fila({ codigo_puesto: "P-B", descripcion_actividad: "otra cosa" }), fila({ codigo_puesto: "P-B" })]);
        assert.equal(p.kind, "invalid");
        assert.deepEqual(p.filas.map((x: any) => x.estado), ["error", "omitida", "error"].map((e, i) => (i === 1 ? "omitida" : e)));
        assert.match(p.filas[0].motivo, /código de puesto «NO» no existe/);
        assert.match(p.filas[2].motivo, /datos distintos a los de la fila 2|datos distintos a los de la fila/);
        assert.equal(f.calls.length, 0);
    });
    it("las filas de una misma actividad (un puesto cada una) forman UNA actividad con todos sus puestos", async () => {
        const f = fakeEnv();
        const p: any = await planificarCargaActividades(f.env.prisma, [fila(), fila({ codigo_puesto: "P-B" }), fila({ codigo_puesto: "P-C", nombre_actividad: "Otra actividad" })]);
        assert.equal(p.kind, "ok");
        assert.equal(p.actividades.length, 2);
        assert.deepEqual(p.actividades[0].puestoIds, [10, 11]);
        assert.deepEqual(p.actividades[0].filas, [1, 2]);
        assert.deepEqual(p.filas.map((x: any) => x.estado), ["creada", "creada", "creada"]);
    });
    it("lo que ya existe (mismo nombre en el puesto, sin tildes ni mayúsculas) y lo repetido en el archivo se omite con su motivo", async () => {
        const f = fakeEnv({ existentes: [{ puesto_id: 10, nombre: "RONDA DE REVISION" }] });
        const p: any = await planificarCargaActividades(f.env.prisma, [fila(), fila({ codigo_puesto: "P-B" }), fila({ codigo_puesto: "P-B" })]);
        assert.deepEqual(p.filas.map((x: any) => x.estado), ["omitida", "creada", "omitida"]);
        assert.match(p.filas[0].motivo, /Ya existe una actividad «Ronda de revisión» en el puesto P-A/);
        assert.match(p.filas[2].motivo, /Repetida en el archivo/);
        assert.deepEqual(p.actividades[0].puestoIds, [11]);
    });
});

describe("#213: cargar las actividades", () => {
    const aplicar = (f: ReturnType<typeof fakeEnv>, filas: unknown, modo: "validar" | "aplicar" = "aplicar") => cargarActividadesPuesto(f.env, { filas, modo, actorId: 5, firmaDigital: "firma-digital" });

    it("validar no escribe nada y dice qué se crearía", async () => {
        const f = fakeEnv();
        const r: any = await aplicar(f, [fila(), fila({ codigo_puesto: "P-B" })], "validar");
        assert.equal(r.ok, true);
        assert.deepEqual([r.body.modo, r.body.creadas, r.body.resumen], ["validar", { actividades: 1, puestos: 2 }, { recibidas: 2, creadas: 2, omitidas: 0, errores: 0 }]);
        assert.equal(escrituras(f.calls).length, 0);
        assert.match(r.body.mensaje, /Se crearían 1 actividad\(es\) en 2 puesto\(s\)/);
    });

    it("con errores: 400 con el detalle por fila y sin escribir", async () => {
        const f = fakeEnv();
        const r: any = await aplicar(f, [fila({ frecuencia: "x" }), fila()]);
        assert.deepEqual([r.ok, r.status, r.code], [false, 400, "invalid_request"]);
        assert.match(r.errors[0], /^Fila 1: frecuencia inválida/);
        assert.deepEqual(r.extra.filas.map((x: any) => x.estado), ["error", "omitida"]);
        assert.equal(escrituras(f.calls).length, 0);
    });

    it("aplicar crea la actividad, sus turnos, sus puestos, la jerarquía, avisa a las plazas y deja el rastro, firmando como el actor", async () => {
        const f = fakeEnv();
        const r: any = await aplicar(f, [fila(), fila({ codigo_puesto: "P-B" })]);
        assert.equal(r.ok, true);
        assert.deepEqual(r.body.creadas, { actividades: 1, puestos: 2 });
        assert.deepEqual(r.body.actividadIds, [100]);
        assert.deepEqual(r.body.puestoIds.sort(), [10, 11]);
        const w = escrituras(f.calls);
        assert.deepEqual(w.map((c) => [c.action, c.table]), [["POST", "e_actividades"], ["POST", "c_actividades_tipo_turno"], ["POST", "e_actividades_puesto"], ["UPDATE", "e_actividades"], ["POST", "c_cambios_apps_modules"]]);
        const act = w[0]!.data;
        assert.equal(act.nombre_actividad, "Ronda de revisión");
        assert.equal(act.created_by, 5);
        assert.equal(act.firma_responsable, "firma-digital");
        assert.equal(act.tipo_turno, "D");
        assert.equal(act.es_revision_equipo, false);
        assert.equal(act.fecha_inicio, "2026-11-24T00:00:00.000Z");
        assert.equal(act.fecha_fin, "2026-11-24T00:00:00.000Z", "sin fecha de fin, igual que la app: la de inicio");
        assert.equal(JSON.parse(act.frecuencia).title, "Cada semana el martes");
        assert.deepEqual(w[1]!.data, [{ actividad_id: 100, tipo_turno: "D" }, { actividad_id: 100, tipo_turno: "M" }]);
        assert.deepEqual(w[2]!.data, [{ actividad_id: 100, puesto_id: 10 }, { actividad_id: 100, puesto_id: 11 }]);
        assert.deepEqual([w[3]!.where, w[3]!.data], [{ id: 100 }, { empresa_id: 5, cliente_id: 4, division_id: 6, contrato_id: 3, corpo_id: 7, puesto_id: null }], "jerarquía común de los dos puestos");
        assert.equal(JSON.parse(w[4]!.data.cambios)[0].after.origen, "guardify");
        assert.equal(w[4]!.data.created_by, 5);
        assert.deepEqual(f.plazaNotifs, [{ title: "Actividad asignada", message: 'Se te ha asignado la actividad Ronda de revisión, la cual deberá realizarse "Cada semana el martes"', plazas: [501, 502] }]);
    });

    it("repetir la misma carga no crea nada", async () => {
        const f = fakeEnv({ existentes: [{ puesto_id: 10, nombre: "Ronda de revisión" }, { puesto_id: 11, nombre: "Ronda de revisión" }] });
        const r: any = await aplicar(f, [fila(), fila({ codigo_puesto: "P-B" })]);
        assert.equal(r.ok, true);
        assert.deepEqual([r.body.creadas.actividades, r.body.resumen.omitidas, r.body.resumen.creadas], [0, 2, 0]);
        assert.match(r.body.mensaje, /todo ya existía/);
        assert.equal(escrituras(f.calls).length, 0);
    });

    it("si la actividad no se puede dejar completa, se deshace y sus filas quedan con error; el aviso a las plazas no se manda", async () => {
        const f = fakeEnv({ falla: "e_actividades_puesto" });
        const r: any = await aplicar(f, [fila()]);
        assert.equal(r.ok, true);
        assert.deepEqual(r.body.filas.map((x: any) => x.estado), ["error"]);
        assert.match(r.body.filas[0].motivo, /No se pudo crear la actividad: falló e_actividades_puesto/);
        assert.deepEqual(r.body.creadas, { actividades: 0, puestos: 0 });
        assert.deepEqual(r.body.actividadIds, []);
        const borrados = escrituras(f.calls).filter((c) => c.action === "DELETE").map((c) => c.table);
        assert.deepEqual(borrados, ["c_actividades_tipo_turno", "e_actividades"]);
        assert.equal(f.plazaNotifs.length, 0);
        assert.equal(f.reports.length, 1);
    });

    it("lo complementario (jerarquía, aviso, rastro) no deshace la actividad si falla", async () => {
        const f = fakeEnv({ falla: "c_cambios_apps_modules" });
        const r: any = await aplicar(f, [fila()]);
        assert.deepEqual([r.ok, r.body.creadas.actividades, r.body.resumen.errores], [true, 1, 0]);
        assert.equal(f.reports.length, 1);
    });

    it("sin plazas activas no se manda aviso", async () => {
        const f = fakeEnv({ sinPlazas: true });
        await aplicar(f, [fila()]);
        assert.equal(f.plazaNotifs.length, 0);
    });
});

describe("#213: la ruta de cargas de Guardify", () => {
    const empleado = { id: 5, supervisor_id: null, cedula: "c" };
    const world = (opts: Parameters<typeof fakeEnv>[0] = {}) => {
        const f = fakeEnv(opts);
        (f.env.prisma as any).c_empleado = { findUnique: async () => null, findMany: async (a: any) => (a.where.cedula ? [empleado] : []) };
        return f;
    };
    const deps = (f: ReturnType<typeof fakeEnv>) => ({ getEnv: () => f.env, env: { GUARDIFY_REPORTS_API_KEY: KEY }, now: () => NOW });
    const run = async (f: ReturnType<typeof fakeEnv>, body: unknown, extra: Record<string, string> = {}, signed = true) => {
        const r = await handleImport(req(body, extra, signed), "actividades-puesto", deps(f));
        return { status: r.status, body: (await r.json()) as any };
    };

    it("sin identidad firmada: 401; otra carga que no existe: 404; modo, filas y tope validados", async () => {
        const f = world();
        assert.equal((await run(f, { modo: "validar", filas: [fila()] }, {}, false)).status, 401);
        assert.equal((await handleImport(req({ modo: "validar", filas: [fila()] }), "no-existe", deps(f))).status, 404);
        assert.equal((await run(f, { modo: "ya", filas: [fila()] })).status, 400);
        assert.equal((await run(f, { modo: "validar", filas: [] })).status, 400);
        assert.equal((await run(f, { modo: "validar", filas: Array(2001).fill(fila()) })).status, 400);
        assert.equal(escrituras(f.calls).length, 0);
    });

    it("validar: responde lo que se crearía y no escribe ni pide la sesión de Planillas", async () => {
        const f = world();
        const r = await run(f, { modo: "validar", filas: [fila(), fila({ codigo_puesto: "P-B" })] });
        assert.equal(r.status, 200);
        assert.deepEqual([r.body.modo, r.body.creadas, r.body.resumen.creadas], ["validar", { actividades: 1, puestos: 2 }, 2]);
        assert.equal(escrituras(f.calls).length, 0);
    });

    it("validar con errores: 400 con `errores` y el resultado de cada fila", async () => {
        const r = await run(world(), { modo: "validar", filas: [fila({ fecha_inicio: "x" }), fila()] });
        assert.deepEqual([r.status, r.body.code], [400, "invalid_request"]);
        assert.match(r.body.errores[0], /^Fila 1: fecha de inicio obligatoria/);
        assert.deepEqual(r.body.filas.map((x: any) => x.estado), ["error", "omitida"]);
        assert.deepEqual(r.body.resumen, { recibidas: 2, creadas: 0, omitidas: 1, errores: 1 });
    });

    it("aplicar exige la clave de idempotencia; con ella crea, firma como el actor y deja la evidencia con origen Guardify", async () => {
        const f = world();
        const sinClave = await run(f, { modo: "aplicar", filas: [fila()] });
        assert.equal(sinClave.status, 400);
        assert.match(sinClave.body.message, /clave de idempotencia/);
        assert.equal(escrituras(f.calls).length, 0);

        const r = await run(f, { modo: "aplicar", filas: [fila()] }, { "idempotency-key": IDEM });
        assert.equal(r.status, 200);
        assert.deepEqual([r.body.modo, r.body.creadas, r.body.actividadIds, r.body.evidencia], ["aplicar", { actividades: 1, puestos: 1 }, [100], "registrada"]);
        const act = escrituras(f.calls).find((c) => c.table === "e_actividades" && c.action === "POST")!;
        assert.equal(act.data.created_by, 5);
        assert.match(Buffer.from(act.data.firma_responsable, "base64").toString("utf8"), /^guardify-[0-9a-f]{16}:5:::\d+$/);
        const evidencia = escrituras(f.calls).find((c) => c.table === "c_evidencia_registro")!;
        assert.ok(evidencia, "evidencia escrita");
    });

    it("el actor que no es una persona de la app: 403 y no se escribe nada", async () => {
        const f = world();
        (f.env.prisma as any).c_empleado.findMany = async () => [];
        const r = await run(f, { modo: "validar", filas: [fila()] });
        assert.deepEqual([r.status, r.body.code], [403, "out_of_scope"]);
    });
});

describe("#213: el entorno real puede avisar a las plazas", () => {
    it("`notifyPlazas` llama a `sendNotificationByPlaza` SIN marca (null): nadie queda excluido; sin esa pieza no existe", async () => {
        const llamadas: any[] = [];
        const base = {
            callDynamicPrisma: async () => null,
            markInternalRequest: () => undefined,
            reportError: async () => undefined,
            sendNotificationByEmployee: async () => undefined,
            prisma: {},
            planillasPost: async () => ({}),
            ahoraPared: () => new Date(),
        };
        const con = makeActionEnv({ ...base, sendNotificationByPlaza: async (...a: any[]) => { llamadas.push(a); } }, {}, "r", "POST", { verifyUser: false });
        await con.notifyPlazas!("t", "m", [1, 2]);
        assert.deepEqual(llamadas[0].slice(1), [null, "t", "m", [1, 2]]);
        assert.equal(makeActionEnv(base, {}, "r", "POST", { verifyUser: false }).notifyPlazas, undefined);
    });

    it("`sendNotificationByPlaza` acepta no tener marca y la app real le pasa esa pieza", () => {
        const base = path.resolve(__dirname, "..");
        assert.match(fs.readFileSync(path.join(base, "sendNotification.ts"), "utf8").replace(/\r\n/g, "\n"), /sendNotificationByPlaza\(req: NextRequest, marcaDiaId: number \| null,/);
        assert.match(fs.readFileSync(path.join(__dirname, "appEnv.ts"), "utf8"), /sendNotificationByPlaza,\s*\n\s*prisma,/);
    });
});
