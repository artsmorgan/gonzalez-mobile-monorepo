import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
    formatDateTimeLine,
    formatFechaDMY,
    formatHoraHHmm,
    formatHoraRange,
    isShiftUpcoming,
    levelCode,
    levelLabel,
    levelLabelCodeOnly,
    levelName,
    parseNextShift,
    shiftInfoRows,
    shiftStartMs,
    tipoTurnoLabel,
} from "../../mobile/hooks/nextShiftCore";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const server = path.resolve(__dirname, "..");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

describe("Marcar ingreso/salida: formato de la información", () => {
    it("el código de cada elemento es su código o, si no tiene, su número", () => {
        assert.equal(levelCode({ id: 7, codigo: "PUE-01", nombre: "Puesto" }), "PUE-01");
        assert.equal(levelCode({ id: 7, codigo: "  ", nombre: "Cliente" }), "7");
        assert.equal(levelCode({ id: 7, codigo: null }), "7");
        assert.equal(levelCode({ id: 0, codigo: null }), null);
        assert.equal(levelCode(null), null);
    });

    it("«código · nombre»; sin código, el número; sin nada, una raya", () => {
        assert.equal(levelLabel({ id: 3, codigo: "E01", nombre: "Empresa" }), "E01 · Empresa");
        assert.equal(levelLabel({ id: 3, nombre: "Cliente" }), "3 · Cliente");
        assert.equal(levelLabel({ codigo: "9876", nombre: "Ana Pérez" }), "9876 · Ana Pérez");
        assert.equal(levelLabel({ id: 0, nombre: "" }), "—");
        assert.equal(levelLabel(undefined), "—");
    });

    it("las horas se ven como en los turnos futuros: HH:mm - HH:mm", () => {
        assert.equal(formatHoraHHmm("1970-01-01T06:00:00.000Z"), "06:00");
        assert.equal(formatHoraHHmm("14:30:00"), "14:30");
        assert.equal(formatHoraHHmm(null), "");
        assert.equal(formatHoraRange("1970-01-01T06:00:00.000Z", "1970-01-01T14:00:00.000Z"), "06:00 - 14:00");
        assert.equal(formatHoraRange("06:00:00", null), "06:00");
        assert.equal(formatHoraRange(null, "14:00:00"), "");
    });

    it("fecha y hora del día en una sola línea, sin pasar por la zona horaria del dispositivo", () => {
        assert.equal(formatDateTimeLine(Date.parse("2026-11-03T14:35:00.000Z")), "03-11-2026 14:35");
        assert.equal(formatDateTimeLine(Number.NaN), "—");
        assert.equal(formatFechaDMY("2026-11-03T00:00:00.000Z"), "03-11-2026");
        assert.equal(formatFechaDMY("basura"), "");
    });

    it("tipo de turno legible: Diurno, Mixto, Nocturno, Libre; cualquier otro dato es Indeterminable", () => {
        assert.equal(tipoTurnoLabel("d"), "Diurno");
        assert.equal(tipoTurnoLabel("N"), "Nocturno");
        assert.equal(tipoTurnoLabel("M"), "Mixto");
        assert.equal(tipoTurnoLabel("L"), "Libre");
        assert.equal(tipoTurnoLabel(" m "), "Mixto");
        for (const raro of [null, undefined, "", "  ", "X", "LL", "Diurno", 7]) assert.equal(tipoTurnoLabel(raro), "Indeterminable", String(raro));
    });
});

