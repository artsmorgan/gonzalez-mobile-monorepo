/**
 * SDK de dispositivo de Guardify (núcleo, sin dependencias de plataforma).
 * Corre igual en React Native, Node y navegador: recibe `fetch`, almacenamiento y reloj por inyección.
 *
 * Flujo (docs/arquitectura §7, §16):
 *   register(código de empresa)  →  [aprobación en la consola]  →  login(usuario)  →  renew()…
 * y siempre atento a: bloqueo/retiro del dispositivo, cierre de sesión del usuario y política sin conexión.
 */

export type Storage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

/** Almacenamiento en memoria (pruebas). En producción: almacenamiento cifrado del sistema (Keychain / Keystore). */
export class MemoryStorage implements Storage {
  data = new Map<string, string>();
  async get(k: string) { return this.data.get(k) ?? null; }
  async set(k: string, v: string) { this.data.set(k, v); }
  async remove(k: string) { this.data.delete(k); }
}

/**
 * `now` = hora del reloj del dispositivo (manipulable por el usuario); NO se usa para medir la tolerancia.
 * `monotonic` = milisegundos desde un origen que no se puede retroceder cambiando la hora del teléfono
 * (en RN: SystemClock.elapsedRealtime / performance.now).
 */
export type Clock = { now(): number; monotonic(): number };
export const systemClock: Clock = { now: () => Date.now(), monotonic: () => (typeof performance !== "undefined" ? performance.now() : Date.now()) };

export type OfflineMode = "cortocircuito" | "sin_tolerancia" | "por_tiempo";
export type Policy = {
  mode: OfflineMode; toleranceHours: number; allowedOffline: string[]; leaseSeconds: number;
  /** Texto y contacto de soporte que la empresa quiere mostrar en las pantallas de pendiente, rechazado y bloqueado (Ajustes → Dispositivos). */
  support?: { pending?: string; rejected?: string; blocked?: string; phone?: string; email?: string };
};
export type DeviceStatus = "PENDING" | "ACTIVE" | "BLOCKED" | "RETIRED" | "REJECTED";

export type SdkState =
  | { kind: "unregistered" }
  | { kind: "pending" }
  | { kind: "rejected"; reason?: string | null }
  | { kind: "blocked"; reason?: string | null }
  | { kind: "retired" }
  | { kind: "signed_out" }
  | { kind: "locked"; reason: "offline" | "lease_expired" | "tolerance_expired" | "clock_reset" }
  | { kind: "operational"; online: boolean };

export class GuardifyError extends Error {
  constructor(public status: number, public code: string, message: string, public body?: any) {
    super(message);
  }
}

type Persisted = {
  deviceId?: string;
  secret?: string;
  status?: DeviceStatus;
  statusReason?: string | null;
  policy?: Policy;
  session?: { id: string; refreshToken: string; accessToken: string; expMs: number; grants: string[]; role: string | null; externalUserId: string; units: string[] | null; mustChangePassword?: boolean };
  /** Ancla de tiempo: hora del servidor y reloj monótono en el último contacto exitoso (OFF-04). */
  sync?: { serverMs: number; mono: number };
};

export type SdkEvent =
  | { type: "state"; state: SdkState }
  | { type: "command"; id: string; command: string; payload: any }
  | { type: "wipe" }
  | { type: "force_update" };

export type Options = {
  baseUrl: string;
  appKey: string;
  deviceUid: string;
  storage: Storage;
  fetch?: typeof fetch;
  clock?: Clock;
  platform?: "ANDROID" | "IOS" | "WEB" | "DESKTOP" | "OTHER";
  model?: string;
  osVersion?: string;
  appVersion?: string;
  attestation?: string;
};

export class GuardifyDevice {
  private p: Persisted = {};
  private loaded = false;
  private online = true;
  private listeners = new Set<(e: SdkEvent) => void>();
  private streamAbort: AbortController | null = null;
  private clock: Clock;
  private f: typeof fetch;

  constructor(private o: Options) {
    this.clock = o.clock ?? systemClock;
    this.f = o.fetch ?? fetch;
  }

  // ------------------------------------------------------------------ persistencia
  private async load() {
    if (this.loaded) return;
    const raw = await this.o.storage.get("guardify.state");
    this.p = raw ? JSON.parse(raw) : {};
    this.loaded = true;
  }
  private async save() {
    await this.o.storage.set("guardify.state", JSON.stringify(this.p));
  }
  /** Debe llamarse una vez al iniciar la app. */
  async init() {
    await this.load();
    return this.state();
  }

