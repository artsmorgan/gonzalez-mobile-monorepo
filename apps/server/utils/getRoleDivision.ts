import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

type RoleDivision = {
    role: { id: number, nombre: string };
    division: { id: number, nombre: string };
};

export default async function getRoleDivision(req: NextRequest, plaza: any, contrato: any) {
    const roleDivision: RoleDivision = {
        role: { id: 1, nombre: "OPERATIVO" },
        division: { id: 0, nombre: "Indeterminable" },
    };

    try {
        if (contrato.division_id) {
            const division = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "n_division",
                    operation: "findFirst",
                    where: {
                        id: contrato.division_id
                    }
                }
            });

            if (division) {
                roleDivision.division.id = division.id;
                roleDivision.division.nombre = division.nombre;
            }
            if (plaza && plaza.categoriaSalarial_id) {
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
                        let role = "OPERATIVO";
                        switch (categoria_empleado.codigo) {
                            case "OFI":
                                role = "OPERATIVO";
                                break;
                            case "MIS":
                                role = "OPERATIVO";
                                break;
                            case "OFC":
                                role = "OPERATIVO";
                                break;
                            case "ADM":
                                role = "ADMINISTRATIVO";
                                break;
                            case "COO":
                                role = "SUPERVISOR";
                                break;
                            case "SUP":
                                role = "SUPERVISOR";
                                break;
                        }
                        roleDivision.role.id = categoria_empleado.id;
                        roleDivision.role.nombre = role;
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error al obtener el rol y la división:", error);
        return roleDivision;
    }

    return roleDivision;
}