/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Guardify SIMULADO para probar la integración de MonitoreApp (issues #145 a #150) sin la consola real.
 *
 * Implementa SOLO lo que usan el SDK de dispositivo (`vendor/guardify-sdk`) y el servidor de la app (`utils/guardifyDevices.ts`):
 *   registro del equipo, estado, latidos, órdenes, verificación y renovación de acceso, catálogo de APK y lista de revocaciones.
 * No es el contrato completo de Guardify: sirve para probar NUESTRO lado. Estado en memoria (se pierde al reiniciar).
 *
 * Uso (desde apps/server):
 *   npx tsx scripts/mockGuardify.ts            # http://localhost:4010 (panel de control en la raíz)
 *   MOCK_GUARDIFY_PORT=4010 MOCK_AUTO_APPROVE=1 MOCK_LEASE_SECONDS=120 npx tsx scripts/mockGuardify.ts
 * Variables: MOCK_GUARDIFY_PORT, MOCK_COMPANY_CODE (corporacion-gonzalez), MOCK_APP_KEY (monitoreapp), MOCK_CLIENT_ID (mock-id),
 *   MOCK_CLIENT_SECRET (mock-secret), MOCK_AUTO_APPROVE (1 = los equipos nuevos quedan ACTIVE), MOCK_LEASE_SECONDS (900),
 *   MOCK_TOLERANCE_HOURS (8), MOCK_OFFLINE_MODE (por_tiempo | sin_tolerancia | cortocircuito).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";

type DeviceStatus = "PENDING" | "ACTIVE" | "BLOCKED" | "RETIRED" | "REJECTED";

export type MockOptions = {
    port?: number;
    companyCode?: string;
    appKey?: string;
    clientId?: string;
    clientSecret?: string;
    autoApprove?: boolean;
    leaseSeconds?: number;
    toleranceHours?: number;
    offlineMode?: "por_tiempo" | "sin_tolerancia" | "cortocircuito";
    quiet?: boolean;
    now?: () => number;
};

type Device = {
    id: string; secret: string; uid: string; appKey: string; platform: string; model: string | null; osVersion: string | null; appVersion: string | null;
    status: DeviceStatus; reason: string | null; registeredAt: number; updatedAt: number;
    heartbeat: null | { at: number; battery: number | null; appVersion: string | null; consent: any; location: any };
};
type Session = { id: string; deviceId: string; externalUserId: string; refreshToken: string; createdAt: number; expMs: number; revokedAt: number | null };
type Command = { id: string; deviceId: string; type: string; payload: any; createdAt: number; deliveredAt: number | null; ackedAt: number | null };
type Apk = { version: string; variant: string; notes: string; filePath: string | null; sizeBytes: number; sha256: string; publishedAt: number };

const SERIAL = (a: string, b: string) => {
    const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
    const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d) return d;
    }
    return 0;
};

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function createMockGuardify(opts: MockOptions = {}) {
    const cfg = {
        companyCode: opts.companyCode ?? "corporacion-gonzalez",
        appKey: opts.appKey ?? "monitoreapp",
        clientId: opts.clientId ?? "mock-id",
        clientSecret: opts.clientSecret ?? "mock-secret",
        autoApprove: !!opts.autoApprove,
        leaseSeconds: opts.leaseSeconds ?? 900,
        toleranceHours: opts.toleranceHours ?? 8,
        offlineMode: opts.offlineMode ?? "por_tiempo",
    };
    const now = opts.now ?? Date.now;
    const devices = new Map<string, Device>();
    const sessions = new Map<string, Session>();
    const commands: Command[] = [];
    const apks: Apk[] = [];
    let minAppVersion: string | null = null;
    const log: { at: number; text: string }[] = [];
    const note = (text: string) => {
        log.unshift({ at: now(), text });
        if (log.length > 80) log.pop();
        if (!opts.quiet) console.log(`[mock-guardify] ${text}`);
    };

    const policy = () => ({
        mode: cfg.offlineMode,
        toleranceHours: cfg.toleranceHours,
        allowedOffline: [] as string[],
        leaseSeconds: cfg.leaseSeconds,
        support: { pending: "Tu equipo espera la aprobación de un administrador (texto de prueba).", rejected: "Equipo rechazado (texto de prueba).", blocked: "Equipo bloqueado (texto de prueba).", phone: "2222-0000", email: "soporte@example.com" },
    });

    const send = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
        const data = typeof body === "object" && body && !Array.isArray(body) ? { ...(body as object), serverTime: new Date(now()).toISOString() } : body;
        res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
        res.end(JSON.stringify(data));
    };
    const readBody = (req: http.IncomingMessage) =>
        new Promise<any>((resolve) => {
            const chunks: Buffer[] = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => {
                try {
                    resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
                } catch {
                    resolve({});
                }
            });
        });

    const deviceFrom = (req: http.IncomingMessage): Device | null => {
        const m = /^Device\s+([^.\s]+)\.(\S+)$/.exec(String(req.headers.authorization ?? ""));
        const d = m ? devices.get(m[1]!) : undefined;
        return d && d.secret === m![2] ? d : null;
    };
    const ERR_BY_STATUS: Record<string, string> = { PENDING: "device_pending", BLOCKED: "device_blocked", REJECTED: "device_rejected", RETIRED: "device_retired" };
    /** Los endpoints con la credencial del equipo exigen que esté ACTIVE (igual que Guardify): si no, 403 con el código del estado. */
    const requireActive = (req: http.IncomingMessage, res: http.ServerResponse): Device | null => {
        const d = deviceFrom(req);
        if (!d) { send(res, 401, { error: "unauthorized", message: "Credencial de equipo inválida." }); return null; }
        if (d.status !== "ACTIVE") { send(res, 403, { error: ERR_BY_STATUS[d.status] ?? "device_blocked", reason: d.reason, message: `Equipo ${d.status}` }); return null; }
        return d;
    };

    const accessPayload = (s: Session) => ({
        permissions: ["*"],
        role: { name: "guarda" },
        units: null,
        sessionId: s.id,
        refreshToken: s.refreshToken,
        accessToken: `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sid: s.id, sub: s.externalUserId, exp: Math.floor(s.expMs / 1000) })}.mock`,
        policy: policy(),
    });

    const setStatus = (d: Device, status: DeviceStatus, reason: string | null = null) => {
        d.status = status;
        d.reason = reason;
        d.updatedAt = now();
        if (status !== "ACTIVE" && status !== "PENDING") for (const s of sessions.values()) if (s.deviceId === d.id && !s.revokedAt) s.revokedAt = now();
        note(`equipo ${d.id.slice(0, 8)} → ${status}${reason ? ` (${reason})` : ""}`);
    };

    const enqueue = (d: Device, type: string, payload: any = {}, alsoBlock = false) => {
        const c: Command = { id: crypto.randomUUID(), deviceId: d.id, type, payload, createdAt: now(), deliveredAt: null, ackedAt: null };
        commands.push(c);
        if (type === "LOGOUT_ALL") for (const s of sessions.values()) if (s.deviceId === d.id && !s.revokedAt) s.revokedAt = now();
        if (type === "LOGOUT_USER") for (const s of sessions.values()) if (s.deviceId === d.id && s.externalUserId === payload?.externalUserId && !s.revokedAt) s.revokedAt = now();
        note(`orden ${type} para ${d.id.slice(0, 8)}${alsoBlock ? " + bloqueo" : ""}`);
        if (alsoBlock) setStatus(d, "BLOCKED", "Bloqueado junto con el borrado");
        return c;
    };

    const apkBytes = (a: Apk): Buffer => (a.filePath && fs.existsSync(a.filePath) ? fs.readFileSync(a.filePath) : Buffer.alloc(a.sizeBytes, 7));

    const publishApk = (p: { version: string; variant?: string; notes?: string; filePath?: string | null }) => {
        const filePath = p.filePath && fs.existsSync(p.filePath) ? p.filePath : null;
        const bytes = filePath ? fs.readFileSync(filePath) : Buffer.alloc(1_000_000, 7); // sin archivo real: 1 MB de relleno (no es instalable)
        const apk: Apk = {
            version: p.version, variant: p.variant || "lite", notes: p.notes ?? "", filePath, sizeBytes: bytes.length,
            sha256: crypto.createHash("sha256").update(bytes).digest("hex"), publishedAt: now(),
        };
        const i = apks.findIndex((a) => a.version === apk.version && a.variant === apk.variant);
        if (i >= 0) apks[i] = apk; else apks.push(apk);
        note(`APK ${apk.variant} ${apk.version} publicado${filePath ? "" : " (relleno, no instalable)"}`);
        return apk;
    };

    const handler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const p = url.pathname;
        const m = req.method ?? "GET";
        try {
            // ---------------------------------------------------------------- API que usa la app y el servidor
            if (m === "POST" && p === "/api/v1/devices/register") {
                const b = await readBody(req);
                if (String(b.appKey ?? "") !== cfg.appKey) return send(res, 400, { error: "unknown_app", message: "appKey desconocida." });
                if (String(b.code ?? "").trim().toLowerCase() !== cfg.companyCode) return send(res, 404, { error: "invalid_code", message: "Código de empresa inválido." });
                let d = [...devices.values()].find((x) => x.uid === String(b.deviceUid ?? "") && x.appKey === cfg.appKey);
                if (!d) {
                    d = {
                        id: crypto.randomUUID(), secret: crypto.randomBytes(24).toString("hex"), uid: String(b.deviceUid ?? ""), appKey: cfg.appKey,
                        platform: String(b.platform ?? "OTHER"), model: b.model ?? null, osVersion: b.osVersion ?? null, appVersion: b.appVersion ?? null,
                        status: cfg.autoApprove ? "ACTIVE" : "PENDING", reason: null, registeredAt: now(), updatedAt: now(), heartbeat: null,
                    };
                    devices.set(d.id, d);
                    note(`equipo nuevo ${d.id.slice(0, 8)} (${d.model ?? "?"}) → ${d.status}`);
                } else {
                    d.secret = crypto.randomBytes(24).toString("hex"); // un registro repetido entrega una credencial nueva
                    d.appVersion = b.appVersion ?? d.appVersion;
                    note(`equipo ${d.id.slice(0, 8)} se registró de nuevo (${d.status})`);
                }
                return send(res, 201, { deviceId: d.id, credential: d.secret, status: d.status, policy: policy() });
            }

            if (m === "GET" && p === "/api/v1/revocations") {
                const expected = `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`;
                if (req.headers.authorization !== expected) return send(res, 401, { error: "unauthorized" });
                const since = new Date(url.searchParams.get("since") ?? 0).getTime() || 0;
                return send(res, 200, {
                    sessions: [...sessions.values()].filter((s) => s.revokedAt && s.revokedAt >= since).map((s) => ({ sid: s.id })),
                    devices: [...devices.values()].filter((d) => d.updatedAt >= since).map((d) => ({ id: d.id, status: d.status })),
                });
            }

            if (m === "GET" && p === "/api/v1/devices/self") {
                const d = deviceFrom(req);
                if (!d) return send(res, 401, { error: "unauthorized" });
                return send(res, 200, { status: d.status, reason: d.reason, policy: policy() });
            }
            if (m === "POST" && p === "/api/v1/devices/self/heartbeat") {
                const d = requireActive(req, res); if (!d) return;
                const b = await readBody(req);
                d.heartbeat = { at: now(), battery: typeof b.battery === "number" ? b.battery : null, appVersion: b.appVersion ?? null, consent: b.consent ?? null, location: b.location ?? null };
                d.appVersion = b.appVersion ?? d.appVersion;
                return send(res, 200, { ok: true });
            }
            if (m === "GET" && p === "/api/v1/devices/self/commands") {
                const d = requireActive(req, res); if (!d) return;
                const pending = commands.filter((c) => c.deviceId === d.id && !c.ackedAt);
                for (const c of pending) c.deliveredAt = c.deliveredAt ?? now();
                return send(res, 200, { commands: pending.map((c) => ({ id: c.id, type: c.type, payload: c.payload })) });
            }
            const ack = /^\/api\/v1\/devices\/self\/commands\/([^/]+)\/ack$/.exec(p);
            if (m === "POST" && ack) {
                const d = deviceFrom(req); if (!d) return send(res, 401, { error: "unauthorized" });
                const c = commands.find((x) => x.id === ack[1] && x.deviceId === d.id);
                if (c) { c.ackedAt = now(); note(`orden ${c.type} confirmada por ${d.id.slice(0, 8)}`); }
                return send(res, 200, { ok: true });
            }
            if (m === "POST" && p === "/api/v1/devices/self/rotate-credential") {
                const d = requireActive(req, res); if (!d) return;
                d.secret = crypto.randomBytes(24).toString("hex");
                return send(res, 200, { credential: d.secret });
            }

            if (m === "POST" && p === "/api/v1/access/verify") {
                const d = requireActive(req, res); if (!d) return;
                const b = await readBody(req);
                const id = String(b.externalUserId ?? "").trim();
                if (!id) return send(res, 400, { error: "invalid", message: "Falta externalUserId." });
                const s: Session = { id: crypto.randomUUID(), deviceId: d.id, externalUserId: id, refreshToken: crypto.randomBytes(24).toString("hex"), createdAt: now(), expMs: now() + cfg.leaseSeconds * 1000, revokedAt: null };
                sessions.set(s.id, s);
                note(`sesión de ${id} en ${d.id.slice(0, 8)}`);
                return send(res, 200, accessPayload(s));
            }
            if (m === "POST" && p === "/api/v1/access/renew") {
                const d = requireActive(req, res); if (!d) return;
                const b = await readBody(req);
                const s = sessions.get(String(b.sessionId ?? ""));
                if (!s || s.deviceId !== d.id || s.refreshToken !== b.refreshToken || s.revokedAt) return send(res, 401, { error: "session_revoked", message: "La sesión ya no es válida." });
                s.expMs = now() + cfg.leaseSeconds * 1000;
                return send(res, 200, accessPayload(s));
            }
            if (m === "POST" && p === "/api/v1/access/logout") {
                const b = await readBody(req);
                const s = sessions.get(String(b.sessionId ?? ""));
                if (s) s.revokedAt = s.revokedAt ?? now();
                return send(res, 200, { ok: true });
            }
            if (m === "POST" && p === "/api/v1/activity") return send(res, 200, { logged: false });
            if (m === "POST" && p === "/api/v1/ingest/events") {
                const b = await readBody(req);
                return send(res, 200, { accepted: Array.isArray(b.events) ? b.events.length : 0, duplicates: 0, rejected: [] });
            }

            if (m === "GET" && p === "/api/v1/apks/latest") {
                const d = requireActive(req, res); if (!d) return;
                const variant = url.searchParams.get("variant") || "lite";
                const latest = apks.filter((a) => a.variant === variant).sort((a, b) => SERIAL(b.version, a.version))[0];
                return send(res, 200, {
                    minAppVersion,
                    latest: latest ? { version: latest.version, variant: latest.variant, notes: latest.notes || null, sizeBytes: latest.sizeBytes, sha256: latest.sha256, publishedAt: new Date(latest.publishedAt).toISOString(), downloadUrl: `/api/v1/apks/${encodeURIComponent(latest.version)}/download?variant=${encodeURIComponent(latest.variant)}` } : null,
                });
            }
            const dl = /^\/api\/v1\/apks\/([^/]+)\/download$/.exec(p);
            if (m === "GET" && dl) {
                const d = requireActive(req, res); if (!d) return;
                const apk = apks.find((a) => a.version === decodeURIComponent(dl[1]!) && a.variant === (url.searchParams.get("variant") || "lite"));
                if (!apk) return send(res, 404, { error: "not_found" });
                const bytes = apkBytes(apk);
                note(`descarga de APK ${apk.version} por ${d.id.slice(0, 8)}`);
                res.writeHead(200, { "content-type": "application/vnd.android.package-archive", "content-length": String(bytes.length), "content-disposition": `attachment; filename="MonitoreApp-${apk.variant}-${apk.version}.apk"` });
                return void res.end(bytes);
            }

            // ---------------------------------------------------------------- panel de control (sin autenticación: solo para pruebas locales)
            if (m === "GET" && p === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return void res.end(PANEL_HTML); }
            if (m === "GET" && p === "/health") return send(res, 200, { ok: true });
            if (m === "GET" && p === "/admin/state") {
                return send(res, 200, {
                    config: { ...cfg, clientSecret: "(oculto)" },
                    minAppVersion,
                    devices: [...devices.values()].map((d) => ({ ...d, secret: undefined, commands: commands.filter((c) => c.deviceId === d.id).slice(-4).map((c) => ({ type: c.type, delivered: !!c.deliveredAt, acked: !!c.ackedAt })) })),
                    sessions: [...sessions.values()].map((s) => ({ id: s.id, deviceId: s.deviceId, externalUserId: s.externalUserId, createdAt: s.createdAt, expMs: s.expMs, revokedAt: s.revokedAt })),
                    apks: apks.map((a) => ({ version: a.version, variant: a.variant, notes: a.notes, sizeBytes: a.sizeBytes, real: !!a.filePath })),
                    log: log.slice(0, 40),
                });
            }
            const adm = /^\/admin\/devices\/([^/]+)\/(status|command)$/.exec(p);
            if (m === "POST" && adm) {
                const d = devices.get(adm[1]!);
                if (!d) return send(res, 404, { error: "not_found" });
                const b = await readBody(req);
                if (adm[2] === "status") {
                    const status = String(b.status ?? "").toUpperCase() as DeviceStatus;
                    if (!["PENDING", "ACTIVE", "BLOCKED", "RETIRED", "REJECTED"].includes(status)) return send(res, 400, { error: "invalid_status" });
                    setStatus(d, status, b.reason ? String(b.reason) : null);
                } else {
                    enqueue(d, String(b.type ?? "PING").toUpperCase(), b.payload ?? {}, !!b.alsoBlock);
                }
                return send(res, 200, { ok: true });
            }
            if (m === "POST" && p === "/admin/apk") {
                const b = await readBody(req);
                if (!b.version) return send(res, 400, { error: "version_required" });
                return send(res, 200, { ok: true, apk: { ...publishApk({ version: String(b.version), variant: b.variant, notes: b.notes, filePath: b.filePath }), filePath: undefined } });
            }
            if (m === "POST" && p === "/admin/min-version") {
                const b = await readBody(req);
                minAppVersion = String(b.version ?? "").trim() || null;
                note(`versión mínima = ${minAppVersion ?? "(ninguna)"}`);
                return send(res, 200, { ok: true, minAppVersion });
            }
            const rev = /^\/admin\/sessions\/([^/]+)\/revoke$/.exec(p);
            if (m === "POST" && rev) {
                const s = sessions.get(rev[1]!);
                if (s && !s.revokedAt) { s.revokedAt = now(); note(`sesión ${s.id.slice(0, 8)} revocada`); }
                return send(res, 200, { ok: true });
            }
            if (m === "POST" && p === "/admin/reset") {
                devices.clear(); sessions.clear(); commands.length = 0; apks.length = 0; minAppVersion = null; log.length = 0;
                note("estado reiniciado");
                return send(res, 200, { ok: true });
            }
            return send(res, 404, { error: "not_found", message: `${m} ${p}` });
        } catch (e) {
            note(`error: ${e instanceof Error ? e.message : String(e)}`);
            return send(res, 500, { error: "internal", message: "Error del simulacro" });
        }
    };

    const server = http.createServer((req, res) => void handler(req, res));
    return {
        server,
        cfg,
        state: { devices, sessions, commands, apks, get minAppVersion() { return minAppVersion; } },
        setStatus, enqueue, publishApk,
        setMinAppVersion: (v: string | null) => { minAppVersion = v; },
        listen: (port = opts.port ?? 4010) => new Promise<number>((resolve) => server.listen(port, () => resolve((server.address() as AddressInfo).port))),
        close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
}

