import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { sendNotificationByRole, sendNotificationByPlaza } from "../../../utils/sendNotification";

import { prisma } from "../../../utils/prismaClient";
import { getUserMarca } from "../../../utils/getUserMarca";

export async function GET(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const marcaId = req.nextUrl.searchParams.get("m");
        if (!marcaId) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaId) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marca.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const lastMarca = await getUserMarca(marca.empleadoFijo_id);
        if (!lastMarca) {
            return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
        }

        if (marca.id !== lastMarca.id) {
            return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
        }


        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marca.puesto_id } });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const voiceNotes = await prisma.c_notas_voz.findMany({
            where: {
                OR: [
                    { corpo_id: corpo.id, puesto_id: puesto.id },
                    { corpo_id: marca.corpo_id, puesto_id: null }
                ]
            }
        });

        const voiceNotes_return: { id: number, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, corpo: { id: number, nombre: string }, puesto: { id: number, nombre: string } | null, titulo: string, descripcion: string, transcripcion: string, firma_responsable: string, nombre_firma: string, nombre_creator: string, id_local: string, file_base64: string, created_by: number, created_at: string }[] = [];
        for (const voiceNote of voiceNotes) {

            const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: voiceNote.empresa_id } });
            if (!empresa) {
                continue;
            }

            const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: voiceNote.cliente_id } });
            if (!cliente) {
                continue;
            }

            let nombre_creator = "-";
            const creator = await prisma.c_empleado.findUnique({ where: { id: voiceNote.created_by } });
            if (creator) {
                nombre_creator = creator.nombre + " " + creator.primer_apellido + " " + creator.segundo_apellido;
                if (creator.cedula) {
                    nombre_creator += " (" + creator.cedula + ")";
                }
            }

            let nombre_firma = "No disponible";
            if (voiceNote.firma_responsable) {
                const id_firma = atob(voiceNote.firma_responsable).split(":")[1];
                const firma = await prisma.c_empleado.findUnique({ where: { id: parseInt(id_firma) } });
                if (firma) {
                    nombre_firma = firma.nombre + " " + firma.primer_apellido + " " + firma.segundo_apellido;
                    if (firma.cedula) {
                        nombre_firma += " (" + firma.cedula + ")";
                    }
                }
            }

            voiceNotes_return.push({
                id: voiceNote.id,
                empresa: {
                    id: empresa.id,
                    nombre: empresa.nombre
                },
                cliente: {
                    id: cliente.id,
                    nombre: cliente.nombre
                },
                corpo: {
                    id: corpo.id,
                    nombre: corpo.nombre
                },
                puesto: voiceNote.puesto_id ? {
                    id: voiceNote.puesto_id,
                    nombre: puesto.nombre
                } : null,
                titulo: voiceNote.titulo,
                descripcion: voiceNote.descripcion,
                transcripcion: voiceNote.transcripcion,
                firma_responsable: voiceNote.firma_responsable,
                nombre_firma: nombre_firma,
                nombre_creator: nombre_creator,
                id_local: "",
                file_base64: "",
                created_by: voiceNote.created_by,
                created_at: voiceNote.created_at.toISOString()
            });
        }

        return NextResponse.json({ status: true, voiceNotes: voiceNotes_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { marca_id, setPuesto, titulo, descripcion, firma_responsable, file_base64, created_at } = await req.json();

        if (!marca_id || !titulo || !descripcion || !firma_responsable || !file_base64 || !created_at) {
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

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrada" }, { status: 200 });
        }

        if (setPuesto) {
            const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marca.puesto_id } });
            if (!puesto) {
                return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
            }
        }

        const newVoiceNote = await prisma.c_notas_voz.create({
            data: {
                empresa_id: empresa.id,
                cliente_id: cliente.id,
                corpo_id: corpo.id,
                puesto_id: setPuesto ? marca.puesto_id : null,
                titulo,
                descripcion,
                path: "-",
                transcripcion: '-',
                firma_responsable,
                created_by: payload.id,
                created_at: new Date(created_at)
            }
        });

        if (newVoiceNote) {
            if (!/^[A-Za-z0-9+/=]+$/.test(file_base64)) {
                return NextResponse.json({ status: false, message: "Formato de archivo inválido" }, { status: 400 });
            }

            const extension = file_base64.startsWith('UklGR') ? 'wav' : 'm4a'; // detección básica
            const path_file = `${uuidv4()}.${extension}`;

            const dir = path.join(process.cwd(), 'public', 'uploads', 'voice-notes', `${newVoiceNote.id}`);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Convierte el base64 en buffer binario
            const buffer = Buffer.from(file_base64, 'base64');

            // Guarda el archivo
            const filePath = path.join(dir, path_file);
            fs.writeFileSync(filePath, buffer);

            await prisma.c_notas_voz.update({ where: { id: newVoiceNote.id }, data: { path: path_file } });

            const empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });
            if (empleado) {
                const fecha = created_at.toISOString().split("T")[0];
                const hora = created_at.toISOString().split("T")[1].split(".")[0];
                const desc = `El usuario ${empleado.nombre} ${empleado.primer_apellido} ha creado una nueva nota de voz llamada ${titulo} el día ${fecha} a las ${hora}`;
                if (!setPuesto) {
                    await sendNotificationByRole(marca.id, "Nota de voz creada", desc, ["ADMINISTRATIVO", "SUPERVISOR", "OPERATIVO"]);
                } else {
                    const plaza = await prisma.e_estructura_plazas.findMany({ where: { puesto_id: marca.puesto_id } });
                    if (plaza.length > 0) {
                        await sendNotificationByPlaza(marca.id, "Nota de voz creada", desc, plaza.map(p => p.id));
                    }
                }
            }
        }

        return NextResponse.json({ status: true, message: "Nota de voz creada con éxito" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}