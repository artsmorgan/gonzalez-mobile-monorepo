import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByEmployee, sendNotificationByRole } from "../../../utils/sendNotification";
import { getUserMarca } from "../../../utils/getUserMarca";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

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

        const lastMarca = await getUserMarca(marca.empleadoFijo_id);
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

        const capacitaciones = await prisma.e_registro_capacitaciones.findMany({ where: { corpo_id: marca.corpo_id } });

        const capacitaciones_return: {
            id: number,
            empresa: { id: number, nombre: string },
            cliente: { id: number, nombre: string },
            sucursal: { id: number, nombre: string },
            titulo: string,
            descripcion: string,
            tipo: string,
            resultado: string,
            observaciones: string,
            responsable: { nombre: string, cedula: string },
            firma_responsable: string,
            nombre_firma: string,
            fecha: string,
            base64_file: string,
            empleados: { id: number, nombre: string, cedula: string }[],
            puestos: { id: number, nombre: string }[],
            id_local: string,
        }[] = [];

        for (const capacitacion of capacitaciones) {
            // Desconvertir de base64 a string
            const id_firma = atob(capacitacion.firma_responsable).split(":")[1];
            const firma = await prisma.c_empleado.findUnique({ where: { id: parseInt(id_firma) } });
            let nombre_firma = "No disponible";
            if (firma) {
                nombre_firma = (firma.nombre || "") + " " + (firma.primer_apellido || "") + " " + (firma.segundo_apellido || "");
                if (firma.cedula) {
                    nombre_firma += " (" + firma.cedula + ")";
                }
            }

            const empleados = await prisma.e_capacitacion_empleado.findMany({ where: { capacitacion_id: capacitacion.id } });
            const all_empleados: { id: number, nombre: string, cedula: string }[] = [];
            for (const empleado of empleados) {
                const empleado_data = await prisma.c_empleado.findUnique({ where: { id: empleado.empleado_id } });
                if (empleado_data) {
                    all_empleados.push({
                        id: empleado.empleado_id,
                        nombre: (empleado_data.nombre || "") + " " + (empleado_data.primer_apellido || "") + " " + (empleado_data.segundo_apellido || ""),
                        cedula: empleado_data.cedula
                    });
                }
            }

            const puestos = await prisma.e_capacitacion_puesto.findMany({ where: { capacitacion_id: capacitacion.id } });
            const all_puestos: { id: number, nombre: string }[] = [];
            for (const puesto of puestos) {
                const puesto_data = await prisma.e_estructura_puesto.findUnique({ where: { id: puesto.puesto_id } });
                if (puesto_data) {
                    all_puestos.push({
                        id: puesto.puesto_id,
                        nombre: puesto_data.nombre
                    });
                }
            }

            capacitaciones_return.push({
                id: capacitacion.id,
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
                titulo: capacitacion.titulo,
                descripcion: capacitacion.descripcion,
                tipo: capacitacion.tipo,
                resultado: capacitacion.resultado || "No disponible",
                observaciones: capacitacion.observaciones,
                responsable: {
                    nombre: capacitacion.nombre_responsable,
                    cedula: capacitacion.cedula_responsable
                },
                firma_responsable: capacitacion.firma_responsable,
                nombre_firma: nombre_firma,
                fecha: capacitacion.fecha.toISOString(),
                base64_file: "",
                empleados: all_empleados,
                puestos: all_puestos,
                id_local: ""
            });
        }

        return NextResponse.json({ status: true, capacitaciones: capacitaciones_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            titulo,
            descripcion,
            tipo,
            resultado, // Opcional
            observaciones,
            nombre_responsable,
            cedula_responsable,
            firma_responsable,
            file, // Opcional
            fecha,
            empleados,
            puestos
        } = await req.json();

        console.log("marca_id", marca_id);
        console.log("titulo", titulo);
        console.log("descripcion", descripcion);
        console.log("tipo", tipo);
        //console.log("resultado", resultado);
        console.log("observaciones", observaciones);
        console.log("nombre_responsable", nombre_responsable);
        console.log("cedula_responsable", cedula_responsable);
        console.log("firma_responsable", firma_responsable);
        console.log("file", file);
        console.log("fecha", fecha);
        console.log("empleados", empleados);
        console.log("puestos", puestos);
        console.log("--------------------------------");

        if (!marca_id ||
            !titulo ||
            !descripcion ||
            !tipo ||
            !observaciones ||
            !nombre_responsable ||
            !cedula_responsable ||
            !firma_responsable ||
            !fecha ||
            !empleados ||
            !puestos) {
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

        const new_capacitacion = await prisma.e_registro_capacitaciones.create({
            data: {
                empresa_id: empresa.id,
                cliente_id: cliente.id,
                corpo_id: corpo.id,
                titulo: titulo,
                descripcion: descripcion,
                tipo: tipo,
                resultado: resultado,
                observaciones: observaciones,
                nombre_responsable: nombre_responsable,
                cedula_responsable: cedula_responsable,
                firma_responsable: firma_responsable,
                file: "-",
                fecha: new Date(fecha),
                responsable_id: payload.id
            }
        });

        const date = new_capacitacion.fecha.toISOString().split("T")[0];
        const hour = new_capacitacion.fecha.toISOString().split("T")[1].split(".")[0];

        for (const emp of empleados) {
            const empleado_data = await prisma.c_empleado.findUnique({ where: { id: parseInt(emp) } });
            if (!empleado_data) {
                continue;
            }
            await prisma.e_capacitacion_empleado.create({
                data: {
                    capacitacion_id: new_capacitacion.id,
                    empleado_id: parseInt(emp)
                }
            });

            const desc = `Has recibido la capacitación ${new_capacitacion.titulo} en la sucursal ${corpo.nombre} de ${cliente.nombre} el día ${date} a las ${hour}`;
            await sendNotificationByEmployee(marca.corpo_id, [marca.empleadoFijo_id], "Capacitación recibida", desc, [parseInt(emp)]);
        }

        for (const puesto of puestos) {
            const puesto_data = await prisma.e_estructura_puesto.findUnique({ where: { id: parseInt(puesto) } });
            if (!puesto_data) {
                continue;
            }
            await prisma.e_capacitacion_puesto.create({
                data: {
                    capacitacion_id: new_capacitacion.id,
                    puesto_id: parseInt(puesto)
                }
            });
        }

        if (new_capacitacion && file) {
            const matches = file.match(/^data:(.+);base64,(.+)$/);
            if (!matches) {
                throw new Error("Formato base64 inválido");
            }

            const mimeType = matches[1];
            const base64Data = matches[2];
            const extension = mimeType.split("/")[1]; // ej. 'jpeg' o 'png'

            const file_name = `${uuidv4()}.${extension}`;

            const dir = path.join(process.cwd(), "public", "uploads", "training", `${new_capacitacion.id}`);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const filePath = path.join(dir, file_name);

            // Escribir el archivo en binario
            fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

            // Actualizar el file_name en la base de datos
            const updated_capacitacion = await prisma.e_registro_capacitaciones.update({ where: { id: new_capacitacion.id }, data: { file: file_name } });
        }

        await sendNotificationByRole(marca.corpo_id, [marca.plaza_id], "Capacitación creada", `Se ha registrado la capacitación ${new_capacitacion.titulo} en la sucursal ${corpo.nombre} de ${cliente.nombre} el día ${date} a las ${hour}`, ["ADMINISTRATIVO", "SUPERVISOR"]);

        return NextResponse.json({ status: true, message: "Capacitación creada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}