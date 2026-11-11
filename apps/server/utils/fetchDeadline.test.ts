import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
    DEADLINES_MS,
    MAX_DEADLINE_MS,
    MAX_READ_RETRIES,
    MAX_IDEMPOTENT_WRITE_RETRIES,
    createDeadline,
    resolveDeadlineMs,
    retryDelayMs,
    shouldRetry,
    type DeadlineTimers,
} from "../../mobile/hooks/fetchDeadline";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

/** Temporizadores falsos: el tiempo solo avanza cuando la prueba lo manda. */
function fakeTimers() {
    let nextId = 1;
    const pending = new Map<number, () => void>();
    const timers: DeadlineTimers = {
        setTimeout: (fn) => { const id = nextId++; pending.set(id, fn); return id; },
        clearTimeout: (h) => { pending.delete(h as number); },
    };
    return { timers, pending, fire: () => { for (const [id, fn] of [...pending]) { pending.delete(id); fn(); } } };
}

describe("plazos por operación (issue #172, H06)", () => {
    it("una lectura tiene un plazo; una escritura, otro más largo; una subida de archivos, el más largo", () => {
        assert.equal(resolveDeadlineMs({ method: "GET" }), DEADLINES_MS.read);
        assert.equal(resolveDeadlineMs({ method: undefined }), DEADLINES_MS.read, "sin método es GET");
        assert.equal(resolveDeadlineMs({ method: "post", body: JSON.stringify({ a: 1 }) }), DEADLINES_MS.write);
        for (const m of ["PUT", "PATCH", "DELETE"]) assert.equal(resolveDeadlineMs({ method: m, body: "{}" }), DEADLINES_MS.write, m);
        assert.equal(resolveDeadlineMs({ method: "POST", body: new FormData() }), DEADLINES_MS.upload);
        assert.ok(DEADLINES_MS.read < DEADLINES_MS.write && DEADLINES_MS.write < DEADLINES_MS.upload);
    });
    it("un plazo explícito válido se respeta; uno absurdo se ignora o se acota", () => {
        assert.equal(resolveDeadlineMs({ method: "GET", override: 5000 }), 5000);
        assert.equal(resolveDeadlineMs({ method: "GET", override: 10 * 60 * 60 * 1000 }), MAX_DEADLINE_MS);
        for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "10" as unknown as number, null as unknown as number]) {
            assert.equal(resolveDeadlineMs({ method: "GET", override: bad }), DEADLINES_MS.read, String(bad));
        }
    });
    it("al cumplirse el plazo se aborta la petición y se sabe que fue por tiempo", () => {
        const f = fakeTimers();
        const d = createDeadline(1000, null, f.timers);
        assert.equal(d.signal.aborted, false);
        f.fire();
        assert.equal(d.signal.aborted, true);
        assert.equal(d.timedOut, true);
    });
    it("cancelar el plazo (llegó la respuesta) limpia el temporizador y no aborta nada", () => {
        const f = fakeTimers();
        const d = createDeadline(1000, null, f.timers);
        d.cancel();
        assert.equal(f.pending.size, 0);
        f.fire();
        assert.equal(d.signal.aborted, false);
        assert.equal(d.timedOut, false);
    });
    it("la cancelación de quien llama se respeta y no cuenta como tiempo agotado", () => {
        const f = fakeTimers();
        const caller = new AbortController();
        const d = createDeadline(1000, caller.signal, f.timers);
        caller.abort();
        assert.equal(d.signal.aborted, true);
        assert.equal(d.timedOut, false);
        d.cancel();
        assert.equal(f.pending.size, 0);
        const yaCancelada = new AbortController();
        yaCancelada.abort();
        assert.equal(createDeadline(1000, yaCancelada.signal, fakeTimers().timers).signal.aborted, true);
    });
});

describe("reintentos solo cuando es seguro (issue #172, H06)", () => {
    it("las lecturas se reintentan ante red, tiempo agotado o 5xx, un número limitado de veces", () => {
        for (const failure of ["network", "timeout", "server_error"] as const) {
            assert.equal(shouldRetry({ method: "GET", failure, attempt: 0 }), true, failure);
            assert.equal(shouldRetry({ method: "GET", failure, attempt: MAX_READ_RETRIES }), false, `${failure} agotado`);
        }
    });
    it("una escritura NO se reintenta sola (podría duplicarse), aunque la red haya fallado", () => {
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            for (const failure of ["network", "timeout", "server_error"] as const) assert.equal(shouldRetry({ method, failure, attempt: 0 }), false, `${method} ${failure}`);
        }
    });
    it("una escritura solo se reintenta si quien llama declara que el servidor es idempotente, y una vez", () => {
        assert.equal(shouldRetry({ method: "POST", idempotent: true, failure: "timeout", attempt: 0 }), true);
        assert.equal(shouldRetry({ method: "POST", idempotent: true, failure: "timeout", attempt: MAX_IDEMPOTENT_WRITE_RETRIES }), false);
        assert.equal(shouldRetry({ method: "POST", idempotent: false, failure: "timeout", attempt: 0 }), false);
    });
    it("nunca se reintenta lo que no es de red/servidor: permisos, sesión, equipo", () => {
        for (const failure of ["permission_denied", "session_expired", "session_revoked", "forbidden", "device_not_approved"] as const) {
            assert.equal(shouldRetry({ method: "GET", failure, attempt: 0 }), false, failure);
            assert.equal(shouldRetry({ method: "POST", idempotent: true, failure, attempt: 0 }), false, failure);
        }
        assert.equal(shouldRetry({ method: "GET", failure: null, attempt: 0 }), false);
    });
    it("la espera crece y tiene tope", () => {
        const a = retryDelayMs(0), b = retryDelayMs(1), c = retryDelayMs(10);
        assert.ok(a > 0 && b > a);
        assert.ok(c <= 4000);
        assert.ok(retryDelayMs(-1) > 0);
    });
});

describe("cableado en authedFetch (issue #172, H06)", () => {
    const src = leer("hooks/authedFetch.ts");
    it("toda petición lleva un plazo y su señal, y el temporizador se limpia", () => {
        assert.match(src, /createDeadline\(/);
        assert.match(src, /resolveDeadlineMs\(/);
        assert.match(src, /signal: deadline\.signal/);
        assert.match(src, /deadline\.cancel\(\)/);
        assert.equal(/await fetch\(url, \{ \.\.\.\(init \?\? \{\}\), headers \}\)/.test(src), false, "ya no hay un fetch sin plazo");
    });
    it("los reintentos pasan por shouldRetry y respetan la idempotencia declarada", () => {
        assert.match(src, /shouldRetry\(\{[^}]*idempotent/);
        assert.match(src, /idempotent\?: boolean/);
    });
    it("la clave de idempotencia, si se da, viaja en la cabecera", () => {
        assert.match(src, /Idempotency-Key/);
    });
    it("el tiempo agotado se informa como tal", () => {
        assert.match(src, /deadline\.timedOut/);
    });
});
