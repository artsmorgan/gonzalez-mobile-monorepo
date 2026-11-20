import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ATTENDANCE_POLL_DELAY_MS, shouldRunAttendancePolling, type AttendancePollingState } from "../../mobile/hooks/attendancePolling";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const pantalla = fs.readFileSync(path.join(mobile, "screens", "MarcarIngresoSalidaScreen.tsx"), "utf8").replace(/\r\n/g, "\n");

const listo: AttendancePollingState = { isAuthenticated: true, hasEmployee: true, isProcessingMark: false, isLoadingData: false, isSearchingMarca: false, hasAttendanceData: true };

describe("actualización de la marca: los 30 segundos empiezan solo con la marca en pantalla", () => {
    it("la espera es de 30 segundos", () => {
        assert.equal(ATTENDANCE_POLL_DELAY_MS, 30_000);
    });

    it("corre únicamente con la marca en pantalla y sin búsqueda, carga ni marcado en curso", () => {
        assert.equal(shouldRunAttendancePolling(listo), true);
        assert.equal(shouldRunAttendancePolling({ ...listo, isSearchingMarca: true }), false, "mientras busca la marca");
        assert.equal(shouldRunAttendancePolling({ ...listo, isLoadingData: true }), false, "mientras carga");
        assert.equal(shouldRunAttendancePolling({ ...listo, isProcessingMark: true }), false, "mientras se marca");
        assert.equal(shouldRunAttendancePolling({ ...listo, hasAttendanceData: false }), false, "sin marca en pantalla (cargando o con error)");
        assert.equal(shouldRunAttendancePolling({ ...listo, isAuthenticated: false }), false);
        assert.equal(shouldRunAttendancePolling({ ...listo, hasEmployee: false }), false);
    });

    it("la búsqueda se marca desde su primer paso (antes de la hora del servidor y del token) y se apaga siempre al terminar", () => {
        const inicio = pantalla.indexOf("const fetchAttendanceStatus = async () => {");
        const cuerpo = pantalla.slice(inicio, pantalla.indexOf("const setCurrentAttendanceData = async (", inicio));
        const marca = cuerpo.indexOf("isSearchingMarcaRef.current = true;");
        const horaServidor = cuerpo.indexOf("await getHoraAccion()");
        const token = cuerpo.indexOf("requestPlanillasRevalidationIfNeeded(referenceMs)");
        assert.ok(marca > 0 && marca < horaServidor && marca < token, "se enciende antes de cualquier espera de la búsqueda");
        assert.match(cuerpo, /setIsSearchingMarca\(true\);/);
        assert.match(cuerpo, /\} finally \{\s*setIsLoadingData\(false\);\s*fetchAttendanceInFlightRef\.current = false;[\s\S]*?isSearchingMarcaRef\.current = false;\s*setIsValidatingMarca\(false\);\s*setIsSearchingMarca\(false\);/);
    });

    it("la espera es un temporizador de un solo disparo que se vuelve a armar al terminar cada búsqueda (con éxito o con error)", () => {
        assert.match(pantalla, /intervalRef = useRef<ReturnType<typeof setTimeout> \| null>\(null\);/);
        const a = pantalla.indexOf("// Actualización automática de la marca:");
        const efecto = pantalla.slice(a, pantalla.indexOf("useEffect(() => {\n    if (attendanceData) return;", a));
        assert.match(efecto, /shouldRunAttendancePolling\(\{[\s\S]*?isSearchingMarca,[\s\S]*?hasAttendanceData: !!attendanceData,/);
        assert.match(efecto, /intervalRef\.current = setTimeout\(\(\) => \{[\s\S]*?void fetchAttendanceStatus\(\);\s*\}, ATTENDANCE_POLL_DELAY_MS\);/);
        assert.match(efecto, /\[isAuthenticated, employee, isProcessingMark, isLoadingData, isSearchingMarca, attendanceData\]/);
        assert.equal(/setInterval/.test(efecto), false, "ya no es un intervalo que sigue corriendo");
    });

    it("al empezar a buscar o a marcar se cancela la espera con clearTimeout", () => {
        assert.equal(/clearInterval\(intervalRef/.test(pantalla), false);
        assert.equal((pantalla.match(/clearTimeout\(intervalRef\.current\)/g) ?? []).length >= 3, true, "efecto, búsqueda y marcado");
    });

    it("los otros chequeos de cada 30 segundos (hora/GPS y revisión sin conexión) tampoco corren mientras se busca la marca", () => {
        assert.equal((pantalla.match(/isProcessingMark \|\| isLoadingData \|\| isSearchingMarcaRef\.current\) return;/g) ?? []).length, 2);
    });
});

import { ATTENDANCE_SEARCH_DEADLINE_MS, ATTENDANCE_SEARCH_SLOW_MESSAGE, ATTENDANCE_SEARCH_SLOW_NOTICE_MS } from "../../mobile/hooks/attendancePolling";
import { DEADLINES_MS, MAX_DEADLINE_MS, resolveDeadlineMs } from "../../mobile/hooks/fetchDeadline";

describe("búsqueda de la marca: tiempo suficiente y aviso en la pantalla de carga a los 20 segundos", () => {
    it("el plazo de la búsqueda es el máximo permitido, no los 20 segundos de una consulta normal", () => {
        assert.equal(ATTENDANCE_SEARCH_DEADLINE_MS, MAX_DEADLINE_MS);
        assert.ok(ATTENDANCE_SEARCH_DEADLINE_MS > DEADLINES_MS.read * 10);
        assert.equal(resolveDeadlineMs({ method: "GET", override: ATTENDANCE_SEARCH_DEADLINE_MS }), 300_000);
        assert.equal(resolveDeadlineMs({ method: "GET" }), 20_000, "las demás consultas no cambian");
    });

    it("la marca y su información adjunta (alimentación y actividades) se piden con ese plazo", () => {
        assert.match(pantalla, /url: attendanceUserUrl,\s*\/\/[^\n]*\n\s*timeoutMs: ATTENDANCE_SEARCH_DEADLINE_MS,/);
        assert.match(pantalla, /url: `\$\{apiUrl\}\/api\/lunch-time\/\$\{marcaId\}`,\s*timeoutMs: ATTENDANCE_SEARCH_DEADLINE_MS,/);
        assert.match(pantalla, /url: `\$\{apiUrl\}\/api\/activities\/marca\/\$\{marcaId\}`,\s*timeoutMs: ATTENDANCE_SEARCH_DEADLINE_MS,/);
    });

    it("el texto cambia a los 20 segundos de empezar la búsqueda con el texto pedido", () => {
        assert.equal(ATTENDANCE_SEARCH_SLOW_NOTICE_MS, 20_000);
        assert.equal(ATTENDANCE_SEARCH_SLOW_MESSAGE, "La búsqueda está tardando demasiado, espere por favor...");
        const inicio = pantalla.indexOf("const fetchAttendanceStatus = async () => {");
        const cuerpo = pantalla.slice(inicio, pantalla.indexOf("const setCurrentAttendanceData = async (", inicio));
        assert.match(cuerpo, /searchSlowTimerRef\.current = setTimeout\(\(\) => setIsSearchSlow\(true\), ATTENDANCE_SEARCH_SLOW_NOTICE_MS\);/);
        assert.ok(cuerpo.indexOf("setTimeout(() => setIsSearchSlow(true)") < cuerpo.indexOf("await getHoraAccion()"), "el reloj de los 20 s empieza con la búsqueda");
    });

    it("el aviso se quita al terminar la búsqueda (éxito o error) y al salir de la pantalla", () => {
        assert.match(pantalla, /\} finally \{[\s\S]*?clearTimeout\(searchSlowTimerRef\.current\);[\s\S]*?setIsSearchSlow\(false\);/);
        assert.match(pantalla, /useEffect\(\s*\(\) => \(\) => \{\s*if \(searchSlowTimerRef\.current\) clearTimeout\(searchSlowTimerRef\.current\);/);
    });

    it("el aviso reemplaza el texto «Cargando datos de asistencia...» de la pantalla de carga y ya no hay recuadro arriba", () => {
        assert.match(pantalla, /\{isSearchSlow \? ATTENDANCE_SEARCH_SLOW_MESSAGE : ATTENDANCE_LOADING_MESSAGE\}/);
        assert.equal(pantalla.includes("{isSearchingMarca && isSearchSlow ? ("), false, "ya no se muestra un recuadro aparte arriba");
        assert.equal(pantalla.includes("Cargando datos de asistencia..."), false, "el texto sale de la constante");
    });
});

describe("flujo: marca de inmediato, validaciones después y recién entonces los 30 segundos", () => {
    it("la marca se muestra apenas se obtiene y los mensajes y botones esperan a las validaciones", () => {
        // al poner la marca en pantalla se quita la carga y empiezan las validaciones posteriores
        assert.match(pantalla, /marcaMostradaRef\.current = true;\s*if \(isSearchingMarcaRef\.current\) \{\s*setIsLoadingData\(false\);\s*setIsValidatingMarca\(true\);/);
        // mientras se validan, los mensajes (7) y el botón de marcar (8) no se ven
        assert.match(pantalla, /\{isValidatingMarca \? \([\s\S]*?Verificando tu ubicación y la hora\.\.\.[\s\S]*?\) : \(\s*<>[\s\S]*?\{\/\* 7\. Mensajes[\s\S]*?\{\/\* 8\. Botón de marcar entrada o salida \*\/\}[\s\S]*?<\/>\s*\)\}\s*\{\/\* 9\. Ubicación del puesto/);
    });

    it("la espera de 30 segundos no corre durante las validaciones: depende de que la búsqueda haya terminado del todo", () => {
        const p = fs.readFileSync(path.join(mobile, "hooks", "attendancePolling.ts"), "utf8");
        assert.match(p, /!s\.isSearchingMarca/);
        // la búsqueda (isSearchingMarca) se apaga una sola vez, en el finally, después de las validaciones y no al mostrar la marca
        const inicio = pantalla.indexOf("const fetchAttendanceStatus = async () => {");
        const cuerpo = pantalla.slice(inicio, pantalla.indexOf("const setCurrentAttendanceData = async (", inicio));
        assert.equal((cuerpo.match(/setIsSearchingMarca\(false\)/g) ?? []).length, 1);
    });
});
