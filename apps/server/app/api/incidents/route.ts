/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { getUserMarca } from "../../../utils/getUserMarca";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByEmployee, sendNotificationByRole } from "../../../utils/sendNotification";
import { findContributionIncidents } from "../../../utils/findContributionIncidents";

type IncidentFileInput = {
    type: string; // image | audio | video | document
    extension: string;
    original_name?: string;
    file_base64: string; // base64 puro (sin data:)
};

function safeParseJson<T>(value: any, fallback: T): T {
    try {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length === 0) return fallback;
            return JSON.parse(trimmed) as T;
        }
        if (value === null || value === undefined) return fallback;
        return value as T;
    } catch {
        return fallback;
    }
}

function normalizeBase64(b64: string): string {
    // acepta "data:...;base64,AAAA" o "AAAA"
    if (!b64) return "";
    const idx = b64.indexOf("base64,");
    if (idx !== -1) return b64.slice(idx + "base64,".length);
    return b64;
}

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const marcaIdStr = req.nextUrl.searchParams.get("m");
        if (!marcaIdStr) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaIdStr) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marca.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const lastMarca = await getUserMarca(marca.empleadoFijo_id);
        if (!lastMarca) {
            return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
        }

        if (marca.id !== lastMarca.id) {
            return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
        }

        const incidents = await prisma.c_incidente.findMany({
            where: { corpo_id: marca.corpo_id },
            orderBy: { id: "desc" },
            include: {
                n_ejecutivo_cuenta: true,
                n_clasificacion_incidente: true,
                c_archivos_incidente: true,
                _count: {
                    select: {
                        c_contribucion_incidente: true,
                    },
                },
            },
        });

        const incidentsMapped = [];

        for (const i of incidents) {
            const involucrados = safeParseJson<any[]>(i.involucrados, []);
            const fechaLibro = safeParseJson<any>(i.fecha_libro_novedades, { numero: "", fecha: "" });
            const empleado = await prisma.c_empleado.findUnique({ where: { id: marca.empleadoFijo_id } });
            if (empleado) {
                const ejecutivo = empleado.supervisor_id;
                const aportes = await findContributionIncidents(i.id);
                incidentsMapped.push({
                    id: i.id,
                    estado: Boolean(i.estado),
                    ejecutivo: {
                        id: i.n_ejecutivo_cuenta?.id ?? i.ejecutivo_cuenta,
                        name: i.n_ejecutivo_cuenta?.nombre ?? "",
                    },
                    fecha_incidente: i.fecha_incidente ? new Date(i.fecha_incidente).toISOString() : "",
                    fecha_reporte: i.fecha_reporte ? new Date(i.fecha_reporte).toISOString() : "",
                    nombre_responsable: i.nombre_responsable ?? "",
                    clasificacion: {
                        id: i.n_clasificacion_incidente?.id ?? i.clasificacion,
                        name: i.n_clasificacion_incidente?.nombre ?? "",
                    },
                    descripcion: i.descripcion ?? "",
                    involucrados,
                    fecha_libro_novedades: fechaLibro,
                    nombre_responsable_atencion: i.nombre_responsable_atencion ?? "",
                    solucion: i.solucion ?? "",
                    fecha_solucion: i.fecha_solucion ? new Date(i.fecha_solucion).toISOString() : "",
                    fecha_solucion_real: i.fecha_real_solucion ? new Date(i.fecha_real_solucion).toISOString() : "",
                    costo_asociado: i.costo_asociado ?? "",
                    consecutivo_informe: i.consecutivo_informe ?? "",
                    link_informe: i.link_informe ?? "",
                    files: (i.c_archivos_incidente || []).map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        original_name: f.original_name,
                        type: f.type,
                        extension: f.extension,
                    })),
                    aportes: aportes ?? [],
                    owned: ejecutivo === i.ejecutivo_cuenta ? true : false,
                    id_local: "",
                });
            }
        }

        return NextResponse.json({ status: true, incidents: incidentsMapped }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/incidents:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const body = await req.json();
        const {
            marca_id,
            empleado_id,
            fecha_incidente,
            fecha_reporte,
            nombre_responsable,
            clasificacion_id,
            descripcion,
            involucrados,
            fecha_libro_novedades,
            nombre_responsable_atencion,
            archivos,
            // opcionales (permitimos que vengan aunque el formulario de creación los oculte)
            solucion,
            fecha_solucion,
            fecha_real_solucion,
            costo_asociado,
            consecutivo_informe,
            link_informe,
        } = body ?? {};

        if (
            !marca_id ||
            !empleado_id ||
            !fecha_incidente ||
            !fecha_reporte ||
            !nombre_responsable ||
            !clasificacion_id ||
            !descripcion ||
            !nombre_responsable_atencion
        ) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const invParsed = safeParseJson<any[]>(involucrados, []);
        const fechaLibroParsed = safeParseJson<any>(fecha_libro_novedades, { numero: "", fecha: "" });

        let filesParsed: IncidentFileInput[] = [];
        if (archivos) {
            filesParsed = safeParseJson<IncidentFileInput[]>(archivos, []);
        }

        const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;

        const incident = await prisma.c_incidente.create({
            data: {
                corpo_id: marca.corpo_id,
                ejecutivo_cuenta: parseInt(String(empleado_id)),
                fecha_incidente: new Date(fecha_incidente),
                fecha_reporte: new Date(fecha_reporte),
                nombre_responsable: String(nombre_responsable),
                clasificacion: parseInt(String(clasificacion_id)),
                descripcion: String(descripcion),
                involucrados: JSON.stringify(invParsed ?? []),
                fecha_libro_novedades: JSON.stringify(fechaLibroParsed ?? { numero: "", fecha: "" }),
                nombre_responsable_atencion: String(nombre_responsable_atencion),
                solucion: (typeof solucion === "string" && solucion.trim().length > 0) ? solucion : null,
                fecha_solucion: (typeof fecha_solucion === "string" && fecha_solucion.trim().length > 0) ? new Date(fecha_solucion) : null,
                fecha_real_solucion: (typeof fecha_real_solucion === "string" && fecha_real_solucion.trim().length > 0) ? new Date(fecha_real_solucion) : null,
                costo_asociado: (typeof costo_asociado === "string" && costo_asociado.trim().length > 0) ? costo_asociado : null,
                consecutivo_informe: (typeof consecutivo_informe === "string" && consecutivo_informe.trim().length > 0) ? consecutivo_informe : null,
                link_informe: (typeof link_informe === "string" && link_informe.trim().length > 0) ? link_informe : null,
                cliente_id: marca.cliente_id,
                empresa_id: marca.empresa_id,
                estado: true,
                created_at: createdAt,
                created_by: parseInt(String(payload?.id ?? "0")),
            },
        });

        if (filesParsed.length > 0) {
            const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incident.id}`);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            for (const f of filesParsed) {
                if (!f.file_base64 || !f.extension || !f.type) continue;

                let buffer: Buffer;
                try {
                    buffer = Buffer.from(normalizeBase64(String(f.file_base64)), "base64");
                } catch {
                    console.warn("Formato de archivo inválido, se omite uno de los archivos");
                    continue;
                }

                const ext = String(f.extension).replace(".", "").trim() || "dat";
                const fileName = `${uuidv4()}.${ext}`;
                const filePath = path.join(dir, fileName);
                fs.writeFileSync(filePath, buffer);

                const originalName =
                    (typeof f.original_name === "string" && f.original_name.trim().length > 0)
                        ? f.original_name.trim()
                        : fileName;

                await prisma.c_archivos_incidente.create({
                    data: {
                        name: fileName,
                        original_name: originalName,
                        type: String(f.type),
                        extension: ext,
                        incidente_id: incident.id,
                    },
                });
            }
        }

        const clasificacion = await prisma.n_clasificacion_incidente.findUnique({ where: { id: parseInt(String(clasificacion_id)) } });
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marca.cliente_id } });
        if (clasificacion && sucursal && cliente) {
            const fecha_string = fecha_incidente.split("T")[0];
            const hora_string = fecha_incidente.split("T")[1].split(".")[0];
            const description = `Se ha reportado un incidente de tipo ${clasificacion.nombre} en la sucursal ${sucursal.nombre} de la empresa ${cliente.nombre} el día ${fecha_string} a las ${hora_string}`;
            const supervisors = await prisma.c_empleado.findMany({ where: { supervisor_id: empleado_id } });
            const supervisorIds = supervisors.map(s => s.id);
            sendNotificationByRole(marca.corpo_id, [marca.plaza_id], "Incidente reportado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            sendNotificationByEmployee(marca.corpo_id, [empleado_id], "Incidente reportado", description, supervisorIds);
        }

        return NextResponse.json(
            { status: true, message: "Incidente creado con éxito", incidentId: incident.id },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log("Error in POST /api/incidents:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


