import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
    ahoraCostaRicaMs,
    camposDeFila,
    construirEvidencia,
    contenidoFirmado,
    decodificarFirmaCaptura,
    filaDeEvidencia,
    firmarRegistro,
    huellaSha256,
    idDelRegistro,
    jsonCanonico,
    llaveroDesdeEntorno,
    registrarEvidencia,
    TABLAS_CON_EVIDENCIA,
    verificarFirma,
    type CamposFirmados,
    type FilaEvidencia,
} from "./evidencia";

const SECRETO = "una-clave-de-prueba-de-mas-de-24-caracteres";
const llavero = llaveroDesdeEntorno({ EVIDENCE_SIGNING_KEY: SECRETO })!;
const AHORA = Date.UTC(2026, 9, 21, 14, 30, 0); // 14:30 CR del 21 oct (reloj de CR como UTC)

/** Firma de captura como la genera la app: base64(sesión:empleado:latitud:longitud:marcaDeTiempo). */
const firmaApp = (o: { ses?: string; emp?: string | number; lat?: string; lng?: string; ts?: number } = {}) =>
    Buffer.from(`${o.ses ?? "ses-1"}:${o.emp ?? 77}:${o.lat ?? "9.9341"}:${o.lng ?? "-84.0877"}:${o.ts ?? Date.UTC(2026, 9, 21, 8, 15, 30)}`).toString("base64");
const campos = (over: Partial<CamposFirmados> = {}): CamposFirmados => ({
    tabla: "c_incidente", registroId: 12, accion: "CREATE", cedula: "1-0555-0666", usuarioId: 77, sesionId: "ses-1",
    latitud: "9.9341", longitud: "-84.0877", dispositivo: "dev-uuid", capturadoEn: "2026-10-21T08:15:30", ...over,
});

describe("JSON canónico y huella del contrato de Guardify (issue #151)", () => {
    it("ordena las llaves en todos los niveles, sin espacios; undefined no cuenta y null sí", () => {
        assert.equal(jsonCanonico({ b: 1, a: { d: [3, { z: 1, y: null }], c: undefined }, e: null }), '{"a":{"d":[3,{"y":null,"z":1}]},"b":1,"e":null}');
        assert.equal(jsonCanonico({ texto: "ñandú · 日本" }), '{"texto":"ñandú · 日本"}');
    });
    it("la huella es SHA-256 hexadecimal en minúscula del JSON canónico, igual a la que recalcula Guardify de forma independiente", () => {
        const contenido = contenidoFirmado(campos());
        // implementación independiente del contrato: llaves ordenadas, sin espacios, UTF-8
        const aMano = '{"accion":"CREATE","cedula":"1-0555-0666","dispositivo":"dev-uuid","fecha":"2026-10-21T08:15:30","latitud":9.9341,"longitud":-84.0877,"registro_id":12,"sesion_id":"ses-1","tabla":"c_incidente","usuario_id":77}';
        assert.equal(jsonCanonico(contenido), aMano);
        assert.equal(huellaSha256(contenido), crypto.createHash("sha256").update(aMano, "utf8").digest("hex"));
        assert.match(huellaSha256(contenido), /^[0-9a-f]{64}$/);
    });
    it("el contenido lleva cédula, usuario, sesión, latitud, longitud, dispositivo y fecha, más tabla, registro y acción", () => {
        assert.deepEqual(Object.keys(contenidoFirmado(campos())).sort(), ["accion", "cedula", "dispositivo", "fecha", "latitud", "longitud", "registro_id", "sesion_id", "tabla", "usuario_id"]);
        // lo vacío entra como null (cuenta), no se omite
        const vacio = contenidoFirmado(campos({ cedula: null, latitud: null, longitud: null, dispositivo: null, sesionId: null, usuarioId: null }));
        assert.deepEqual([vacio.cedula, vacio.latitud, vacio.longitud, vacio.dispositivo, vacio.sesion_id, vacio.usuario_id], [null, null, null, null, null, null]);
    });
});

