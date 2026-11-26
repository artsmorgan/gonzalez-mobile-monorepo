import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatNaive, resolveManualLunch, ventanaDeMarca, type ManualLunchInput } from "../../mobile/hooks/lunchManualTimes";

const diaMarca = { fecha: "2026-10-15T00:00:00.000Z", hora_inicio: "1970-01-01T06:00:00.000Z", hora_fin: "1970-01-01T18:00:00.000Z" };
const nocheMarca = { fecha: "2026-10-15T00:00:00.000Z", hora_inicio: "1970-01-01T22:00:00.000Z", hora_fin: "1970-01-01T06:00:00.000Z" };
const t = (hour: string, minute = "00") => ({ hour, minute });
const base = (over: Partial<ManualLunchInput> = {}): ManualLunchInput => ({ marca: diaMarca, inicio: t("12"), fin: t("13"), pausas: [], minutosDisponibles: 60, ...over });
const ok = (r: ReturnType<typeof resolveManualLunch>) => {
    assert.equal(r.ok, true, JSON.stringify(r));
    return r as Extract<typeof r, { ok: true }>;
};
const errs = (r: ReturnType<typeof resolveManualLunch>) => {
    assert.equal(r.ok, false);
    return (r as Extract<typeof r, { ok: false }>).errors;
};

describe("almuerzo manual con inicio y fin explícitos (issue #158)", () => {
    it("guarda exactamente las dos horas escritas, sin corrimiento de zona horaria (12:00 → 12:00Z, no 18:00Z)", () => {
        const r = ok(resolveManualLunch(base()));
        assert.equal(new Date(r.inicioMs).toISOString(), "2026-10-15T12:00:00.000Z");
        assert.equal(new Date(r.finMs).toISOString(), "2026-10-15T13:00:00.000Z");
        assert.equal(r.minutosAlmuerzo, 60);
        assert.equal(formatNaive(r.finMs), "2026-10-15 13:00");
    });
    it("el fin NO se asume al final del turno: puede ser menor a los minutos disponibles", () => {
        const r = ok(resolveManualLunch(base({ fin: t("12", "40") })));
        assert.equal(r.minutosAlmuerzo, 40);
        assert.equal(new Date(r.finMs).toISOString(), "2026-10-15T12:40:00.000Z");
    });
    it("las pausas se descuentan del tiempo efectivo", () => {
        const r = ok(resolveManualLunch(base({ fin: t("13", "20"), pausas: [{ startHour: "12", startMinute: "30", endHour: "12", endMinute: "50", reason: "Llamada" }] })));
        assert.equal(r.minutosAlmuerzo, 60);
        assert.deepEqual(
            r.pausas.map((p) => [new Date(p.startMs).toISOString(), new Date(p.endMs).toISOString(), p.reason]),
            [["2026-10-15T12:30:00.000Z", "2026-10-15T12:50:00.000Z", "Llamada"]],
        );
    });
    it("turno nocturno: un almuerzo de madrugada cae al día siguiente y un fin pasada la medianoche también", () => {
        const antes = ok(resolveManualLunch(base({ marca: nocheMarca, inicio: t("23", "30"), fin: t("0", "20") })));
        assert.equal(new Date(antes.inicioMs).toISOString(), "2026-10-15T23:30:00.000Z");
        assert.equal(new Date(antes.finMs).toISOString(), "2026-10-16T00:20:00.000Z");
        const despues = ok(resolveManualLunch(base({ marca: nocheMarca, inicio: t("2"), fin: t("3") })));
        assert.equal(new Date(despues.inicioMs).toISOString(), "2026-10-16T02:00:00.000Z");
    });
    it("el fin no puede pasar del fin del turno", () => {
        assert.match(errs(resolveManualLunch(base({ inicio: t("17", "30"), fin: t("18", "30") }))).join(" "), /fin de la marca/);
        ok(resolveManualLunch(base({ inicio: t("17"), fin: t("18") })));
    });
    it("turno nocturno: el fin del turno es a las 06:00 del día siguiente (no del mismo día)", () => {
        const v = ventanaDeMarca(nocheMarca)!;
        assert.equal(new Date(v.finMs).toISOString(), "2026-10-16T06:00:00.000Z");
        assert.match(errs(resolveManualLunch(base({ marca: nocheMarca, inicio: t("5", "30"), fin: t("6", "30") }))).join(" "), /fin de la marca/);
    });
    it("valida inicio, fin y que el fin sea posterior al inicio", () => {
        assert.match(errs(resolveManualLunch(base({ inicio: t("", "") }))).join(" "), /hora de inicio/);
        assert.match(errs(resolveManualLunch(base({ fin: t("", "") }))).join(" "), /hora de fin/);
        assert.match(errs(resolveManualLunch(base({ fin: t("12") }))).join(" "), /posterior/);
    });
    it("el tiempo efectivo no puede exceder los minutos disponibles", () => {
        assert.match(errs(resolveManualLunch(base({ fin: t("13", "30") }))).join(" "), /excede los 60 minutos/);
        ok(resolveManualLunch(base({ fin: t("13", "30"), pausas: [{ startHour: "12", startMinute: "30", endHour: "13", endMinute: "0" }] })));
    });
    it("las pausas deben estar dentro del almuerzo, completas y sin solaparse", () => {
        const e1 = errs(resolveManualLunch(base({ pausas: [{ startHour: "11", startMinute: "50", endHour: "12", endMinute: "10" }] }))).join(" ");
        assert.match(e1, /dentro del tiempo de alimentación/);
        assert.match(errs(resolveManualLunch(base({ pausas: [{ startHour: "12", startMinute: "", endHour: "12", endMinute: "10" }] }))).join(" "), /campos vacíos/);
        const e2 = errs(
            resolveManualLunch(
                base({
                    fin: t("13", "30"),
                    pausas: [
                        { startHour: "12", startMinute: "10", endHour: "12", endMinute: "30" },
                        { startHour: "12", startMinute: "20", endHour: "12", endMinute: "40" },
                    ],
                }),
            ),
        ).join(" ");
        assert.match(e2, /solapan/);
    });
    it("sin horario de marca legible no registra", () => {
        assert.match(errs(resolveManualLunch(base({ marca: { fecha: "x", hora_inicio: null, hora_fin: null } }))).join(" "), /horario de la marca/);
    });
});
