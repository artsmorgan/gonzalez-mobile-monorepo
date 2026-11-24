import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { isConnectionLoadError, attendanceLoadErrorMessage, attendanceLoadErrorSupportText, classifyAttendanceLoadError, type AttendanceLoadErrorInput } from "../../mobile/hooks/attendanceLoadError";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

const codigo = (i: AttendanceLoadErrorInput) => classifyAttendanceLoadError(i).code;

describe("errores al cargar el turno: cada situación tiene su mensaje", () => {
    it("el servidor responde con un error y manda su código", () => {
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 404, serverCode: "SIN_MARCA" }), "SIN-TURNO");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 404, serverCode: "ESTRUCTURA_INCOMPLETA" }), "TURNO-INCOMPLETO");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 404, serverCode: "EMPLEADO_NO_ENCONTRADO" }), "USUARIO-NO-ENCONTRADO");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 401 }), "SESION");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 403 }), "SESION");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 426 }), "ACTUALIZAR");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 500 }), "SERVICIO");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 503 }), "SERVICIO");
        assert.equal(codigo({ stage: "respuesta_http", httpStatus: 404 }), "SERVIDOR-404", "404 sin código conocido");
    });

    it("el servidor responde 200 pero el cuerpo no se puede leer (túnel, página intermedia, respuesta vacía o cortada)", () => {
        assert.equal(codigo({ stage: "respuesta_json", error: new SyntaxError("JSON Parse error: Unexpected character: <") }), "RESPUESTA-ILEGIBLE");
        assert.equal(codigo({ stage: "desconocida", error: new SyntaxError("Unexpected end of JSON input") }), "RESPUESTA-ILEGIBLE");
    });

    it("la respuesta llega bien pero falla al procesarla en el teléfono", () => {
        assert.equal(codigo({ stage: "procesar_bloqueada", error: new Error("database or disk is full") }), "SIN-ESPACIO");
        assert.equal(codigo({ stage: "procesar_bloqueada", error: new Error("Row too big to fit into CursorWindow") }), "SIN-ESPACIO");
        assert.equal(codigo({ stage: "procesar_bloqueada", error: new RangeError("Invalid time value") }), "HORA-INVALIDA");
        assert.equal(codigo({ stage: "procesar_exito", error: new Error("Server time not found") }), "HORA-SERVICIO");
        assert.equal(codigo({ stage: "procesar_exito", error: new Error("HTTP error! status: 404 getLunchTimeConfig") }), "TURNO-PARCIAL");
        assert.equal(codigo({ stage: "procesar_bloqueada", error: new TypeError("Cannot read property 'split' of undefined") }), "DATOS-INCOMPLETOS");
        assert.equal(codigo({ stage: "procesar_bloqueada", error: new Error("algo raro") }), "DATOS-INCOMPLETOS", "falla al procesar la marca recibida");
    });

    it("sin red o algo que no se esperaba", () => {
        assert.equal(codigo({ stage: "preparacion", error: new TypeError("Network request failed") }), "SIN-CONEXION");
        assert.equal(codigo({ stage: "preparacion", error: new Error("algo raro") }), "INESPERADO");
        assert.equal(codigo({ stage: "desconocida" }), "INESPERADO");
    });

    it("los textos son para personas sin conocimientos técnicos: sin jerga y siempre dicen qué hacer", () => {
        const jerga = /\b(JSON|HTTP|API|token|excepci[oó]n|undefined|null|AsyncStorage|stack|status|servidor|endpoint|parse|404|500)\b/i;
        const entradas: AttendanceLoadErrorInput[] = [
            { stage: "respuesta_http", httpStatus: 404, serverCode: "SIN_MARCA" },
            { stage: "respuesta_http", httpStatus: 404, serverCode: "ESTRUCTURA_INCOMPLETA" },
            { stage: "respuesta_http", httpStatus: 404, serverCode: "EMPLEADO_NO_ENCONTRADO" },
            { stage: "respuesta_http", httpStatus: 403 },
            { stage: "respuesta_http", httpStatus: 426 },
            { stage: "respuesta_http", httpStatus: 502 },
            { stage: "respuesta_http", httpStatus: 400 },
            { stage: "respuesta_json", error: new SyntaxError("JSON Parse error") },
            { stage: "procesar_bloqueada", error: new Error("disk is full") },
            { stage: "procesar_bloqueada", error: new RangeError("Invalid time value") },
            { stage: "procesar_exito", error: new Error("Server time not found") },
            { stage: "procesar_exito", error: new Error("getLunchTimeConfig") },
            { stage: "procesar_bloqueada", error: new TypeError("Cannot read property 'x' of undefined") },
            { stage: "preparacion", error: new Error("Network request failed") },
            { stage: "desconocida" },
        ];
        const codigos = new Set<string>();
        for (const e of entradas) {
            const info = classifyAttendanceLoadError(e);
            codigos.add(info.code);
            for (const campo of [info.titulo, info.mensaje, info.queHacer]) {
                assert.ok(campo.trim().length > 10, `${info.code}: texto vacío`);
                assert.equal(jerga.test(campo), false, `${info.code}: usa jerga técnica en «${campo}»`);
            }
            assert.match(info.queHacer, /\.$/);
            assert.ok(info.code.length <= 24 && /^[A-Z0-9-]+$/.test(info.code));
        }
        assert.ok(codigos.size >= 12, "cada situación tiene su propio código");
    });

    it("el mensaje corto y el texto para soporte no llevan detalles técnicos y sí el código", () => {
        const info = classifyAttendanceLoadError({ stage: "respuesta_json", error: new SyntaxError("JSON Parse error: Unexpected character: <html>") });
        const corto = attendanceLoadErrorMessage(info);
        assert.match(corto, /^No pudimos leer la respuesta\./);
        assert.equal(/Unexpected|<html>|SyntaxError/.test(corto), false);
        const soporte = attendanceLoadErrorSupportText(info, { version: "1.0.7", fecha: "20-11-2026 07:58" });
        assert.match(soporte, /Código para soporte: RESPUESTA-ILEGIBLE/);
        assert.match(soporte, /Versión de la aplicación: 1\.0\.7/);
        assert.equal(/Unexpected|<html>|SyntaxError/.test(soporte), false);
    });
});

