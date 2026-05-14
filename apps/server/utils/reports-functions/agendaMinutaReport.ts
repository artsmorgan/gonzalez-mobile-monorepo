/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import archiver from "archiver";
import fs from "fs/promises";
import path from "path";
import {
    Document,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    AlignmentType,
    ImageRun,
    ShadingType,
    BorderStyle,
    VerticalAlign,
} from "docx";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";

export type AgendaMinutaModuleFilters = ActaEntregaModuleFilters & {
    estadoMinuta?: "todos" | "completado" | "pendiente";
};

export type AgendaMinutaOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha";

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

function parseDataUri(dataUri: string | null): { extension: "png" | "jpeg"; base64: string } | null {
    if (!dataUri) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(dataUri);
    if (m) {
        const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        return { extension: ext, base64: m[2].replace(/\s+/g, "") };
    }
    return { extension: "png", base64: String(dataUri).replace(/\s+/g, "") };
}

function timeToHHmm(val: any): string {
    if (val == null) return "";
    const d = val instanceof Date ? val : new Date(String(val));
    if (Number.isNaN(d.getTime())) return "";
    const hh = d.getUTCHours();
    const mm = d.getUTCMinutes();
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function normalizeAgendaMinutaFilters(raw: unknown): AgendaMinutaModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const em = o.estadoMinuta ?? o.estado_minuta;
    let estadoMinuta: AgendaMinutaModuleFilters["estadoMinuta"] = "todos";
    if (em === "completado" || em === "pendiente" || em === "todos") estadoMinuta = em;
    return { ...base, estadoMinuta };
}

export function hasAgendaListModuleFiltersContent(f: AgendaMinutaModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds && f.empresaIds.length > 0) return true;
    if (f.clienteIds && f.clienteIds.length > 0) return true;
    if (f.divisionIds && f.divisionIds.length > 0) return true;
    if (f.contratoIds && f.contratoIds.length > 0) return true;
    if (f.corpoIds && f.corpoIds.length > 0) return true;
    if (f.puestoIds && f.puestoIds.length > 0) return true;
    if (f.estadoMinuta && f.estadoMinuta !== "todos") return true;
    return false;
}

export function filtersMatchAgendaListQuery(parsedRowFilters: any, listModuleFilters?: AgendaMinutaModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeAgendaMinutaFilters(mf);
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
    const wantEst = listModuleFilters.estadoMinuta ?? "todos";
    const savedEst = (saved.estadoMinuta as string) ?? "todos";
    if (wantEst !== "todos" && savedEst !== wantEst) return false;
    return true;
}

function parseParticipantes(raw: string | null | undefined): Array<{ nombre?: string; puesto?: string; firma?: string | null }> {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

function parseAcuerdosItems(raw: string | null | undefined): Array<{ texto?: string; responsable?: string; fecha_limite?: string }> {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        if (typeof p === "object" && p !== null && Array.isArray((p as any).items)) return (p as any).items;
        if (Array.isArray(p)) return p;
    } catch {
        /* ignore */
    }
    return [];
}

function parseTemas(raw: string | null | undefined): string[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p.map((x) => String(x ?? "")) : [];
    } catch {
        return [];
    }
}

