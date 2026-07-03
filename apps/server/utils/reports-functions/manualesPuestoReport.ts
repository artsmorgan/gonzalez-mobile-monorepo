/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type ManualesPuestoOrderKey = "title" | "created_at";

export const normalizeManualesPuestoFilters = normalizeActaEntregaFilters;
export type ManualesPuestoModuleFilters = ActaEntregaModuleFilters;

export function hasManualesPuestoListModuleFiltersContent(f: ManualesPuestoModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds?.length) return true;
    if (f.clienteIds?.length) return true;
    if (f.divisionIds?.length) return true;
    if (f.contratoIds?.length) return true;
    if (f.corpoIds?.length) return true;
    if (f.puestoIds?.length) return true;
    return false;
}

export function filtersMatchManualesPuestoListQuery(parsedRowFilters: any, listModuleFilters?: ManualesPuestoModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeManualesPuestoFilters(mf);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) return false;
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    return true;
}

const now = () => new Date();
const activeOrNoInactiveDate = [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: now() } }];

function parseBoundaryDateTime(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function excelCellString(v: unknown): string {
    const s = String(v ?? "");
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

function safeJsonParse(raw: string | null | undefined): any {
    if (!raw || String(raw).trim() === "") return null;
    try {
        return JSON.parse(String(raw));
    } catch {
        return null;
    }
}

/** Columnas usadas en las cuadrículas de la hoja «Quices». */
const QUIZ_SHEET_COLS = 7;

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

/** Misma nomenclatura que `getQuizTypeLabel` en `JobManualsScreen.tsx`. */
function quizTypeKeyToSpanishLabel(typeKey: string | undefined | null): string {
    const k = String(typeKey ?? "")
        .trim()
        .toLowerCase();
    const map: Record<string, string> = {
        short: "Respuesta corta",
        paragraph: "Párrafo",
        multiple_choice: "Selección única",
        multiple_select: "Selección múltiple",
        list: "Lista",
    };
    if (k && map[k]) return map[k];
    const raw = String(typeKey ?? "").trim();
    return raw !== "" ? raw : "—";
}

function extractQuizQuestionArray(quizStr: string | null | undefined): any[] {
    const parsed = safeJsonParse(quizStr ?? undefined);
    if (!parsed) return [];
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
}

function formatCorrectAnswerForGrid(q: any): string {
    if (Array.isArray(q?.answers) && q.answers.length) {
        return excelCellString(q.answers.map((o: any) => String(o)).join(", "));
    }
    if (typeof q?.answer === "string" && q.answer.trim() !== "") return excelCellString(q.answer);
    return "—";
}

function optionsCellText(q: any): string {
    if (!Array.isArray(q?.options) || !q.options.length) return "—";
    return excelCellString(q.options.map((o: any) => String(o)).join(" | "));
}

function parseQuizAnswersPayload(raw: string | null | undefined): any[] {
    const arr = safeJsonParse(raw ?? undefined);
    return Array.isArray(arr) ? arr : [];
}

function answersByQuestionId(items: any[]): Map<string, any> {
    const m = new Map<string, any>();
    for (const x of items) {
        const id = String(x?.question_id ?? "").trim();
        if (id) m.set(id, x);
    }
    return m;
}

function displayUserAnswerCell(ans: any): string {
    if (!ans) return "—";
    if (ans.user_answer != null && String(ans.user_answer).trim() !== "") return excelCellString(ans.user_answer);
    if (Array.isArray(ans.user_answers) && ans.user_answers.length) {
        return excelCellString(ans.user_answers.map((o: any) => String(o)).join(", "));
    }
    return "—";
}

function applyQuizDataRow(row: ExcelJS.Row, cols: number) {
    for (let c = 1; c <= cols; c++) {
        const cell = row.getCell(c);
        cell.border = borderThin as ExcelJS.Borders;
        cell.alignment = { wrapText: true, vertical: "top" };
    }
}

function applyQuizSubheaderRow(row: ExcelJS.Row, cols: number) {
    row.font = { bold: true, size: 11 };
    for (let c = 1; c <= cols; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } } as ExcelJS.Fill;
        cell.border = borderThin as ExcelJS.Borders;
        cell.alignment = { vertical: "middle", wrapText: true };
    }
}

