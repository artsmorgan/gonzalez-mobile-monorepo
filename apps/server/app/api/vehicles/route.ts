/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { createVehicleImage } from "../../../utils/createVehicleImage";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { assertCorpoAllowedForMarca, resolveClienteYPuestoParaAlta, getRegistroVehiculoLocationAnchors } from "../../../utils/registroCorpoPuesto";

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

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const corpoOkGet = await assertCorpoAllowedForMarca(req, marcaDia, corpoIdReq);
        if (!corpoOkGet.ok) {
            return NextResponse.json({ status: false, message: corpoOkGet.message }, { status: 200 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const vehiculos = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_registro_vehiculos",
                operation: "findMany",
                where: { corpo_id: corpoIdReq, isActive: true },
            },
        });

        const vehiculos_return: any[] = [];
        for (const v of vehiculos) {

            const responsable = await prisma.c_empleado.findUnique({ where: { id: v.responsable_id } });
            if (!responsable) {
                return NextResponse.json({ status: false, message: "Responsable no encontrado" }, { status: 200 });
            }

            vehiculos_return.push({
                id: v.id,
                tipo: v.tipo,
                placa: v.placa,
                nombre_propietario: v.nombre,
                cedula_propietario: v.cedula,
                departamento_visita: v.departamento_visita || "",
                persona_visita: v.persona_visita || "",
                hora_entrada: v.hora_entrada,
                hora_salida: v.hora_salida,
                razon_visita: v.razon_visita,
                responsable: {
                    id: v.responsable_id,
                    nombre: responsable.nombre + " " + responsable.primer_apellido + " " + responsable.segundo_apellido,
                },
                created_at: v.created_at,
                corpo_id: v.corpo_id,
                puesto_id: v.puesto_id,
                empresa_id: v.empresa_id,
                cliente_id: v.cliente_id,
                division_id: v.division_id,
                contrato_id: v.contrato_id,
                file_name: v.file_name || null,
                id_local: "",
                base64_image: ""
            });
        }

        return NextResponse.json({ status: true, data: vehiculos_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            corpo_id: bodyCorpoId,
            puesto_id: bodyPuestoId,
            empresa_id: bodyEmpresaId,
            cliente_id: bodyClienteId,
            division_id: bodyDivisionId,
            contrato_id: bodyContratoId,
            tipo,
            placa,
            nombre,
            cedula,
            departamento_visita,
            persona_visita,
            hora_entrada,
            hora_salida,
            razon_visita,
            file
        } = await req.json();

        if (!marca_id || !tipo || !placa || !nombre || !cedula || !hora_entrada || !razon_visita) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

        const bodyCorpoParsed =
            bodyCorpoId != null && bodyCorpoId !== ""
                ? parseInt(String(bodyCorpoId), 10)
                : NaN;
        const targetCorpoId =
            Number.isFinite(bodyCorpoParsed) && bodyCorpoParsed > 0
                ? bodyCorpoParsed
                : Number(marcaDia.corpo_id);

        const corpoOkPost = await assertCorpoAllowedForMarca(req, marcaDia, targetCorpoId);
        if (!corpoOkPost.ok) {
            return NextResponse.json({ status: false, message: corpoOkPost.message }, { status: 200 });
        }

        const resolvedCp = await resolveClienteYPuestoParaAlta(req, marcaDia, targetCorpoId, bodyPuestoId);
        if (!resolvedCp.ok) {
            return NextResponse.json({ status: false, message: resolvedCp.message }, { status: 200 });
        }
        const clienteIdFinal = resolvedCp.cliente_id;
        const puestoIdFinal = resolvedCp.puesto_id;

        const anchors = await getRegistroVehiculoLocationAnchors(req, targetCorpoId);
        if (!anchors.ok) {
            return NextResponse.json({ status: false, message: anchors.message }, { status: 200 });
        }
        if (Number(clienteIdFinal) !== Number(anchors.cliente_id)) {
            return NextResponse.json({ status: false, message: "Cliente inconsistente con la sucursal" }, { status: 200 });
        }

        const chk = (label: string, bodyVal: unknown, expected: number) => {
            if (bodyVal == null || bodyVal === "") return true;
            const n = parseInt(String(bodyVal), 10);
            return Number.isFinite(n) && n === expected;
        };
        if (!chk("empresa", bodyEmpresaId, anchors.empresa_id)) {
            return NextResponse.json({ status: false, message: "La empresa no corresponde a la sucursal" }, { status: 200 });
        }
        if (!chk("cliente", bodyClienteId, anchors.cliente_id)) {
            return NextResponse.json({ status: false, message: "El cliente no corresponde a la sucursal" }, { status: 200 });
        }
        if (!chk("división", bodyDivisionId, anchors.division_id)) {
            return NextResponse.json({ status: false, message: "La división no corresponde a la sucursal" }, { status: 200 });
        }
        if (!chk("contrato", bodyContratoId, anchors.contrato_id)) {
            return NextResponse.json({ status: false, message: "El contrato no corresponde a la sucursal" }, { status: 200 });
        }

        const new_vehicle = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_registro_vehiculos",
                data: {
                    cliente_id: clienteIdFinal,
                    corpo_id: targetCorpoId,
                    puesto_id: puestoIdFinal,
                    empresa_id: anchors.empresa_id,
                    division_id: anchors.division_id,
                    contrato_id: anchors.contrato_id,
                    isActive: true,
                    responsable_id: createdBy,
                    created_at: createdAt.toISOString(),
                    updated_at: createdAt.toISOString(),
                    tipo: tipo,
                    placa: placa,
                    nombre: nombre,
                    cedula: cedula,
                    departamento_visita: departamento_visita ? String(departamento_visita) : null,
                    persona_visita: persona_visita ? String(persona_visita) : null,
                    hora_entrada: new Date(hora_entrada).toISOString(),
                    hora_salida: hora_salida ? new Date(hora_salida).toISOString() : null,
                    razon_visita: razon_visita,
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
                    nombre_tabla: "e_registro_vehiculos",
                    registro_id: new_vehicle.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: new_vehicle.id,
                            tipo: new_vehicle.tipo,
                            placa: new_vehicle.placa,
                            nombre: new_vehicle.nombre,
                            cedula: new_vehicle.cedula,
                            departamento_visita: new_vehicle.departamento_visita || null,
                            persona_visita: new_vehicle.persona_visita || null,
                            hora_entrada: new_vehicle.hora_entrada,
                            hora_salida: new_vehicle.hora_salida ? new_vehicle.hora_salida : null,
                            razon_visita: new_vehicle.razon_visita,
                        },
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        // Guardar imagen si existe
        if (new_vehicle) {
            if (file) {
                const result = await createVehicleImage(req, new_vehicle.id, file);
                if (!result) {
                    return NextResponse.json(
                        { status: false, message: "El vehículo se guardó pero no se pudo subir la imagen. Verifique el formato o el tamaño." },
                        { status: 200 }
                    );
                }
            }
            const empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });
            if (empleado && marcaDia.plaza_id) {
                const entrada = new_vehicle.hora_entrada;
                const fecha_entrada = entrada.split("T")[0];
                const hora_entrada = entrada.split("T")[1].split(".")[0];
                const desc = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha registrado la visita de un vehículo de tipo ${tipo} con la placa ${placa} el día ${fecha_entrada} a las ${hora_entrada}. Razón de la visita: ${razon_visita}`;
                await sendNotificationByRole(req, targetCorpoId, [marcaDia.plaza_id], "Vehículo registrado", desc, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }

        return NextResponse.json(
            { status: true, message: "Vehículo registrado correctamente", id: new_vehicle.id },
            { status: 200 }
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
