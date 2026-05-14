/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type ControlAsistenciaModuleFilters = ActaEntregaModuleFilters & {
    tipoTurno?: "D" | "M" | "N" | null;
};

export type ControlAsistenciaOrderKey = "empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "corpo_id" | "puesto_id" | "fecha";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSignatureDataUri(raw: string | null | undefined): string | null {
    if (!raw || String(raw).trim() === "") return null;
    const s = String(raw).trim();
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function formatHourOnly(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s) return "";
    // Si viene como HH:mm o HH:mm:ss
    const hm = /^(\d{2}:\d{2})(:\d{2})?$/.exec(s);
    if (hm) return hm[1];
    // Si viene tipo ISO datetime
    const m = /T(\d{2}:\d{2})/.exec(s);
    if (m) return m[1];
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }
    return s;
}

function parseSignatureDataForExcel(dataUriOrBase64: string | null | undefined): { extension: "png" | "jpeg"; base64: string } | null {
    const d = normalizeSignatureDataUri(dataUriOrBase64);
    if (!d) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        return { extension: m[1].toLowerCase() === "png" ? "png" : "jpeg", base64: String(m[2]).replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/^data:image\/\w+;base64,/, "").replace(/\s+/g, "") };
}

function normalizeTurno(v: unknown): "D" | "M" | "N" | null {
    const s = String(v ?? "").trim().toUpperCase();
    if (!s) return null;
    if (s === "D" || s === "DIURNO") return "D";
    if (s === "M" || s === "MIXTO") return "M";
    if (s === "N" || s === "NOCTURNO") return "N";
    return null;
}

function parseColaboradores(raw: string | null | undefined): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

export function normalizeControlAsistenciaFilters(raw: unknown): ControlAsistenciaModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return { ...base, tipoTurno: normalizeTurno(o.tipoTurno ?? o.turnoTipo ?? o.turno) };
}

export function hasControlAsistenciaListModuleFiltersContent(f: ControlAsistenciaModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta || f.tipoTurno) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    return false;
}

export function filtersMatchControlAsistenciaListQuery(parsedRowFilters: any, listModuleFilters?: ControlAsistenciaModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeControlAsistenciaFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if ((listModuleFilters.tipoTurno ?? null) && (saved.tipoTurno ?? null) !== (listModuleFilters.tipoTurno ?? null)) return false;
    return true;
}

async function resolveLogoPathByEmpresaId(empresaId: number): Promise<string | null> {
    const logoName = empresaId === 9 ? "9.png" : empresaId === 10 ? "10.png" : null;
    if (!logoName) return null;
    const p = path.resolve(process.cwd(), "app", "logo-images", logoName);
    try {
        await fs.access(p);
        return p;
    } catch {
        return null;
    }
}

export async function queryControlAsistenciaRows(prisma: PrismaClient, filters: ControlAsistenciaModuleFilters, orderKey: ControlAsistenciaOrderKey) {
    const where: any = { isActive: true };
    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.tipoTurno) where.turno = filters.tipoTurno;

    const rows = await prisma.c_control_asistencia.findMany({
        where,
        include: { c_control_asistencia_empleado_firmas: true },
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds] = [
        ids(rows.map((x: any) => x.empresa_id)),
        ids(rows.map((x: any) => x.cliente_id)),
        ids(rows.map((x: any) => x.division_id)),
        ids(rows.map((x: any) => x.contrato_id)),
        ids(rows.map((x: any) => x.corpo_id)),
        ids(rows.map((x: any) => x.puesto_id)),
    ];
    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
        corpoIds.length
            ? prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpoIds } }, select: { id: true, nombre: true, nro_sucursal: true } })
            : [],
        puestoIds.length
            ? prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
    ]);
    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));

    const enriched = rows.map((r: any) => {
        const firmasByEmpleado = new Map<number, string>();
        for (const f of r.c_control_asistencia_empleado_firmas || []) firmasByEmpleado.set(Number(f.empleado_id || 0), String(f.firma || ""));
        const cols = parseColaboradores(r.colaboradores).map((c: any) => {
            const activeFirma = firmasByEmpleado.get(Number(c?.empleado_id || 0)) ?? firmasByEmpleado.get(Number(c?.empleado_reemplaza_id || 0));
            const firmaOriginal = firmasByEmpleado.get(Number(c?.empleado_original_id || 0));
            const firmaReemplazo = firmasByEmpleado.get(Number(c?.empleado_reemplaza_id || 0));
            return {
                ...c,
                firma_manual_colaborador: activeFirma ?? null,
                firma_manual_colaborador_data_uri: normalizeSignatureDataUri(activeFirma ?? null),
                firma_manual_original_data_uri: normalizeSignatureDataUri(firmaOriginal ?? null),
                firma_manual_reemplazo_data_uri: normalizeSignatureDataUri(firmaReemplazo ?? null),
            };
        });
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            turno_label: r.turno === "D" ? "Diurno" : r.turno === "M" ? "Mixto" : r.turno === "N" ? "Nocturno" : String(r.turno ?? ""),
            fecha_txt: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? ""),
            colaboradores_preview: cols,
            firma_manual_supervisor_data_uri: normalizeSignatureDataUri(r.firma_manual_supervisor),
        };
    });

    return [...enriched].sort((a: any, b: any) => {
        switch (orderKey) {
            case "empresa_id":
                return a.empresa_nombre.localeCompare(b.empresa_nombre, "es");
            case "cliente_id":
                return a.cliente_nombre.localeCompare(b.cliente_nombre, "es");
            case "division_id":
                return a.division_nombre.localeCompare(b.division_nombre, "es");
            case "contrato_id":
                return a.contrato_nombre.localeCompare(b.contrato_nombre, "es");
            case "corpo_id":
                return a.corpo_nombre.localeCompare(b.corpo_nombre, "es");
            case "puesto_id":
                return a.puesto_nombre.localeCompare(b.puesto_nombre, "es");
            case "fecha":
            default:
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        }
    });
}

