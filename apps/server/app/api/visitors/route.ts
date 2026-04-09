/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import fs from "fs";
import { toZonedTime } from "date-fns-tz";
import path from "path";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }
        const searchParams = req.nextUrl.searchParams;
        const marca = searchParams.get("m");
        const corpoParam = searchParams.get("corpo_id");

        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const corpoIdReq = corpoParam != null && corpoParam !== "" ? parseInt(String(corpoParam), 10) : NaN;
        if (!Number.isFinite(corpoIdReq) || corpoIdReq <= 0) {
            return NextResponse.json({ status: false, message: "Sucursal no especificada" }, { status: 200 });
        }

        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(marca) } }
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (Number(marcaDia.corpo_id) !== corpoIdReq) {
            return NextResponse.json(
                { status: false, message: "La sucursal no corresponde a la marca indicada" },
                { status: 200 }
            );
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const visitas = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_personas", operation: "findMany", where: { corpo_id: corpoIdReq } }
        });

        const visitas_return: any[] = [];
        for (const v of visitas) {

            const responsable = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: v.responsable_id } }
            });
            if (!responsable) {
                return NextResponse.json({ status: false, message: "Responsable no encontrado" }, { status: 200 });
            }

            const activos = [];
            const activo_visitante = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_activo_visitante", operation: "findMany", where: { visitante_id: v.id } }
            });
            if (activo_visitante.length > 0) {
                for (const a of activo_visitante) {
                    const tipo_activo = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "n_tipo_activo_visitas", operation: "findUnique", where: { id: a.tipo_id } }
                    });
                    if (tipo_activo) {
                        activos.push({
                            tipo: {
                                id: tipo_activo.id,
                                nombre: tipo_activo.nombre,
                            },
                            nombre: a.nombre,
                            detalles: a.detalles,
                            numero_id: a.numero_id,
                            numero_activo: a.numero_activo,
                        });
                    }
                }
            }

            visitas_return.push({
                id: v.id,
                nombre: v.nombre,
                cedula: v.cedula,
                hora_entrada: v.hora_entrada,
                hora_salida: v.hora_salida,
                razon_visita: v.razon_visita,
                dep_pers_visita: v.dep_pers_visita ?? null,
                responsable: {
                    id: v.responsable_id,
                    nombre: responsable.nombre + " " + responsable.primer_apellido + " " + responsable.segundo_apellido,
                },
                es_funcionario: v.es_funcionario,
                observaciones: v.observaciones,
                tipo_accion: v.tipo_accion,
                pers_autoriza_salida: v.pers_autoriza_salida,
                foto_cedula: v.foto_cedula,
                updated_at: v.updated_at,
                activos: activos,
                corpo_id: v.corpo_id,
                id_local: ""
            });
        }

        return NextResponse.json({ status: true, data: visitas_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            nombre,
            cedula,
            hora_entrada,
            hora_salida, // Opcional
            razon_visita,
            dep_pers_visita, // Opcional
            es_funcionario,
            observaciones, // Opcional
            tipo_accion, // Opcional
            pers_autoriza_salida, // Opcional
            foto_cedula, // viene en base64 y opcional
            activos,
        } = await req.json();

        console.log(activos);


        // Verificar marca
        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(marca_id) } }
        });
        if (!marcaDia) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        // Crear registro
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

        const new_visita = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_registro_personas",
                data: {
                    cliente_id: marcaDia.cliente_id,
                    corpo_id: marcaDia.corpo_id,
                    puesto_id: marcaDia.puesto_id,
                    responsable_id: createdBy,
                    created_at: createdAt.toISOString(),
                    updated_at: createdAt.toISOString(),
                    nombre,
                    cedula,
                    hora_entrada: new Date(hora_entrada).toISOString(),
                    hora_salida: hora_salida ? new Date(hora_salida).toISOString() : null,
                    razon_visita,
                    dep_pers_visita: dep_pers_visita ?? null,
                    es_funcionario,
                    observaciones,
                    tipo_accion,
                    pers_autoriza_salida,
                }
            }
        });

        // Registrar cambio de creación
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                data: {
                    nombre_tabla: "e_registro_personas",
                    registro_id: new_visita.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: new_visita.id,
                            nombre: new_visita.nombre,
                            cedula: new_visita.cedula,
                            hora_entrada: new_visita.hora_entrada,
                            hora_salida: new_visita.hora_salida ? new_visita.hora_salida : null,
                            razon_visita: new_visita.razon_visita,
                            dep_pers_visita: new_visita.dep_pers_visita ?? null,
                            es_funcionario: new_visita.es_funcionario,
                            observaciones: new_visita.observaciones,
                            tipo_accion: new_visita.tipo_accion,
                            pers_autoriza_salida: new_visita.pers_autoriza_salida,
                            activos: activos,
                        },
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                }
            }
        });

        if (new_visita) {
            const empleado = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: payload.id } }
            });
            if (empleado) {
                const entrada = new_visita.hora_entrada;
                const fecha_entrada = entrada.split("T")[0];
                const hora_entrada = entrada.split("T")[1].split(".")[0];
                const tipo_visitante = es_funcionario ? "Funcionario" : "Visitante";
                const desc = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha registrado la visita de ${nombre} con la cedula ${cedula} el día ${fecha_entrada} a las ${hora_entrada}. Tipo de visitante: ${tipo_visitante}. Razón de la visita: ${razon_visita}`;
                await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id], "Visita registrada", desc, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }

            if (activos.length > 0) {
                for (const a of activos) {
                    const tipo_activo = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "n_tipo_activo_visitas", operation: "findUnique", where: { id: a.tipo_id } }
                    });
                    if (tipo_activo) {
                        await callDynamicPrisma({
                            req,
                            data: {
                                action: "POST",
                                table: "e_activo_visitante",
                                data: {
                                    visitante_id: new_visita.id,
                                    tipo_id: tipo_activo.id,
                                    nombre: (a.nombre != null && String(a.nombre).trim() !== '') ? String(a.nombre).trim() : tipo_activo.nombre,
                                    detalles: JSON.stringify(a.detalles),
                                    numero_id: a.numero_id != null ? String(a.numero_id) : '',
                                    numero_activo: a.numero_activo ? a.numero_activo : null,
                                }
                            }
                        });
                    }
                }
            }

            if (foto_cedula) {
                const matches = foto_cedula.match(/^data:(.+);base64,(.+)$/);
                if (!matches) throw new Error("Formato base64 inválido");
                const extension = matches[1].split("/")[1]?.replace("jpeg", "jpg") || "jpg";
                const uploadResp = await uploadDynamicFiles({
                    req,
                    folderPath: `visitors/${new_visita.id}/cedula`,
                    files: [{ type: "image", extension, file_base64: foto_cedula }],
                });
                const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
                const file_name = uploaded[0]?.name || "";
                if (file_name) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "UPDATE",
                            table: "e_registro_personas",
                            where: { id: new_visita.id },
                            data: { foto_cedula: file_name }
                        }
                    });
                }
            }
        }

        return NextResponse.json(
            { status: true, message: "Visita registrada correctamente" },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}