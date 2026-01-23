import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../utils/sendNotification";

const parseDateInputToDate = (input: unknown): Date | null => {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

    const s = String(input).trim();
    if (!s) return null;

    // dd/mm/yyyy
    const parts = s.split("/");
    if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const day = parseInt(dd, 10);
        const month = parseInt(mm, 10);
        const year = parseInt(yyyy, 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const d = new Date(year, month - 1, day, 0, 0, 0, 0);
            return isNaN(d.getTime()) ? null : d;
        }
    }

    // ISO / other Date-parsable formats
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            division,
            persona_solicita,
            codigo,
            contrato,
            horario,
            fecha_solicitud,
            motivo_permiso,
            permiso_sustituido_por,
            codigo_sustituto,
            firma_gerente,
            firma_encargado_monitoreo,
            permiso_coordinado_por,
            firma_responsables
        } = await req.json();

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const createdBy = payload.id?.toString();
        if (!createdBy) {
            return NextResponse.json({ status: false, message: "No se pudo obtener el usuario creador" }, { status: 400 });
        }

        const empresaId = marcaDia.empresa_id?.toString();
        const clienteId = marcaDia.cliente_id?.toString();
        const contratoId = marcaDia.contrato_id?.toString();
        const corpoId = marcaDia.corpo_id?.toString();
        const puestoId = marcaDia.puesto_id?.toString();
        const plazaId = marcaDia.plaza_id?.toString();

        if (!empresaId || !clienteId || !contratoId || !corpoId || !puestoId || !plazaId) {
            return NextResponse.json(
                { status: false, message: "No fue posible obtener empresa/cliente/contrato/corpo/puesto/plaza desde la marca" },
                { status: 400 }
            );
        }

        const fechaSolicitudDate = parseDateInputToDate(fecha_solicitud);
        if (!fechaSolicitudDate) {
            return NextResponse.json({ status: false, message: "fecha_solicitud inválida" }, { status: 400 });
        }

        const requiredString = (v: any) => (v === undefined || v === null) ? "" : String(v);
        const divisionStr = requiredString(division).trim();
        const personaSolicitaStr = requiredString(persona_solicita).trim();
        const codigoStr = requiredString(codigo).trim();
        const contratoStr = requiredString(contrato).trim();
        const horarioStr = requiredString(horario).trim();
        const motivoPermisoStr = requiredString(motivo_permiso).trim();
        const permisoSustituidoPorStr = requiredString(permiso_sustituido_por).trim();
        const codigoSustitutoStr = requiredString(codigo_sustituto).trim();
        const firmaGerenteStr = requiredString(firma_gerente).trim();
        const firmaEncargadoStr = requiredString(firma_encargado_monitoreo).trim();
        const permisoCoordinadoPorStr = requiredString(permiso_coordinado_por).trim();
        const firmaResponsablesStr = requiredString(firma_responsables).trim();

        const missingFields: string[] = [];
        if (!divisionStr) missingFields.push("division");
        if (!personaSolicitaStr) missingFields.push("persona_solicita");
        if (!codigoStr) missingFields.push("codigo");
        if (!contratoStr) missingFields.push("contrato");
        if (!horarioStr) missingFields.push("horario");
        if (!motivoPermisoStr) missingFields.push("motivo_permiso");
        if (!permisoSustituidoPorStr) missingFields.push("permiso_sustituido_por");
        if (!codigoSustitutoStr) missingFields.push("codigo_sustituto");
        if (!firmaGerenteStr) missingFields.push("firma_gerente");
        if (!firmaEncargadoStr) missingFields.push("firma_encargado_monitoreo");
        if (!permisoCoordinadoPorStr) missingFields.push("permiso_coordinado_por");
        if (!firmaResponsablesStr) missingFields.push("firma_responsables");

        if (missingFields.length > 0) {
            return NextResponse.json(
                { status: false, message: `Campos requeridos faltantes: ${missingFields.join(", ")}` },
                { status: 400 }
            );
        }

        // Autocompletar campos desde la marca
        const new_record = await prisma.c_solicitud_permiso.create({
            data: {
                empresa_id: empresaId,
                cliente_id: clienteId,
                contrato_id: contratoId,
                corpo_id: corpoId,
                puesto_id: puestoId,
                plaza_id: plazaId,
                division: divisionStr,
                persona_solicita: personaSolicitaStr,
                codigo: codigoStr,
                contrato: contratoStr,
                horario: horarioStr,
                fecha_solicitud: fechaSolicitudDate,
                motivo_permiso: motivoPermisoStr,
                permiso_sustituido_por: permisoSustituidoPorStr,
                codigo_sustituto: codigoSustitutoStr,
                firma_gerente: firmaGerenteStr,
                firma_encargado_monitoreo: firmaEncargadoStr,
                permiso_coordinado_por: permisoCoordinadoPorStr,
                firma_responsables: firmaResponsablesStr,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: createdBy
            }
        });

        const fecha_string = fechaSolicitudDate.toISOString().split('T')[0];
        const hora_string = fechaSolicitudDate.toISOString().split('T')[1].split('.')[0];
        const description = `Se ha creado una solicitud de permiso para ${personaSolicitaStr} el día ${fecha_string} a las ${hora_string}`;
        sendNotificationByRole(marcaDia.corpo_id, [marcaDia.plaza_id], "Solicitud de permiso creada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso creada correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                division: (new_record as any).division,
                persona_solicita: new_record.persona_solicita,
                codigo: new_record.codigo,
                contrato: new_record.contrato,
                horario: new_record.horario,
                fecha_solicitud: new_record.fecha_solicitud,
                motivo_permiso: new_record.motivo_permiso,
                permiso_sustituido_por: new_record.permiso_sustituido_por,
                codigo_sustituto: new_record.codigo_sustituto,
                firma_gerente: new_record.firma_gerente,
                firma_encargado_monitoreo: new_record.firma_encargado_monitoreo,
                permiso_coordinado_por: new_record.permiso_coordinado_por,
                firma_responsables: new_record.firma_responsables,
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

