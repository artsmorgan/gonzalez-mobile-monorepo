import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime, format } from "date-fns-tz";
import path from "path";
import fs from "fs";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { sendNotificationByEmployee, sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const marcaId = req.nextUrl.searchParams.get("m");
        if (!marcaId) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id: parseInt(marcaId) },
            },
        });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const marcaObj = marca as any;
        if (!marcaObj.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        // Obtener la última marca usando callDynamicPrisma directamente
        const now = toZonedTime(new Date(), "America/Costa_Rica");
        const nowPlus15 = new Date(now.getTime() + 15 * 60 * 1000);
        const currentDate = new Date(now.toISOString().split("T")[0]);
        const currentTime = new Date("1970-01-01 " + now.toTimeString().slice(0, 8));

        const proximo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findFirst",
                where: {
                    empleadoFijo_id: marcaObj.empleadoFijo_id,
                    OR: [
                        { fecha: { gt: now } },
                        { fecha: { equals: currentDate }, hora_inicio: { gte: currentTime } },
                    ],
                },
                orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
            },
        });

        let lastMarca: any = null;
        if (proximo) {
            const proximoObj = proximo as any;
            const proximoDateTime = new Date(`${proximoObj.fecha}T${proximoObj.hora_inicio}`);
            if (proximoDateTime <= nowPlus15) {
                lastMarca = proximo;
            }
        }

        if (!lastMarca) {
            const ultimo = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_marca_dia",
                    operation: "findFirst",
                    where: {
                        empleadoFijo_id: marcaObj.empleadoFijo_id,
                        OR: [
                            { fecha: { lt: now } },
                            { fecha: { equals: currentDate }, hora_inicio: { lt: currentTime } },
                        ],
                    },
                    orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }],
                },
            });
            lastMarca = ultimo;
        }

        if (!lastMarca) {
            return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
        }

        const lastMarcaObj = lastMarca as any;

        const corpoIdParam = req.nextUrl.searchParams.get("corpo_id");
        const effectiveCorpoId =
            corpoIdParam != null && corpoIdParam !== "" && !isNaN(parseInt(corpoIdParam, 10))
                ? parseInt(corpoIdParam, 10)
                : marcaObj.corpo_id;

        const corpo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_sucursal",
                operation: "findUnique",
                where: { id: effectiveCorpoId },
            },
        });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrada" }, { status: 200 });
        }

        const capacitaciones = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_registro_capacitaciones",
                operation: "findMany",
                where: { corpo_id: effectiveCorpoId },
            },
        });
        const capacitacionesArray = Array.isArray(capacitaciones) ? capacitaciones : [];

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

        const empresaCache = new Map<number, any>();
        const clienteCache = new Map<number, any>();
        const corpoCache = new Map<number, any>();

        const loadEmpresa = async (id: number) => {
            if (empresaCache.has(id)) return empresaCache.get(id);
            const row = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_empresa",
                    operation: "findUnique",
                    where: { id },
                },
            });
            empresaCache.set(id, row);
            return row;
        };
        const loadCliente = async (id: number) => {
            if (clienteCache.has(id)) return clienteCache.get(id);
            const row = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_cliente",
                    operation: "findUnique",
                    where: { id },
                },
            });
            clienteCache.set(id, row);
            return row;
        };
        const loadCorpo = async (id: number) => {
            if (corpoCache.has(id)) return corpoCache.get(id);
            const row = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_sucursal",
                    operation: "findUnique",
                    where: { id },
                },
            });
            corpoCache.set(id, row);
            return row;
        };

        for (const capacitacion of capacitacionesArray) {
            const capacitacionObj = capacitacion as any;
            // Desconvertir de base64 a string
            const id_firma = atob(capacitacionObj.firma_responsable).split(":")[1];
            const firma = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: parseInt(id_firma) },
                },
            });
            let nombre_firma = "No disponible";
            if (firma) {
                const firmaObj = firma as any;
                nombre_firma = (firmaObj.nombre || "") + " " + (firmaObj.primer_apellido || "") + " " + (firmaObj.segundo_apellido || "");
                if (firmaObj.cedula) {
                    nombre_firma += " (" + firmaObj.cedula + ")";
                }
            }

            const empleados = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_capacitacion_empleado",
                    operation: "findMany",
                    where: { capacitacion_id: capacitacionObj.id },
                },
            });
            const empleadosArray = Array.isArray(empleados) ? empleados : [];
            const all_empleados: { id: number, nombre: string, cedula: string }[] = [];
            for (const empleado of empleadosArray) {
                const empleadoObj = empleado as any;
                const empleado_data = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_empleado",
                        operation: "findUnique",
                        where: { id: empleadoObj.empleado_id },
                    },
                });
                if (empleado_data) {
                    const empleadoDataObj = empleado_data as any;
                    all_empleados.push({
                        id: empleadoObj.empleado_id,
                        nombre: (empleadoDataObj.nombre || "") + " " + (empleadoDataObj.primer_apellido || "") + " " + (empleadoDataObj.segundo_apellido || ""),
                        cedula: empleadoDataObj.cedula
                    });
                }
            }

            const puestos = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_capacitacion_puesto",
                    operation: "findMany",
                    where: { capacitacion_id: capacitacionObj.id },
                },
            });
            const puestosArray = Array.isArray(puestos) ? puestos : [];
            const all_puestos: { id: number, nombre: string }[] = [];
            for (const puesto of puestosArray) {
                const puestoObj = puesto as any;
                const puesto_data = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_puesto",
                        operation: "findUnique",
                        where: { id: puestoObj.puesto_id },
                    },
                });
                if (puesto_data) {
                    const puestoDataObj = puesto_data as any;
                    all_puestos.push({
                        id: puestoObj.puesto_id,
                        nombre: puestoDataObj.nombre
                    });
                }
            }

            const fechaValue = capacitacionObj.fecha instanceof Date ? capacitacionObj.fecha : (typeof capacitacionObj.fecha === 'string' ? new Date(capacitacionObj.fecha) : new Date());

            const empresaRow = await loadEmpresa(capacitacionObj.empresa_id);
            const clienteRow = await loadCliente(capacitacionObj.cliente_id);
            const corpoRow = await loadCorpo(capacitacionObj.corpo_id);
            const empresaObj = (empresaRow || {}) as any;
            const clienteObj = (clienteRow || {}) as any;
            const corpoObj = (corpoRow || {}) as any;

            capacitaciones_return.push({
                id: capacitacionObj.id,
                empresa: {
                    id: empresaObj.id ?? capacitacionObj.empresa_id,
                    nombre: empresaObj.nombre ?? "—"
                },
                cliente: {
                    id: clienteObj.id ?? capacitacionObj.cliente_id,
                    nombre: clienteObj.nombre ?? "—"
                },
                sucursal: {
                    id: corpoObj.id ?? capacitacionObj.corpo_id,
                    nombre: corpoObj.nombre ?? "—"
                },
                titulo: capacitacionObj.titulo,
                descripcion: capacitacionObj.descripcion,
                tipo: capacitacionObj.tipo,
                resultado: capacitacionObj.resultado || "No disponible",
                observaciones: capacitacionObj.observaciones,
                responsable: {
                    nombre: capacitacionObj.nombre_responsable,
                    cedula: capacitacionObj.cedula_responsable
                },
                firma_responsable: capacitacionObj.firma_responsable,
                nombre_firma: nombre_firma,
                fecha: fechaValue.toISOString(),
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
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const body = await req.json();
        const {
            marca_id,
            empresa_id: body_empresa_id,
            cliente_id: body_cliente_id,
            corpo_id: body_corpo_id,
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
        } = body;

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

        const marca = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id: parseInt(marca_id) },
            },
        });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const marcaObj = marca as any;
        if (!marcaObj.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const empleado = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado",
                operation: "findUnique",
                where: { id: marcaObj.empleadoFijo_id },
            },
        });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const effectiveEmpresaId =
            body_empresa_id != null && body_empresa_id !== "" && !isNaN(parseInt(String(body_empresa_id), 10))
                ? parseInt(String(body_empresa_id), 10)
                : marcaObj.empresa_id;
        const effectiveClienteId =
            body_cliente_id != null && body_cliente_id !== "" && !isNaN(parseInt(String(body_cliente_id), 10))
                ? parseInt(String(body_cliente_id), 10)
                : marcaObj.cliente_id;
        const effectiveCorpoIdPost =
            body_corpo_id != null && body_corpo_id !== "" && !isNaN(parseInt(String(body_corpo_id), 10))
                ? parseInt(String(body_corpo_id), 10)
                : marcaObj.corpo_id;

        const empresa = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_empresa",
                operation: "findUnique",
                where: { id: effectiveEmpresaId },
            },
        });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const cliente = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_cliente",
                operation: "findUnique",
                where: { id: effectiveClienteId },
            },
        });
        if (!cliente) {
            return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
        }

        const corpo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_sucursal",
                operation: "findUnique",
                where: { id: effectiveCorpoIdPost },
            },
        });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
        }

        const empresaObj = empresa as any;
        const clienteObj = cliente as any;
        const corpoObj = corpo as any;
        const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);

        const new_capacitacion = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_registro_capacitaciones",
                operation: "create",
                data: {
                    empresa_id: empresaObj.id,
                    cliente_id: clienteObj.id,
                    corpo_id: corpoObj.id,
                    titulo: titulo,
                    descripcion: descripcion,
                    tipo: tipo,
                    resultado: resultado,
                    observaciones: observaciones,
                    nombre_responsable: nombre_responsable,
                    cedula_responsable: cedula_responsable,
                    firma_responsable: firma_responsable,
                    file: "-",
                    fecha: fechaDate.toISOString(),
                    responsable_id: payload?.id
                }
            }
        });

        const capacitacionObj = new_capacitacion as any;
        const fechaValue = capacitacionObj.fecha instanceof Date ? capacitacionObj.fecha : (typeof capacitacionObj.fecha === 'string' ? new Date(capacitacionObj.fecha) : new Date());
        const date = fechaValue.toISOString().split("T")[0];
        const hour = fechaValue.toISOString().split("T")[1].split(".")[0];

        for (const emp of empleados) {
            const empleado_data = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: parseInt(emp) },
                },
            });
            if (!empleado_data) {
                continue;
            }
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "e_capacitacion_empleado",
                    operation: "create",
                    data: {
                        capacitacion_id: capacitacionObj.id,
                        empleado_id: parseInt(emp)
                    }
                }
            });

            const desc = `Has recibido la capacitación ${capacitacionObj.titulo} en la sucursal ${corpoObj.nombre} de ${clienteObj.nombre} el día ${date} a las ${hour}`;
            await sendNotificationByEmployee(req, effectiveCorpoIdPost, [marcaObj.empleadoFijo_id], "Capacitación recibida", desc, [parseInt(emp)]);
        }

        for (const puesto of puestos) {
            const puesto_data = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_puesto",
                    operation: "findUnique",
                    where: { id: parseInt(puesto) },
                },
            });
            if (!puesto_data) {
                continue;
            }
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "e_capacitacion_puesto",
                    operation: "create",
                    data: {
                        capacitacion_id: capacitacionObj.id,
                        puesto_id: parseInt(puesto)
                    }
                }
            });
        }

        if (capacitacionObj && file) {
            const matches = file.match(/^data:(.+);base64,(.+)$/);
            if (!matches) throw new Error("Formato base64 inválido");
            const extension = matches[1].split("/")[1]?.replace("jpeg", "jpg") || "jpg";
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `training/${capacitacionObj.id}`,
                files: [{ type: "image", extension, file_base64: file }],
            });
            const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            const file_name = uploaded[0]?.name || "";
            if (file_name) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "UPDATE",
                        table: "e_registro_capacitaciones",
                        operation: "update",
                        where: { id: capacitacionObj.id },
                        data: { file: file_name }
                    }
                });
            }
        }

        await sendNotificationByRole(req, effectiveCorpoIdPost, [marcaObj.plaza_id], "Capacitación creada", `Se ha registrado la capacitación ${capacitacionObj.titulo} en la sucursal ${corpoObj.nombre} de ${clienteObj.nombre} el día ${date} a las ${hour}`, ["ADMINISTRATIVO", "SUPERVISOR"]);

        return NextResponse.json({ status: true, message: "Capacitación creada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}