function approvedLabel(v: boolean | null | undefined): string {
    if (v === true) return "Aprobado";
    if (v === false) return "Reprobado";
    return "Pendiente";
}

async function puestoIdsFromSucursalIds(prisma: ReportDataAccess, sucursalIds: number[]): Promise<number[]> {
    if (!sucursalIds.length) return [];
    const rows = await prisma.e_estructura_puesto.findMany({
        where: {
            deleted: null,
            AND: [{ OR: activeOrNoInactiveDate }],
            sucursal_id: { in: sucursalIds },
        },
        select: { id: true },
    });
    return rows.map((r) => r.id);
}

async function sucursalIdsFromContratoIds(prisma: ReportDataAccess, contratoIds: number[]): Promise<number[]> {
    if (!contratoIds.length) return [];
    const rows = await prisma.e_estructura_sucursal.findMany({
        where: {
            deleted: null,
            AND: [{ OR: activeOrNoInactiveDate }],
            contrato_id: { in: contratoIds },
        },
        select: { id: true },
    });
    return rows.map((r) => r.id);
}

async function traceEmpresaToPuestoIds(prisma: ReportDataAccess, empresaIds: number[]): Promise<Set<number>> {
    const out = new Set<number>();
    const clientes = await prisma.e_estructura_cliente.findMany({
        where: { empresa_id: { in: empresaIds }, deleted: null, AND: [{ OR: activeOrNoInactiveDate }] },
        select: { id: true },
    });
    if (!clientes.length) return out;
    const cliIds = clientes.map((c) => c.id);
    const contratos = await prisma.e_estructura_contrato.findMany({
        where: { cliente_id: { in: cliIds }, deleted: null, AND: [{ OR: activeOrNoInactiveDate }] },
        select: { id: true },
    });
    const corIds = contratos.map((c) => c.id);
    const sids = await sucursalIdsFromContratoIds(prisma, corIds);
    const pids = await puestoIdsFromSucursalIds(prisma, sids);
    pids.forEach((id) => out.add(id));
    return out;
}

async function traceClienteToPuestoIds(prisma: ReportDataAccess, clienteIds: number[]): Promise<Set<number>> {
    const out = new Set<number>();
    const contratos = await prisma.e_estructura_contrato.findMany({
        where: { cliente_id: { in: clienteIds }, deleted: null, AND: [{ OR: activeOrNoInactiveDate }] },
        select: { id: true },
    });
    if (!contratos.length) return out;
    const sids = await sucursalIdsFromContratoIds(prisma, contratos.map((c) => c.id));
    const pids = await puestoIdsFromSucursalIds(prisma, sids);
    pids.forEach((id) => out.add(id));
    return out;
}

async function traceDivisionToPuestoIds(prisma: ReportDataAccess, divisionIds: number[]): Promise<Set<number>> {
    const out = new Set<number>();
    const contratos = await prisma.e_estructura_contrato.findMany({
        where: { division_id: { in: divisionIds }, deleted: null, AND: [{ OR: activeOrNoInactiveDate }] },
        select: { id: true },
    });
    if (!contratos.length) return out;
    const sids = await sucursalIdsFromContratoIds(prisma, contratos.map((c) => c.id));
    const pids = await puestoIdsFromSucursalIds(prisma, sids);
    pids.forEach((id) => out.add(id));
    return out;
}

async function traceContratoToPuestoIds(prisma: ReportDataAccess, contratoIds: number[]): Promise<Set<number>> {
    const out = new Set<number>();
    const sids = await sucursalIdsFromContratoIds(prisma, contratoIds);
    const pids = await puestoIdsFromSucursalIds(prisma, sids);
    pids.forEach((id) => out.add(id));
    return out;
}

