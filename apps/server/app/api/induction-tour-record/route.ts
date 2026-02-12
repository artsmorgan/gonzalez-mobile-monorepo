import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
        const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
        const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
        const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
        const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");
        const plazaIdStr = req.nextUrl.searchParams.get("plaza_id");

        const where: any = {};

        // Si hay filtros jerárquicos, usarlos (prioridad: plaza > puesto > corpo > contrato > cliente > empresa)
        if (plazaIdStr) {
            where.plaza_id = parseInt(plazaIdStr);
        } else if (puestoIdStr) {
            where.puesto_id = parseInt(puestoIdStr);
        } else if (corpoIdStr) {
            where.corpo_id = parseInt(corpoIdStr);
        } else if (contratoIdStr) {
            where.contrato_id = parseInt(contratoIdStr);
        } else if (clienteIdStr) {
            // Si hay cliente pero no contrato, buscar todos los contratos del cliente
            const clienteId = parseInt(clienteIdStr);
            const contratos = await prisma.e_estructura_contrato.findMany({
                where: {
                    cliente_id: clienteId,
                    deleted: null,
                },
                select: { id: true },
            });
            const contratoIds = contratos.map((c) => c.id);
            if (contratoIds.length > 0) {
                where.contrato_id = { in: contratoIds };
            } else {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
        } else if (empresaIdStr) {
            // Si hay empresa pero no cliente, buscar todos los clientes de la empresa
            const empresaId = parseInt(empresaIdStr);
            const clientes = await prisma.e_estructura_cliente.findMany({
                where: { empresa_id: empresaId },
                select: { id: true },
            });
            const clienteIds = clientes.map((c) => c.id);
            if (clienteIds.length > 0) {
                // Obtener todos los contratos de estos clientes
                const contratos = await prisma.e_estructura_contrato.findMany({
                    where: {
                        cliente_id: { in: clienteIds },
                        deleted: null,
                    },
                    select: { id: true },
                });
                const contratoIds = contratos.map((c) => c.id);
                if (contratoIds.length > 0) {
                    where.contrato_id = { in: contratoIds };
                } else {
                    return NextResponse.json({ status: true, data: [] }, { status: 200 });
                }
            } else {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
        } else {
            return NextResponse.json({ status: false, message: "Debe especificar filtros jerárquicos" }, { status: 400 });
        }

        const records = await prisma.c_registro_induccion_recorrido.findMany({
            where,
            orderBy: {
                created_at: 'desc'
            }
        });

        const recordsWithIdLocal = records.map(record => ({
            ...record,
            id_local: ""
        }));

        return NextResponse.json({
            status: true,
            message: "Registros de inducción y recorrido obtenidos correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
    }
}

function parseFechaInput(fecha: any): Date | undefined {
    if (!fecha) return undefined;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
        // dd/mm/yyyy (legacy mobile) OR ISO (yyyy-mm-dd / full ISO)
        if (fecha.includes('/')) {
            const parts = fecha.split('/');
            if (parts.length === 3) {
                const [dd, mm, yyyy] = parts;
                const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                if (!Number.isNaN(d.getTime())) return d;
            }
        }
        const d = new Date(fecha);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return undefined;
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            fecha,
            division,
            renglon_edificio,
            supervisor_cliente,
            supervisor_corporacion,
            temas_desarrollados,
            aspectos_especificos,
            participantes,
            firma_supervisor,
            firma_responsable
        } = await req.json();

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaIdNum = parseInt(String(marca_id), 10);
        if (Number.isNaN(marcaIdNum)) {
            return NextResponse.json({ status: false, message: "Marca inválida" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaIdNum } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const empresaId = Number(marcaDia.empresa_id);
        const clienteId = Number(marcaDia.cliente_id);
        const contratoId = Number(marcaDia.contrato_id);
        const corpoId = Number(marcaDia.corpo_id);
        const puestoId = Number(marcaDia.puesto_id);
        const plazaId = Number(marcaDia.plaza_id);

        if (
            [empresaId, clienteId, contratoId, corpoId, puestoId, plazaId].some((n) => Number.isNaN(n) || n === 0)
        ) {
            return NextResponse.json({ status: false, message: "No se pudieron derivar los IDs de la marca" }, { status: 400 });
        }

        const fechaParsed = parseFechaInput(fecha);

        // Autocompletar campos desde la marca
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdBy = payload.id !== undefined && payload.id !== null ? Number(payload.id) : 0;

        const new_record = await prisma.c_registro_induccion_recorrido.create({
            data: {
                empresa_id: empresaId,
                cliente_id: clienteId,
                contrato_id: contratoId,
                corpo_id: corpoId,
                puesto_id: puestoId,
                plaza_id: plazaId,
                ...(fechaParsed ? { fecha: fechaParsed } : {}),
                division: (division && String(division).trim()) ? String(division).trim() : "Otros",
                renglon_edificio: renglon_edificio ? String(renglon_edificio) : "",
                supervisor_cliente: supervisor_cliente !== undefined && supervisor_cliente !== null ? String(supervisor_cliente) : null,
                supervisor_corporacion: supervisor_corporacion ? String(supervisor_corporacion) : "",
                temas_desarrollados: temas_desarrollados ? String(temas_desarrollados) : "[]",
                aspectos_especificos: aspectos_especificos ? String(aspectos_especificos) : "[]",
                participantes: participantes ? String(participantes) : "[]",
                firma_supervisor: firma_supervisor ? String(firma_supervisor) : "",
                firma_responsable: firma_responsable ? String(firma_responsable) : "",
                created_at: createdAt,
                created_by: createdBy.toString()
            }
        });

        // Registrar cambio de creación
        await prisma.c_cambios_apps_modules.create({
            data: {
                nombre_tabla: "c_registro_induccion_recorrido",
                registro_id: new_record.id,
                cambios: JSON.stringify([{
                    prop: "__created__",
                    before: null,
                    after: {
                        id: new_record.id,
                        empresa_id: new_record.empresa_id,
                        cliente_id: new_record.cliente_id,
                        contrato_id: new_record.contrato_id,
                        corpo_id: new_record.corpo_id,
                        puesto_id: new_record.puesto_id,
                        plaza_id: new_record.plaza_id,
                        fecha: new_record.fecha ? new_record.fecha.toISOString() : null,
                        division: new_record.division,
                        renglon_edificio: new_record.renglon_edificio,
                        supervisor_cliente: new_record.supervisor_cliente,
                        supervisor_corporacion: new_record.supervisor_corporacion,
                        temas_desarrollados: new_record.temas_desarrollados,
                        aspectos_especificos: new_record.aspectos_especificos,
                        participantes: new_record.participantes,
                    },
                }]),
                created_at: createdAt,
                created_by: createdBy,
            },
        });

        if (new_record) {
            let empNombre = "Desconocido";
            if (new_record.created_by) {
                const empleado = await prisma.c_empleado.findUnique({ where: { id: Number(new_record.created_by) } });
                if (empleado) {
                    empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                }
            }
            let sucursalNombre = "Desconocida";
            if (new_record.corpo_id) {
                const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: new_record.corpo_id } });
                if (sucursal) {
                    sucursalNombre = sucursal.nombre + " (" + sucursal.nro_sucursal + ")";
                }
            }
            let clienteNombre = "Desconocido";
            if (new_record.cliente_id) {
                const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: new_record.cliente_id } });
                if (cliente) {
                    clienteNombre = cliente.nombre;
                }
            }
            let plazaNombre = "Desconocida";
            if (new_record.plaza_id) {
                const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: new_record.plaza_id } });
                if (plaza) {
                    plazaNombre = plaza.nombre + " (" + plaza.codigo_plaza + ")";
                }
            }
            let fechaRegistro = new_record.created_at.toISOString().split("T")[0];
            let horaRegistro = new_record.created_at.toISOString().split("T")[1].split(".")[0];
            const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de inducción y recorrido misceláneo en la sucursal " + sucursalNombre + " para el cliente " + clienteNombre + " en la plaza " + plazaNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
            sendNotificationByRole(new_record.corpo_id, [Number(new_record.created_by)], "Registro de inducción y recorrido misceláneo creado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                fecha: new_record.fecha,
                renglon_edificio: new_record.renglon_edificio,
                supervisor_cliente: new_record.supervisor_cliente,
                supervisor_corporacion: new_record.supervisor_corporacion,
                temas_desarrollados: new_record.temas_desarrollados,
                aspectos_especificos: new_record.aspectos_especificos,
                participantes: new_record.participantes,
                firma_supervisor: new_record.firma_supervisor,
                division: new_record.division,
                firma_responsable: new_record.firma_responsable,
                created_at: new_record.created_at,
                created_by: new_record.created_by,
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