describe("firma y sello de la evidencia (issue #151)", () => {
    it("misma entrada → misma firma; la firma NO necesita ninguna clave", () => {
        const a = firmarRegistro(campos(), null), b = firmarRegistro(campos(), llavero);
        assert.equal(a.firma, b.firma);
        assert.deepEqual([a.sello, a.kid, a.version], [null, null, 1]);
        assert.match(b.sello!, /^[0-9a-f]{64}$/);
        assert.equal(b.kid, "k1");
    });
    it("cualquier campo cambiado → la firma no verifica", () => {
        const guardada = firmarRegistro(campos(), llavero);
        const cambios: Partial<CamposFirmados>[] = [
            { tabla: "c_otra" }, { registroId: 13 }, { accion: "UPDATE" }, { cedula: "9-9999-9999" }, { usuarioId: 78 }, { sesionId: "ses-2" },
            { latitud: "9.9342" }, { longitud: "-84.0878" }, { dispositivo: "otro-equipo" }, { capturadoEn: "2026-10-21T08:15:31" },
        ];
        assert.deepEqual(verificarFirma(campos(), guardada, llavero), { firma: true, sello: true });
        for (const c of cambios) assert.equal(verificarFirma(campos(c), guardada, llavero).firma, false, JSON.stringify(c));
    });
    it("el sello detecta una fila fabricada aunque su huella sea consistente (cualquiera puede recalcular la huella, nadie el sello)", () => {
        const fabricada = { firma: firmarRegistro(campos({ usuarioId: 99 }), null).firma, sello: "ab".repeat(32), kid: "k1" };
        const r = verificarFirma(campos({ usuarioId: 99 }), fabricada, llavero);
        assert.deepEqual(r, { firma: true, sello: false });
    });
    it("una firma alterada, vacía o ilegible no verifica", () => {
        const { firma } = firmarRegistro(campos(), null);
        assert.equal(verificarFirma(campos(), { firma: firma.replace(/.$/, firma.endsWith("0") ? "1" : "0") }, null).firma, false);
        assert.equal(verificarFirma(campos(), { firma: "" }, null).firma, false);
        assert.equal(verificarFirma(campos(), { firma: "zz" }, null).firma, false);
    });
    it("sin sello o sin la clave de su kid, el sello queda como «no se puede saber» (null), no como válido", () => {
        const g = firmarRegistro(campos(), llavero);
        assert.equal(verificarFirma(campos(), { firma: g.firma }, llavero).sello, null);
        assert.equal(verificarFirma(campos(), g, null).sello, null);
        assert.equal(verificarFirma(campos(), { ...g, kid: "k9" }, llavero).sello, null);
    });
    it("rotación de claves: lo sellado con la clave anterior se sigue verificando", () => {
        const vieja = llaveroDesdeEntorno({ EVIDENCE_SIGNING_KEY: SECRETO, EVIDENCE_SIGNING_KEY_ID: "k1" })!;
        const sellado = firmarRegistro(campos(), vieja);
        const nueva = llaveroDesdeEntorno({ EVIDENCE_SIGNING_KEY: "clave-nueva-de-rotacion-1234567890", EVIDENCE_SIGNING_KEY_ID: "k2", EVIDENCE_SIGNING_KEYS_OLD: `k1:${SECRETO}` })!;
        assert.equal(nueva.actual.kid, "k2");
        assert.equal(verificarFirma(campos(), sellado, nueva).sello, true);
        assert.equal(firmarRegistro(campos(), nueva).kid, "k2");
        const sinLaVieja = llaveroDesdeEntorno({ EVIDENCE_SIGNING_KEY: "clave-nueva-de-rotacion-1234567890", EVIDENCE_SIGNING_KEY_ID: "k2" })!;
        assert.equal(verificarFirma(campos(), sellado, sinLaVieja).sello, null);
    });
    it("sin clave (o demasiado corta) no hay llavero: la evidencia se registra solo con la huella", () => {
        assert.equal(llaveroDesdeEntorno({}), null);
        assert.equal(llaveroDesdeEntorno({ EVIDENCE_SIGNING_KEY: "corta" }), null);
    });
});

