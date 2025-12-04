import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";
import { transporter } from '../../../transporter';

import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../utils/sendNotification";

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
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const lastMarca = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: marca.empleadoFijo_id }, orderBy: { id: "desc" } });
        if (!lastMarca) {
            return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
        }

        if (marca.id !== lastMarca.id) {
            return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
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

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marca.puesto_id } });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrada" }, { status: 200 });
        }

        const empleado_plaza = await prisma.c_empleado_plaza.findFirst({
            where: {
                empleado_id: marca.empleadoFijo_id,
                plaza_id: marca.plaza_id
            }
        });

        if (!empleado_plaza || !empleado_plaza.division_id || !empleado_plaza.empleado_id) {
            return NextResponse.json({ status: false, message: "Empleado o división no encontrada" }, { status: 200 });
        }

        const division = await prisma.n_division.findUnique({ where: { id: empleado_plaza.division_id } });
        if (!division) {
            return NextResponse.json({ status: false, message: "Division no encontrada" }, { status: 200 });
        }

        const responsable = await prisma.c_empleado.findUnique({ where: { id: empleado_plaza.empleado_id } });
        if (!responsable) {
            return NextResponse.json({ status: false, message: "Responsable no encontrada" }, { status: 200 });
        }

        const encuestas = await prisma.c_encuesta_cliente.findMany({ where: { corpo_id: marca.corpo_id, division_id: division.id } });

        const encuestas_return: { id: number, nombre_firma: string, persona_evaluada: string, cedula_persona_evaluada: string, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, sucursal: { id: number, nombre: string }, puesto: { id: number, nombre: string }, division: { id: number, nombre: string }, responsable_id: number, responsable: { nombre: string, cedula: string }, firma_responsable: string, fecha: string, evaluaciones: string }[] = [];
        for (const encuesta of encuestas) {
            let nombre_firma = "No disponible";
            if (encuesta.firma_responsable) {
                const id_firma = atob(encuesta.firma_responsable).split(":")[1];
                const firma = await prisma.c_empleado.findUnique({ where: { id: parseInt(id_firma) } });
                if (firma) {
                    nombre_firma = (firma.nombre || "") + " " + (firma.primer_apellido || "") + " " + (firma.segundo_apellido || "");
                    if (firma.cedula) {
                        nombre_firma += " (" + firma.cedula + ")";
                    }
                }
            }
            const encuesta_return: { id: number, nombre_firma: string, empresa_evaluada: string, persona_evaluada: string, cedula_persona_evaluada: string, telefono_persona_evaluada: string, email_persona_evaluada: string, firma_persona_evaluada: string, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, sucursal: { id: number, nombre: string }, puesto: { id: number, nombre: string }, division: { id: number, nombre: string }, responsable_id: number, responsable: { nombre: string, cedula: string }, firma_responsable: string, fecha: string, evaluaciones: string, observations: string } = {
                id: encuesta.id,
                empresa_evaluada: encuesta.empresa_evaluado || "",
                persona_evaluada: encuesta.nombre_evaluado || "",
                cedula_persona_evaluada: encuesta.cedula_evaluado || "",
                telefono_persona_evaluada: encuesta.telefono_evaluado || "",
                email_persona_evaluada: encuesta.email_evaluado || "",
                firma_persona_evaluada: encuesta.firma_evaluado || "",
                empresa: {
                    id: empresa.id,
                    nombre: empresa.nombre
                },
                cliente: {
                    id: cliente.id,
                    nombre: cliente.nombre
                },
                sucursal: {
                    id: corpo.id,
                    nombre: corpo.nombre
                },
                puesto: {
                    id: puesto.id,
                    nombre: puesto.nombre
                },
                division: {
                    id: division.id,
                    nombre: division.nombre
                },
                responsable_id: encuesta.responsable_id,
                responsable: {
                    nombre: encuesta.nombre_responsable,
                    cedula: encuesta.cedula_responsable || ""
                },
                firma_responsable: encuesta.firma_responsable || "",
                nombre_firma: nombre_firma,
                fecha: encuesta.fecha.toISOString(),
                evaluaciones: encuesta.evaluaciones,
                observations: encuesta.observaciones
            };
            encuestas_return.push(encuesta_return);
        }

        return NextResponse.json({ status: true, encuestas: encuestas_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
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
            puesto_id,
            fecha,
            evaluaciones,
            persona_evaluada,
            cedula_persona_evaluada,
            telefono_persona_evaluada,
            email_persona_evaluada,
            nombre_responsable,
            cedula_responsable,
            firma_responsable,
            firma_persona_evaluada,
            empresa_evaluada,
            observaciones
        } = await req.json();

        console.log("marca_id", marca_id);
        console.log("puesto_id", puesto_id);
        console.log("fecha", fecha);
        console.log("evaluaciones", evaluaciones);
        console.log("persona_evaluada", persona_evaluada);
        console.log("cedula_persona_evaluada", cedula_persona_evaluada);
        console.log("telefono_persona_evaluada", telefono_persona_evaluada);
        console.log("email_persona_evaluada", email_persona_evaluada);
        console.log("nombre_responsable", nombre_responsable);
        console.log("cedula_responsable", cedula_responsable);
        console.log("firma_responsable", firma_responsable);
        console.log("firma_persona_evaluada", firma_persona_evaluada);
        console.log("empresa_evaluada", empresa_evaluada);
        console.log("observaciones", observaciones);
        console.log("--------------------------------");

        if (!marca_id || !empresa_evaluada || !puesto_id || !fecha || !evaluaciones || !persona_evaluada || !cedula_persona_evaluada || !nombre_responsable || !cedula_responsable || !firma_responsable || !firma_persona_evaluada || !observaciones) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marca.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: marca.empleadoFijo_id! } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marca.empresa_id } });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marca.cliente_id } });
        if (!cliente) {
            return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
        }

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
        }

        const puesto_db = await prisma.e_estructura_puesto.findUnique({ where: { id: puesto_id } });
        if (!puesto_db) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const empleado_plaza = await prisma.c_empleado_plaza.findFirst({
            where: {
                empleado_id: empleado.id,
                plaza_id: marca.plaza_id
            }
        });

        if (!empleado_plaza || !empleado_plaza.division_id) {
            return NextResponse.json({ status: false, message: "División no encontrada" }, { status: 200 });
        }

        const division = await prisma.n_division.findUnique({ where: { id: empleado_plaza.division_id } });
        if (!division) {
            return NextResponse.json({ status: false, message: "Division no encontrada" }, { status: 200 });
        }

        const responsable = await prisma.c_empleado.findUnique({ where: { id: marca.empleadoFijo_id } });
        if (!responsable) {
            return NextResponse.json({ status: false, message: "Responsable no encontrada" }, { status: 200 });
        }

        const encuesta = await prisma.c_encuesta_cliente.create({
            data: {
                empresa_id: empresa.id,
                cliente_id: cliente.id,
                corpo_id: corpo.id,
                puesto_id: puesto_db.id,
                division_id: division.id,
                responsable_id: responsable.id,
                empresa_evaluado: empresa_evaluada,
                firma_responsable: firma_responsable,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                fecha: new Date(fecha),
                evaluaciones: evaluaciones,
                nombre_evaluado: persona_evaluada,
                cedula_evaluado: cedula_persona_evaluada,
                telefono_evaluado: telefono_persona_evaluada,
                email_evaluado: email_persona_evaluada,
                firma_evaluado: firma_persona_evaluada,
                nombre_responsable: nombre_responsable,
                cedula_responsable: cedula_responsable,
                observaciones: observaciones
            }
        });

        if (encuesta) {
            const evaluaciones_json = JSON.parse(evaluaciones);
            let evaluaciones_html = "";
            for (const item of evaluaciones_json) {
                evaluaciones_html += `<p>${item.question}: ${item.result}</p><br>`;
            }

            await transporter.sendMail({
                from: `Encuesta NPS - <${process.env.EMAIL_USER}>`,
                to: email_persona_evaluada,
                subject: "Encuesta de satisfacción del puesto " + puesto_db.nombre,
                html: `
                    <h1>Buenos días, estimado(a) ${persona_evaluada} (${cedula_persona_evaluada}) de la organización ${empresa_evaluada}</h1>
                    <p>Gracias por tu tiempo y esfuerzo en completar la encuesta de satisfacción del puesto ${puesto_db.nombre}.</p>
                    <p>A continuación, te mostramos un resumen de la encuesta:</p><br>
                    ${evaluaciones_html}
                    <p>Gracias por tu colaboración.</p>
                `
            });

            const fecha_encuesta_string = fecha.toISOString().split('T')[0];
            const hora_encuesta_string = fecha.toISOString().split('T')[1].split('.')[0];
            const desc_notification = `La encuesta de satisfacción del puesto "${puesto_db.nombre}" realizada el día ${fecha_encuesta_string} a las ${hora_encuesta_string} por parte de "${persona_evaluada}" (${cedula_persona_evaluada}) de la empresa "${empresa_evaluada}" ha sido agregada. Se ha enviado un correo de confirmación a ${email_persona_evaluada}.`;
            await sendNotificationByRole(marca_id, "Encuesta de satisfacción agregada", desc_notification, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        return NextResponse.json({ status: true, message: "Encuesta creada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}