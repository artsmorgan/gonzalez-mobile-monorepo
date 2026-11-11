import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";

export async function createAccionPersonal(req: NextRequest, marcaId: number, tipo_accion_id: number, permiso_id: number, ausencia_id: number, salida_anticipada_id: number, comentarios: string | null, coordinadoPor_id: number, coordinador_id: number, usuario_insercion: string) {

    console.log("Procedemos a crear la acción personal");
    try {
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaId } });
        if (!marcaDia) {
            return { status: false, message: "Marca no encontrada" };
        }

        // Obtener el empleado
        const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id ?? 0 } });
        if (!empleado) {
            return { status: false, message: "Empleado no encontrado" };
        }

        // Obtener el salario
        const empleado_plaza = await prisma.c_empleado_plaza.findFirst({ where: { empleado_id: marcaDia.empleadoFijo_id, plaza_id: marcaDia.plaza_id } });
        if (!empleado_plaza) {
            return { status: false, message: "Empleado plaza no encontrada" };
        }
        const salario = empleado_plaza.salario;
        if (!salario) {
            return { status: false, message: "Salario no encontrado" };
        }

        // Categoría salarial: puede venir en empleado_plaza (si existe en BD) o en la plaza de estructura
        const parsePositiveInt = (v: unknown): number | null => {
            if (v === null || v === undefined || v === "") return null;
            const n = parseInt(String(v), 10);
            return Number.isNaN(n) || n <= 0 ? null : n;
        };

        let categoriaSalarialId =
            parsePositiveInt((empleado_plaza as { categoriaSalarial_id?: unknown }).categoriaSalarial_id);

        if (categoriaSalarialId == null && marcaDia.plaza_id) {
            const plazaEstructura = await prisma.e_estructura_plazas.findUnique({ where: { id: marcaDia.plaza_id } });
            categoriaSalarialId = parsePositiveInt((plazaEstructura as { categoriaSalarial_id?: unknown })?.categoriaSalarial_id);
        }

        if (categoriaSalarialId == null) {
            return {
                status: false,
                message: "No se pudo determinar la categoría salarial (falta categoriaSalarial_id en plaza o empleado plaza)",
            };
        }

        const categoriaSalarial = await prisma.pg_categoria_salarial.findUnique({ where: { id: categoriaSalarialId } });
        if (!categoriaSalarial) {
            return { status: false, message: "Categoría salarial no encontrada" };
        }

        // Obtener el periodo de pago en base a empleado.periodoPago_id
        let periodoPagoId = null;
        if (empleado.periodoPago_id) {
            const periodoPago = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "p_periodopago_config", operation: "findUnique", where: { id: empleado.periodoPago_id } }
            });
            if (periodoPago) {
                periodoPagoId = periodoPago.id;
            }
        }

        // Obtener el tipo de contrato en base a empleado.tipoContratacion_id
        let tipoContratacionId = null;
        if (empleado.tipoContratacion_id) {
            const tipoContratacion = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "n_tipo_contratacion", operation: "findUnique", where: { id: empleado.tipoContratacion_id } }
            });
            if (tipoContratacion) {
                tipoContratacionId = tipoContratacion.id;
            }
        }

        // Obtener hoy más 3 meses
        const today = toZonedTime(new Date(), "America/Costa_Rica");
        const futureDate = new Date(today);

        futureDate.setMonth(futureDate.getMonth() + 3);

        let futureDateString = futureDate.toISOString().split("T")[0];
        futureDateString = futureDateString + "T00:00:00.000Z";

        // Obtener el último consecutivo de la tabla c_accion_personal
        const ultimoConsecutivo = await prisma.c_accion_personal.findFirst({
            orderBy: { id: "desc" }
        });
        if (!ultimoConsecutivo) {
            return { status: false, message: "No se encontró el último consecutivo" };
        }
        
        let consecutivo = null;
        const separated = ultimoConsecutivo.consecutivo?.split("-");
        if (separated && separated.length > 1) {
            const result = (parseInt(separated[1], 10) + 1).toString().padStart(separated[1].length, "0");
            let corp = "CG";
            switch (marcaDia.empresa_id) {
            case 9:
                corp = "CG";
                break;
            case 10:
                corp = "CH";
                break;
            }
            consecutivo = `${corp}-${result}`;
        }

        if (!consecutivo) {
            return { status: false, message: "No se pudo crear el consecutivo" };
        }

        console.log("consecutivo", consecutivo);

        // Crear la acción personal
        const accionPersonal = await prisma.c_accion_personal.create({
            data: {
                    empleado_id: marcaDia.empleadoFijo_id,
                    plaza_id: marcaDia.plaza_id,
                    puesto_id: marcaDia.puesto_id,
                    corpo_id: marcaDia.corpo_id,
                    contrato_id: marcaDia.contrato_id,
                    cliente_id: marcaDia.cliente_id,
                    empresa_id: marcaDia.empresa_id,
                    horario_id: marcaDia.horario_id,
                    consecutivo: consecutivo,
                    fecha_inicio: marcaDia.fecha,
                    fecha_fin: marcaDia.fecha,
                    fecha_insercion: toZonedTime(new Date(), "America/Costa_Rica"),
                    salario: salario,
                    comentarios: comentarios ? comentarios : '[Acción personal creada en el sistema MonitoreApp]',
                    fecha_actualizacion: toZonedTime(new Date(), "America/Costa_Rica"),
                    tipoAccion_id: tipo_accion_id,
                    reemplazo_id: marcaDia.empleadoReemplaza_id,
                    salida_anticipada_id: tipo_accion_id === 13 ? salida_anticipada_id : null,
                    ausencia_id: tipo_accion_id === 5 ? ausencia_id : null,
                    permiso_sin_goce_id: tipo_accion_id === 7 ? permiso_id : null,
                    permiso_con_goce_id: tipo_accion_id === 6 ? permiso_id : null,
                    reversible: false,
                    salario_base_mensual: categoriaSalarial.salario_mes,
                    numero_hed: categoriaSalarial.horas_extras_diurnas,
                    numero_hem: categoriaSalarial.horas_extras_mixtas,
                    numero_hen: categoriaSalarial.horas_extras_nocturnas,
                    periodoPago_id: periodoPagoId,
                    categoriaEmpleado_id: empleado.categoriaEmpleado_id,
                    salario_base_diario: categoriaSalarial.salario_dia,
                    fecha_vence_subir_adjunto: futureDateString,
                    tipoContratacion_id: tipoContratacionId,
                    coordinadoPor_id: coordinadoPor_id,
                    coordinador_id: coordinador_id,
                    usuario_insercion: usuario_insercion,
                    mobile_upload: true,
                }
        });

        console.log("accionPersonal created: ", accionPersonal);
        
        return { status: true, data: accionPersonal, message: "Acción personal creada correctamente" };
    } catch (error) {
        console.error(error);
        return { status: false, message: "Error al crear la acción personal" };
    }
}