  on(fn: (e: SdkEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(e: SdkEvent) {
    this.listeners.forEach((l) => l(e));
  }
  private emitState() {
    this.emit({ type: "state", state: this.state() });
  }

  // ------------------------------------------------------------------ HTTP
  private async call<T = any>(method: string, path: string, body?: unknown, auth: "device" | "none" = "device"): Promise<T> {
    await this.load();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth === "device" && this.p.deviceId && this.p.secret) headers.authorization = `Device ${this.p.deviceId}.${this.p.secret}`;
    let res: Response;
    try {
      res = await this.f(`${this.o.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      this.setConnectivity(false); // un error de red equivale a "sin conexión"
      throw new GuardifyError(0, "network", "Sin conexión con Guardify.");
    }
    if (!this.online) this.setConnectivity(true);
    const data = await res.json().catch(() => ({}));
    if (data?.serverTime) await this.anchor(data.serverTime);
    if (!res.ok) {
      const code = data?.error ?? "error";
      if (code === "device_blocked" || code === "device_pending" || code === "device_rejected" || code === "device_retired") {
        const next: DeviceStatus = { device_blocked: "BLOCKED", device_pending: "PENDING", device_rejected: "REJECTED", device_retired: "RETIRED" }[code as string] as DeviceStatus;
        this.p.status = next;
        this.p.statusReason = data?.reason ?? null;
        if (next !== "PENDING") this.p.session = undefined;
        await this.save();
        this.emitState();
      }
      throw new GuardifyError(res.status, code, data?.message ?? "Error", data);
    }
    return data as T;
  }

  /** Ancla de tiempo con la hora del servidor (OFF-04). */
  private async anchor(serverTime: string) {
    this.p.sync = { serverMs: new Date(serverTime).getTime(), mono: this.clock.monotonic() };
    await this.save();
  }

  // ------------------------------------------------------------------ registro y estado
  /** DEV-01: registra el dispositivo con el código de empresa (o de registro). Debe ocurrir antes del login. */
  async register(code: string): Promise<SdkState> {
    await this.load();
    const r = await this.call<{ deviceId: string; credential: string; status: DeviceStatus; policy: Policy; serverTime: string }>(
      "POST", "/api/v1/devices/register",
      { code, appKey: this.o.appKey, deviceUid: this.o.deviceUid, platform: this.o.platform ?? "OTHER", model: this.o.model, osVersion: this.o.osVersion, appVersion: this.o.appVersion, attestation: this.o.attestation },
      "none",
    );
    this.p = { ...this.p, deviceId: r.deviceId, secret: r.credential, status: r.status, policy: r.policy, session: undefined };
    await this.anchor(r.serverTime);
    await this.save();
    this.emitState();
    return this.state();
  }

  /** Consulta el estado en el servidor (sondeo mientras está pendiente). */
  async refreshStatus(): Promise<SdkState> {
    const r = await this.call<{ status: DeviceStatus; reason: string | null; policy: Policy }>("GET", "/api/v1/devices/self");
    this.p.status = r.status;
    this.p.statusReason = r.reason;
    this.p.policy = r.policy;
    if (r.status !== "ACTIVE" && r.status !== "PENDING") this.p.session = undefined;
    await this.save();
    this.emitState();
    return this.state();
  }

  // ------------------------------------------------------------------ actualización de la app (catálogo de APK de Guardify)
  /** El APK más reciente de esta variante (`prod`, `lite`…), la versión mínima que exige el servidor y su enlace de descarga (absoluto). */
  async latestApk(variant = ""): Promise<{ minAppVersion: string | null; latest: null | { version: string; variant: string; notes: string | null; sizeBytes: number | null; sha256: string; publishedAt: string; downloadUrl: string } }> {
    const r = await this.call<{ minAppVersion: string | null; latest: null | { version: string; variant: string; notes: string | null; sizeBytes: number | null; sha256: string; publishedAt: string; downloadUrl: string } }>("GET", `/api/v1/apks/latest?variant=${encodeURIComponent(variant)}`);
    return { minAppVersion: r.minAppVersion, latest: r.latest ? { ...r.latest, downloadUrl: `${this.o.baseUrl}${r.latest.downloadUrl}` } : null };
  }
  /** Cabecera `Authorization` del equipo, para bajar el APK (`downloadUrl`) con el gestor de descargas de la app. */
  async authorizationHeader(): Promise<string | null> {
    await this.load();
    return this.p.deviceId && this.p.secret ? `Device ${this.p.deviceId}.${this.p.secret}` : null;
  }

  // ------------------------------------------------------------------ acceso
  /** ACC-01: tras autenticar al usuario con el sistema del cliente, pide a Guardify el permiso de acceso. */
  async login(externalUserId: string) {
    const r = await this.call<any>("POST", "/api/v1/access/verify", { externalUserId });
    await this.storeSession(r, externalUserId);
    return r as { permissions: string[]; role: { name: string }; units: string[] | null; sessionId: string; accessToken: string; policy: Policy };
  }

  /**
   * ACC-12: modo «Guardify». La persona escribe su contraseña y Guardify la valida (la propia de esta app, o la de la empresa
   * a través del conector). Si `mustChangePassword` es verdadero, la app debe pedirle una nueva antes de seguir.
   */
  async loginWithSecret(externalUserId: string, secret: string) {
    const r = await this.call<any>("POST", "/api/v1/access/login", { externalUserId, secret });
    await this.storeSession(r, externalUserId);
    if (this.p.session) { this.p.session.mustChangePassword = !!r.mustChangePassword; await this.save(); }
    return r as { permissions: string[]; role: { name: string }; units: string[] | null; sessionId: string; accessToken: string; policy: Policy; mustChangePassword: boolean; passwordChange: "sdk" | "console" | "ambos" | "ninguno" };
  }

  /** La persona cambia su propia contraseña de esta app. La empresa decide si se permite por SDK; si no, el error lo dice. */
  async changePassword(currentPassword: string, newPassword: string) {
    await this.load();
    const s = this.p.session;
    if (!s) throw new GuardifyError(401, "signed_out", "No hay sesión.");
    await this.call("POST", "/api/v1/access/change-password", { sessionId: s.id, refreshToken: s.refreshToken, currentPassword, newPassword });
    s.mustChangePassword = false;
    await this.save();
  }

  /**
   * Log de comportamiento: informa una acción de la persona en un módulo. Guardify solo la guarda si ese módulo tiene el log activado;
   * `logged: false` indica que no hace falta seguir enviando ese módulo.
   */
  async logBehavior(module: string, action: string, meta?: Record<string, unknown>) {
    await this.load();
    const s = this.p.session;
    if (!s) throw new GuardifyError(401, "signed_out", "No hay sesión.");
    return this.call<{ logged: boolean }>("POST", "/api/v1/activity", { sessionId: s.id, module, action, meta });
  }

  /** ACC-03: renueva el permiso de uso. Reevalúa dispositivo, usuario, app y tenant en el servidor. */
  async renew() {
    await this.load();
    const s = this.p.session;
    if (!s) throw new GuardifyError(401, "signed_out", "No hay sesión.");
    try {
      const r = await this.call<any>("POST", "/api/v1/access/renew", { sessionId: s.id, refreshToken: s.refreshToken });
      await this.storeSession(r, s.externalUserId);
      return r;
    } catch (e) {
      if (e instanceof GuardifyError && e.status >= 400 && e.status < 500 && e.code !== "network") {
        this.p.session = undefined; // el servidor negó la renovación: sesión terminada
        await this.save();
        this.emitState();
      }
      throw e;
    }
  }

  async logout() {
    await this.load();
    const s = this.p.session;
    if (s) await this.call("POST", "/api/v1/access/logout", { sessionId: s.id }).catch(() => undefined);
    this.p.session = undefined;
    await this.save();
    this.emitState();
  }

  private async storeSession(r: any, externalUserId: string) {
    const payload = JSON.parse(Buffer_from(r.accessToken.split(".")[1]));
    this.p.session = { id: r.sessionId, refreshToken: r.refreshToken, accessToken: r.accessToken, expMs: payload.exp * 1000, grants: r.permissions, role: r.role?.name ?? null, externalUserId, units: r.units ?? null };
    this.p.policy = r.policy;
    this.p.status = "ACTIVE";
    await this.save();
    this.emitState();
  }

  // ------------------------------------------------------------------ política sin conexión (guardrail)
  /** La app informa el estado de la red (o el propio SDK lo deduce de errores de red). */
  setConnectivity(online: boolean) {
    if (this.online === online) return;
    this.online = online;
    this.emitState();
  }

  /** Hora del servidor estimada con el reloj monótono (inmune a cambiar la hora del teléfono). Null si no es confiable. */
  private serverNow(): number | null {
    const s = this.p.sync;
    if (!s) return null;
    const elapsed = this.clock.monotonic() - s.mono;
    if (elapsed < 0) return null; // el reloj monótono retrocedió (reinicio del equipo): no es confiable
    return s.serverMs + elapsed;
  }

  state(): SdkState {
    const p = this.p;
    if (!p.deviceId) return { kind: "unregistered" };
    if (p.status === "PENDING") return { kind: "pending" };
    if (p.status === "REJECTED") return { kind: "rejected", reason: p.statusReason };
    if (p.status === "BLOCKED") return { kind: "blocked", reason: p.statusReason };
    if (p.status === "RETIRED") return { kind: "retired" };
    if (!p.session) return { kind: "signed_out" };

    const pol = p.policy;
    const now = this.serverNow();
    if (now === null) return { kind: "locked", reason: "clock_reset" };
    if (pol?.mode === "cortocircuito" && !this.online) return { kind: "locked", reason: "offline" };
    if (this.online) {
      // con conexión se renueva solo; si el permiso venció, espera la renovación
      return now < p.session.expMs ? { kind: "operational", online: true } : { kind: "locked", reason: "lease_expired" };
    }
    if (pol?.mode === "por_tiempo") {
      const contact = p.sync!.serverMs; // último contacto exitoso con el servidor
      const limit = contact + pol.toleranceHours * 3600_000;
      return this.serverNowAt() < limit ? { kind: "operational", online: false } : { kind: "locked", reason: "tolerance_expired" };
    }
    // sin_tolerancia: solo mientras dure el permiso de uso vigente
    return now < p.session.expMs ? { kind: "operational", online: false } : { kind: "locked", reason: "lease_expired" };
  }

  private serverNowAt() {
    return this.serverNow() ?? Number.POSITIVE_INFINITY;
  }

  /** ¿Puede ejecutar esta función ahora? Sin conexión solo las permitidas por la política (OFF-03). */
  canRun(permission: string): boolean {
    const st = this.state();
    if (st.kind !== "operational") return false;
    const s = this.p.session!;
    if (!s.grants.includes(permission)) return false;
    if (!st.online) return !!this.p.policy?.allowedOffline.includes(permission);
    return true;
  }

  get grants() { return this.p.session?.grants ?? []; }
  /** Unidades del árbol que esta persona puede ver (las resuelve Guardify); null = toda la empresa. */
  get units() { return this.p.session?.units ?? null; }
  /** ¿Puede ver lo que pertenece a esta unidad? Filtra siempre con esto, nunca con reglas propias de la app. */
  canSeeUnit(unitId: string | null | undefined): boolean {
    const u = this.units;
    return u === null || (!!unitId && u.includes(unitId));
  }
  get deviceId() { return this.p.deviceId; }
  get session() { return this.p.session; }

  // ------------------------------------------------------------------ canal en tiempo real
  /** DEV-23: mantiene abierto el canal SSE; aplica bloqueos, cierres de sesión y borrados en segundos. */
  connectStream() {
    this.disconnectStream();
    const ac = new AbortController();
    this.streamAbort = ac;
    const run = async () => {
      await this.load();
      while (!ac.signal.aborted) {
        try {
          const res = await this.f(`${this.o.baseUrl}/api/v1/devices/self/stream`, { headers: { authorization: `Device ${this.p.deviceId}.${this.p.secret}` }, signal: ac.signal });
          if (!res.ok || !res.body) throw new Error(String(res.status));
          if (!this.online) this.setConnectivity(true);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (!ac.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i: number;
            while ((i = buf.indexOf("\n\n")) >= 0) {
              const block = buf.slice(0, i);
              buf = buf.slice(i + 2);
              await this.onSse(block);
            }
          }
        } catch {
          if (ac.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, 1000)); // reconecta
      }
    };
    void run();
    return () => ac.abort();
  }
  disconnectStream() {
    this.streamAbort?.abort();
    this.streamAbort = null;
  }

  private async onSse(block: string) {
    const ev = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];
    if (!ev || !data) return;
    const d = JSON.parse(data);
    if (ev === "status") {
      this.p.status = d.status;
      this.p.statusReason = d.reason ?? null;
      if (d.status !== "ACTIVE" && d.status !== "PENDING") this.p.session = undefined;
      await this.save();
      this.emitState();
    } else if (ev === "command") {
      await this.applyCommand(d);
    }
  }

  private async applyCommand(c: { id: string; type: string; payload: any }) {
    if (c.type === "LOGOUT_ALL" || (c.type === "LOGOUT_USER" && this.p.session?.externalUserId === c.payload?.externalUserId)) {
      this.p.session = undefined;
      await this.save();
      this.emitState();
    }
    if (c.type === "WIPE") {
      // Borrado selectivo (DEV-09): se borra lo local de la app; la cola pendiente se entrega/descarta según la app.
      const q = await this.o.storage.get("guardify.queue");
      this.p = { deviceId: this.p.deviceId, secret: this.p.secret, status: this.p.status, policy: this.p.policy, sync: this.p.sync };
      await this.save();
      void q;
      this.emit({ type: "wipe" });
      this.emitState();
    }
    if (c.type === "FORCE_UPDATE") this.emit({ type: "force_update" });
    this.emit({ type: "command", id: c.id, command: c.type, payload: c.payload });
    await this.call("POST", `/api/v1/devices/self/commands/${c.id}/ack`, { ok: true }).catch(() => undefined);
  }

  /** Sondeo alternativo (push en segundo plano): trae y aplica los comandos pendientes. */
  async pollCommands() {
    const r = await this.call<{ commands: { id: string; type: string; payload: any }[] }>("GET", "/api/v1/devices/self/commands");
    for (const c of r.commands) await this.applyCommand(c);
    return r.commands.length;
  }

  async heartbeat(t: { battery?: number; consent?: { location: boolean }; location?: { lat: number; lng: number } }) {
    return this.call("POST", "/api/v1/devices/self/heartbeat", { appVersion: this.o.appVersion, ...t });
  }

  async rotateCredential() {
    const r = await this.call<{ credential: string }>("POST", "/api/v1/devices/self/rotate-credential", {});
    this.p.secret = r.credential;
    await this.save();
  }

  // ------------------------------------------------------------------ cola de datos (OFF-05)
  /** Los datos pendientes se guardan en el almacenamiento (que debe estar cifrado) y NO se borran al bloquearse la app. */
  async enqueue(event: Record<string, unknown>) {
    const q = JSON.parse((await this.o.storage.get("guardify.queue")) ?? "[]") as unknown[];
    q.push({ ...event, _id: `${this.p.deviceId ?? "d"}-${Date.now()}-${q.length}`, _at: this.clock.now() });
    await this.o.storage.set("guardify.queue", JSON.stringify(q));
  }
  async pending(): Promise<number> {
    return (JSON.parse((await this.o.storage.get("guardify.queue")) ?? "[]") as unknown[]).length;
  }
  // ------------------------------------------------------------------ eventos de negocio (F6)
  /**
   * Registra un evento de la app (declarado en las métricas del manifiesto). Se guarda localmente con un id estable,
   * de modo que reenviarlo tras un corte no lo duplica. Funciona sin conexión.
   */
  async track(event: string, opts: { user?: string; value?: number; dimensions?: Record<string, string | number | boolean> } = {}) {
    const q = JSON.parse((await this.o.storage.get("guardify.events")) ?? "[]") as any[];
    const rand = Math.random().toString(36).slice(2, 10);
    q.push({ id: `${this.p.deviceId ?? "d"}-${this.clock.now()}-${rand}`, event, at: new Date(this.clock.now()).toISOString(), ...opts });
    await this.o.storage.set("guardify.events", JSON.stringify(q));
  }
  async pendingEvents(): Promise<number> {
    return (JSON.parse((await this.o.storage.get("guardify.events")) ?? "[]") as unknown[]).length;
  }
  /** Envía los eventos pendientes en lotes de 500. Lo aceptado o ya conocido sale de la cola; lo rechazado se descarta; un error de red la conserva. */
  async flushEvents(): Promise<{ sent: number; duplicates: number; rejected: { id: string; reason: string }[] }> {
    const q = JSON.parse((await this.o.storage.get("guardify.events")) ?? "[]") as any[];
    let sent = 0, duplicates = 0;
    const rejected: { id: string; reason: string }[] = [];
    let rest = q;
    while (rest.length) {
      const batch = rest.slice(0, 500);
      const r = await this.call<{ accepted: number; duplicates: number; rejected: { id: string; reason: string }[] }>("POST", "/api/v1/ingest/events", { events: batch });
      sent += r.accepted; duplicates += r.duplicates; rejected.push(...r.rejected);
      rest = rest.slice(batch.length);
      await this.o.storage.set("guardify.events", JSON.stringify(rest));
    }
    return { sent, duplicates, rejected };
  }

  /** Al reconectar: entrega la cola con un `sender` (la API de ingesta de F6 o el backend propio de la app). */
  async flush(sender: (batch: any[]) => Promise<void>) {
    const q = JSON.parse((await this.o.storage.get("guardify.queue")) ?? "[]") as any[];
    if (!q.length) return 0;
    await sender(q);
    await this.o.storage.set("guardify.queue", "[]");
    return q.length;
  }
}

/** Decodifica base64url (Node y navegador/RN). */
function Buffer_from(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = typeof atob === "function" ? atob(b64) : (globalThis as any).Buffer.from(b64, "base64").toString("binary");
  return decodeURIComponent(bin.split("").map((c: string) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
}