async function traceCorpoToPuestoIds(prisma: ReportDataAccess, corpoIds: number[]): Promise<Set<number>> {
    const out = new Set<number>();
    const pids = await puestoIdsFromSucursalIds(prisma, corpoIds);
    pids.forEach((id) => out.add(id));
    return out;
}

/**
 * Intersección de conjuntos de puestos derivados de cada filtro estructural aplicado.
 * Si no hay ningún filtro estructural, devuelve `undefined` (no restringir por puesto).
 */
export async function resolveManualReportPuestoIds(prisma: ReportDataAccess, f: ManualesPuestoModuleFilters): Promise<Set<number> | undefined> {
    const sets: Set<number>[] = [];
    if (f.empresaIds?.length) sets.push(await traceEmpresaToPuestoIds(prisma, f.empresaIds));
    if (f.clienteIds?.length) sets.push(await traceClienteToPuestoIds(prisma, f.clienteIds));
    if (f.divisionIds?.length) sets.push(await traceDivisionToPuestoIds(prisma, f.divisionIds));
    if (f.contratoIds?.length) sets.push(await traceContratoToPuestoIds(prisma, f.contratoIds));
    if (f.corpoIds?.length) sets.push(await traceCorpoToPuestoIds(prisma, f.corpoIds));
    if (f.puestoIds?.length) sets.push(new Set(f.puestoIds));
    if (sets.length === 0) return undefined;
    let acc = new Set(sets[0]);
    for (let i = 1; i < sets.length; i++) {
        const next = new Set<number>();
        for (const id of acc) {
            if (sets[i].has(id)) next.add(id);
        }
        acc = next;
    }
    return acc;
}

export async function queryManualesPuestoRows(prisma: ReportDataAccess, filters: ManualesPuestoModuleFilters, orderKey: ManualesPuestoOrderKey) {
    const puestoSet = await resolveManualReportPuestoIds(prisma, filters);
    if (puestoSet !== undefined && puestoSet.size === 0) return [];

    const desde = parseBoundaryDateTime(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDateTime(filters.creadoHasta ?? undefined);

    const where: any = { isActive: true };
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (puestoSet !== undefined) {
        const arr = [...puestoSet];
        where.OR = [{ puesto_id: { in: arr } }, { e_puestos_manual_puesto: { some: { puesto_id: { in: arr } } } }];
    }

    const orderBy =
        orderKey === "created_at"
            ? { created_at: "desc" as const }
            : { title: "asc" as const };

    const rows = await prisma.e_manual_puesto.findMany({
        where,
        orderBy,
        take: 10_000,
        include: {
            e_puestos_manual_puesto: {
                include: { e_estructura_puesto: { select: { id: true, nombre: true, codigo: true } } },
            },
            e_empleado_visualizacion_manual_puesto: {
                include: {
                    c_empleado: { select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true } },
                },
            },
        },
    });

    const empresaIds = [...new Set(rows.map((r) => r.empresa_id).filter((n) => n > 0))];
    const clienteIds = [...new Set(rows.map((r) => r.cliente_id).filter((n) => n > 0))];
    const divisionIds = [...new Set(rows.map((r) => r.division_id).filter((n) => n > 0))];
    const contratoIds = [...new Set(rows.map((r) => r.contrato_id).filter((n) => n > 0))];
    const corpoIds = [...new Set(rows.map((r) => r.corpo_id).filter((n) => n > 0))];
    const puestoIds = [...new Set(rows.map((r) => r.puesto_id).filter((n) => n > 0))];

    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
        corpoIds.length ? prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpoIds } }, select: { id: true, nombre: true, nro_sucursal: true } }) : [],
        puestoIds.length ? prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
    ]);
    const empresaById = new Map(empresas.map((e) => [e.id, e]));
    const clienteById = new Map(clientes.map((c) => [c.id, c]));
    const divisionById = new Map(divisiones.map((d) => [d.id, d]));
    const contratoById = new Map(contratos.map((c) => [c.id, c]));
    const corpoById = new Map(corpos.map((c) => [c.id, c]));
    const puestoById = new Map(puestos.map((p) => [p.id, p]));

    return rows.map((r: any) => {
        const emp = empresaById.get(r.empresa_id);
        const cli = clienteById.get(r.cliente_id);
        const div = divisionById.get(r.division_id);
        const con = contratoById.get(r.contrato_id);
        const cor = corpoById.get(r.corpo_id);
        const pto = puestoById.get(r.puesto_id);
        return {
            ...r,
            empresa_txt: emp ? `${emp.codigo ? `${emp.codigo} - ` : ""}${emp.nombre}` : String(r.empresa_id),
            cliente_txt: cli?.nombre ?? String(r.cliente_id),
            division_txt: div ? `${div.codigo ? `${div.codigo} - ` : ""}${div.nombre}` : String(r.division_id ?? ""),
            contrato_txt: con ? `${con.nro_contrato ? `${con.nro_contrato} - ` : ""}${con.nombre}` : String(r.contrato_id),
            corpo_txt: cor ? `${cor.nro_sucursal ? `${cor.nro_sucursal} - ` : ""}${cor.nombre}` : String(r.corpo_id),
            puesto_principal_txt: pto ? `${pto.codigo ? `${pto.codigo} - ` : ""}${pto.nombre}` : String(r.puesto_id),
            created_at_txt: r.created_at instanceof Date ? r.created_at.toISOString().replace("T", " ").slice(0, 19) : String(r.created_at ?? ""),
        };
    });
}

