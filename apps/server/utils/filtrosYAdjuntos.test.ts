import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { EMPTY_RANGE, creationYmd, dateToYmd, inRange, isRangeActive, normalizeToYmd, ymdToDmy } from "../../mobile/hooks/filtrosFechas";
import { esDuenoDelPermiso, esEjecutivoDelPermiso, puedeVerArchivosDelPermiso } from "./permitArchivos";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

describe("filtros de fecha: nacen vacíos y un rango vacío no oculta nada", () => {
    it("sin fechas elegidas todo pasa, incluso un registro sin fecha", () => {
        assert.equal(isRangeActive(EMPTY_RANGE), false);
        assert.equal(inRange("2026-11-20", EMPTY_RANGE), true);
        assert.equal(inRange("", EMPTY_RANGE), true);
        assert.equal(inRange("2020-01-01", { desde: null, hasta: null }), true);
        assert.equal(inRange("", null), true);
    });

    it("con extremos: desde, hasta, ambos, un solo día y extremos al revés", () => {
        assert.equal(inRange("2026-11-10", { desde: "2026-11-11", hasta: null }), false);
        assert.equal(inRange("2026-11-11", { desde: "2026-11-11", hasta: null }), true);
        assert.equal(inRange("2026-12-30", { desde: "2026-11-11", hasta: null }), true);
        assert.equal(inRange("2026-11-21", { desde: null, hasta: "2026-11-20" }), false);
        assert.equal(inRange("2026-11-20", { desde: null, hasta: "2026-11-20" }), true);
        assert.equal(inRange("2026-11-15", { desde: "2026-11-10", hasta: "2026-11-20" }), true);
        assert.equal(inRange("2026-11-15", { desde: "2026-11-15", hasta: "2026-11-15" }), true, "un solo día");
        assert.equal(inRange("2026-11-16", { desde: "2026-11-15", hasta: "2026-11-15" }), false);
        assert.equal(inRange("2026-11-15", { desde: "2026-11-20", hasta: "2026-11-10" }), true, "extremos al revés no ocultan todo");
        assert.equal(inRange("", { desde: "2026-11-10", hasta: null }), false, "con rango activo, un registro sin fecha no se puede ubicar");
    });

    it("entiende los formatos de fecha de los registros y muestra DD-MM-AAAA", () => {
        assert.equal(normalizeToYmd("2026-11-5"), "2026-11-05");
        assert.equal(normalizeToYmd("05-11-2026"), "2026-11-05");
        assert.equal(normalizeToYmd("2026-11-05T00:00:00.000Z"), "2026-11-05");
        assert.equal(normalizeToYmd("basura"), "");
        assert.equal(ymdToDmy("2026-11-05"), "05-11-2026");
        assert.equal(dateToYmd(new Date(2026, 10, 5)), "2026-11-05");
    });

    it("el día de creación es el de Costa Rica (UTC-6), no el de UTC", () => {
        assert.equal(creationYmd("2026-11-21T02:30:00.000Z"), "2026-11-20", "02:30Z son las 20:30 del día anterior en Costa Rica");
        assert.equal(creationYmd("2026-11-21T07:00:00.000Z"), "2026-11-21");
        assert.equal(creationYmd("2026-11-21 02:30:00"), "2026-11-20", "sin zona se toma como UTC");
        assert.equal(creationYmd("2026-11-20"), "2026-11-20", "solo fecha: tal cual");
        assert.equal(creationYmd(null), "");
    });
});

