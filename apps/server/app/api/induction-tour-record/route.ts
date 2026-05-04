import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
        const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
        const divisionIdStr = req.nextUrl.searchParams.get("division_id");
        const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
        const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
        const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");
        const plazaIdStr = req.nextUrl.searchParams.get("plaza_id");

        const where: any = { isActive: true };

        // Si hay filtros jerárquicos, usarlos (prioridad: plaza > puesto > corpo > contrato > division > cliente > empresa)
        if (plazaIdStr) {
            where.plaza_id = parseInt(plazaIdStr);
        } else if (puestoIdStr) {
            where.puesto_id = parseInt(puestoIdStr);
        } else if (corpoIdStr) {
            where.corpo_id = parseInt(corpoIdStr);
        } else if (contratoIdStr) {
            where.contrato_id = parseInt(contratoIdStr);
        } else if (divisionIdStr) {
            where.division_id = parseInt(divisionIdStr);
        } else if (clienteIdStr) {
            // Si hay cliente pero no contrato, buscar todos los contratos del cliente
            const clienteId = parseInt(clienteIdStr);
            const contratos = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_contrato",
                    operation: "findMany",
                    where: {
                        cliente_id: clienteId,
                        deleted: null,
                    },
                    select: { id: true },
                },
            });
            const contratosArray = Array.isArray(contratos) ? contratos : [];
            const contratoIds = contratosArray.map((c: any) => c.id);
            if (contratoIds.length > 0) {
                where.contrato_id = { in: contratoIds };
            } else {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
        } else if (empresaIdStr) {
            // Si hay empresa pero no cliente, buscar todos los clientes de la empresa
            const empresaId = parseInt(empresaIdStr);
            const clientes = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_cliente",
                    operation: "findMany",
                    where: { empresa_id: empresaId },
                    select: { id: true },
                },
            });
            const clientesArray = Array.isArray(clientes) ? clientes : [];
            const clienteIds = clientesArray.map((c: any) => c.id);
            if (clienteIds.length > 0) {
                // Obtener todos los contratos de estos clientes
                const contratos = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_contrato",
                        operation: "findMany",
                        where: {
                            cliente_id: { in: clienteIds },
                            deleted: null,
                        },
                        select: { id: true },
                    },
                });
                const contratosArray2 = Array.isArray(contratos) ? contratos : [];
                const contratoIds = contratosArray2.map((c: any) => c.id);
                if (contratoIds.length > 0) {
                    where.contrato_id = { in: contratoIds };
                } else {
                    return NextResponse.json({ status: true, data: [] }, { status: 200 });
                }
            } else {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
        } else {
            return NextResponse.json({ status: false, message: "Debe especificar filtros jer?rquicos" }, { status: 400 });
        }

        const records = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_registro_induccion_recorrido",
                operation: "findMany",
                where,
                orderBy: {
                    created_at: 'desc'
                }
            },
        });
        const recordsArray = Array.isArray(records) ? records : [];

        const recordsWithIdLocal = recordsArray.map((record: any) => ({
            ...record,
            id_local: ""
        }));

        return NextResponse.json({
            status: true,
            message: "Registros de inducci?n y recorrido obtenidos correctamente",
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
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            empresa_id,
            cliente_id,
            division_id,
            contrato_id,
            corpo_id,
            puesto_id,
            plaza_id,
            empleado_id,
            fecha,
            division,
            renglon_edificio,
            supervisor_cliente,
            supervisor_corporacion,
            temas_desarrollados,
            aspectos_especificos,
            participantes,
            firma_supervisor,
            firma_empleado,
            firma_responsable
        } = await req.json();

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaIdNum = parseInt(String(marca_id), 10);
        if (Number.isNaN(marcaIdNum)) {
            return NextResponse.json({ status: false, message: "Marca inv?lida" }, { status: 400 });
        }

        const marcaDia = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id: marcaIdNum },
            },
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }
        const marcaDiaObj = marcaDia as any;

        // Usar IDs del body si est?n presentes, sino usar los de la marca
        const empresaId = empresa_id !== undefined && empresa_id !== null ? Number(empresa_id) : Number(marcaDiaObj.empresa_id);
        const clienteId = cliente_id !== undefined && cliente_id !== null ? Number(cliente_id) : Number(marcaDiaObj.cliente_id);
        const divisionId = division_id !== undefined && division_id !== null ? Number(division_id) : Number(marcaDiaObj.division_id);
        const contratoId = contrato_id !== undefined && contrato_id !== null ? Number(contrato_id) : Number(marcaDiaObj.contrato_id);
        const corpoId = corpo_id !== undefined && corpo_id !== null ? Number(corpo_id) : Number(marcaDiaObj.corpo_id);
        const puestoId = puesto_id !== undefined && puesto_id !== null ? Number(puesto_id) : Number(marcaDiaObj.puesto_id);
        const plazaId = plaza_id !== undefined && plaza_id !== null ? Number(plaza_id) : Number(marcaDiaObj.plaza_id);

        if (
            [empresaId, clienteId, divisionId, contratoId, corpoId, puestoId, plazaId].some((n) => Number.isNaN(n) || n === 0)
        ) {
            return NextResponse.json({ status: false, message: "No se pudieron derivar los IDs de la marca" }, { status: 400 });
        }

        // Validar empleado_id
        if (!empleado_id) {
            return NextResponse.json({ status: false, message: "empleado_id es requerido" }, { status: 400 });
        }
        const empleadoIdNum = Number(empleado_id);
        if (Number.isNaN(empleadoIdNum) || empleadoIdNum === 0) {
            return NextResponse.json({ status: false, message: "empleado_id inv?lido" }, { status: 400 });
        }

        const fechaParsed = parseFechaInput(fecha);

        // Autocompletar campos desde la marca
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

        const createData: any = {
            empresa_id: empresaId,
            cliente_id: clienteId,
            division_id: divisionId,
            contrato_id: contratoId,
            corpo_id: corpoId,
            puesto_id: puestoId,
            plaza_id: plazaId,
            isActive: true,
            empleado_id: empleadoIdNum,
            division: (division && String(division).trim()) ? String(division).trim() : "Otros",
            renglon_edificio: renglon_edificio ? String(renglon_edificio) : "",
            supervisor_cliente: supervisor_cliente !== undefined && supervisor_cliente !== null ? String(supervisor_cliente) : null,
            supervisor_corporacion: supervisor_corporacion ? String(supervisor_corporacion) : "",
            temas_desarrollados: temas_desarrollados ? String(temas_desarrollados) : "[]",
            aspectos_especificos: aspectos_especificos ? String(aspectos_especificos) : "[]",
            participantes: participantes ? String(participantes) : "[]",
            firma_supervisor:
                firma_supervisor != null && String(firma_supervisor).trim().length > 0
                    ? String(firma_supervisor).trim()
                    : null,
            firma_empleado:
                firma_empleado != null && String(firma_empleado).trim().length > 0
                    ? String(firma_empleado).trim()
                    : null,
            firma_responsable: firma_responsable ? String(firma_responsable) : "",
            created_at: createdAt.toISOString(),
            created_by: createdBy.toString()
        };
        if (fechaParsed) {
            createData.fecha = fechaParsed.toISOString();
        }

        const new_record = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_registro_induccion_recorrido",
                operation: "create",
                data: createData,
            },
        });
        const newRecordObj = new_record as any;

        // Registrar cambio de creaci?n
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_registro_induccion_recorrido",
                    registro_id: newRecordObj.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: newRecordObj.id,
                            empresa_id: newRecordObj.empresa_id,
                            cliente_id: newRecordObj.cliente_id,
                            division_id: newRecordObj.division_id,
                            contrato_id: newRecordObj.contrato_id,
                            corpo_id: newRecordObj.corpo_id,
                            puesto_id: newRecordObj.puesto_id,
                            plaza_id: newRecordObj.plaza_id,
                            empleado_id: newRecordObj.empleado_id,
                            fecha: fechaParsed ? fechaParsed.toISOString() : null,
                            division: newRecordObj.division,
                            renglon_edificio: newRecordObj.renglon_edificio,
                            supervisor_cliente: newRecordObj.supervisor_cliente,
                            supervisor_corporacion: newRecordObj.supervisor_corporacion,
                            temas_desarrollados: newRecordObj.temas_desarrollados,
                            aspectos_especificos: newRecordObj.aspectos_especificos,
                            participantes: newRecordObj.participantes,
                            firma_supervisor: newRecordObj.firma_supervisor,
                            firma_empleado: newRecordObj.firma_empleado,
                            firma_responsable: newRecordObj.firma_responsable,
                        },
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        if (newRecordObj) {
            let empNombre = "Desconocido";
            if (newRecordObj.created_by) {
                const empleado = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_empleado",
                        operation: "findUnique",
                        where: { id: Number(newRecordObj.created_by) },
                    },
                });
                if (empleado) {
                    const empleadoObj = empleado as any;
                    empNombre = empleadoObj.nombre + " " + empleadoObj.primer_apellido + " " + empleadoObj.segundo_apellido;
                }
            }
            let sucursalNombre = "Desconocida";
            if (newRecordObj.corpo_id) {
                const sucursal = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_sucursal",
                        operation: "findUnique",
                        where: { id: newRecordObj.corpo_id },
                    },
                });
                if (sucursal) {
                    const sucursalObj = sucursal as any;
                    sucursalNombre = sucursalObj.nombre + " (" + sucursalObj.nro_sucursal + ")";
                }
            }
            let clienteNombre = "Desconocido";
            if (newRecordObj.cliente_id) {
                const cliente = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_cliente",
                        operation: "findUnique",
                        where: { id: newRecordObj.cliente_id },
                    },
                });
                if (cliente) {
                    const clienteObj = cliente as any;
                    clienteNombre = clienteObj.nombre;
                }
            }
            let plazaNombre = "Desconocida";
            if (newRecordObj.plaza_id) {
                const plaza = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_plazas",
                        operation: "findUnique",
                        where: { id: newRecordObj.plaza_id },
                    },
                });
                if (plaza) {
                    const plazaObj = plaza as any;
                    plazaNombre = plazaObj.nombre + " (" + plazaObj.codigo_plaza + ")";
                }
            }
            const created_at_value = typeof newRecordObj.created_at === 'string' ? newRecordObj.created_at : (newRecordObj.created_at instanceof Date ? newRecordObj.created_at.toISOString() : createdAt.toISOString());
            let fechaRegistro = created_at_value.split("T")[0];
            let horaRegistro = created_at_value.split("T")[1].split(".")[0];
            const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de inducci?n y recorrido miscel?neo en la sucursal " + sucursalNombre + " para el cliente " + clienteNombre + " en la plaza " + plazaNombre + " el d?a " + fechaRegistro + " a las " + horaRegistro;
            await sendNotificationByRole(req, newRecordObj.corpo_id, [Number(newRecordObj.created_by)], "Registro de inducci?n y recorrido miscel?neo creado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        return NextResponse.json({
            status: true,
            message: "Registro de inducci?n y recorrido creado correctamente",
            data: {
                id: newRecordObj.id,
                empresa_id: newRecordObj.empresa_id,
                cliente_id: newRecordObj.cliente_id,
                division_id: newRecordObj.division_id,
                contrato_id: newRecordObj.contrato_id,
                corpo_id: newRecordObj.corpo_id,
                puesto_id: newRecordObj.puesto_id,
                plaza_id: newRecordObj.plaza_id,
                empleado_id: newRecordObj.empleado_id,
                fecha: newRecordObj.fecha,
                renglon_edificio: newRecordObj.renglon_edificio,
                supervisor_cliente: newRecordObj.supervisor_cliente,
                supervisor_corporacion: newRecordObj.supervisor_corporacion,
                temas_desarrollados: newRecordObj.temas_desarrollados,
                aspectos_especificos: newRecordObj.aspectos_especificos,
                participantes: newRecordObj.participantes,
                firma_supervisor: newRecordObj.firma_supervisor,
                firma_empleado: newRecordObj.firma_empleado,
                division: newRecordObj.division,
                firma_responsable: newRecordObj.firma_responsable,
                created_at: newRecordObj.created_at,
                created_by: newRecordObj.created_by,
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

