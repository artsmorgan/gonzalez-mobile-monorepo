/* eslint-disable @typescript-eslint/no-explicit-any */
import { authorizeMarcaAccess } from "../objectAccess";
import { rolPuedeGestionar } from "./edicion";

/**
 * Quién puede editar un documento y borrar sus archivos: la misma regla que la app aplica a «Act. puestos» y «Act. empleados» (rol distinto de OPERATIVO),
 * pero comprobada EN EL SERVIDOR. El rol sale de la marca con la que trabaja la persona (su plaza y contrato), igual que en el inicio de sesión, y la marca
 * tiene que ser suya (titular o reemplazo) o de un administrador. Todo lo dudoso se niega.
 */
export type DecisionGestion =
    | { allowed: true }
    | { allowed: false; status: 403 | 404; code: "permission_denied" | "not_found"; message: string };

export const MENSAJE_ROL_SIN_EDICION = "Tu rol no puede editar documentos";

export function cuerpoDenegado(d: Extract<DecisionGestion, { allowed: false }>): { status: false; code: string; message: string } {
    return { status: false, code: d.code, message: d.message };
}

export async function autorizarGestionManual(p: {
    callerId: unknown;
    marca: { empleadoFijo_id?: unknown; empleadoReemplaza_id?: unknown } | null | undefined;
    /** Nombre del rol de la marca (`OPERATIVO`, `SUPERVISOR`, `ADMINISTRATIVO`); solo se pide si hace falta. */
    roleNameOfMarca: (marca: any) => Promise<string | null | undefined>;
    isAdmin?: () => Promise<boolean>;
}): Promise<DecisionGestion> {
    if (!p.marca) return { allowed: false, status: 404, code: "not_found", message: "Marca no encontrada" };

    let admin: boolean | null = null;
    const isAdmin = async () => {
        if (admin === null) {
            try {
                admin = p.isAdmin ? (await p.isAdmin()) === true : false;
            } catch {
                admin = false; // si no se puede comprobar, no se concede
            }
        }
        return admin;
    };

    const acceso = await authorizeMarcaAccess({ callerId: p.callerId, marca: p.marca, isAdmin });
    if (!acceso.allowed) return { allowed: false, status: 403, code: "permission_denied", message: acceso.message };
    if (await isAdmin()) return { allowed: true };

    let rol: string | null | undefined;
    try {
        rol = await p.roleNameOfMarca(p.marca);
    } catch {
        rol = null;
    }
    return rolPuedeGestionar(rol) ? { allowed: true } : { allowed: false, status: 403, code: "permission_denied", message: MENSAJE_ROL_SIN_EDICION };
}