describe("pantallas: Solicitud de permiso y Mutuos acuerdos", () => {
    it("Solicitud de permiso: dos rangos (creación e inicio del permiso), vacíos de entrada", () => {
        const p = leer(mobile, "screens/PermitRequestScreenV2.tsx");
        assert.match(p, /useState<DateRange>\(EMPTY_RANGE\);[\s\S]*?useState<DateRange>\(EMPTY_RANGE\);/);
        assert.match(p, /const \[filterCreacion, setFilterCreacion\] = useState<DateRange>\(EMPTY_RANGE\);/);
        assert.match(p, /const \[filterInicioPermiso, setFilterInicioPermiso\] = useState<DateRange>\(EMPTY_RANGE\);/);
        assert.match(p, /<DateRangeFilter label="Fecha de creación"/);
        assert.match(p, /<DateRangeFilter label="Fecha de inicio del permiso"/);
        assert.match(p, /inRange\(creationYmd\(r\.created_at\), filterCreacion\)/);
        assert.match(p, /inRange\(normalizeToYmd\(r\.fecha_inicio\), filterInicioPermiso\)/);
        assert.equal(p.includes("Desde — período de la solicitud"), false, "el filtro anterior ya no está");
        assert.equal(p.includes("filterFechaDesde"), false);
    });

    it("Solicitud de permiso: no pide al servidor ninguna fecha, así que al abrir se ven todos los registros del usuario", () => {
        const p = leer(mobile, "screens/PermitRequestScreenV2.tsx");
        assert.match(p, /url: `\$\{apiUrl\}\/api\/permit-request`,/);
        const ruta = leer(server, "app/api/permit-request/route.ts");
        const get = ruta.slice(ruta.indexOf("export async function GET"), ruta.indexOf("export async function POST"));
        assert.equal(/fecha_inicio:|created_at: \{|\b(?:gte|lte)\b/.test(get.replace(/orderBy: \{ created_at: "desc" \}/, "")), false, "el GET no filtra por fechas");
    });

    it("Mutuos acuerdos: tres rangos (creación, primer turno y segundo turno), vacíos de entrada", () => {
        const m = leer(mobile, "screens/MutuosAcuerdosScreen.tsx");
        for (const nombre of ["filterCreacion", "filterFechaAusente", "filterFechaReemplaza"]) {
            assert.match(m, new RegExp(`const \\[${nombre}, set\\w+\\] = useState<DateRange>\\(EMPTY_RANGE\\);`));
        }
        assert.match(m, /<DateRangeFilter label="Fecha de creación"/);
        assert.match(m, /<DateRangeFilter label="Fecha de inicio del primer turno"/);
        assert.match(m, /<DateRangeFilter label="Fecha del segundo turno"/);
        assert.match(m, /inRange\(creationYmd\(\(r as \{ created_at\?: string \}\)\.created_at\), filterCreacion\)/);
        const ruta = leer(server, "app/api/mutuos-acuerdos/route.ts");
        const get = ruta.slice(ruta.indexOf("export async function GET"));
        assert.equal(/fecha_ausente: \{|fecha_reemplaza: \{|created_at: \{/.test(get.slice(0, 3000)), false, "el GET no filtra por fechas");
    });

    it("el filtro de fecha es un rango Desde — Hasta que se puede quitar", () => {
        const c = leer(mobile, "components/DateRangeFilter.tsx");
        assert.match(c, /renderField\('desde', 'Desde'\)/);
        assert.match(c, /renderField\('hasta', 'Hasta'\)/);
        assert.match(c, /Quitar filtro de fecha/);
    });
});

describe("adjuntos de una solicitud de permiso: los ve la persona del permiso y su ejecutivo", () => {
    const record = { empleado_id: 50, ejecutivo_cuenta: 7 };
    it("la persona dueña del permiso los ve", () => {
        assert.equal(esDuenoDelPermiso(record, 50), true);
        assert.equal(puedeVerArchivosDelPermiso({ record, currentEmployeeId: 50, myEjecutivoCuentaId: null }), true);
    });
    it("el ejecutivo los sigue viendo, por id o por ser el supervisor de quien consulta", () => {
        assert.equal(esEjecutivoDelPermiso(record, 7, null), true);
        assert.equal(esEjecutivoDelPermiso(record, 99, 7), true);
        assert.equal(puedeVerArchivosDelPermiso({ record, currentEmployeeId: 99, myEjecutivoCuentaId: 7 }), true);
    });
    it("otra persona no los ve", () => {
        assert.equal(puedeVerArchivosDelPermiso({ record, currentEmployeeId: 99, myEjecutivoCuentaId: 8 }), false);
        assert.equal(puedeVerArchivosDelPermiso({ record, currentEmployeeId: 99, myEjecutivoCuentaId: null }), false);
        assert.equal(puedeVerArchivosDelPermiso({ record: {}, currentEmployeeId: 0, myEjecutivoCuentaId: null }), false, "sin datos no se abre a nadie");
        assert.equal(puedeVerArchivosDelPermiso({ record: { empleado_id: null, ejecutivo_cuenta: null }, currentEmployeeId: 0, myEjecutivoCuentaId: 0 }), false);
    });
    it("las cuatro rutas de archivos (imagen, archivo, audio y video) usan la misma regla", () => {
        for (const r of ["get-image/[image]", "get-file/[file]", "get-audio/[audio]", "get-video/[video]"]) {
            const ruta = leer(server, `app/api/permit-request/[id]/${r}/route.ts`);
            assert.match(ruta, /puedeVerArchivosDelPermiso\(\{ record, currentEmployeeId, myEjecutivoCuentaId \}\)/, r);
            assert.equal(/Solo el ejecutivo asignado/.test(ruta), false, r);
        }
    });
    it("en la app, la persona del permiso ve sus adjuntos y no solo el ejecutivo", () => {
        const p = leer(mobile, "screens/PermitRequestScreenV2.tsx");
        assert.match(p, /const canViewFiles = Boolean\(r\.is_executive_for_record\) \|\| Boolean\(r\.is_own_record\);/);
        assert.equal(p.includes("Disponible para el ejecutivo asignado."), false);
    });
});