describe("Información laboral: qué código lleva cada nivel", () => {
    it("cliente, rol y horario solo muestran el nombre (sin id)", () => {
        assert.equal(levelName({ id: 5, codigo: "X", nombre: "Cliente S.A." }), "Cliente S.A.");
        assert.equal(levelName({ id: 5, nombre: "" }), "—");
    });

    it("división, contrato y corpo usan su propio código y nunca el id", () => {
        assert.equal(levelLabelCodeOnly({ id: 4, codigo: "SEG", nombre: "Seguridad" }), "SEG · Seguridad");
        assert.equal(levelLabelCodeOnly({ id: 4, codigo: "CT-2026-01", nombre: "Contrato A" }), "CT-2026-01 · Contrato A");
        assert.equal(levelLabelCodeOnly({ id: 4, codigo: null, nombre: "Sucursal Centro" }), "Sucursal Centro", "sin código no se cae al id");
        assert.equal(levelLabelCodeOnly({ id: 4, codigo: "  ", nombre: "Sucursal" }), "Sucursal");
        assert.equal(levelLabelCodeOnly(undefined), "—");
    });

    it("el siguiente turno y los turnos futuros usan las mismas reglas", () => {
        const filas = shiftInfoRows({
            empresa: { id: 1, codigo: "E01", nombre: "Empresa" },
            cliente: { id: 9, codigo: null, nombre: "Cliente" },
            division: { id: 3, codigo: "SEG", nombre: "Seguridad" },
            contrato: { id: 8, codigo: "C-77", nombre: "Contrato" },
            corpo: { id: 6, codigo: "S-12", nombre: "Sucursal" },
            puesto: { id: 2, codigo: "P-1", nombre: "Puesto" },
            plaza: { id: 11, codigo: null, nombre: "Plaza" },
            horario: { id: 15, codigo: null, nombre: "Diurno 6-14" },
        });
        assert.deepEqual(filas, [
            { label: "Empresa", value: "E01 · Empresa" },
            { label: "Cliente", value: "Cliente" },
            { label: "División", value: "SEG · Seguridad" },
            { label: "Contrato", value: "C-77 · Contrato" },
            { label: "Corpo", value: "S-12 · Sucursal" },
            { label: "Puesto", value: "P-1 · Puesto" },
            { label: "Plaza", value: "11 · Plaza" },
            { label: "Horario", value: "Diurno 6-14" },
        ]);
        for (const f of filas) assert.equal(/^\d+$/.test(f.value), false);
    });

    it("omite los niveles sin nombre", () => {
        assert.deepEqual(shiftInfoRows({ empresa: { id: 1, nombre: "Empresa" } }), [{ label: "Empresa", value: "1 · Empresa" }]);
        assert.deepEqual(shiftInfoRows({}), []);
    });
});

describe("Los ids se conservan: el cambio a códigos es solo visual", () => {
    const turno = {
        id: 12,
        fecha: "2026-11-04T00:00:00.000Z",
        hora_inicio: "1970-01-01T06:00:00.000Z",
        hora_fin: "1970-01-01T14:00:00.000Z",
        tipo_turno: "D",
        empresa: { id: 1, codigo: "E01", nombre: "Empresa" },
        cliente: { id: 9, nombre: "Cliente" },
        division: { id: 3, codigo: "SEG", nombre: "Seguridad" },
        contrato: { id: 8, codigo: "C-77", nombre: "Contrato" },
        corpo: { id: 6, codigo: "S-12", nombre: "Sucursal" },
        puesto: { id: 2, codigo: "P-1", nombre: "Puesto" },
        plaza: { id: 11, codigo: null, nombre: "Plaza" },
        horario: { id: 15, nombre: "Diurno" },
    };

    it("dar formato a los datos no cambia ni quita ningún id del turno guardado", () => {
        const copia = JSON.parse(JSON.stringify(turno));
        shiftInfoRows(turno);
        for (const nivel of ["empresa", "cliente", "division", "contrato", "corpo", "puesto", "plaza", "horario"] as const) {
            levelName(turno[nivel]);
            levelLabelCodeOnly(turno[nivel]);
            levelLabel(turno[nivel]);
        }
        assert.deepEqual(turno, copia, "los helpers de formato no deben mutar los datos");
        const guardado = parseNextShift(turno)!;
        for (const nivel of ["empresa", "cliente", "division", "contrato", "corpo", "puesto", "plaza", "horario"] as const) {
            assert.equal((guardado[nivel] as { id: number }).id, turno[nivel].id, `se perdió el id de ${nivel}`);
        }
        assert.equal(guardado.id, 12);
    });

    it("el tipo de turno se ve con el mismo texto en la marca, el siguiente turno y los turnos futuros", () => {
        const pantalla = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(pantalla, /\{tipoTurnoLabel\(marcaView\.tipo_turno\)\}/);
        assert.match(pantalla, /tipoTurnoLabel\(upcomingNextShift\.tipo_turno\)/);
        assert.match(pantalla, /const tipoTurno = tipoTurnoLabel\(mark\.tipo_turno\);/);
        for (const viejo of ["'Día libre (L)'", "'Desconocido'", "tipoTurno = 'Diurno'"]) assert.equal(pantalla.includes(viejo), false, `queda ${viejo}`);
    });

    it("el servidor sigue enviando el id de cada nivel junto con su código", () => {
        const ruta = leer(server, "app/api/attendance/user/[id]/route.ts");
        const futuros = leer(server, "app/api/attendance/user/[id]/next/route.ts");
        for (const exp of [/id: empresa\.id,/, /id: cliente\.id,/, /id: contrato\.id,/, /id: corpo\.id,/, /id: puesto\?\.id \?\? 0,/, /id: plaza\?\.id \?\? 0,/, /id: horario\?\.id \?\? 0,/]) {
            assert.match(ruta, exp, `la marca actual perdió ${exp}`);
        }
        for (const exp of [/id: marca\.empresa_id \?\? 0,/, /id: marca\.contrato_id \?\? 0,/, /id: marca\.corpo_id \?\? 0,/, /id: marca\.puesto_id \?\? 0,/, /id: marca\.plaza_id \?\? 0,/, /id: division\?\.id \?\? 0,/]) {
            assert.match(futuros, exp, `los turnos futuros perdieron ${exp}`);
        }
        assert.match(ruta, /roleDivision: roleDivision,/, "la división y el rol siguen saliendo con su id");
        assert.match(leer(server, "utils/getRoleDivision.ts"), /roleDivision\.division\.id = division\.id;/);
        assert.match(leer(server, "utils/getRoleDivision.ts"), /roleDivision\.role\.id = categoria_empleado\.id;/);
    });

    it("la pantalla sigue usando el id de la marca para su lógica y el tipo conserva todos los ids", () => {
        const pantalla = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(pantalla, /interface AttendanceSuccessResponse[\s\S]*?id: number;\s*codigo\?: string \| null;\s*nombre: string;/, "el tipo conserva id y suma codigo");
        assert.match(pantalla, /Number\(marca\.id\)|marca_send\.id/, "la lógica de la pantalla sigue usando el id de la marca");
        assert.equal(pantalla.includes("levelCode(marcaView"), false, "el formato de pantalla no sustituye ids en la lógica");
    });
});

