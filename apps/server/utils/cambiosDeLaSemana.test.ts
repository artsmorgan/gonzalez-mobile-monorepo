import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { depurarMarcasDeUnDia, depurarMarcasPorDia, esTurnoPropioCubiertoPorOtro, marcaCompleta, marcaSinDatos } from "./marcasDelDia";
import { pickNextShift } from "./nextShift";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

const h = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const marca = (id: number, fecha: string, tipo: string | null, ini: string | null, fin: string | null) => ({
    id,
    fecha: new Date(`${fecha}T00:00:00.000Z`),
    tipo_turno: tipo,
    hora_inicio: ini ? h(ini) : null,
    hora_fin: fin ? h(fin) : null,
});
const dia = (m: { fecha: Date }) => m.fecha.toISOString().slice(0, 10);

describe("varias marcas en un mismo día: se toma la que tiene datos o el día queda Libre", () => {
    it("qué es una marca sin datos y una completa", () => {
        assert.equal(marcaSinDatos(marca(1, "2026-11-17", null, null, null)), true);
        assert.equal(marcaSinDatos(marca(1, "2026-11-17", "", null, null)), true);
        assert.equal(marcaSinDatos(marca(1, "2026-11-17", "D", null, null)), false, "con tipo ya tiene datos");
        assert.equal(marcaCompleta(marca(1, "2026-11-17", "D", "06:00", "14:00")), true);
        assert.equal(marcaCompleta(marca(1, "2026-11-17", "D", "06:00", null)), false);
    });

    it("una sola marca nunca se toca, aunque no tenga datos (se muestra con normalidad)", () => {
        const sola = [marca(1, "2026-11-17", null, null, null)];
        assert.deepEqual(depurarMarcasDeUnDia(sola), sola);
    });

    it("si todas menos una carecen de datos, se toma solo la que tiene tipo de turno y horas", () => {
        const dia1 = [marca(5, "2026-11-17", null, null, null), marca(6, "2026-11-17", "D", "06:00", "14:00"), marca(7, "2026-11-17", null, null, null)];
        const r = depurarMarcasDeUnDia(dia1);
        assert.deepEqual(r.map((m) => m.id), [6]);
        assert.equal(r[0].tipo_turno, "D");
    });

    it("si hay varias con datos se conservan todas las que tienen datos (después se resuelve el conflicto de horario)", () => {
        const r = depurarMarcasDeUnDia([marca(1, "2026-11-17", "D", "06:00", "14:00"), marca(2, "2026-11-17", null, null, null), marca(3, "2026-11-17", "N", "18:00", "02:00")]);
        assert.deepEqual(r.map((m) => m.id), [1, 3]);
    });

    it("si ninguna tiene datos, el día es Libre: una sola marca con tipo L (la de menor id)", () => {
        const r = depurarMarcasDeUnDia([marca(9, "2026-11-17", null, null, null), marca(4, "2026-11-17", null, null, null)]);
        assert.equal(r.length, 1);
        assert.equal(r[0].id, 4);
        assert.equal(r[0].tipo_turno, "L");
    });

    it("por día: cada día se depura por separado y se conserva el orden", () => {
        const marcas = [
            marca(1, "2026-11-17", null, null, null),
            marca(2, "2026-11-17", null, null, null), // 17: sin datos -> libre
            marca(3, "2026-11-18", null, null, null),
            marca(4, "2026-11-18", "M", "08:00", "16:00"), // 18: se toma la 4
            marca(5, "2026-11-19", "D", "06:00", "14:00"), // 19: una sola, intacta
        ];
        const r = depurarMarcasPorDia(marcas, dia);
        assert.deepEqual(r.map((m) => [m.id, m.tipo_turno]), [[1, "L"], [4, "M"], [5, "D"]]);
    });

    it("el siguiente turno ignora el día libre y pasa al siguiente turno laboral", () => {
        const marcas = depurarMarcasPorDia(
            [marca(1, "2026-11-18", null, null, null), marca(2, "2026-11-18", null, null, null), marca(3, "2026-11-19", "D", "06:00", "14:00")],
            dia,
        );
        const ahora = new Date("2026-11-17T12:00:00.000Z").getTime();
        assert.equal(pickNextShift(marcas as any, ahora, 15)?.id, 3);
    });

    it("el servidor la aplica a la marca actual, al siguiente turno y a los turnos futuros", () => {
        assert.match(leer(server, "app/api/attendance/user/[id]/route.ts"), /return depurarMarcasPorDia\(delEmpleado,/);
        assert.match(leer(server, "app/api/attendance/user/[id]/next/route.ts"), /const marcas = depurarMarcasPorDia\(marcasDelPeriodo,/);
    });
});

describe("notificaciones: sin turno o con plaza 0 solo salen las propias", () => {
    const ruta = leer(server, "app/api/notification/route.ts");

    it("ya no responde 404 sin marca o plaza: omite las notificaciones de plaza", () => {
        assert.equal(/Marca o empleado no especificados|Marca no encontrada|Plaza o empleado no encontrados/.test(ruta), false);
        assert.match(ruta, /const plazaId = marca\?\.plaza_id && marca\.plaza_id > 0 \? marca\.plaza_id : null;/);
        assert.match(ruta, /const plaza_notifications = plazaId\s*\? await callDynamicPrisma/);
        assert.match(ruta, /where: \{ empleadoId \}/);
    });

    it("el empleado sigue siendo obligatorio", () => {
        assert.match(ruta, /Empleado no especificado/);
    });
});

describe("solicitud de permiso: sin plaza ni jerarquía enviada, con turnos de Planillas", () => {
    const ruta = leer(server, "app/api/permit-request/route.ts");

    it("el servidor ya no compara la jerarquía enviada ni exige elegir una plaza", () => {
        assert.equal(ruta.includes("La jerarquía enviada no coincide con la plaza seleccionada"), false);
        assert.equal(ruta.includes("Debes seleccionar una plaza"), false);
        assert.match(ruta, /if \(!plazaId\) plazaId = parseIntStrict\(turnos\[0\]\?\.plaza_id\);/);
        assert.equal((ruta.match(/getTurnosFromRange\(/g) ?? []).length, 1, "una sola búsqueda de turnos");
    });

    it("los turnos del rango salen de Planillas /marcas por día, sin los que no traen tipo ni horas, y con el código del puesto", () => {
        const util = leer(server, "utils/getPermitTurnosFromPlanillasRange.ts");
        assert.match(util, /marcaArray\.filter\(\(m: any\) => !marcaSinDatos\(m\)\)/);
        assert.match(util, /puesto_codigo: m\.e_estructura_puesto\?\.codigo \?\? null/);
        assert.match(util, /\/marcas/);
    });

    it("el permiso aprobado bloquea a la persona en esas fechas sin importar la plaza", () => {
        const asistencia = leer(server, "app/api/attendance/user/[id]/route.ts");
        const a = asistencia.indexOf('table: "c_solicitud_permiso"');
        assert.equal(/plaza_id/.test(asistencia.slice(a, a + 600)), false);
    });

    it("la pantalla ya no pide plaza ni la jerarquía de la marca actual, valida el token de Planillas y muestra el código del puesto", () => {
        const p = leer(mobile, "screens/PermitRequestScreenV2.tsx");
        assert.equal(/selectedPlazaId|fetchPlazas|Plaza \*/.test(p), false);
        assert.equal(/parsePermitHierarchyFromCurrentMarca\(marca\)|hierarchy\.empresa_id|hierarchy\.puesto_id/.test(p), false);
        assert.match(p, /requestPlanillasRevalidationIfNeeded\(referenceMs\)/);
        assert.match(p, /t\.puesto_codigo \? `\$\{t\.puesto_codigo\} · ` : ''/);
        assert.equal(/plaza_id=/.test(p), false);
    });
});

describe("mutuos acuerdos: turnos válidos, elegir cuál se cambia y avisar de los de reemplazo", () => {
    it("el servidor descarta las marcas sin datos e indica si el turno es de reemplazo", () => {
        const r = leer(server, "app/api/mutuos-acuerdos/marcas/route.ts");
        assert.match(r, /\.filter\(\(m: any\) => !marcaSinDatos\(m\) && !esTurnoPropioCubiertoPorOtro\(m, empleadoId\)\)/);
        assert.match(r, /es_reemplazo: m\.empleadoReemplaza_id != null && Number\(m\.empleadoReemplaza_id\) === empleadoId/);
        assert.match(r, /collectPlanillasMarcaIdsForDateRange/, "los turnos salen de Planillas /marcas");
    });

    it("el alta acepta turnos propios y de reemplazo: la persona de cada lado es quien cubre el turno", () => {
        const r = leer(server, "app/api/mutuos-acuerdos/route.ts");
        assert.match(r, /const empleadoDeMarca = \(m: any, esperado: number \| null\): number =>/);
        assert.match(r, /empleadoDeMarca\(m, empleadoAusenteBody\) !== empAusente/);
        assert.match(r, /if \(empAusente === empReemplaza\)/);
        assert.equal(/Number\(marcaAusente\.empleadoFijo_id\)|Number\(marcaReemplaza\.empleadoFijo_id\)/.test(r), false);
    });

    it("la pantalla deja elegir el turno de cada empleado, advierte de los de reemplazo y envía solo los elegidos", () => {
        const p = leer(mobile, "screens/MutuosAcuerdosScreen.tsx");
        assert.match(p, /selectedMarcaIds: number\[\]/);
        assert.match(p, /accessibilityRole="checkbox"/);
        assert.match(p, /Turno de reemplazo/);
        assert.match(p, /Este turno no es propio: lo cubres como reemplazo de otra persona/);
        assert.match(p, /marcas_ausente: selectedMarcas\(ausente\)\.map\(\(m\) => m\.id\)/);
        assert.match(p, /marcas_reemplaza: selectedMarcas\(reemplaza\)\.map\(\(m\) => m\.id\)/);
        assert.match(p, /disabled=\{isSubmitting \|\| !hasSelectedOnBothSides\(\)\}/);
        assert.equal(p.includes("Se incluirán todos los turnos de este día"), false);
        assert.match(p, /m\.puesto_codigo \? `\$\{m\.puesto_codigo\} · ` : ''/);
    });
});

describe("Mis puestos como módulo abierto para todos", () => {
    it("tiene su pantalla, está registrada en la navegación y en el menú sin depender del rol, de la marca ni de la liberación de módulos", () => {
        assert.match(leer(mobile, "App.tsx"), /<Stack\.Screen name="MisPuestos" component=\{MisPuestosScreen\} \/>/);
        const menu = leer(mobile, "components/SlideMenu.tsx");
        const i = menu.indexOf("onPress={handleMisPuestosPress}");
        assert.ok(i > 0);
        const antes = menu.slice(Math.max(0, i - 400), i);
        assert.equal(/releaseAction|hasCurrentMarca|hasPermissionRole|hasActiveCurrentMarca/.test(antes), false);
        const pantalla = leer(mobile, "screens/MisPuestosScreen.tsx");
        assert.match(pantalla, /<MisPuestosSection refreshAccessToken=\{refreshAccessToken\} logout=\{logout\} embedded \/>/);
    });

    it("usa la misma ventana flotante con elección de aplicación de mapas que Ubicación del puesto", () => {
        const s = leer(mobile, "components/MisPuestosSection.tsx");
        assert.match(s, /<PuestoLocationBlock ubicacion=\{puesto\.ubicacion\}/);
        assert.match(leer(mobile, "screens/PuestoUbicacionScreen.tsx"), /<MisPuestosSection /);
    });
});

describe("ajustes visuales: Mis puestos, tarjetas de turnos de Mutuos y carga de «Buscar turnos»", () => {
    it("Mis puestos usa el encabezado y las tarjetas de los demás módulos (título con icono, subtítulo y línea inferior)", () => {
        const p = leer(mobile, "screens/MisPuestosScreen.tsx");
        const referencia = leer(mobile, "screens/PuestoUbicacionScreen.tsx");
        for (const estilo of ["titleContainer", "titleText", "subtitle"]) assert.match(p, new RegExp(estilo + ": \\{"), estilo);
        assert.match(p, /fontSize: 24,\s*fontWeight: 'bold'/, "mismo tamaño de título");
        assert.match(referencia, /fontSize: 24,\s*fontWeight: 'bold'/);
        assert.match(p, /borderBottomWidth: 1,\s*borderBottomColor: '#E0E0E0'/);
        assert.match(p, /maxWidth: 800, alignSelf: 'center'/);
        const sec = leer(mobile, "components/MisPuestosSection.tsx");
        assert.match(sec, /embedded \? styles\.embeddedCard : styles\.card/);
        assert.match(sec, /embeddedCard: \{[^}]*borderRadius: 10[^}]*borderColor: '#E0E0E0'[^}]*padding: 14/);
        assert.match(sec, /embedded \? null : \(\s*<TouchableOpacity style=\{styles\.header\}/, "sin botón de abrir dentro del módulo");
    });

    it("la tarjeta de cada turno en Mutuos: puesto arriba a la izquierda, marca solo si está elegido arriba a la derecha y la franja de turno propio o de reemplazo abajo", () => {
        const p = leer(mobile, "screens/MutuosAcuerdosScreen.tsx");
        const a = p.indexOf("<ThemedView style={styles.marcaCardBody}>");
        const tarjeta = p.slice(a, p.indexOf("</TouchableOpacity>", a));
        assert.ok(a > 0);
        const iPuesto = tarjeta.indexOf("styles.marcaPuestoName");
        const iCheck = tarjeta.indexOf("checkmark-circle");
        const iDetalle = tarjeta.indexOf("Horario:");
        const iFranja = tarjeta.indexOf("styles.marcaRibbon");
        assert.ok(iPuesto >= 0 && iCheck > iPuesto && iDetalle > iCheck && iFranja > iDetalle, "puesto y check arriba; la franja al final");
        assert.match(tarjeta, /\{checked \? <Ionicons name="checkmark-circle"[^>]*\/> : null\}/, "el check solo aparece cuando el turno está elegido");
        assert.equal(/square-outline/.test(tarjeta), false, "ya no hay casilla vacía");
        assert.match(tarjeta, /m\.es_reemplazo \? 'Turno de reemplazo' : 'Turno propio'/);
        assert.match(p, /marcaCardTopRow: \{[^}]*justifyContent: 'space-between'/);
        assert.match(p, /marcaRibbon: \{[^}]*borderTopWidth: 1/, "la franja va separada por una línea superior");
        assert.match(p, /marcaRibbonText: \{[^}]*textTransform: 'uppercase'/);
    });

    it("«Buscar turnos» muestra una animación de carga y no se puede pulsar mientras busca", () => {
        const p = leer(mobile, "screens/PermitRequestScreenV2.tsx");
        assert.match(p, /const \[isSearchingTurnos, setIsSearchingTurnos\] = useState\(false\);/);
        assert.match(p, /setIsSearchingTurnos\(true\);\s*try \{\s*await fetchTurnosPreviewInner\(\);\s*\} finally \{\s*setIsSearchingTurnos\(false\);/);
        assert.match(p, /disabled=\{isSearchingTurnos\}/);
        assert.match(p, /\{isSearchingTurnos \? \(\s*<View[^>]*>\s*<ActivityIndicator[\s\S]*?Buscando turnos\.\.\./);
    });
});

describe("mutuos acuerdos: la consulta de turnos conserva las validaciones y no ofrece turnos propios cubiertos por otra persona", () => {
    const ruta = leer(server, "app/api/mutuos-acuerdos/marcas/route.ts");

    it("si el empleado ya tiene un mutuo acuerdo o un permiso pendiente o aprobado ese día no se ofrecen turnos (Planillas no permite otro cambio de guardia en esa fecha)", () => {
        assert.match(ruta, /table: "e_mutuos_acuerdos"/);
        assert.match(ruta, /El empleado ya tiene un mutuo acuerdo pendiente\/aprobado para esa fecha/);
        assert.match(ruta, /table: "c_solicitud_permiso"/);
        assert.match(ruta, /El empleado tiene un permiso \$\{permitConflict\.estado\} del/);
        assert.match(ruta, /collectPlanillasMarcaIdsForDateRange/);
    });

    it("un turno propio con un empleado de reemplazo distinto no se ofrece; uno que el empleado cubre como reemplazo sí", () => {
        // el consultado es el 10
        assert.equal(esTurnoPropioCubiertoPorOtro({ empleadoFijo_id: 10, empleadoReemplaza_id: 20 }, 10), true, "propio cubierto por otro: fuera");
        assert.equal(esTurnoPropioCubiertoPorOtro({ empleadoFijo_id: 10, empleadoReemplaza_id: null }, 10), false, "propio sin reemplazo: se ofrece");
        assert.equal(esTurnoPropioCubiertoPorOtro({ empleadoFijo_id: 10, empleadoReemplaza_id: 10 }, 10), false);
        assert.equal(esTurnoPropioCubiertoPorOtro({ empleadoFijo_id: 30, empleadoReemplaza_id: 10 }, 10), false, "de reemplazo (lo cubre el 10): se ofrece");
        assert.equal(esTurnoPropioCubiertoPorOtro({ empleadoFijo_id: 10, empleadoReemplaza_id: 0 }, 10), false, "reemplazo 0 es sin reemplazo");
        assert.match(ruta, /!marcaSinDatos\(m\) && !esTurnoPropioCubiertoPorOtro\(m, empleadoId\)/);
    });
});

describe("mutuos acuerdos: el alta conserva las validaciones de mutuos y de permisos", () => {
    const alta = leer(server, "app/api/mutuos-acuerdos/route.ts");

    it("se rechaza si alguno de los empleados ya tiene otro mutuo acuerdo pendiente o aprobado con fechas en conflicto (Planillas no admite dos cambios de guardia en la misma fecha)", () => {
        assert.match(alta, /table: "e_mutuos_acuerdos"[\s\S]*?const conflictingOther = otherMutuosRows\.find/);
        assert.match(alta, /ya tiene un mutuo acuerdo \$\{String\(conflictingOther\.estado \|\| "pendiente"\)\} cuyas fechas entran en conflicto con este intercambio/);
        assert.match(alta, /const legacyConflict = legacyWithoutFechas\.find/, "también los mutuos antiguos sin fechas");
    });

    it("se rechaza si alguno tiene un permiso pendiente o aprobado que cubre las fechas, y en el alta del permiso si choca con un mutuo", () => {
        assert.match(alta, /table: "c_solicitud_permiso"[\s\S]*?tiene un permiso \$\{overlappingPermit\.estado\} del \$\{pInicio\} al \$\{pFin\} que entra en conflicto con las fechas del mutuo acuerdo/);
        assert.match(leer(server, "app/api/permit-request/route.ts"), /Ya tienes un mutuo acuerdo \$\{estadoMutuo\}[\s\S]*?No se puede crear la solicitud/);
    });

    it("se conservan las validaciones de los turnos del intercambio y los turnos de reemplazo", () => {
        assert.match(alta, /validateMutuoAcuerdoShiftExchange\(marcasAusente, marcasReemplaza\)/);
        assert.match(alta, /const empleadoDeMarca = \(m: any, esperado: number \| null\): number =>/);
    });
});