const PANEL_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Guardify simulado</title>
<style>
body{font:14px system-ui,sans-serif;margin:16px;color:#111}h1{font-size:20px}h2{font-size:16px;margin-top:22px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f2f2f2}
button{margin:1px;padding:3px 7px;cursor:pointer}.s{font-weight:600}.PENDING{color:#b36b00}.ACTIVE{color:#0a7a2f}.BLOCKED,.REJECTED,.RETIRED{color:#b00020}
input{padding:3px;margin:2px}code{background:#f2f2f2;padding:1px 4px}#log{font:12px monospace;background:#fafafa;border:1px solid #ddd;padding:6px;max-height:220px;overflow:auto}
.muted{color:#666}
</style></head><body>
<h1>Guardify simulado <button onclick="reset()">Reiniciar todo</button></h1>
<p class="muted" id="cfg"></p>
<h2>Dispositivos</h2><div id="devices"></div>
<h2>Sesiones</h2><div id="sessions"></div>
<h2>Catálogo de APK</h2>
<div>Versión mínima: <input id="min" size="8" placeholder="1.0.3"><button onclick="setMin()">Guardar</button> <span class="muted">(vacío = sin mínima)</span></div>
<div>Publicar: versión <input id="av" size="7" placeholder="1.0.3"> variante <input id="avar" size="6" value="lite"> notas <input id="an" size="22">
 archivo APK (ruta en esta PC, opcional) <input id="ap" size="34" placeholder="C:\\\\ruta\\\\app-lite-release.apk"><button onclick="pub()">Publicar</button></div>
<div id="apks"></div>
<h2>Registro</h2><div id="log"></div>
<script>
function api(path, body){return fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})}).then(function(){return load();});}
function status(id,s){var r=s==='BLOCKED'||s==='REJECTED'||s==='RETIRED'?prompt('Motivo (opcional)'):null;api('/admin/devices/'+id+'/status',{status:s,reason:r});}
function cmd(id,t,extra){var body={type:t};if(t==='LOGOUT_USER'){var u=prompt('Cédula del usuario');if(!u)return;body.payload={externalUserId:u};}if(extra)body.alsoBlock=true;api('/admin/devices/'+id+'/command',body);}
function revoke(id){api('/admin/sessions/'+id+'/revoke');}
function setMin(){api('/admin/min-version',{version:document.getElementById('min').value});}
function pub(){api('/admin/apk',{version:document.getElementById('av').value,variant:document.getElementById('avar').value,notes:document.getElementById('an').value,filePath:document.getElementById('ap').value});}
function reset(){if(confirm('¿Borrar dispositivos, sesiones, APK y registro?'))api('/admin/reset');}
function t(ms){return ms?new Date(ms).toLocaleTimeString():'—';}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function load(){return fetch('/admin/state').then(function(r){return r.json();}).then(function(s){
 document.getElementById('cfg').textContent='Código de empresa: '+s.config.companyCode+' · appKey: '+s.config.appKey+' · credencial del servidor: '+s.config.clientId+' / (ver MOCK_CLIENT_SECRET) · permiso de uso: '+s.config.leaseSeconds+' s · autoaprobar: '+s.config.autoApprove;
 var h='<table><tr><th>Equipo</th><th>Modelo / versión</th><th>Estado</th><th>Último latido</th><th>Órdenes</th><th>Acciones</th></tr>';
 s.devices.forEach(function(d){var hb=d.heartbeat;
  h+='<tr><td><code>'+esc(d.id.slice(0,8))+'</code></td><td>'+esc(d.model||'?')+' / app '+esc(d.appVersion||'?')+'</td><td class="s '+d.status+'">'+d.status+(d.reason?'<br><span class="muted">'+esc(d.reason)+'</span>':'')+'</td>'
  +'<td>'+(hb?(t(hb.at)+'<br>batería '+(hb.battery==null?'—':hb.battery+'%')+'<br>ubicación: '+(hb.consent&&hb.consent.location?(hb.location?hb.location.lat+', '+hb.location.lng:'autorizada, sin lectura'):'sin consentimiento')):'—')+'</td>'
  +'<td>'+d.commands.map(function(c){return esc(c.type)+(c.acked?' ✓':c.delivered?' (entregada)':' (pendiente)');}).join('<br>')+'</td><td>'
  +['ACTIVE:Aprobar / reactivar','REJECTED:Rechazar','BLOCKED:Bloquear','RETIRED:Retirar','PENDING:Pendiente'].map(function(x){var p=x.split(':');return '<button onclick="status(\\''+d.id+'\\',\\''+p[0]+'\\')">'+p[1]+'</button>';}).join('')+'<br>'
  +['LOGOUT_ALL','LOGOUT_USER','FORCE_UPDATE','PING','WIPE'].map(function(c){return '<button onclick="cmd(\\''+d.id+'\\',\\''+c+'\\')">'+c+'</button>';}).join('')+'<button onclick="cmd(\\''+d.id+'\\',\\'WIPE\\',true)">WIPE + bloquear</button></td></tr>';});
 document.getElementById('devices').innerHTML=s.devices.length?h+'</table>':'<span class="muted">Ningún equipo registrado todavía.</span>';
 var q='<table><tr><th>Sesión</th><th>Usuario</th><th>Equipo</th><th>Vence</th><th>Estado</th><th></th></tr>';
 s.sessions.forEach(function(x){q+='<tr><td><code>'+esc(x.id.slice(0,8))+'</code></td><td>'+esc(x.externalUserId)+'</td><td><code>'+esc(x.deviceId.slice(0,8))+'</code></td><td>'+t(x.expMs)+'</td><td>'+(x.revokedAt?'revocada':'vigente')+'</td><td>'+(x.revokedAt?'':'<button onclick="revoke(\\''+x.id+'\\')">Revocar</button>')+'</td></tr>';});
 document.getElementById('sessions').innerHTML=s.sessions.length?q+'</table>':'<span class="muted">Sin sesiones.</span>';
 document.getElementById('apks').innerHTML='<p>Versión mínima actual: <b>'+esc(s.minAppVersion||'ninguna')+'</b></p>'+(s.apks.length?'<ul>'+s.apks.map(function(a){return '<li>'+esc(a.variant)+' '+esc(a.version)+' · '+(a.real?'archivo real':'relleno (no instalable)')+' · '+Math.round(a.sizeBytes/1024)+' KB '+esc(a.notes)+'</li>';}).join('')+'</ul>':'<span class="muted">Sin APK publicados.</span>');
 document.getElementById('log').innerHTML=s.log.map(function(l){return t(l.at)+'  '+esc(l.text);}).join('<br>');
 });}