describe("Siguiente turno guardado en el dispositivo", () => {
    const valido = { id: 12, fecha: "2026-11-04T00:00:00.000Z", hora_inicio: "1970-01-01T06:00:00.000Z", hora_fin: "1970-01-01T14:00:00.000Z", tipo_turno: "D", puesto: { id: 1, codigo: "P1", nombre: "Puesto" } };

    it("acepta un turno laboral con fecha y rechaza lo demás", () => {
        assert.equal(parseNextShift(valido)?.id, 12);
        assert.equal(parseNextShift({ ...valido, tipo_turno: "L" }), null, "un día libre no es un turno laboral");
        assert.equal(parseNextShift({ ...valido, tipo_turno: null }), null);
        assert.equal(parseNextShift({ ...valido, fecha: "no-es-fecha" }), null);
        assert.equal(parseNextShift({ ...valido, id: 0 }), null);
        for (const v of [null, undefined, "x", 3, []]) assert.equal(parseNextShift(v), null);
    });

    it("la entrada, restados los minutos previos, debe ser posterior al momento actual", () => {
        const s = parseNextShift(valido)!;
        const inicio = shiftStartMs(s)!;
        assert.equal(inicio, Date.parse("2026-11-04T06:00:00.000Z"));
        assert.equal(isShiftUpcoming(s, inicio - 16 * 60_000, 15), true);
        assert.equal(isShiftUpcoming(s, inicio - 15 * 60_000, 15), false, "justo en la ventana ya es la marca actual");
        assert.equal(isShiftUpcoming(s, inicio + 1, 0), false);
        assert.equal(isShiftUpcoming(s, Number.NaN, 15), false);
    });
});