describe("firma de captura de la app", () => {
    it("se lee el formato actual de 5 campos sin cambiarlo", () => {
        assert.deepEqual(decodificarFirmaCaptura(firmaApp()), { sessionId: "ses-1", empleadoId: "77", latitud: "9.9341", longitud: "-84.0877", timestamp: Date.UTC(2026, 9, 21, 8, 15, 30) });
    });
    it("formatos que no son de la app salen como null", () => {
        for (const v of [null, "", "no-base64-valido!!", Buffer.from("a:b:c").toString("base64"), Buffer.from("a:b:c:d:nan").toString("base64")]) assert.equal(decodificarFirmaCaptura(v), null, String(v));
    });
});

describe("armado de la evidencia (issue #153)", () => {
    const base = { tabla: "c_incidente", registroId: 12, accion: "CREATE" as const };
    const actor = { id: 77, cedula: "1-0555-0666", sessionId: "ses-token" };

    it("con firma de captura: ubicación y hora SON las de la acción, aunque se sincronice después", () => {
        const e = construirEvidencia(base, { headers: { "x-device-uid": "dev-1", "x-evidence-lat": "10", "x-evidence-lng": "-85", "x-evidence-at": String(AHORA) }, actor, datos: { firma_responsable: firmaApp() }, ahoraMs: AHORA })!;
        assert.deepEqual([e.latitud, e.longitud, e.ubicacionOrigen, e.capturadoEn], ["9.9341", "-84.0877", "firma", "2026-10-21T08:15:30"]);
        assert.deepEqual([e.dispositivo, e.cedula, e.usuarioId, e.sesionId], ["dev-1", "1-0555-0666", 77, "ses-1"]);
    });
    it("sin firma usa las cabeceras de la app (con su hora)", () => {
        const e = construirEvidencia(base, { headers: { "x-device-uid": "dev-1", "x-evidence-lat": "10.5", "x-evidence-lng": "-85.2", "x-evidence-at": String(Date.UTC(2026, 9, 21, 13, 0, 0)) }, actor, datos: {}, ahoraMs: AHORA })!;
        assert.deepEqual([e.latitud, e.longitud, e.ubicacionOrigen, e.capturadoEn, e.sesionId], ["10.5", "-85.2", "cabecera", "2026-10-21T13:00:00", "ses-token"]);
    });
    it("permiso de ubicación negado: se guarda igual, con la ubicación vacía y marcada", () => {
        const e = construirEvidencia(base, { headers: { "x-device-uid": "dev-1", "x-evidence-perm": "denied" }, actor, datos: {}, ahoraMs: AHORA })!;
        assert.deepEqual([e.latitud, e.longitud, e.ubicacionOrigen, e.capturadoEn], [null, null, "denegada", "2026-10-21T14:30:00"]);
    });
    it("coordenadas inválidas se ignoran; sin quién ni desde dónde no hay evidencia", () => {
        const e = construirEvidencia(base, { headers: { "x-device-uid": "d", "x-evidence-lat": "999", "x-evidence-lng": "-85" }, actor, datos: {}, ahoraMs: AHORA })!;
        assert.deepEqual([e.latitud, e.ubicacionOrigen], [null, "sin_datos"]);
        assert.equal(construirEvidencia(base, { headers: {}, actor: null, datos: {}, ahoraMs: AHORA }), null);
    });
    it("el dispositivo es el que Guardify muestra (su id) y, sin registrar, el UUID de la instalación", () => {
        const conAmbos = construirEvidencia(base, { headers: { "x-guardify-device": "gd-77", "x-device-uid": "uuid-1" }, actor, datos: {}, ahoraMs: AHORA })!;
        assert.equal(conAmbos.dispositivo, "gd-77");
        const soloUuid = construirEvidencia(base, { headers: { "x-device-uid": "uuid-1" }, actor, datos: {}, ahoraMs: AHORA })!;
        assert.equal(soloUuid.dispositivo, "uuid-1");
    });
    it("el dispositivo cae al del token si la cabecera no viene", () => {
        const e = construirEvidencia(base, { headers: {}, actor: { ...actor, gdev: "dev-token" }, datos: {}, ahoraMs: AHORA })!;
        assert.equal(e.dispositivo, "dev-token");
    });
    it("la fila guardada se puede verificar después con sus propios campos (también con la fecha como Date de la base)", () => {
        const e = construirEvidencia(base, { headers: { "x-device-uid": "dev-1" }, actor, datos: { firma_responsable: firmaApp() }, ahoraMs: AHORA })!;
        const fila = filaDeEvidencia(e, llavero, AHORA);
        assert.equal(fila.creado, "2026-10-21T14:30:00Z");
        const guardada = { firma: fila.firma, sello: fila.sello, kid: fila.firma_kid };
        assert.deepEqual(verificarFirma(camposDeFila(fila), guardada, llavero), { firma: true, sello: true });
        assert.deepEqual(verificarFirma(camposDeFila({ ...fila, capturado_en: new Date(fila.capturado_en) }), guardada, llavero), { firma: true, sello: true });
        assert.equal(verificarFirma(camposDeFila({ ...fila, latitud: "0" }), guardada, llavero).firma, false);
        // sin clave: misma huella, sin sello
        const sinClave = filaDeEvidencia(e, null, AHORA);
        assert.deepEqual([sinClave.firma === fila.firma, sinClave.sello, sinClave.firma_kid], [true, null, null]);
    });
});