export async function queryAgendaMinutaReportRows(
    prisma: PrismaClient,
    filters: AgendaMinutaModuleFilters,
    orderKey: AgendaMinutaOrderKey,
): Promise<any[]> {
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
    if (filters.estadoMinuta === "completado") where.estado = true;
    if (filters.estadoMinuta === "pendiente") where.estado = false;

    const rows = await prisma.c_agenda_minuta.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const empresaIds = [...new Set(rows.map((x) => Number(x.empresa_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const clienteIds = [...new Set(rows.map((x) => Number(x.cliente_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const divisionIds = [...new Set(rows.map((x) => Number(x.division_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const contratoIds = [...new Set(rows.map((x) => Number(x.contrato_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const corpoIds = [...new Set(rows.map((x) => Number(x.corpo_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const puestoIds = [...new Set(rows.map((x) => Number(x.puesto_id)).filter((n) => Number.isFinite(n) && n > 0))];

    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        clienteIds.length
            ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } })
            : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({
                  where: { id: { in: contratoIds } },
                  select: { id: true, nombre: true, nro_contrato: true },
              })
            : [],
        corpoIds.length
            ? prisma.e_estructura_sucursal.findMany({
                  where: { id: { in: corpoIds } },
                  select: { id: true, nombre: true, nro_sucursal: true },
              })
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

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(r.empresa_id);
        const cliente = clienteById.get(r.cliente_id);
        const division = divisionById.get(r.division_id);
        const contrato = contratoById.get(r.contrato_id);
        const corpo = corpoById.get(r.corpo_id);
        const puesto = puestoById.get(r.puesto_id);
        const participantes = parseParticipantes(r.participantes);
        const participantesPreview = participantes.map((p) => ({
            ...p,
            firma_data_uri: normalizeSignatureDataUri(p.firma ?? null),
        }));
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            hora_inicio_txt: timeToHHmm(r.hora_inicio),
            hora_fin_txt: timeToHHmm(r.hora_fin),
            fecha_txt: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? ""),
            firma_responsable_data_uri: normalizeSignatureDataUri(r.firma_responsable),
            participantes_preview: participantesPreview,
        };
    });

    const sorted = [...enriched].sort((a, b) => {
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

    return sorted;
}

async function resolveLogoBuffer(empresaId: number): Promise<Buffer | null> {
    const logoName = empresaId === 9 ? "9.png" : empresaId === 10 ? "10.png" : null;
    if (!logoName) return null;
    const p = path.resolve(process.cwd(), "app", "logo-images", logoName);
    try {
        return await fs.readFile(p);
    } catch {
        return null;
    }
}

const DOC_FONT = "Arial";

const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

export async function buildAgendaMinutaDocxBuffer(row: any, reportNombre: string): Promise<Buffer> {
    /** Texto esquina superior derecha: preferir datos del registro (`titulo`), luego nombre explícito o respaldo del reporte. */
    const nombreEsquina = String(row.titulo ?? row.nombre ?? reportNombre ?? "").trim();

    const logoBuf = await resolveLogoBuffer(Number(row.empresa_id));
    const logoChildren: (Paragraph | Table)[] = [];
    if (logoBuf) {
        logoChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new ImageRun({
                        data: new Uint8Array(logoBuf),
                        transformation: { width: 90, height: 90 },
                        type: "png",
                    }),
                ],
            }),
        );
    }

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: logoChildren.length ? logoChildren : [new Paragraph("")],
                    }),
                    new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        shading: { fill: "1F2A3A", type: ShadingType.CLEAR, color: "auto" },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: "AGENDA / MINUTA ELECTRÓNICA",
                                        bold: true,
                                        size: 28,
                                        color: "FFFFFF",
                                        font: DOC_FONT,
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: nombreEsquina,
                                        bold: true,
                                        size: 22,
                                        color: "000000",
                                        font: DOC_FONT,
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });

    const bar = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        shading: { fill: "000000", type: ShadingType.CLEAR, color: "auto" },
                        borders: thinBorder,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: "AGENDA-MINUTA",
                                        bold: true,
                                        color: "FFFFFF",
                                        size: 24,
                                        font: DOC_FONT,
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });

    const infoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    cellLabel("Fecha:"),
                    cellVal(row.fecha_txt),
                    cellLabel("Hora Inicio:"),
                    cellVal(row.hora_inicio_txt),
                    cellLabel("Hora Fin:"),
                    cellVal(row.hora_fin_txt),
                ],
            }),
            new TableRow({
                children: [
                    new TableCell({
                        columnSpan: 4,
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Elaborada por: ", bold: true, font: DOC_FONT }),
                                    new TextRun({ text: String(row.autor ?? ""), font: DOC_FONT }),
                                ],
                            }),
                        ],
                    }),
                    new TableCell({
                        columnSpan: 2,
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Minuta No. ", bold: true, font: DOC_FONT }),
                                    new TextRun({ text: String(row.numero ?? ""), font: DOC_FONT }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });

    const participantes = parseParticipantes(row.participantes);
    const partHeader = new TableRow({
        tableHeader: true,
        children: ["Nombre Completo", "Puesto", "Firma"].map((h) =>
            new TableCell({
                shading: { fill: "000000", type: ShadingType.CLEAR, color: "auto" },
                borders: thinBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: h, bold: true, color: "FFFFFF", font: DOC_FONT }),
                        ],
                    }),
                ],
            }),
        ),
    });
    const partRows: TableRow[] = [partHeader];
    const maxRows = Math.max(participantes.length, 12);
    for (let i = 0; i < maxRows; i++) {
        const p = participantes[i];
        const imgCellChildren: Paragraph[] = [];
        if (p?.firma) {
            const img = parseDataUri(normalizeSignatureDataUri(p.firma));
            if (img) {
                try {
                    const buf = Buffer.from(img.base64, "base64");
                    imgCellChildren.push(
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new ImageRun({
                                    data: new Uint8Array(buf),
                                    transformation: { width: 80, height: 40 },
                                    type: img.extension === "png" ? "png" : "jpg",
                                }),
                            ],
                        }),
                    );
                } catch {
                    imgCellChildren.push(
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: "—", font: DOC_FONT })],
                        }),
                    );
                }
            } else {
                imgCellChildren.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: "—", font: DOC_FONT })],
                    }),
                );
            }
        } else {
            imgCellChildren.push(new Paragraph(""));
        }
        partRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(p?.nombre ?? ""), font: DOC_FONT })],
                            }),
                        ],
                    }),
                    new TableCell({
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(p?.puesto ?? ""), font: DOC_FONT })],
                            }),
                        ],
                    }),
                    new TableCell({
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: imgCellChildren,
                    }),
                ],
            }),
        );
    }
    const participantesTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: partRows });

    const temas = parseTemas(row.temas_a_tratar);
    const temasChildren: Paragraph[] = [
        new Paragraph({
            children: [
                new TextRun({
                    text: "2- Tema(s) a Tratar:",
                    bold: true,
                    color: "000000",
                    font: DOC_FONT,
                }),
            ],
        }),
    ];
    if (temas.length === 0) {
        temasChildren.push(new Paragraph({ children: [new TextRun({ text: "—", font: DOC_FONT })] }));
    } else {
        temas.forEach((t, i) =>
            temasChildren.push(
                new Paragraph({
                    children: [new TextRun({ text: `${i + 1}. ${t}`, font: DOC_FONT, color: "000000" })],
                }),
            ),
        );
    }

    const acuerdos = parseAcuerdosItems(row.acuerdos);
    const acuHeader = new TableRow({
        tableHeader: true,
        children: ["Acuerdos", "Responsables", "Fecha límite"].map(
            (h) =>
                new TableCell({
                    shading: { fill: "000000", type: ShadingType.CLEAR, color: "auto" },
                    borders: thinBorder,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: h, bold: true, color: "FFFFFF", font: DOC_FONT })],
                        }),
                    ],
                }),
        ),
    });
    const acuRows: TableRow[] = [acuHeader];
    const maxA = Math.max(acuerdos.length, 10);
    for (let i = 0; i < maxA; i++) {
        const a = acuerdos[i];
        acuRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: `${i + 1}) ${String(a?.texto ?? "")}`,
                                        font: DOC_FONT,
                                        color: "000000",
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new TableCell({
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: String(a?.responsable ?? ""), font: DOC_FONT, color: "000000" }),
                                ],
                            }),
                        ],
                    }),
                    new TableCell({
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: String(a?.fecha_limite ?? ""), font: DOC_FONT, color: "000000" }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        );
    }
    const acuerdosTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: acuRows });

    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    headerTable,
                    new Paragraph({ text: "" }),
                    bar,
                    new Paragraph({ text: "" }),
                    infoTable,
                    new Paragraph({ text: "" }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "1- Participantes:",
                                bold: true,
                                color: "000000",
                                font: DOC_FONT,
                            }),
                        ],
                    }),
                    participantesTable,
                    new Paragraph({ text: "" }),
                    ...temasChildren,
                    new Paragraph({ text: "" }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "3- Acuerdos:",
                                bold: true,
                                color: "000000",
                                font: DOC_FONT,
                            }),
                        ],
                    }),
                    acuerdosTable,
                ],
            },
        ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
}