describe("errores al cargar el turno: el servidor y la pantalla", () => {
    it("las respuestas 404 de la marca actual traen un código estable (sin cambiar el mensaje ni el estado)", () => {
        const ruta = leer(server, "app/api/attendance/user/[id]/route.ts");
        assert.match(ruta, /code: "SIN_MARCA", message: "No se encontró la marca del dia" \}, \{ status: 404 \}/);
        assert.match(ruta, /code: "ESTRUCTURA_INCOMPLETA", campo: "empresa", message: "No se encontró la empresa" \}, \{ status: 404 \}/);
        assert.match(ruta, /code: "ESTRUCTURA_INCOMPLETA", campo: "sucursal", message: "Corpo no encontrado" \}, \{ status: 404 \}/);
        assert.match(ruta, /code: "EMPLEADO_NO_ENCONTRADO", message: "Empleado no encontrado" \}, \{ status: 404 \}/);
        assert.equal((ruta.match(/code: "ESTRUCTURA_INCOMPLETA"/g) ?? []).length, 11);
    });

    it("la pantalla registra la etapa en que falló, muestra el mensaje claro y abre la ventana una vez por situación", () => {
        const p = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(p, /let loadStage: AttendanceLoadStage = 'preparacion';/);
        assert.match(p, /loadStage = 'respuesta_http';[\s\S]*?loadServerCode = isPermissionDeniedPayload\(errorBody\) \? 'permission_denied' : typeof errorBody\?\.code === 'string'/);
        assert.match(p, /loadStage = 'respuesta_json';\s*data = await response\.json\(\);\s*loadStage = data\?\.status \? 'procesar_exito' : 'procesar_bloqueada';/);
        assert.match(p, /classifyAttendanceLoadError\(\{ stage: loadStage, error, httpStatus: loadHttpStatus, serverCode: loadServerCode \}\)/);
        assert.match(p, /setErrorMessage\(attendanceLoadErrorMessage\(info\)\);/);
        assert.match(p, /if \(!shownLoadErrorCodesRef\.current\.has\(info\.code\)\)/);
        assert.equal(p.includes("setErrorMessage('Error al cargar los datos. Por favor, intenta nuevamente.')"), false, "ya no hay un único texto genérico");
        assert.match(p, /¿Qué puedo hacer\?/);
        assert.match(p, /Qué pasó[\s\S]*?Qué puedes hacer[\s\S]*?Código para soporte: \{loadErrorInfo\?\.code\}/);
        assert.match(p, /Compartir con soporte/);
    });

    it("el detalle técnico se queda en el registro y no se muestra a la persona", () => {
        const p = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(p, /console\.error\('Error fetching attendance status:', error, \{ etapa: loadStage, estadoHttp: loadHttpStatus, codigoServidor: loadServerCode, codigo: info\.code \}\);/);
        const ventana = p.slice(p.indexOf("{/* Ventana de ayuda cuando no se puede cargar el turno"), p.indexOf("<AppFooter />", p.indexOf("{/* Ventana de ayuda")));
        assert.equal(/error\.message|error\.stack|String\(error/.test(ventana), false);
    });
});