describe("registro de la evidencia tras guardar", () => {
    const actor = { id: 77, cedula: "1-0555-0666", sessionId: "s" };
    const headers = { "x-device-uid": "dev-1" };
    const run = async (over: Record<string, unknown> = {}) => {
        const filas: FilaEvidencia[] = [];
        const errores: unknown[] = [];
        const ok = await registrarEvidencia({
            tabla: "c_incidente", action: "POST", operation: "create", resultado: { id: 5 }, headers, actor, llavero,
            escribir: async (f: FilaEvidencia) => { filas.push(f); }, ahoraMs: AHORA, onError: (e: unknown) => errores.push(e), ...over,
        } as any);
        return { ok, filas, errores };
    };
    it("un alta deja una fila CREATE y una edición una fila UPDATE", async () => {
        const alta = await run();
        assert.deepEqual([alta.ok, alta.filas[0]!.accion, alta.filas[0]!.registro_id], [true, "CREATE", 5]);
        const edicion = await run({ action: "UPDATE", operation: "update", resultado: { id: 5 }, where: { id: 5 } });
        assert.deepEqual([edicion.ok, edicion.filas[0]!.accion], [true, "UPDATE"]);
        const masiva = await run({ action: "UPDATE", operation: "updateMany", resultado: { count: 1 }, where: { id: 9 } });
        assert.deepEqual([masiva.ok, masiva.filas[0]!.registro_id], [true, 9]);
    });
    it("sin clave de sello registra igual (solo con la huella)", async () => {
        const { ok, filas } = await run({ llavero: null });
        assert.equal(ok, true);
        assert.deepEqual([filas[0]!.sello, filas[0]!.firma_kid], [null, null]);
        assert.match(filas[0]!.firma, /^[0-9a-f]{64}$/);
    });
    it("no registra: tabla sin evidencia, createMany/updateMany masivos o sin id", async () => {
        assert.equal((await run({ tabla: "n_division" })).ok, false);
        assert.equal((await run({ operation: "createMany", resultado: { count: 3 } })).ok, false);
        assert.equal((await run({ action: "UPDATE", operation: "updateMany", resultado: { count: 4 }, where: { empresa_id: 1 } })).ok, false);
        assert.equal((await run({ resultado: null })).ok, false);
        assert.equal((await run({ action: "GET" })).ok, false);
        assert.equal((await run({ action: "UPDATE", operation: "deleteMany", where: { id: 1 } })).ok, false);
    });
    it("si falla el guardado de la evidencia NO lanza (la acción del usuario ya se guardó) y avisa", async () => {
        const { ok, errores } = await run({ escribir: async () => { throw new Error("tabla inexistente"); } });
        assert.equal(ok, false);
        assert.match(String((errores[0] as Error).message), /tabla inexistente/);
    });
    it("el id sale del resultado o, si no, del where", () => {
        assert.equal(idDelRegistro({ resultado: { id: 3 }, where: undefined }), 3);
        assert.equal(idDelRegistro({ resultado: { count: 1 }, where: { id: 8 } }), 8);
        assert.equal(idDelRegistro({ resultado: null, where: { id: { in: [1] } } }), null);
    });
    it("las tablas con evidencia son los módulos con auditoría propia", () => {
        for (const t of ["c_acta_entre_producto", "c_empleado_almuerzo", "c_vehiculos_corporativos", "e_manual_puesto"]) assert.ok(TABLAS_CON_EVIDENCIA.has(t), t);
        for (const t of ["c_evidencia_registro", "c_cambios_apps_modules", "refresh_token", "c_accion_personal"]) assert.equal(TABLAS_CON_EVIDENCIA.has(t), false, t);
    });
});