function cellLabel(text: string): TableCell {
    return new TableCell({
        borders: thinBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                children: [new TextRun({ text, bold: true, font: DOC_FONT, color: "000000" })],
            }),
        ],
    });
}

function cellVal(text: string): TableCell {
    return new TableCell({
        borders: thinBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                children: [new TextRun({ text: String(text ?? ""), font: DOC_FONT, color: "000000" })],
            }),
        ],
    });
}

export async function buildAgendaMinutaIndividualZip(rows: any[], reportNombre: string): Promise<Buffer> {
    const files: { name: string; buf: Buffer }[] = [];
    let idx = 0;
    for (const r of rows) {
        idx += 1;
        const nameSafe = `Agenda_minuta_${r.id}_${idx}.docx`.replace(/[/\\?%*:|"<>]/g, "_");
        const buf = await buildAgendaMinutaDocxBuffer(r, reportNombre);
        files.push({ name: nameSafe, buf });
    }
    return zipBuffers(files);
}

function zipBuffers(files: { name: string; buf: Buffer }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const archive = archiver("zip", { zlib: { level: 6 } });
        archive.on("error", reject);
        archive.on("data", (c: Buffer) => chunks.push(c));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        for (const f of files) archive.append(f.buf, { name: f.name });
        void archive.finalize();
    });
}