export async function buildControlAsistenciaExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Control asistencia");
    const wsDetails = wb.addWorksheet("Detalles");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const detailsAnchorByControl = new Map<number, number>();
    const descRows = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of descRows) {
        const start = wsDetails.rowCount + 1;
        detailsAnchorByControl.set(Number(r.id), start);
        wsDetails.mergeCells(start, 1, start, 9);
        wsDetails.getCell(start, 1).value = `Control #${r.id} | ${r.empresa_nombre} | ${r.fecha_txt}`;
        wsDetails.getCell(start, 1).font = { bold: true };
        wsDetails.getCell(start, 1).fill = hdrFill;
        for (let c = 1; c <= 9; c++) wsDetails.getCell(start, c).border = border;
        const h = wsDetails.addRow(["Nombre original", "Cédula", "Nombre reemplazo", "Cédula reemplazo", "Presente", "Puesto", "Hora inicio", "Hora fin", "Firma"]);
        h.font = { bold: true };
        h.eachCell((c) => {
            c.fill = hdrFill;
            c.border = border;
            c.alignment = { vertical: "middle", wrapText: true };
        });
        for (const c of Array.isArray(r.colaboradores_preview) ? r.colaboradores_preview : parseColaboradores(r.colaboradores)) {
            const row = wsDetails.addRow([
                String(c?.nombre_original || c?.nombre || ""),
                String(c?.cedula || ""),
                String(c?.nombre_reemplazo || ""),
                String(c?.cedula_reemplazo || ""),
                c?.ausente ? "No" : "Sí",
                String(c?.puesto || ""),
                String(c?.hora_inicio || ""),
                String(c?.hora_fin || ""),
                c?.firma_manual_colaborador_data_uri ? "Sí" : "No",
            ]);
            row.eachCell((cell) => {
                cell.border = border;
                cell.alignment = { vertical: "middle", wrapText: true };
            });
        }
        wsDetails.addRow([]);
    }

    const headers = ["ID", "Empresa", "Cliente", "División", "Contrato", "Sucursal", "Puesto", "Fecha", "Turno", "Presentes", "Total turno", "Supervisor", "Comentarios", "Colaboradores"];
    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = hdrFill;
        c.border = border;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = [
        { width: 9, outlineLevel: 1 }, { width: 28, outlineLevel: 1 }, { width: 24, outlineLevel: 1 }, { width: 20, outlineLevel: 1 },
        { width: 28, outlineLevel: 1 }, { width: 28, outlineLevel: 1 }, { width: 24, outlineLevel: 1 }, { width: 13, outlineLevel: 1 },
        { width: 12, outlineLevel: 1 }, { width: 12, outlineLevel: 1 }, { width: 14, outlineLevel: 1 }, { width: 24, outlineLevel: 1 },
        { width: 36, outlineLevel: 1 }, { width: 16, outlineLevel: 1 },
    ];
    for (const r of rows) {
        const anchor = detailsAnchorByControl.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            r.id, r.empresa_nombre, r.cliente_nombre, r.division_nombre, r.contrato_nombre, r.corpo_nombre, r.puesto_nombre, r.fecha_txt, r.turno_label,
            r.total_presentes, r.total_empleados_turno, r.nombre_supervisor ?? "", r.comentarios ?? "", "",
        ]);
        row.getCell(14).value = { text: "Ver detalles", hyperlink: `#'Detalles'!A${anchor}` };
        row.getCell(14).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    }
    wsMain.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    wsDetails.columns = [{ width: 24 }, { width: 14 }, { width: 24 }, { width: 16 }, { width: 10 }, { width: 24 }, { width: 12 }, { width: 12 }, { width: 10 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildControlAsistenciaExcelIndividual(rows: any[], reportName?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    for (const r of rows) {
        const ws = wb.addWorksheet(`Control ${String(r.id).slice(0, 24)}`);
        ws.columns = [{ width: 8 }, { width: 28 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 30 }, { width: 12 }, { width: 20 }, { width: 10 }];
        ws.getRow(1).height = 58;
        ws.mergeCells("A1:C1");
        ws.mergeCells("D1:H1");
        ws.mergeCells("I1:J1");
        ws.mergeCells("A2:J2");
        ws.mergeCells("A3:C3");
        ws.mergeCells("D3:E3");
        ws.mergeCells("F3:J3");

        for (let c = 1; c <= 8; c++) {
            const cell = ws.getCell(1, c);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
            cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
        for (let c = 9; c <= 10; c++) {
            const cell = ws.getCell(1, c);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            cell.font = { color: { argb: "FF1F2A44" }, bold: true };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
        ws.getCell("D1").value = "CONTROL DE ASISTENCIA";
        ws.getCell("D1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
        ws.getCell("D1").alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell("I1").value = String(reportName || r.nombre || "");
        ws.getCell("I1").font = { bold: true, color: { argb: "FF1F2A44" }, size: 12 };
        ws.getCell("I1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

        ws.getCell("A2").value =
            'Si el colaborador no se presenta complete el campo "Firma/Comentario" con el motivo: Ausente, Incapacitado CCSS, Incapacitado INS, PSG, PG, Vacaciones, Suspendido, Preaviso';
        ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        ws.getCell("A2").font = { size: 9 };

        const logo = await resolveLogoPathByEmpresaId(Number(r.empresa_id));
        if (logo) {
            const imgId = wb.addImage({ filename: logo, extension: "png" });
            // Centrado visualmente en la columna B sin estirar el logo.
            ws.addImage(imgId, { tl: { col: 1.15, row: 0.08 }, ext: { width: 78, height: 66 } });
        }
        ws.getCell("A3").value = `CLIENTE: ${String(r.cliente_nombre || "").trim()}`;
        ws.getCell("D3").value = `FECHA: ${String(r.fecha_txt || "").trim()}`;
        const t = String(r.turno || "").toUpperCase();
        const turnoTxt = `TURNO: DIURNO ( ${t === "D" ? "X" : " "} )   MIXTO ( ${t === "M" ? "X" : " "} )   NOCTURNO ( ${t === "N" ? "X" : " "} )`;
        ws.getCell("F3").value = turnoTxt;
        ws.getCell("A3").font = { bold: true, size: 10 };
        ws.getCell("D3").font = { bold: true, size: 10 };
        ws.getCell("F3").font = { bold: true, size: 10 };

        ws.mergeCells("A4:C4");
        ws.mergeCells("D4:E4");
        ws.mergeCells("A6:J6");
        ws.getCell("A4").value = "AREA / PISO";
        ws.getCell("D4").value = `Total Presentes: ${Number(r.total_presentes || 0)} / ${Number(r.total_empleados_turno || 0)}`;
        ws.getCell("F4").value = "Fijos:";
        ws.getCell("H4").value = "Comodines:";
        ws.getCell("A6").value = "COLOCA CANTIDAD DE PERSONAS Y HORARIO";

        const line4Cells = ["A4", "D4", "F4", "H4"];
        for (const ref of line4Cells) {
            ws.getCell(ref).font = { bold: true, size: 10 };
            ws.getCell(ref).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } };
        }
        for (let c = 1; c <= 10; c++) {
            const cell = ws.getCell(4, c);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } };
        }

        const headers = ["#", "Nombre colaborador", "Cédula", "Firma / Comentario", "Entrada", "Salida", "Nombre Sustituto", "Cédula", "Firma", "✓"];
        for (let i = 0; i < headers.length; i++) {
            const c = ws.getCell(5, i + 1);
            c.value = headers[i];
            c.font = { bold: true, size: 9 };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
            c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
        ws.getCell("A6").font = { bold: true, size: 10 };
        ws.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } };

        const startData = 7;
        const cols = Array.isArray(r.colaboradores_preview) ? r.colaboradores_preview : parseColaboradores(r.colaboradores);
        for (const [index, c] of cols.entries()) {
            ws.getRow(startData + index).values = [
                index + 1,
                String(c?.nombre_original || c?.nombre || ""),
                String(c?.cedula || ""),
                "",
                formatHourOnly(c?.hora_inicio),
                formatHourOnly(c?.hora_fin),
                String(c?.nombre_reemplazo || ""),
                String(c?.cedula_reemplazo || ""),
                "",
                c?.ausente ? "" : "✓",
            ];
            ws.getRow(startData + index).height = 46;
            for (let col = 1; col <= 10; col++) {
                const cell = ws.getCell(startData + index, col);
                cell.alignment = { vertical: "middle", horizontal: col === 1 || col === 10 ? "center" : "left", wrapText: true };
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                    bottom: { style: "thin" },
                };
            }
        }
        // Inserta firmas en imagen: solo en el espacio que corresponda.
        for (const [index, c] of cols.entries()) {
            const rowIdx = startData + index;
            const hasReemplazo = String(c?.nombre_reemplazo || "").trim() !== "";
            if (hasReemplazo) {
                const firmaReemplazo = parseSignatureDataForExcel(c?.firma_manual_reemplazo_data_uri || c?.firma_manual_colaborador_data_uri);
                if (firmaReemplazo) {
                    const imgId = wb.addImage({ base64: firmaReemplazo.base64, extension: firmaReemplazo.extension });
                    ws.addImage(imgId, { tl: { col: 8.08, row: rowIdx - 0.9 }, ext: { width: 92, height: 42 } });
                }
            } else {
                const firmaPrincipal = parseSignatureDataForExcel(c?.firma_manual_original_data_uri || c?.firma_manual_colaborador_data_uri || c?.firma_manual_colaborador);
                if (firmaPrincipal) {
                    const imgId = wb.addImage({ base64: firmaPrincipal.base64, extension: firmaPrincipal.extension });
                    ws.addImage(imgId, { tl: { col: 3.08, row: rowIdx - 0.9 }, ext: { width: 105, height: 42 } });
                }
            }
        }
        const baseRow = ws.rowCount + 2;
        const comentariosRow = baseRow + 5;
        // Fondo blanco para la sección de supervisor/comentarios (incluye fila/columna anterior dentro de la cuadrícula).
        for (let rr = baseRow - 1; rr <= comentariosRow + 1; rr++) {
            for (let cc = 1; cc <= 10; cc++) {
                ws.getCell(rr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            }
        }
        ws.getCell(`B${baseRow}`).value = "Nombre Supervisor:";
        ws.mergeCells(`C${baseRow}:E${baseRow}`);
        ws.getCell(`C${baseRow}`).value = String(r.nombre_supervisor || "");
        ws.getCell(`C${baseRow}`).border = { bottom: { style: "thin", color: { argb: "FF000000" } } };
        ws.getCell(`F${baseRow}`).value = "Firma:";
        ws.getCell(`B${comentariosRow}`).value = "Comentarios:";
        ws.mergeCells(`D${comentariosRow}:I${comentariosRow}`);
        ws.getCell(`D${comentariosRow}`).value = String(r.comentarios || "");
        ws.getCell(`D${comentariosRow}`).border = { bottom: { style: "thin", color: { argb: "FF000000" } } };
        const sig = normalizeSignatureDataUri(r.firma_manual_supervisor);
        if (sig) {
            const b64 = sig.replace(/^data:image\/\w+;base64,/, "");
            const imgId = wb.addImage({ base64: b64, extension: "png" });
            ws.addImage(imgId, { tl: { col: 6.2, row: baseRow - 0.2 }, ext: { width: 180, height: 70 } });
        }
        // Borde perimetral negro para toda la cuadrícula (A1:J sección completa).
        const lastFrameRow = Math.max(ws.rowCount, comentariosRow + 1);
        for (let rr = 1; rr <= lastFrameRow; rr++) {
            for (let cc = 1; cc <= 10; cc++) {
                const cell = ws.getCell(rr, cc);
                const b = cell.border || {};
                if (rr === 1) b.top = { style: "thin", color: { argb: "FF000000" } };
                if (rr === lastFrameRow) b.bottom = { style: "thin", color: { argb: "FF000000" } };
                if (cc === 1) b.left = { style: "thin", color: { argb: "FF000000" } };
                if (cc === 10) b.right = { style: "thin", color: { argb: "FF000000" } };
                cell.border = b;
            }
        }
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}