describe("Marcar ingreso/salida: cableado de la pantalla", () => {
    const pantalla = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");

    it("ya no muestra los títulos «Hora actual», «Estado actual», «Hora de entrada» ni «Hora de salida»", () => {
        for (const t of [">Hora actual<", "Estado actual:", "'Hora de salida:'", "'Hora de entrada:'", "Hora de salida:", "Hora de entrada:"]) {
            assert.equal(pantalla.includes(t), false, `sigue apareciendo «${t}»`);
        }
    });

    it("la información laboral está en un componente colapsable (cerrado por defecto) con horario y códigos", () => {
        assert.match(pantalla, /<Collapsible title="Información laboral"/);
        assert.match(leer(mobile, "components/Collapsible.tsx"), /useState\(false\)/, "el colapsable empieza cerrado");
        assert.match(pantalla, /formatHoraRange\(marcaView\.hora_inicio, marcaView\.hora_fin\)/);
        const esperado: Record<string, string> = {
            empresa: "levelLabel",
            cliente: "levelName",
            "roleDivision.division": "levelLabelCodeOnly",
            "roleDivision.role": "levelName",
            contrato: "levelLabelCodeOnly",
            corpo: "levelLabelCodeOnly",
            puesto: "levelLabel",
            plaza: "levelLabel",
            horario: "levelName",
        };
        for (const [nivel, fn] of Object.entries(esperado)) {
            assert.ok(pantalla.includes(`{${fn}(marcaView.${nivel})}`), `${nivel} debe usar ${fn}`);
        }
    });

    it("el espacio entre «Información laboral» y el bloque siguiente es el mismo que entre los demás (sin margen extra del colapsable)", () => {
        assert.match(pantalla, /<Collapsible title="Información laboral" containerStyle=\{styles\.collapsibleInContent\}>/);
        const estilo = pantalla.slice(pantalla.indexOf("  collapsibleInContent: {"), pantalla.indexOf("  /* Información laboral"));
        assert.match(estilo, /marginBottom: 0/);
        assert.match(leer(mobile, "components/Collapsible.tsx"), /style=\{\[styles\.container, containerStyle\]\}/);
    });

    it("la información laboral de la marca, del siguiente turno y de los turnos futuros comparten las mismas reglas por nivel", () => {
        const modal = pantalla.slice(pantalla.indexOf("Próximo turno"), pantalla.indexOf("Buscar turnos de los próximos 30 días"));
        assert.match(modal, /shiftInfoRows\(upcomingNextShift\)/);
        const lista = pantalla.slice(pantalla.indexOf("const renderFutureMarks"), pantalla.indexOf("const handleCreateTestMarca"));
        assert.match(lista, /shiftInfoRows\(mark\)/);
        assert.equal(/mark\.(cliente|contrato|corpo)\.nombre/.test(lista), false, "la lista ya no arma esas filas a mano");
    });

    it("muestra empleado (código y nombre) y puesto (código y nombre), y la fecha y hora actual visibles en un recuadro con borde", () => {
        assert.match(pantalla, /levelLabel\(\{ codigo: employee\?\.codigo, nombre: employee\?\.name \}\)/);
        assert.match(pantalla, /getDisplayDateTimeText\(\)/);
        const tarjeta = pantalla.slice(pantalla.indexOf("<ThemedView style={styles.dateTimeCard}>"), pantalla.indexOf("styles.identityCard"));
        assert.match(tarjeta, /\{getDisplayDateTimeText\(\)\}/, "la fecha y hora están visibles dentro del recuadro");
        const estilo = pantalla.slice(pantalla.indexOf("  dateTimeCard: {"), pantalla.indexOf("  dateTimeText: {"));
        assert.match(estilo, /borderWidth: 1/, "el recuadro tiene borde visible");
        assert.equal(pantalla.includes("isDateTimeModalVisible"), false, "no hay modal de fecha y hora");
    });

    it("el orden de los bloques es el pedido", () => {
        const orden = ["styles.messageBoxInfo", "styles.dateTimeCard", "styles.identityCard", '<Collapsible title="Información laboral"', "styles.marcaWarningsSection", "styles.statusCard", "styles.actionContainer", "Ver turnos futuros"];
        let desde = pantalla.indexOf("return (\n    <ThemedView style={styles.fullContainer}>");
        assert.ok(desde > 0);
        for (const marca of orden) {
            const i = pantalla.indexOf(marca, desde);
            assert.ok(i >= 0, `no aparece «${marca}» después del bloque anterior`);
            desde = i;
        }
    });

    it("las consultas de la marca guardan el siguiente turno en AsyncStorage y se conserva al limpiar el almacenamiento", () => {
        assert.match(pantalla, /hasOwnProperty\.call\(data, 'next_shift'\)/);
        assert.match(pantalla, /setNextShiftStorage\(data\.next_shift, employee\.id\)/);
        assert.match(pantalla, /NEXT_SHIFT_KEY,\n\s+ATTENDANCE_ACTIONS_KEY/);
        assert.match(leer(mobile, "hooks/nextShiftStorage.ts"), /NEXT_SHIFT_KEY = 'next_shift'/);
    });

    it("«Ver turnos futuros» abre sin buscar; los 30 días solo se buscan tras una confirmación y con conexión", () => {
        const abrir = pantalla.slice(pantalla.indexOf("const handleOpenFutureMarksModal"), pantalla.indexOf("const handleCloseFutureMarksModal"));
        assert.equal(abrir.includes("fetchFutureMarks"), false, "abrir el modal no debe consultar al servidor");
        const pedir = pantalla.slice(pantalla.indexOf("const handleRequestFutureList"), pantalla.indexOf("const fetchFutureMarks"));
        assert.match(pedir, /Alert\.alert\(\s*'Buscar turnos'/);
        assert.match(pedir, /evaluateInternetConnection\(\)/);
        assert.match(pedir, /await fetchFutureMarks\(\)/);
        assert.ok(pedir.indexOf("Alert.alert") < pedir.indexOf("fetchFutureMarks"));
    });

    it("el modal muestra primero el turno laboral más próximo guardado", () => {
        assert.match(pantalla, /Próximo turno/);
        assert.match(pantalla, /upcomingNextShift/);
        assert.match(pantalla, /Buscar turnos de los próximos 30 días/);
    });

    it("el aviso de los minutos previos se conserva", () => {
        assert.match(pantalla, /Para poder marcar entrada, asegúrate de estar mínimo \{monitoringPreviousMinutes\} minutos antes/);
    });
});

describe("Marcar ingreso/salida: el servidor trae el siguiente turno y los códigos", () => {
    const ruta = leer(server, "app/api/attendance/user/[id]/route.ts");

    it("la consulta de la marca actual responde next_shift en todas sus respuestas con datos de marca", () => {
        assert.match(ruta, /pickNextShift\(/);
        assert.equal((ruta.match(/next_shift: await buscarSiguienteTurno\(\)/g) ?? []).length, 4, "éxito, marca bloqueada, sin turno activo y turno sin datos");
    });

    it("un fallo al buscar el siguiente turno no rompe la marca actual", () => {
        const fn = ruta.slice(ruta.indexOf("const buscarSiguienteTurno"), ruta.indexOf("let marcaDia = null;"));
        assert.match(fn, /catch \(e: unknown\)/);
        assert.match(fn, /return null;/);
    });

    it("contrato y corpo traen nro_contrato y nro_sucursal; la división trae su código de n_division (marca actual, siguiente turno y turnos futuros)", () => {
        const futuros = leer(server, "app/api/attendance/user/[id]/next/route.ts");
        assert.match(ruta, /codigo: contrato\.nro_contrato \?\? null/);
        assert.match(ruta, /codigo: corpo\.nro_sucursal \?\? null/);
        assert.match(ruta, /codigo: contrato\?\.nro_contrato \?\? null/);
        assert.match(ruta, /codigo: corpo\?\.nro_sucursal \?\? null/);
        assert.match(ruta, /codigo: division\?\.codigo \?\? null/);
        assert.match(leer(server, "utils/getRoleDivision.ts"), /roleDivision\.division\.codigo = division\.codigo \?\? null/);
        assert.match(futuros, /codigo: contrato\?\.nro_contrato \?\? null/);
        assert.match(futuros, /codigo: corpo\?\.nro_sucursal \?\? null/);
        assert.match(futuros, /codigo: division\?\.codigo \?\? null/);
        assert.match(futuros, /prisma\.n_division\.findMany/);
    });

    it("la marca trae el código de empresa, puesto y plaza", () => {
        assert.match(ruta, /codigo: empresa\.codigo \?\? null/);
        assert.match(ruta, /codigo: puesto\?\.codigo \?\? null/);
        assert.match(ruta, /codigo: plaza\?\.codigo_plaza \?\? null/);
    });
});

describe("Marcar ingreso/salida: avisos y errores con el mismo estilo", () => {
    const pantalla = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");

    it("el aviso de minutos previos usa la misma caja y texto que los errores y avisos, solo cambia el color", () => {
        assert.match(pantalla, /style=\{\[styles\.messageBox, styles\.messageBoxInfo\]\}/);
        assert.equal(/styles\.hintBox|styles\.hintText/.test(pantalla), false);
    });

    it("el error con «Reintentar» ocupa todo el ancho, igual que la caja del mensaje", () => {
        assert.match(pantalla, /errorContainer: \{\s*width: '100%'/);
        assert.match(pantalla, /retryButton: \{\s*width: '100%'/);
    });
});
