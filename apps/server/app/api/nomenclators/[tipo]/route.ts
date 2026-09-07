import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { mapNomenclatorRow, resolveNomenclatorKind, resolveNomenclatorTable } from "../../../../utils/nomenclatorsConfig";
import {
    EJECUTIVO_COORDINADOR_TABLE,
    fetchEjecutivoCoordinadorList,
    mapEjecutivoCoordinadorRow,
    parseEjecutivoCoordinadorPayload,
    validateEjecutivoCoordinadorAssignment,
} from "../../../../utils/nomenclatorsEjecutivoCoordinador";
import {
    assignEmpleadoEjecutivo,
    fetchEmpleadoEjecutivoList,
    mapEmpleadoEjecutivoRow,
    parseEmpleadoEjecutivoPayload,
} from "../../../../utils/nomenclatorsEmpleadoEjecutivo";
import { fetchMobileVariablesList } from "../../../../utils/nomenclatorsMobileVariables";
import {
    articuloCorpoPuestoExists,
    fetchTipoMantenimientoArticuloList,
    mapTipoMantenimientoArticuloRow,
    parseTipoMantenimientoArticuloPayload,
    TIPO_MANTENIMIENTO_ARTICULO_TABLE,
} from "../../../../utils/nomenclatorsTipoMantenimientoArticulo";
import {
    createSuperAdmin,
    fetchSuperAdminsList,
    parseSuperAdminCreatePayload,
} from "../../../../utils/nomenclatorsSuperAdmins";
import { isSuperAdminEmpleado } from "../../../../utils/isSuperAdminEmpleado";
import { reportError } from "../../../../utils/reportError";

