import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { dayKey, isPermitRangeInverted, reconcilePermitRange } from "../../mobile/hooks/permitDateRange";
import { TIMER_FONT_MAX, TIMER_FONT_MIN, canRefreshLunchMinutes, fitTimerFontSize, shouldConfirmLunchStart } from "../../mobile/hooks/lunchTimeScreenRules";
import { HOME_RESET_ACTION, shouldResetToHome } from "../../mobile/hooks/headerBack";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

/** Fechas locales (el selector de la app trabaja en hora local). */
const d = (y: number, m: number, day: number, h = 12, min = 0) => new Date(y, m - 1, day, h, min);

describe("Solicitud de permiso: fecha de inicio y de fin nunca invertidas", () => {
    it("clave de día en hora local", () => {
        assert.equal(dayKey(d(2026, 10, 21, 23, 59)), 20261021);
        assert.equal(dayKey(d(2026, 1, 1, 0, 0)), 20260101);
    });
    it("si se elige un inicio posterior al fin, el fin se mueve al inicio", () => {
        const r = reconcilePermitRange({ inicio: d(2026, 10, 25), fin: d(2026, 10, 21) }, "inicio");
        assert.equal(dayKey(r.inicio), 20261025);
        assert.equal(dayKey(r.fin), 20261025);
    });
    it("si se elige un fin anterior al inicio, el inicio se mueve al fin", () => {
        const r = reconcilePermitRange({ inicio: d(2026, 10, 25), fin: d(2026, 10, 21) }, "fin");
        assert.equal(dayKey(r.inicio), 20261021);
        assert.equal(dayKey(r.fin), 20261021);
    });
    it("el mismo día no puede quedar con la hora de fin anterior a la de inicio", () => {
        for (const changed of ["inicio", "fin"] as const) {
            const r = reconcilePermitRange({ inicio: d(2026, 10, 21, 15, 30), fin: d(2026, 10, 21, 9, 0) }, changed);
            assert.ok(r.fin.getTime() >= r.inicio.getTime(), changed);
            assert.equal(dayKey(r.fin), dayKey(r.inicio));
        }
    });
    it("un rango válido no se toca (ni se crean copias distintas en valor)", () => {
        const inicio = d(2026, 10, 21, 8), fin = d(2026, 10, 23, 8);
        const r = reconcilePermitRange({ inicio, fin }, "fin");
        assert.equal(r.inicio.getTime(), inicio.getTime());
        assert.equal(r.fin.getTime(), fin.getTime());
        const mismo = reconcilePermitRange({ inicio: d(2026, 10, 21, 8), fin: d(2026, 10, 21, 17) }, "inicio");
        assert.equal(mismo.fin.getTime(), d(2026, 10, 21, 17).getTime());
    });
    it("cruza meses y años correctamente y no muta las fechas recibidas", () => {
        const inicio = d(2027, 1, 2), fin = d(2026, 12, 30);
        const copia = [inicio.getTime(), fin.getTime()];
        const r = reconcilePermitRange({ inicio, fin }, "inicio");
        assert.equal(dayKey(r.fin), 20270102);
        assert.deepEqual([inicio.getTime(), fin.getTime()], copia);
        assert.notEqual(r.fin, inicio, "devuelve una copia, no la misma instancia");
    });
    it("fechas inválidas no rompen: se devuelven tal cual", () => {
        const bad = new Date(Number.NaN);
        const ok = d(2026, 10, 21);
        for (const range of [{ inicio: bad, fin: ok }, { inicio: ok, fin: bad }, { inicio: bad, fin: bad }]) {
            assert.doesNotThrow(() => reconcilePermitRange(range, "inicio"));
            assert.equal(isPermitRangeInverted(range.inicio, range.fin), false);
        }
    });
    it("detecta un rango invertido por día (la solicitud viaja con fechas, no con horas)", () => {
        assert.equal(isPermitRangeInverted(d(2026, 10, 25), d(2026, 10, 21)), true);
        assert.equal(isPermitRangeInverted(d(2026, 10, 21, 20), d(2026, 10, 21, 8)), false, "mismo día: lo corrige reconcile, no es un rango invertido para el servidor");
        assert.equal(isPermitRangeInverted(d(2026, 10, 21), d(2026, 10, 22)), false);
    });
    it("cableado: los selectores y el envío usan la regla", () => {
        const src = leer("screens/PermitRequestScreenV2.tsx");
        assert.match(src, /reconcilePermitRange\(\{[^}]*\}, 'inicio'\)/);
        assert.match(src, /reconcilePermitRange\(\{[^}]*\}, 'fin'\)/);
        const executeCreate = src.slice(src.indexOf("const executeCreate"));
        assert.match(executeCreate.slice(0, 1500), /isPermitRangeInverted\(/);
        const fetchTurnos = src.slice(src.indexOf("const fetchTurnosPreview"), src.indexOf("const fetchTurnosPreview") + 1500);
        assert.match(fetchTurnos, /isPermitRangeInverted\(/);
    });
});

