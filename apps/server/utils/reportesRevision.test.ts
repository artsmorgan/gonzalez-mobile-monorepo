import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { actividadAplicaAlTurno } from "./actividadTipoTurno";
import { puestoConCodigo, tipoTurnoReporteLabel, ymdADmy } from "./reports-functions/reporteFormatos";

const reportes = path.resolve(__dirname, "reports-functions");
const leer = (rel: string) => fs.readFileSync(path.join(reportes, rel), "utf8").replace(/\r\n/g, "\n");

describe("reportes: formatos compartidos con la app", () => {
    it("tipo de turno: Diurno, Mixto, Nocturno, Libre e Indeterminable (letra o palabra)", () => {
        assert.deepEqual(["D", "M", "N", "L"].map(tipoTurnoReporteLabel), ["Diurno", "Mixto", "Nocturno", "Libre"]);
        assert.deepEqual(["diurno", "Mixto", "NOCTURNO", "Libre"].map(tipoTurnoReporteLabel), ["Diurno", "Mixto", "Nocturno", "Libre"]);
        for (const raro of [null, undefined, "", "X", "tarde"]) assert.equal(tipoTurnoReporteLabel(raro), "Indeterminable", String(raro));
    });

    it("fechas DD-MM-AAAA sin pasar por zonas horarias, y puesto con su código", () => {
        assert.equal(ymdADmy("2026-11-17"), "17-11-2026");
        assert.equal(ymdADmy("2026-11-17T00:00:00.000Z"), "17-11-2026");
        assert.equal(ymdADmy("sin fecha"), "sin fecha");
        assert.equal(ymdADmy(null), "");
        assert.equal(puestoConCodigo("P-01", "Puesto Centro"), "P-01 · Puesto Centro");
        assert.equal(puestoConCodigo(null, "Puesto Centro"), "Puesto Centro");
        assert.equal(puestoConCodigo("P-01", ""), "P-01");
    });
});

describe("reporte de actividades: columnas «Horario diurno», «Horario mixto» y «Horario nocturno»", () => {
    const src = leer("actividadesReport.ts");
    const encabezados = (): string[] => {
        const a = src.indexOf("const headers = [");
        const bloque = src.slice(a, src.indexOf("];", a));
        return [...bloque.matchAll(/^\s+"([^"]+)",/gm)].map((m) => m[1]);
    };

    it("están justo después de «Tipo de turno» y antes de «Es revisión equipo»", () => {
        const h = encabezados();
        const i = h.indexOf("Tipo de turno");
        assert.deepEqual(h.slice(i, i + 5), ["Tipo de turno", "Horario diurno", "Horario mixto", "Horario nocturno", "Es revisión equipo"]);
    });

    it("la cuadrícula no se desalinea: un ancho por columna (más el margen), y las celdas de la actividad coinciden con sus encabezados", () => {
        const h = encabezados();
        const a = src.indexOf("wsMain.columns = [");
        const anchos = (src.slice(a, src.indexOf("];", a)).match(/width:/g) ?? []).length;
        assert.equal(anchos, h.length + 1, "anchos = encabezados + el margen de la columna A");
        // celdas de la actividad (hasta «Descripción»): id, nombre, inicio, fin, frecuencia, tipo, D, M, N, revisión, descripción = 11
        const idx = h.indexOf("Descripción");
        assert.equal(idx + 1, 11);
        const c = src.indexOf("const actCols = [");
        const celdas = src.slice(c, src.indexOf("];", c));
        assert.match(celdas, /\.\.\.\(\["D", "M", "N"\] as const\)\.map\(\(t\) => \(actividadAplicaAlTurno\(act\.tipos_turno \?\? \[\], act\.tipo_turno, t\) \? "Sí" : "No"\)\)/);
        // cada fila = actividad (11) + puesto (2) + usuario (14) + cambio (3) = encabezados
        assert.equal(11 + 2 + 14 + 3, h.length);
    });

    it("Sí o No según los tipos de turno de la actividad; una actividad sin tipos aplica a todos", () => {
        const fila = (tipos: string[], respaldo: string | null) => (["D", "M", "N"] as const).map((t) => (actividadAplicaAlTurno(tipos, respaldo, t) ? "Sí" : "No"));
        assert.deepEqual(fila(["D", "N"], "D"), ["Sí", "No", "Sí"]);
        assert.deepEqual(fila(["M"], null), ["No", "Sí", "No"]);
        assert.deepEqual(fila([], "N"), ["No", "No", "Sí"], "actividad anterior a la tabla: su único tipo");
        assert.deepEqual(fila([], null), ["Sí", "Sí", "Sí"], "sin restricción de turno");
    });
});

describe("reportes: los módulos modificados usan los mismos formatos que la app", () => {
    it("control de asistencia: el turno sale como Diurno, Mixto, Nocturno, Libre o Indeterminable", () => {
        assert.match(leer("controlAsistenciaReport.ts"), /turno_label: tipoTurnoReporteLabel\(r\.turno\)/);
    });

    it("mutuos acuerdos: los turnos salen con fecha DD-MM-AAAA y el tipo de turno escrito (no la letra ni AAAA-MM-DD)", () => {
        const s = leer("mutuosAcuerdosReport.ts");
        assert.match(s, /return `\$\{f\} \/ \$\{tipoTurnoReporteLabel\(m\.tipo_turno\)\}`;/);
        assert.match(s, /const f = ymdADmy\(/);
        assert.match(s, /ymdADmy\(r\.created_at_txt\.slice\(0, 10\)\)/);
    });

    it("solicitudes de permiso: el puesto del turno lleva su código y el tipo de turno el mismo criterio (detalle y hoja general)", () => {
        const s = leer("solicitudesPermisoReport.ts");
        assert.equal((s.match(/puestoConCodigo\(/g) ?? []).length, 2);
        assert.equal((s.match(/tipoTurnoReporteLabel\(/g) ?? []).length, 2);
    });

    it("acciones personales: el tipo de turno de la llegada tardía y la salida anticipada sale escrito", () => {
        const s = leer("accionesPersonalesReport.ts");
        assert.equal((s.match(/x\.tipo_turno \? tipoTurnoReporteLabel\(x\.tipo_turno\) : ""/g) ?? []).length, 2);
    });
});