describe("fechas de la fila de evidencia para el servicio dinámico", () => {
    const construida = construirEvidencia(
        { tabla: "e_llave", registroId: 3, accion: "CREATE" },
        { headers: { "x-device-uid": "dev-1", "x-evidence-lat": "10.07", "x-evidence-lng": "-84.72", "x-evidence-at": String(Date.UTC(2026, 9, 22, 11, 37, 44)) }, actor: { id: 3722, cedula: "108920757", sessionId: "ses-9" } as any, datos: {}, ahoraMs: Date.UTC(2026, 9, 22, 17, 45, 58) },
    )!;

    it("capturado_en y creado se envían con zona (Prisma DateTime exige ISO-8601 completo, no «…T11:37:44»)", () => {
        const fila = filaDeEvidencia(construida, llavero, Date.UTC(2026, 9, 22, 17, 45, 58));
        assert.equal(fila.capturado_en, "2026-10-22T11:37:44Z");
        assert.equal(fila.creado, "2026-10-22T17:45:58Z");
        for (const v of [fila.capturado_en, fila.creado]) assert.equal(Number.isNaN(new Date(v).getTime()), false);
        // una fecha que ya trae zona no se vuelve a modificar
        const conZona = filaDeEvidencia({ ...construida, capturadoEn: "2026-10-22T11:37:44Z" }, llavero, Date.UTC(2026, 9, 22, 17, 45, 58));
        assert.equal(conZona.capturado_en, "2026-10-22T11:37:44Z");
    });

    it("la firma sigue verificando tras guardar y leer la fila (la base devuelve la fecha como Date o como ISO con milisegundos)", () => {
        const fila = filaDeEvidencia(construida, llavero, Date.UTC(2026, 9, 22, 17, 45, 58));
        for (const devuelta of [new Date(fila.capturado_en), "2026-10-22T11:37:44.000Z", fila.capturado_en] as const) {
            const campos = camposDeFila({ ...fila, capturado_en: devuelta as any });
            const r = verificarFirma(campos, { firma: fila.firma, sello: fila.sello, kid: fila.firma_kid }, llavero);
            assert.equal(r.firma, true, String(devuelta));
            assert.equal(r.sello, true, String(devuelta));
        }
    });
});

describe("hora de Costa Rica para la evidencia no depende de la zona del equipo", () => {
    it("es la hora real menos 6 horas, igual en un servidor UTC que en uno con otra zona", () => {
        const antes = Date.now();
        const cr = ahoraCostaRicaMs();
        const despues = Date.now();
        assert.ok(cr >= antes - 6 * 3_600_000 && cr <= despues - 6 * 3_600_000);
    });
});