describe("búsqueda lenta: el plazo agotado tiene su mensaje y se usa el turno guardado", () => {
    it("un plazo agotado ya no se confunde con falta de internet", () => {
        const tiempo = classifyAttendanceLoadError({ stage: "preparacion", error: Object.assign(new Error("La petición tardó demasiado"), { name: "TimeoutError" }) });
        assert.equal(tiempo.code, "TIEMPO-AGOTADO");
        assert.equal(isConnectionLoadError(tiempo), true);
        const sinRed = classifyAttendanceLoadError({ stage: "preparacion", error: new TypeError("Network request failed") });
        assert.equal(sinRed.code, "SIN-CONEXION");
        assert.equal(isConnectionLoadError(sinRed), true);
        assert.equal(isConnectionLoadError(classifyAttendanceLoadError({ stage: "respuesta_http", httpStatus: 500 })), false);
        assert.equal(/(timeout|servidor|HTTP|API)/i.test(`${tiempo.titulo} ${tiempo.mensaje} ${tiempo.queHacer}`), false);
    });

    it("la pantalla muestra el turno guardado cuando el servicio no responde y el servidor limita y paraleliza las consultas", () => {
        const p = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(p, /if \(isConnectionLoadError\(info\)\) \{[\s\S]*?getItem\('current_marca'\)[\s\S]*?revalidateLocalMarcaOffline[\s\S]*?setUsingSavedMarcaNotice\(true\);/);
        const ruta = leer(server, "app/api/attendance/user/[id]/route.ts");
        assert.match(ruta, /timeout: PLANILLAS_MARCAS_TIMEOUT_MS/);
        assert.equal((ruta.match(/await precargarDias\(DIAS_BUSQUEDA, (1|-1)\)/g) ?? []).length, 3);
    });
});

describe("la marca obtenida siempre se muestra: un fallo posterior solo agrega su mensaje", () => {
    it("un fallo con la marca ya en pantalla tiene su propio mensaje, sin jerga", () => {
        const info = classifyAttendanceLoadError({ stage: "marca_mostrada", error: new RangeError("Invalid time value") });
        assert.equal(info.code, "VERIFICACION-PENDIENTE");
        assert.equal(/\b(JSON|HTTP|API|token|undefined|null|status|servidor|404|500|Invalid)\b/i.test(`${info.titulo} ${info.mensaje} ${info.queHacer}`), false);
        assert.match(info.queHacer, /\.$/);
    });

    it("la pantalla marca cuándo la marca ya se ve y en ese caso no la oculta ni abre la ventana de error", () => {
        const p = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(p, /setAttendanceData\(attendance_save\);\s*\/\/[^\n]*\n\s*marcaMostradaRef\.current = true;/);
        assert.match(p, /if \(marcaMostradaRef\.current\) \{[\s\S]*?stage: 'marca_mostrada'[\s\S]*?setErrorMessage\(attendanceLoadErrorMessage\(parcial\)\);\s*return;\s*\}/);
        assert.equal(p.includes("throw new Error('Server time not found')"), false, "sin hora guardada la marca se muestra con la hora de acción");
        assert.match(p, /Guardar la marca en el teléfono es secundario/);
        assert.match(p, /const currentTimeSafe = Number\.isFinite\(currentTimeMs\) \? currentTimeMs : now;/);
    });
});
