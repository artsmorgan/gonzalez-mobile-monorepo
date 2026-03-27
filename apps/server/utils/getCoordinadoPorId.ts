import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export async function getCoordinadoPorId(req: NextRequest, marcaDia: any) {
    let coordinadoPorId = 9;

    console.log("A");
    const contrato = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "e_estructura_contrato",
            operation: "findUnique",
            where: { id: marcaDia.contrato_id }
        }
    });

    console.log("B");
    const plaza = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "e_estructura_plazas",
            operation: "findUnique",
            where: { id: marcaDia.plaza_id }
        }
    });

    if (!plaza || !contrato) {
        return coordinadoPorId;
    }

    console.log("C");
    const division = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "n_division",
            operation: "findUnique",
            where: { id: contrato.division_id }
        }
    });

    if (!division) {
        return coordinadoPorId;
    }

    let combinaciones: any = {
        "SEG_OFI": 7, // OPERATIVO
        "SEG_MIS": 7, // OPERATIVO
        "SEG_OFC": 7, // OPERATIVO
        "SEG_ADM": 10, // ADMINISTRATIVO
        "SEG_COO": 2, // SUPERVISOR
        "SEG_SUP": 2, // SUPERVISOR

        "AL_OFI": 4, // OPERATIVO
        "AL_MIS": 4, // OPERATIVO
        "AL_OFC": 4, // OPERATIVO
        "AL_ADM": 8, // ADMINISTRATIVO
        "AL_COO": 6, // SUPERVISOR
        "AL_SUP": 6, // SUPERVISOR

        "ADMIN_OFI": 9, // OPERATIVO
        "ADMIN_MIS": 9, // OPERATIVO
        "ADMIN_OFC": 9, // OPERATIVO
        "ADMIN_ADM": 9, // ADMINISTRATIVO
        "ADMIN_COO": 9, // SUPERVISOR
        "ADMIN_SUP": 9, // SUPERVISOR

        "OT_OFI": 9, // OPERATIVO
        "OT_MIS": 9, // OPERATIVO
        "OT_OFC": 9, // OPERATIVO
        "OT_ADM": 9, // ADMINISTRATIVO
        "OT_COO": 9, // SUPERVISOR
        "OT_SUP": 9, // SUPERVISOR
    }
    
    if (plaza.categoriaSalarial_id) {
        console.log("D");
        const categoria_salarial = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "pg_categoria_salarial",
                operation: "findFirst",
                where: {
                    id: plaza.categoriaSalarial_id
                }
            }
        });

        if (categoria_salarial && categoria_salarial.categoriaEmpleado_id) {
            console.log("E");
            const categoria_empleado = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "pg_categoria_empleado",
                    operation: "findFirst",
                    where: {
                        id: categoria_salarial.categoriaEmpleado_id
                    }
                }
            });

            if (categoria_empleado) {
                console.log("F");
                coordinadoPorId = combinaciones[division.codigo + "_" + categoria_empleado.codigo] as number;
            }
        }
    }

    return coordinadoPorId;
}