async function requireCallerSuperAdmin(req: NextRequest, payload: any, method: string): Promise<NextResponse | null> {
    const empleadoId = payload?.id != null ? Number(payload.id) : 0;
    if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
        await reportError(req, "api/nomenclators/[tipo]", method, 403, "Usuario no autorizado");
        return NextResponse.json({ status: false, message: "Usuario no autorizado" }, { status: 403 });
    }
    const ok = await isSuperAdminEmpleado(req, empleadoId);
    if (!ok) {
        await reportError(req, "api/nomenclators/[tipo]", method, 403, "Se requiere rol SUPER_ADMIN para administrar este nomenclador");
        return NextResponse.json(
            { status: false, message: "Se requiere rol SUPER_ADMIN para administrar este nomenclador" },
            { status: 403 }
        );
    }
    return null;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ tipo: string }> }
) {
    try {
        const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const { tipo } = await context.params;
        const table = resolveNomenclatorTable(tipo);
        if (!table) {
            await reportError(req, "api/nomenclators/[tipo]", "GET", 400, "Tipo de nomenclador no válido");
            return NextResponse.json(
                { status: false, message: "Tipo de nomenclador no válido" },
                { status: 400 }
            );
        }

        if (resolveNomenclatorKind(tipo) === "super-admin") {
            const denied = await requireCallerSuperAdmin(req, payload, "GET");
            if (denied) return denied;
            const data = await fetchSuperAdminsList(req);
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        if (resolveNomenclatorKind(tipo) === "ejecutivo-coordinador") {
            const data = await fetchEjecutivoCoordinadorList(req);
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        if (resolveNomenclatorKind(tipo) === "empleado-ejecutivo") {
            const data = await fetchEmpleadoEjecutivoList(req);
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        if (resolveNomenclatorKind(tipo) === "mobile-variable") {
            const data = await fetchMobileVariablesList(req);
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        if (resolveNomenclatorKind(tipo) === "tipo-mantenimiento-articulo") {
            const articuloIdParam = req.nextUrl.searchParams.get("articulo_id");
            const articuloId =
                articuloIdParam != null && articuloIdParam !== ""
                    ? Number(articuloIdParam)
                    : null;
            const data = await fetchTipoMantenimientoArticuloList(
                req,
                articuloId != null && Number.isFinite(articuloId) && articuloId > 0 ? articuloId : null,
            );
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        const rows = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table,
                operation: "findMany",
                orderBy: { nombre: "asc" },
            },
        });

        const data = (Array.isArray(rows) ? rows : [])
            .map(mapNomenclatorRow)
            .filter((row): row is { id: number; nombre: string } => row !== null);

        return NextResponse.json({ status: true, data }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(`Error in GET /api/nomenclators/[tipo]:`, errorMessage);
        await reportError(req, "api/nomenclators/[tipo]", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ tipo: string }> }
) {
    try {
        const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const { tipo } = await context.params;
        const table = resolveNomenclatorTable(tipo);
        if (!table) {
            await reportError(req, "api/nomenclators/[tipo]", "POST", 400, "Tipo de nomenclador no válido");
            return NextResponse.json(
                { status: false, message: "Tipo de nomenclador no válido" },
                { status: 400 }
            );
        }

        const body = await req.json();

        if (resolveNomenclatorKind(tipo) === "super-admin") {
            const denied = await requireCallerSuperAdmin(req, payload, "POST");
            if (denied) return denied;

            const createPayload = parseSuperAdminCreatePayload(body);
            if (!createPayload) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 400, "Debe seleccionar un empleado válido");
                return NextResponse.json(
                    { status: false, message: "Debe seleccionar un empleado válido" },
                    { status: 400 }
                );
            }

            const result = await createSuperAdmin(req, createPayload.empleado_id);
            if (!result.ok) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", result.status, result.message);
                return NextResponse.json(
                    { status: false, message: result.message },
                    { status: result.status }
                );
            }

            return NextResponse.json(
                { status: true, message: "Super admin creado correctamente", data: result.data },
                { status: 201 }
            );
        }

        if (resolveNomenclatorKind(tipo) === "mobile-variable") {
            await reportError(req, "api/nomenclators/[tipo]", "POST", 405, "No se pueden crear variables del sistema desde esta pantalla");
            return NextResponse.json(
                { status: false, message: "No se pueden crear variables del sistema desde esta pantalla" },
                { status: 405 }
            );
        }

        if (resolveNomenclatorKind(tipo) === "ejecutivo-coordinador") {
            const payload = parseEjecutivoCoordinadorPayload(body);
            if (!payload) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 400, "Debe seleccionar un ejecutivo de cuenta y un coordinador válidos");
                return NextResponse.json(
                    { status: false, message: "Debe seleccionar un ejecutivo de cuenta y un coordinador válidos" },
                    { status: 400 }
                );
            }

            const validation = await validateEjecutivoCoordinadorAssignment(
                req,
                payload.ejecutivo_cuenta_id,
                payload.coordinador_id
            );
            if (!validation.valid) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 409, validation.message);
                return NextResponse.json(
                    { status: false, message: validation.message },
                    { status: 409 }
                );
            }

            const created = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: EJECUTIVO_COORDINADOR_TABLE,
                    operation: "create",
                    data: {
                        ejecutivo_cuenta_id: payload.ejecutivo_cuenta_id,
                        coordinador_id: payload.coordinador_id,
                    },
                },
            });

            const mapped = await mapEjecutivoCoordinadorRow(req, created);
            if (!mapped) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 500, "No se pudo crear el registro");
                return NextResponse.json(
                    { status: false, message: "No se pudo crear el registro" },
                    { status: 500 }
                );
            }

            return NextResponse.json(
                { status: true, message: "Registro creado correctamente", data: mapped },
                { status: 201 }
            );
        }

        if (resolveNomenclatorKind(tipo) === "empleado-ejecutivo") {
            const planillasToken =
                decodeURIComponent(req.headers.get("Planillas-Token") ?? req.headers.get("planillas-token") ?? "") ||
                null;
            if (!planillasToken) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 401, "Token de Planillas requerido");
                return NextResponse.json(
                    { status: false, message: "Token de Planillas requerido" },
                    { status: 401 }
                );
            }

            const payload = parseEmpleadoEjecutivoPayload(body);
            if (!payload) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 400, "Debe seleccionar un empleado y un ejecutivo de cuenta válidos");
                return NextResponse.json(
                    { status: false, message: "Debe seleccionar un empleado y un ejecutivo de cuenta válidos" },
                    { status: 400 }
                );
            }

            const mapped = await assignEmpleadoEjecutivo(
                req,
                payload.empleado_id,
                payload.ejecutivo_cuenta_id,
                planillasToken
            );

            return NextResponse.json(
                { status: true, message: "Relación guardada correctamente", data: mapped },
                { status: 201 }
            );
        }

        if (resolveNomenclatorKind(tipo) === "tipo-mantenimiento-articulo") {
            const payload = parseTipoMantenimientoArticuloPayload(body);
            if (!payload) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 400, "Debe seleccionar un artículo e indicar un nombre válido");
                return NextResponse.json(
                    { status: false, message: "Debe seleccionar un artículo e indicar un nombre válido" },
                    { status: 400 }
                );
            }

            const exists = await articuloCorpoPuestoExists(req, payload.articulo_id);
            if (!exists) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 400, "El artículo seleccionado no existe");
                return NextResponse.json(
                    { status: false, message: "El artículo seleccionado no existe" },
                    { status: 400 }
                );
            }

            const created = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: TIPO_MANTENIMIENTO_ARTICULO_TABLE,
                    operation: "create",
                    data: {
                        articulo_id: payload.articulo_id,
                        nombre: payload.nombre,
                    },
                },
            });

            const mapped = await mapTipoMantenimientoArticuloRow(req, created);
            if (!mapped) {
                await reportError(req, "api/nomenclators/[tipo]", "POST", 500, "No se pudo crear el registro");
                return NextResponse.json(
                    { status: false, message: "No se pudo crear el registro" },
                    { status: 500 }
                );
            }

            return NextResponse.json(
                { status: true, message: "Registro creado correctamente", data: mapped },
                { status: 201 }
            );
        }

        const nombre = String(body?.nombre ?? "").trim();
        if (!nombre) {
            await reportError(req, "api/nomenclators/[tipo]", "POST", 400, "El nombre es obligatorio");
            return NextResponse.json(
                { status: false, message: "El nombre es obligatorio" },
                { status: 400 }
            );
        }

        const created = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table,
                operation: "create",
                data: { nombre },
            },
        });

        const mapped = mapNomenclatorRow(created);
        if (!mapped) {
            await reportError(req, "api/nomenclators/[tipo]", "POST", 500, "No se pudo crear el registro");
            return NextResponse.json(
                { status: false, message: "No se pudo crear el registro" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { status: true, message: "Registro creado correctamente", data: mapped },
            { status: 201 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(`Error in POST /api/nomenclators/[tipo]:`, errorMessage);
        await reportError(req, "api/nomenclators/[tipo]", "POST", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
