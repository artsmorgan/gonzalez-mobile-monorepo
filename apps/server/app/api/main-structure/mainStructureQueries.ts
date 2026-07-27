/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { prisma } from "../../../utils/prismaClient";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

async function dynamicFindMany(req: NextRequest, data: Record<string, any>): Promise<any[]> {
    const rows = await callDynamicPrisma({ req, data: { action: "GET", operation: "findMany", ...data } });
    if (Array.isArray(rows)) return rows;
    return rows != null ? [rows] : [];
}

// --- Tablas preexistentes (Prisma directo) ---

export async function fetchEmpresas() {
    return prisma.e_estructura_empresa.findMany({ where: { deleted: null } });
}

export async function fetchDivisiones() {
    return prisma.n_division.findMany();
}

export async function fetchClientes(empresaIds: number[], activeWhere: Record<string, unknown>) {
    if (empresaIds.length === 0) return [];
    return prisma.e_estructura_cliente.findMany({
        where: { empresa_id: { in: empresaIds }, ...activeWhere },
    });
}

export async function fetchContratos(clienteIds: number[], activeWhere: Record<string, unknown>) {
    if (clienteIds.length === 0) return [];
    return prisma.e_estructura_contrato.findMany({
        where: { cliente_id: { in: clienteIds }, ...activeWhere },
    });
}

export async function fetchSucursales(contratoIds: number[], activeWhere: Record<string, unknown>) {
    if (contratoIds.length === 0) return [];
    return prisma.e_estructura_sucursal.findMany({
        where: { contrato_id: { in: contratoIds }, ...activeWhere },
    });
}

export async function fetchPuestos(sucursalIds: number[], activeWhere: Record<string, unknown>) {
    if (sucursalIds.length === 0) return [];
    return prisma.e_estructura_puesto.findMany({
        where: { sucursal_id: { in: sucursalIds }, ...activeWhere },
    });
}

export async function fetchPlazas(puestoIds: number[], activeWhere: Record<string, unknown>) {
    if (puestoIds.length === 0) return [];
    return prisma.e_estructura_plazas.findMany({
        where: { puesto_id: { in: puestoIds }, ...activeWhere },
    });
}

export async function fetchComboArticulos(comboIds: number[]) {
    if (comboIds.length === 0) return [];
    return prisma.e_estructura_combo_articulo_cp.findMany({ where: { id: { in: comboIds } } });
}

export async function fetchPlanRows(planOrConditions: any[]) {
    if (planOrConditions.length === 0) return [];
    return prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { OR: planOrConditions } });
}

export async function fetchEntregaRows(entregaOrConditions: any[]) {
    if (entregaOrConditions.length === 0) return [];
    return prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({ where: { OR: entregaOrConditions } });
}

export async function fetchNomencladorArticulos(nomencladorIds: number[]) {
    if (nomencladorIds.length === 0) return [];
    return prisma.n_articulo_corpo_puesto.findMany({ where: { id: { in: nomencladorIds } } });
}

export async function fetchEmpleadoPlazaRows(plazaIds: number[]) {
    if (plazaIds.length === 0) return [];
    return prisma.c_empleado_plaza.findMany({
        where: { plaza_id: { in: plazaIds }, empleado_id: { not: null } },
        select: { plaza_id: true, empleado_id: true },
    });
}

export async function fetchEmpleados(empleadoIds: number[]) {
    if (empleadoIds.length === 0) return [];
    return prisma.c_empleado.findMany({
        where: {
            id: { in: empleadoIds },
            fecha_contratacion: { not: null },
            OR: [{ estado: null }, { estado: { not: "BA" } }],
            NOT: [{ cedula: { contains: "@" } }],
        },
        select: {
            id: true,
            codigo: true,
            cedula: true,
            nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
            Email: true,
            telefono: true,
            tipoCedula: true,
            fecha_contratacion: true,
            estado: true,
            supervisor_id: true,
            firma_manual: true,
        },
        orderBy: [{ nombre: "asc" }, { primer_apellido: "asc" }, { segundo_apellido: "asc" }, { id: "asc" }],
    });
}

// --- Tablas creadas (callDynamicPrisma) ---

export async function fetchVehiculosCorporativos(req: NextRequest, sucursalIds: number[]) {
    if (sucursalIds.length === 0) return [];
    return dynamicFindMany(req, {
        table: "c_vehiculos_corporativos",
        where: { sucursal_id: { in: sucursalIds }, isActive: true },
        include: {
            c_usos_vehiculos_corporativos: true,
            c_mantenimiento_vehiculos_corporativos: true,
        },
    });
}

export async function fetchBitacorasVehiculo(req: NextRequest, sucursalIds: number[]) {
    if (sucursalIds.length === 0) return [];
    return dynamicFindMany(req, {
        table: "c_bitacora_vehiculo_detenido",
        where: { sucursal_id: { in: sucursalIds }, isActive: true },
        orderBy: { id: "desc" },
    });
}

export async function fetchLlaves(req: NextRequest, sucursalIds: number[]) {
    if (sucursalIds.length === 0) return [];
    return dynamicFindMany(req, {
        table: "e_llave",
        where: { corpo_id: { in: sucursalIds }, isActive: true },
        include: { e_movimiento_llave: { orderBy: { id: "desc" } } },
        orderBy: { id: "desc" },
    });
}

export async function fetchLlaveros(req: NextRequest, sucursalIds: number[]) {
    if (sucursalIds.length === 0) return [];
    return dynamicFindMany(req, {
        table: "e_llavero",
        where: { corpo_id: { in: sucursalIds }, isActive: true },
        include: {
            e_movimiento_llavero: { orderBy: { id: "desc" } },
            e_llave_en_llavero: { orderBy: { id: "asc" } },
        },
        orderBy: { id: "desc" },
    });
}

export async function fetchTiposMantenimientoArticulo(req: NextRequest, nomencladorIds: number[]) {
    if (nomencladorIds.length === 0) return [];
    return dynamicFindMany(req, {
        table: "n_tipo_mantenimiento_articulo",
        where: { articulo_id: { in: nomencladorIds } },
        select: { id: true, articulo_id: true, nombre: true },
        orderBy: { id: "asc" },
    });
}

export async function fetchArticuloMantenimientos(req: NextRequest, mantOrConditions: any[]) {
    if (mantOrConditions.length === 0) return [];
    return dynamicFindMany(req, {
        table: "c_articulo_mantenimiento",
        where: { OR: mantOrConditions },
        orderBy: { id: "desc" },
        include: {
            c_archivos_adjuntos_articulo_mantenimiento: {
                select: {
                    id: true,
                    name: true,
                    original_name: true,
                    type: true,
                    extension: true,
                },
            },
        },
    });
}

export async function fetchMovimientosArticuloMantenimiento(req: NextRequest, mantOrConditions: any[]) {
    if (mantOrConditions.length === 0) return [];
    return dynamicFindMany(req, {
        table: "c_movimientos_articulo_mantenimiento",
        where: { OR: mantOrConditions },
        orderBy: { id: "desc" },
        select: {
            id: true,
            articulo_plan_id: true,
            articulo_asignado_id: true,
            nombre_persona_recibe: true,
            nombre_persona_entrega: true,
            departamento: true,
            telefono: true,
            entrega: true,
            recibe: true,
            fecha: true,
            hora: true,
            firma_entrega: true,
            firma_recibe: true,
            firma_responsable: true,
        },
    });
}