function applyHeaderRow(row: ExcelJS.Row, cols: number) {
    row.font = { bold: true };
    for (let c = 1; c <= cols; c++) {
        const cell = row.getCell(c);
        cell.fill = GRP_HDR;
        cell.border = borderThin as ExcelJS.Borders;
        cell.alignment = { vertical: "middle", wrapText: true };
    }
}

export async function buildManualesPuestoExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Manuales");
    const wsQuiz = wb.addWorksheet("Quices");
    const wsPuestos = wb.addWorksheet("Puestos del manual");
    const wsVis = wb.addWorksheet("Visualización");

    const mainHeaders = [
        "ID",
        "Título",
        "Descripción",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Corpo",
        "Puesto principal",
        "Creado en",
        "Quiz",
        "Puestos vinculados",
        "Visualización empleados",
        "Quices",
    ];
    const h = wsMain.addRow(mainHeaders);
    applyHeaderRow(h, mainHeaders.length);
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.properties.outlineProperties = { summaryBelow: true, summaryRight: false };

    let quizRow = 0;
    const writeQuizSectionTitle = (text: string) => {
        quizRow += 1;
        wsQuiz.mergeCells(quizRow, 1, quizRow, QUIZ_SHEET_COLS);
        wsQuiz.getCell(quizRow, 1).value = text;
        wsQuiz.getCell(quizRow, 1).font = { bold: true, size: 12 };
        wsQuiz.getCell(quizRow, 1).alignment = { vertical: "middle", wrapText: true };
        return quizRow;
    };

    const writeQuizMergedNote = (text: string) => {
        quizRow += 1;
        wsQuiz.mergeCells(quizRow, 1, quizRow, QUIZ_SHEET_COLS);
        wsQuiz.getCell(quizRow, 1).value = text;
        wsQuiz.getCell(quizRow, 1).alignment = { wrapText: true, vertical: "top" };
        applyQuizDataRow(wsQuiz.getRow(quizRow), QUIZ_SHEET_COLS);
    };

    let puestosRow = 0;
    const writePuestosHeader = () => {
        const hr = wsPuestos.addRow(["Manual ID", "Título manual", "Puesto ID", "Puesto"]);
        applyHeaderRow(hr, 4);
        puestosRow = hr.number;
        return puestosRow;
    };

    let visRow = 0;
    const writeVisHeader = () => {
        const hr = wsVis.addRow([
            "Manual ID",
            "Título manual",
            "Visualización ID",
            "Empleado",
            "Estado",
            "Quiz respuestas",
        ]);
        applyHeaderRow(hr, 6);
        visRow = hr.number;
        return visRow;
    };

    writePuestosHeader();
    writeVisHeader();

    const anchorQuizStructure = new Map<number, number>();
    const anchorQuizAnswers = new Map<number, number>();
    /** Fila en «Quices» donde comienza el bloque de respuestas de una visualización (para hipervínculo desde «Visualización»). */
    const anchorQuizByVisualizationId = new Map<number, number>();
    const anchorPuestos = new Map<number, number>();
    const anchorVis = new Map<number, number>();

    for (const r of rows) {
        const id = Number(r.id);
        const title = excelCellString(r.title);

        const structureTitleRow = writeQuizSectionTitle(`Manual #${id} — ${title}`);
        anchorQuizStructure.set(id, structureTitleRow);

        const parsedRoot = safeJsonParse(r.quiz ?? undefined);
        const questionObjs = extractQuizQuestionArray(r.quiz);

        quizRow += 1;
        wsQuiz.mergeCells(quizRow, 1, quizRow, QUIZ_SHEET_COLS);
        wsQuiz.getCell(quizRow, 1).value = "Estructura del cuestionario (plantilla)";
        applyQuizSubheaderRow(wsQuiz.getRow(quizRow), QUIZ_SHEET_COLS);

        quizRow += 1;
        const structHdr = wsQuiz.addRow([
            "Nº",
            "ID pregunta",
            "Enunciado",
            "Tipo de pregunta",
            "Puntos",
            "Opciones",
            "Respuesta esperada / modelo",
        ]);
        quizRow = structHdr.number;
        applyHeaderRow(structHdr, QUIZ_SHEET_COLS);

        if (typeof parsedRoot === "object" && parsedRoot !== null && typeof (parsedRoot as any).minApprovalPercentage === "number") {
            quizRow += 1;
            wsQuiz.mergeCells(quizRow, 1, quizRow, QUIZ_SHEET_COLS);
            wsQuiz.getCell(quizRow, 1).value = `Porcentaje mínimo para aprobar: ${(parsedRoot as any).minApprovalPercentage}%`;
            wsQuiz.getCell(quizRow, 1).font = { italic: true };
            applyQuizDataRow(wsQuiz.getRow(quizRow), QUIZ_SHEET_COLS);
        }

        if (!questionObjs.length) {
            quizRow += 1;
            const emptyR = wsQuiz.addRow(["—", "—", "(Sin preguntas en el quiz)", "—", "—", "—", "—"]);
            quizRow = emptyR.number;
            applyQuizDataRow(emptyR, QUIZ_SHEET_COLS);
        } else {
            for (let i = 0; i < questionObjs.length; i++) {
                const q = questionObjs[i] || {};
                const qid = String(q?.id ?? "").trim();
                const qtitle = excelCellString(q?.title ?? q?.titulo ?? "");
                const typeLabel = quizTypeKeyToSpanishLabel(q?.type);
                const ptsRaw = q?.points;
                const ptsNum = typeof ptsRaw === "number" ? ptsRaw : Number(ptsRaw);
                const ptsStr = Number.isFinite(ptsNum) ? String(ptsNum) : "—";
                const rnum = wsQuiz.addRow([
                    String(i + 1),
                    qid || "—",
                    qtitle || "—",
                    typeLabel,
                    ptsStr,
                    optionsCellText(q),
                    formatCorrectAnswerForGrid(q),
                ]);
                quizRow = rnum.number;
                applyQuizDataRow(rnum, QUIZ_SHEET_COLS);
            }
        }

        const answerTitleRow = writeQuizSectionTitle(`Respuestas por empleado — Manual #${id}`);
        anchorQuizAnswers.set(id, answerTitleRow);

        const vizList = r.e_empleado_visualizacion_manual_puesto || [];
        if (!vizList.length) {
            writeQuizMergedNote("(Sin visualizaciones ni respuestas registradas)");
        }
        for (const v of vizList) {
            const emp = v.c_empleado;
            const empTxt = emp
                ? [emp.codigo, emp.nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(" ")
                : excelCellString(v.nombre_empleado);
            const vid = Number(v.id);
            quizRow += 1;
            wsQuiz.mergeCells(quizRow, 1, quizRow, QUIZ_SHEET_COLS);
            wsQuiz.getCell(quizRow, 1).value = `Visualización ID ${vid} — Empleado: ${empTxt} — Estado: ${approvedLabel(v.approved)}`;
            applyQuizSubheaderRow(wsQuiz.getRow(quizRow), QUIZ_SHEET_COLS);
            if (Number.isFinite(vid)) anchorQuizByVisualizationId.set(vid, quizRow);

            quizRow += 1;
            const ansHdr = wsQuiz.addRow([
                "Nº",
                "ID pregunta",
                "Enunciado",
                "Tipo de pregunta",
                "Respuesta del empleado",
                "Respuesta esperada (plantilla)",
                "Notas",
            ]);
            quizRow = ansHdr.number;
            applyHeaderRow(ansHdr, QUIZ_SHEET_COLS);

            const ansItems = parseQuizAnswersPayload(v.quiz_answear);
            const byQid = answersByQuestionId(ansItems);

            if (!questionObjs.length) {
                const r0 = wsQuiz.addRow(["—", "—", "(Sin plantilla de preguntas)", "—", "—", "—", "—"]);
                quizRow = r0.number;
                applyQuizDataRow(r0, QUIZ_SHEET_COLS);
            } else {
                for (let i = 0; i < questionObjs.length; i++) {
                    const q = questionObjs[i] || {};
                    const qid = String(q?.id ?? "").trim();
                    const qtitle = excelCellString(q?.title ?? q?.titulo ?? "");
                    const ans = qid ? byQid.get(qid) : undefined;
                    const typeLabel = quizTypeKeyToSpanishLabel(ans?.type ?? q?.type);
                    const userDisp = displayUserAnswerCell(ans);
                    const model = formatCorrectAnswerForGrid(q);
                    const notesRaw =
                        ans && (ans.correct_answer != null || (Array.isArray(ans.correct_answers) && ans.correct_answers.length))
                            ? excelCellString(
                                  typeof ans.correct_answer === "string" && ans.correct_answer.trim() !== ""
                                      ? `Ref. calificación: ${ans.correct_answer}`
                                      : Array.isArray(ans.correct_answers) && ans.correct_answers.length
                                        ? `Ref. calificación: ${ans.correct_answers.join(", ")}`
                                        : "",
                              )
                            : "";
                    const notes = notesRaw && notesRaw.trim() !== "" ? notesRaw : "—";
                    const rnum = wsQuiz.addRow([
                        String(i + 1),
                        qid || "—",
                        qtitle || "—",
                        typeLabel,
                        userDisp,
                        model,
                        notes,
                    ]);
                    quizRow = rnum.number;
                    applyQuizDataRow(rnum, QUIZ_SHEET_COLS);
                }
            }
        }

        anchorPuestos.set(id, puestosRow + 1);
        const links = r.e_puestos_manual_puesto || [];
        for (const link of links) {
            const p = link.e_estructura_puesto;
            const ptxt = p ? `${p.codigo ? `${p.codigo} - ` : ""}${p.nombre}` : String(link.puesto_id);
            const row = wsPuestos.addRow([id, title, link.puesto_id, ptxt]);
            puestosRow = row.number;
            row.eachCell((cell) => {
                cell.border = borderThin as ExcelJS.Borders;
                cell.alignment = { wrapText: true, vertical: "top" };
            });
        }
        if (!links.length) {
            const row = wsPuestos.addRow([id, title, "", "(Sin vínculos adicionales)"]);
            puestosRow = row.number;
            row.eachCell((cell) => {
                cell.border = borderThin as ExcelJS.Borders;
            });
        }

        anchorVis.set(id, visRow + 1);
        for (const v of vizList) {
            const emp = v.c_empleado;
            const empTxt = emp
                ? [emp.codigo, emp.nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(" ")
                : excelCellString(v.nombre_empleado);
            const row = wsVis.addRow([id, title, v.id, empTxt, approvedLabel(v.approved), "Ver respuestas"]);
            visRow = row.number;
            row.eachCell((cell, col) => {
                cell.border = borderThin as ExcelJS.Borders;
                cell.alignment = { wrapText: true, vertical: "top" };
            });
            const quizCell = row.getCell(6);
            const tgt = anchorQuizByVisualizationId.get(Number(v.id)) ?? anchorQuizAnswers.get(id) ?? structureTitleRow;
            quizCell.value = { text: "Ver respuestas", hyperlink: `#'Quices'!A${tgt}` };
            quizCell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        if (!vizList.length) {
            const row = wsVis.addRow([id, title, "", "", "", ""]);
            visRow = row.number;
            row.eachCell((cell) => {
                cell.border = borderThin as ExcelJS.Borders;
            });
        }
    }

    wsQuiz.columns = [
        { width: 6 },
        { width: 14 },
        { width: 42 },
        { width: 22 },
        { width: 36 },
        { width: 28 },
        { width: 28 },
    ];
    wsPuestos.columns = [{ width: 10 }, { width: 40 }, { width: 10 }, { width: 40 }];
    wsVis.columns = [{ width: 10 }, { width: 28 }, { width: 14 }, { width: 36 }, { width: 12 }, { width: 22 }];

    for (const r of rows) {
        const id = Number(r.id);
        const title = excelCellString(r.title);
        const desc = excelCellString(r.description);
        const descShort = desc.length > 500 ? `${desc.slice(0, 497)}...` : desc;
        const qStruct = anchorQuizStructure.get(id) ?? 2;
        const qAns = anchorQuizAnswers.get(id) ?? qStruct;
        const pA = anchorPuestos.get(id) ?? 2;
        const vA = anchorVis.get(id) ?? 2;

        const row = wsMain.addRow([
            id,
            title,
            descShort,
            r.empresa_txt,
            r.cliente_txt,
            r.division_txt,
            r.contrato_txt,
            r.corpo_txt,
            r.puesto_principal_txt,
            r.created_at_txt,
            "Ver estructura",
            "Puestos vinculados",
            "Visualización empleados",
            "Quices",
        ]);
        row.outlineLevel = 1;
        row.eachCell((cell, col) => {
            cell.border = borderThin as ExcelJS.Borders;
            cell.alignment = { wrapText: true, vertical: "top" };
        });
        row.getCell(11).value = { text: "Ver estructura", hyperlink: `#'Quices'!A${qStruct}` };
        row.getCell(11).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(12).value = { text: "Puestos vinculados", hyperlink: `#'Puestos del manual'!A${pA}` };
        row.getCell(12).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(13).value = { text: "Visualización empleados", hyperlink: `#'Visualización'!A${vA}` };
        row.getCell(13).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(14).value = { text: "Quices", hyperlink: `#'Quices'!A${qAns}` };
        row.getCell(14).font = { color: { argb: "FF0563C1" }, underline: true };
    }

    wsMain.columns = [
        { width: 8 },
        { width: 32 },
        { width: 40 },
        { width: 22 },
        { width: 22 },
        { width: 20 },
        { width: 24 },
        { width: 22 },
        { width: 24 },
        { width: 18 },
        { width: 16 },
        { width: 18 },
        { width: 22 },
        { width: 12 },
    ];

    return Buffer.from(await wb.xlsx.writeBuffer());
}