describe("Tiempo de alimentación: actualizar los minutos del horario", () => {
    const quieto = { isTimerActive: false, hasStartTime: false, counterStarted: false, hasPausedInactivity: false };
    it("solo se actualiza el contador si está inactivo y sin iniciar", () => {
        assert.equal(canRefreshLunchMinutes(quieto), true);
    });
    it("nunca mientras corre, ya se inició, hay un conteo guardado o está en pausa", () => {
        for (const k of Object.keys(quieto) as Array<keyof typeof quieto>) {
            assert.equal(canRefreshLunchMinutes({ ...quieto, [k]: true }), false, k);
        }
    });
    it("cableado: la pantalla actualiza al abrir (con conexión) y al deslizar, con esa misma condición", () => {
        const src = leer("screens/LunchTimeScreen.tsx");
        assert.match(src, /RefreshControl/);
        assert.match(src, /canRefreshLunchMinutes\(/);
        assert.match(src, /onRefresh=\{/);
        assert.match(src, /fetchLunchMinutesByMarcaId\(/);
    });
});

describe("Tiempo de alimentación: iniciar pide confirmación y ya no se edita ni se reinicia", () => {
    it("solo se confirma el primer inicio; reanudar una pausa no vuelve a preguntar", () => {
        assert.equal(shouldConfirmLunchStart({ hasStartTime: false }), true);
        assert.equal(shouldConfirmLunchStart({ hasStartTime: true }), false);
    });
    const src = leer("screens/LunchTimeScreen.tsx");
    it("ya no existe el botón de editar minutos ni su flujo", () => {
        for (const gone of ["editMinutesOpenButton", "isEditingMinutes", "handleUpdateLunchMinutes", "Modificar minutos"]) {
            assert.equal(src.includes(gone), false, `sigue apareciendo «${gone}»`);
        }
    });
    it("ya no existe el botón de reiniciar", () => {
        assert.equal(/styles\.resetButton/.test(src), false);
        assert.equal(/getActionIcon\('reset'\)/.test(src), false);
        assert.equal(/onPress=\{\(\) => void handleReset\(\)\}/.test(src), false);
    });
    it("al iniciar por primera vez se pide confirmación antes de arrancar el conteo", () => {
        const body = src.slice(src.indexOf("const handleStart"), src.indexOf("const handleStop"));
        assert.match(body, /shouldConfirmLunchStart\(/);
        assert.match(body, /Alert\.alert\(/);
        assert.ok(body.indexOf("Alert.alert(") < body.indexOf("startCounter()"), "la confirmación va antes de iniciar");
    });
});

describe("Tiempo de alimentación: el contador siempre en una línea", () => {
    it("el tamaño crece con el ancho y nunca pasa de los límites", () => {
        let prev = 0;
        for (const w of [60, 90, 120, 160, 200, 260, 320, 500]) {
            const s = fitTimerFontSize("00:00:00", w);
            assert.ok(s >= TIMER_FONT_MIN && s <= TIMER_FONT_MAX, `${w}: ${s}`);
            assert.ok(s >= prev, "monótono");
            assert.equal(Number.isInteger(s), true);
            prev = s;
        }
        assert.equal(fitTimerFontSize("00:00:00", 5000), TIMER_FONT_MAX);
    });
    it("el texto cabe en el ancho disponible (salvo en el mínimo)", () => {
        for (const text of ["00:00", "59:59", "01:30:00", "10:00:00"]) {
            for (const w of [120, 160, 200, 280]) {
                const s = fitTimerFontSize(text, w);
                if (s > TIMER_FONT_MIN) assert.ok(s * 0.62 * text.length <= w + 1, `${text} @${w} -> ${s}`);
            }
        }
    });
    it("un texto más corto puede ser más grande en el mismo ancho", () => {
        assert.ok(fitTimerFontSize("00:00", 160) >= fitTimerFontSize("00:00:00", 160));
    });
    it("sin ancho medido todavía o con valores raros devuelve un tamaño válido", () => {
        for (const w of [null, undefined, 0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
            const s = fitTimerFontSize("00:00:00", w as number);
            assert.ok(s >= TIMER_FONT_MIN && s <= TIMER_FONT_MAX, String(w));
        }
        assert.ok(fitTimerFontSize("", 200) >= TIMER_FONT_MIN);
    });
    it("cableado: el contador se mide y se dibuja en una sola línea", () => {
        const src = leer("screens/LunchTimeScreen.tsx");
        assert.match(src, /fitTimerFontSize\(/);
        assert.match(src, /onLayout=\{/);
        assert.match(src, /numberOfLines=\{1\}/);
    });
});

describe("Header: la flecha de regreso nunca queda sin destino", () => {
    it("con historial regresa; sin historial va a Home", () => {
        assert.equal(shouldResetToHome(true), false);
        assert.equal(shouldResetToHome(false), true);
    });
    it("el reinicio deja solo la pantalla Home en la pila", () => {
        assert.deepEqual(HOME_RESET_ACTION, { index: 0, routes: [{ name: "Home" }] });
    });
    it("cableado: el header decide con canGoBack y reinicia la pila", () => {
        const src = leer("components/AppHeader.tsx");
        assert.match(src, /canGoBack\(\)/);
        assert.match(src, /CommonActions\.reset\(HOME_RESET_ACTION/);
        assert.equal(/onPress=\{\(\) => navigation\.goBack\(\)\}/.test(src), false);
    });
});