load();setInterval(load,2000);
</script></body></html>`;

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const env = process.env;
    const mock = createMockGuardify({
        port: Number(env.MOCK_GUARDIFY_PORT) || 4010,
        companyCode: env.MOCK_COMPANY_CODE,
        appKey: env.MOCK_APP_KEY,
        clientId: env.MOCK_CLIENT_ID,
        clientSecret: env.MOCK_CLIENT_SECRET,
        autoApprove: env.MOCK_AUTO_APPROVE === "1",
        leaseSeconds: Number(env.MOCK_LEASE_SECONDS) || undefined,
        toleranceHours: Number(env.MOCK_TOLERANCE_HOURS) || undefined,
        offlineMode: (env.MOCK_OFFLINE_MODE as MockOptions["offlineMode"]) || undefined,
    });
    mock.listen().then((port) => {
        console.log(`Guardify simulado en http://localhost:${port}  (panel de control en la raíz)`);
        console.log(`  Código de empresa: ${mock.cfg.companyCode} · appKey: ${mock.cfg.appKey} · credencial del servidor: ${mock.cfg.clientId} / ${mock.cfg.clientSecret}`);
        console.log(`  Equipos nuevos: ${mock.cfg.autoApprove ? "quedan ACTIVOS" : "quedan PENDIENTES hasta aprobarlos en el panel"} · permiso de uso: ${mock.cfg.leaseSeconds} s`);
    });
}