export async function buildAgendaMinutaExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const workbook = new ExcelJS.Workbook();
    const main = workbook.addWorksheet("Agenda minuta");
    const details = workbook.addWorksheet("Detalles");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };

    const mainHeaders = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Fecha",
        "Número",
        "Título",
        "Autor",
        "Estado",
        "Participantes",
        "Acuerdos",
        "Temas",
    ];
    const h = main.addRow(mainHeaders);
    h.font = { bold: true };
    h.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    h.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
        c.border = borderThin;
    });
    main.getRow(1).height = 28;
    main.views = [{ state: "frozen", ySplit: 1 }];
    main.columns = [
        { width: 12 },
        { width: 38 },
        { width: 34 },
        { width: 28 },
        { width: 36 },
        { width: 34 },
        { width: 34 },
        { width: 14 },
        { width: 12 },
        { width: 36 },
        { width: 36 },
        { width: 14 },
        { width: 22 },
        { width: 22 },
        { width: 22 },
    ];

    const detailsStartById = new Map<number, number>();
    let dRow = 1;
    const rowsDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));

    for (const r of rowsDesc) {
        const start = dRow;
        detailsStartById.set(Number(r.id), start);

        details.getCell(`A${dRow}`).value = `Registro #${r.id} — ${r.titulo || ""}`;
        details.getCell(`A${dRow}`).font = { bold: true, size: 12 };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
        dRow += 1;

        details.getCell(`A${dRow}`).value = "Participantes";
        details.getCell(`A${dRow}`).font = { bold: true };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
        details.getCell(`A${dRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
        dRow += 1;
        const partHeader = details.getRow(dRow);
        partHeader.values = ["Nombre", "Puesto", "Firma"];
        partHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
        partHeader.eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            c.border = borderThin;
        });
        dRow += 1;
        for (const p of parseParticipantes(r.participantes)) {
            const img = parseDataUri(normalizeSignatureDataUri(p.firma ?? null));
            details.getCell(`A${dRow}`).value = String(p.nombre ?? "");
            details.getCell(`B${dRow}`).value = String(p.puesto ?? "");
            details.getCell(`C${dRow}`).value = img ? "Ver imagen" : "—";
            details.getRow(dRow).eachCell((c) => {
                c.border = borderThin;
            });
            if (img) {
                try {
                    const imgId = workbook.addImage({ base64: img.base64, extension: img.extension });
                    details.addImage(imgId, { tl: { col: 2, row: dRow - 1 }, ext: { width: 120, height: 50 } });
                } catch {
                    /* ignore */
                }
            }
            details.getRow(dRow).height = 55;
            dRow += 1;
        }

        details.getCell(`A${dRow}`).value = "Acuerdos";
        details.getCell(`A${dRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
        dRow += 1;
        const acuH = details.getRow(dRow);
        acuH.values = ["Texto", "Responsable", "Fecha límite"];
        acuH.font = { bold: true, color: { argb: "FFFFFFFF" } };
        acuH.eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            c.border = borderThin;
        });
        dRow += 1;
        for (const a of parseAcuerdosItems(r.acuerdos)) {
            details.getRow(dRow).values = [String(a.texto ?? ""), String(a.responsable ?? ""), String(a.fecha_limite ?? "")];
            details.getRow(dRow).eachCell((c) => {
                c.border = borderThin;
            });
            dRow += 1;
        }

        details.getCell(`A${dRow}`).value = "Temas a tratar";
        details.getCell(`A${dRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
        dRow += 1;
        let ti = 1;
        for (const t of parseTemas(r.temas_a_tratar)) {
            details.getCell(`A${dRow}`).value = `${ti}. ${t}`;
            details.getCell(`A${dRow}`).border = borderThin;
            dRow += 1;
            ti += 1;
        }

        dRow += 1;
    }

    details.columns = [{ width: 44 }, { width: 28 }, { width: 32 }];

    for (const r of rows) {
        const detailRow = detailsStartById.get(Number(r.id)) ?? 1;
        const row = main.addRow([
            r.id,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            r.fecha_txt,
            r.numero,
            r.titulo,
            r.autor,
            r.estado ? "Completado" : "Pendiente",
            "Ver participantes",
            "Ver acuerdos",
            "Ver temas",
        ]);
        row.getCell(13).value = { text: "Ver participantes", hyperlink: `#'Detalles'!A${detailRow}` };
        row.getCell(14).value = { text: "Ver acuerdos", hyperlink: `#'Detalles'!A${detailRow}` };
        row.getCell(15).value = { text: "Ver temas", hyperlink: `#'Detalles'!A${detailRow}` };
        row.getCell(13).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(14).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(15).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        });
        row.height = 22;
    }

    main.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: mainHeaders.length },
    };

    const ab = await workbook.xlsx.writeBuffer();
    return Buffer.from(ab);
}
