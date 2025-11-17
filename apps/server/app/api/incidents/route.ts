import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const searchParams = req.nextUrl.searchParams;
        const marca_id = searchParams.get("m");
        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const lastMarca = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: marca.empleadoFijo_id }, orderBy: { id: "desc" } });
        if (!lastMarca) {
            return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
        }

        if (marca.id !== lastMarca.id) {
            return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: marca.empleadoFijo_id ?? 0 } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const incidents = await prisma.c_incidente.findMany({ where: { corpo_id: marca.corpo_id } });

        let ejecutivo = null;
        if (empleado.supervisor_id) {
            ejecutivo = await prisma.n_ejecutivo_cuenta.findUnique({ where: { id: empleado.supervisor_id } });
            if (ejecutivo) {
                const incident_ejecutivo = await prisma.c_incidente.findMany({ where: { ejecutivo_cuenta: ejecutivo.id, estado: false } });
                if (incident_ejecutivo.length > 0) {
                    for (const incident of incident_ejecutivo) {
                        // Determinar si el registro del incidente ya existe en el array incidents
                        const incident_exist = incidents.find((i) => i.id === incident.id);
                        if (!incident_exist) {
                            incidents.push(incident);
                        }
                    }
                }
            }
        }

        let incidents_return = [];
        for (const incident of incidents) {
            let classInfo = { id: 0, name: "Desconocida" };
            const clasificacion = await prisma.n_clasificacion_incidente.findUnique({ where: { id: incident.clasificacion } });
            if (clasificacion) {
                classInfo = {
                    id: clasificacion.id,
                    name: clasificacion.nombre,
                };
            }
            let ejecutivoInfo = { id: 0, name: "Desconocido" };
            const ejecutivo_cuenta = await prisma.n_ejecutivo_cuenta.findUnique({ where: { id: incident.ejecutivo_cuenta } });
            if (ejecutivo_cuenta) {
                ejecutivoInfo = {
                    id: ejecutivo_cuenta.id,
                    name: ejecutivo_cuenta.nombre,
                };
            }

            let pertenece = false;
            if (empleado.supervisor_id === ejecutivoInfo.id) {
                pertenece = true;
            }
            incidents_return.push({
                id: incident.id,
                estado: incident.estado,
                ejecutivo: ejecutivoInfo,
                fecha_incidente: incident.fecha_incidente.toISOString(),
                fecha_reporte: incident.fecha_reporte.toISOString(),
                nombre_responsable: incident.nombre_responsable,
                clasificacion: classInfo,
                descripcion: incident.descripcion,
                involucrados: incident.involucrados,
                fecha_libro_novedades: incident.fecha_libro_novedades,
                nombre_responsable_atencion: incident.nombre_responsable_atencion,
                solucion: incident.solucion ? incident.solucion : "",
                fecha_solucion: incident.fecha_solucion ? incident.fecha_solucion.toISOString() : "",
                fecha_real_solucion: incident.fecha_real_solucion ? incident.fecha_real_solucion.toISOString() : "",
                costo_asociado: incident.costo_asociado ? incident.costo_asociado : "",
                consecutivo_informe: incident.consecutivo_informe ? incident.consecutivo_informe : "",
                link_informe: incident.link_informe ? incident.link_informe : "",
                id_local: "",
                base64_image: "",
                base64_audio: "",
                owned: pertenece
            });
        }

        if (ejecutivo) {
            const ordenado = incidents_return.sort((a, b) => {
                if (a.ejecutivo.id === ejecutivo.id) return -1; // a va antes si su id es el prioritario
                if (b.ejecutivo.id === ejecutivo.id) return 1;  // b va antes si su id es el prioritario
                return 0; // mantiene el orden relativo del resto
            });
            incidents_return = ordenado;
        }

        return NextResponse.json({ status: true, incidents: incidents_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message: message }, { status: 401 });
        }

        const {
            marca_id,
            ejecutivo_cuenta,
            fecha_incidente,
            fecha_reporte,
            nombre_responsable,
            clasificacion_id,
            descripcion,
            involucrados,
            fecha_libro_novedades,
            nombre_responsable_atencion,
            file_image,
            file_audio
        } = await req.json();

        console.log(marca_id, ejecutivo_cuenta, fecha_incidente, fecha_reporte, nombre_responsable, clasificacion_id, descripcion, involucrados, fecha_libro_novedades, nombre_responsable_atencion, file_image, file_audio);

        if (!marca_id || !ejecutivo_cuenta || !fecha_incidente || !fecha_reporte || !nombre_responsable || !clasificacion_id || !descripcion || !involucrados || !fecha_libro_novedades || !nombre_responsable_atencion) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marca.empresa_id } });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marca.cliente_id } });
        if (!cliente) {
            return NextResponse.json({ status: false, message: "Cliente no encontrada" }, { status: 200 });
        }

        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        if (!sucursal) {
            return NextResponse.json({ status: false, message: "Sucursal no encontrada" }, { status: 200 });
        }

        const ejecutivo = await prisma.n_ejecutivo_cuenta.findUnique({ where: { id: ejecutivo_cuenta } });
        if (!ejecutivo) {
            return NextResponse.json({ status: false, message: "Ejecutivo no encontrado" }, { status: 200 });
        }

        const clasificacion = await prisma.n_clasificacion_incidente.findUnique({ where: { id: clasificacion_id } });
        if (!clasificacion) {
            return NextResponse.json({ status: false, message: "Clasificación no encontrada" }, { status: 200 });
        }

        const incident = await prisma.c_incidente.create({
            data: {
                empresa_id: empresa.id,
                cliente_id: cliente.id,
                corpo_id: sucursal.id,
                ejecutivo_cuenta: ejecutivo.id,
                fecha_incidente: new Date(fecha_incidente),
                fecha_reporte: new Date(fecha_reporte),
                nombre_responsable: nombre_responsable,
                clasificacion: clasificacion.id,
                descripcion: descripcion,
                involucrados: involucrados,
                fecha_libro_novedades: fecha_libro_novedades,
                nombre_responsable_atencion: nombre_responsable_atencion,
                estado: false,
            }
        });

        if (incident) {
            if (file_image) {
                const matches = file_image.match(/^data:(.+);base64,(.+)$/);
                if (!matches) {
                    throw new Error("Formato base64 inválido");
                }

                const mimeType = matches[1];
                const base64Data = matches[2];
                const extension = mimeType.split("/")[1]; // ej. 'jpeg' o 'png'

                const file_name = `${uuidv4()}.${extension}`;

                const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incident.id}`, "images");
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const filePath = path.join(dir, file_name);

                // Escribir el archivo en binario
                fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

                // Actualizar el file_name en la base de datos
                const updatedVehicle = await prisma.c_incidente.update({ where: { id: incident.id }, data: { file_image: file_name } });
            }
            if (file_audio) {
                if (!/^[A-Za-z0-9+/=]+$/.test(file_audio)) {
                    return NextResponse.json({ status: false, message: "Formato de archivo inválido" }, { status: 400 });
                }

                const extension = file_audio.startsWith('UklGR') ? 'wav' : 'm4a'; // detección básica
                const path_file = `${uuidv4()}.${extension}`;

                const dir = path.join(process.cwd(), 'public', 'uploads', 'incidents', `${incident.id}`, "audios"); // 👈 necesario para usar fs
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // Convierte el base64 en buffer binario
                const buffer = Buffer.from(file_audio, 'base64');

                // Guarda el archivo
                const filePath = path.join(dir, path_file);
                fs.writeFileSync(filePath, buffer);

                await prisma.c_incidente.update({ where: { id: incident.id }, data: { file_audio: path_file } });
            }
        }

        return NextResponse.json({ status: true, message: "Incidente creado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}