/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

function parseDateOnly(value: any): Date | null {
    if (!value) return null;
    const s = String(value);
    const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
    if (isNaN(d.getTime())) return null;
    return d;
}

function normalizeHoraMovimientoInput(value: any): { ok: true; horaNormalized: string } | { ok: false } {
    if (value == null || String(value).trim() === "") return { ok: false };
    let s = String(value).trim();
    if (s.includes("T")) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
            const hh = String(d.getUTCHours()).padStart(2, "0");
            const mm = String(d.getUTCMinutes()).padStart(2, "0");
            const ss = String(d.getUTCSeconds()).padStart(2, "0");
            return { ok: true, horaNormalized: `1970-01-01T${hh}:${mm}:${ss}.000Z` };
        }
        s = s.split("T")[1]?.split(".")[0] || "";
    }
    const parts = s.split(":");
    if (parts.length < 2) return { ok: false };
    const h = String(parseInt(parts[0], 10) || 0).padStart(2, "0");
    const m = String(parseInt(parts[1], 10) || 0).padStart(2, "0");
    const sec = String(parseInt(parts[2] ?? "0", 10) || 0).padStart(2, "0");
    const tryD = new Date(`1970-01-01T${h}:${m}:${sec}`);
    if (isNaN(tryD.getTime())) return { ok: false };
    return { ok: true, horaNormalized: `1970-01-01T${h}:${m}:${sec}.000Z` };
}

async function getMarcaDiaOrFail(req: NextRequest, marcaId: number) {
    const marcaDia = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marcaId } }
    });
    if (!marcaDia) return { ok: false as const, marcaDia: null, message: "Marca no encontrada" };
    if (!marcaDia.empleadoFijo_id) return { ok: false as const, marcaDia: null, message: "Empleado no encontrado" };

    const lastMarca = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "c_marca_dia",
            operation: "findFirst",
            where: { empleadoFijo_id: marcaDia.empleadoFijo_id },
            orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }]
        }
    });
    if (!lastMarca) return { ok: false as const, marcaDia: null, message: "No se encontró la última marca" };
    return { ok: true as const, marcaDia, message: "" };
}

async function validateLlaveroOwnership(req: NextRequest, llaveroId: number, marcaId: number) {
    const marcaRes = await getMarcaDiaOrFail(req, marcaId);
    if (!marcaRes.ok) return { ok: false as const, llavero: null, message: marcaRes.message };
    const marcaDia = marcaRes.marcaDia!;

    const llavero = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_llavero", operation: "findUnique", where: { id: llaveroId } }
    });
    if (!llavero) return { ok: false as const, llavero: null, message: "Llavero no encontrado" };
    if (llavero.cliente_id !== marcaDia.cliente_id || llavero.corpo_id !== marcaDia.corpo_id) {
        return { ok: false as const, llavero: null, message: "No autorizado" };
    }
    return { ok: true as const, llavero, message: "" };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

        const resolvedParams = await context.params;
        const llaveroId = parseInt(resolvedParams.id);
        if (!llaveroId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

        const marcaIdStr = req.nextUrl.searchParams.get("m");
        if (!marcaIdStr) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        const marcaId = parseInt(marcaIdStr);

        const own = await validateLlaveroOwnership(req, llaveroId, marcaId);
        if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

        const rows = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_movimiento_llavero",
                operation: "findMany",
                where: { llavero_id: llaveroId },
                orderBy: { id: "desc" }
            }
        });

        return NextResponse.json({ status: true, data: rows }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/llaveros/[id]/movimientos:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

        const resolvedParams = await context.params;
        const llaveroId = parseInt(resolvedParams.id);
        if (!llaveroId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

        const llavero = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_llavero", operation: "findUnique", where: { id: llaveroId } }
        });
        if (!llavero) return NextResponse.json({ status: false, message: "Llavero no encontrado" }, { status: 200 });

        const body = await req.json();
        const {
            marca_id,
            nombre_persona_recibe,
            nombre_persona_entrega,
            departamento,
            telefono,
            fecha,
            hora,
            firma_entrega,
            firma_recibe,
            firma_responsable,
        } = body ?? {};

        if (!marca_id) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

        const own = await validateLlaveroOwnership(req, llaveroId, parseInt(String(marca_id)));
        if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

        const fechaDate = parseDateOnly(fecha);
        const horaNormRes = normalizeHoraMovimientoInput(hora);
        if (!fechaDate || !horaNormRes.ok) return NextResponse.json({ status: false, message: "Fecha u hora inválida" }, { status: 500 });
        const horaNormalized = horaNormRes.horaNormalized;

        const requiredStrings = [
            nombre_persona_recibe,
            nombre_persona_entrega,
            departamento,
            telefono,
            firma_responsable,
        ];
        if (requiredStrings.some((v) => typeof v !== "string" || v.trim().length === 0)) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const created = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_movimiento_llavero",
                data: {
                    llavero_id: llaveroId,
                    nombre_persona_recibe: String(nombre_persona_recibe),
                    nombre_persona_entrega: String(nombre_persona_entrega),
                    departamento: String(departamento),
                    telefono: String(telefono),
                    fecha: fechaDate.toISOString(),
                    // Guardar la hora como cadena HH:mm:ss sin desplazamiento por zona horaria
                    hora: horaNormalized,
                    firma_entrega:
                        firma_entrega != null && typeof firma_entrega === "string" && firma_entrega.trim().length > 0
                            ? firma_entrega.trim()
                            : null,
                    firma_recibe:
                        firma_recibe != null && typeof firma_recibe === "string" && firma_recibe.trim().length > 0
                            ? firma_recibe.trim()
                            : null,
                    firma_responsable: String(firma_responsable),
                }
            }
        });

        if (created) {
            let sucursalNombre = "Desconocida";
            let fechaRegistro = fechaDate.toISOString().split("T")[0];
            let horaRegistro = horaNormalized;

            if (llavero.corpo_id) {
                const sucursal = await callDynamicPrisma({
                    req,
                    data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: llavero.corpo_id } }
                });
                if (sucursal) {
                    sucursalNombre = sucursal.nombre;
                }
            }

            const description = "Se ha registrado un movimiento del llavero " + llavero.nombre_llavero + " de la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro + " (Del empleado " + nombre_persona_entrega + " a " + nombre_persona_recibe + ")";
            await sendNotificationByRole(req, llavero.corpo_id, [], "Movimiento de llavero registrado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        // Registrar cambio de creación
        const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                data: {
                    nombre_tabla: "e_movimiento_llavero",
                    registro_id: created.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: created.id,
                            llavero_id: created.llavero_id,
                            nombre_persona_recibe: created.nombre_persona_recibe,
                            nombre_persona_entrega: created.nombre_persona_entrega,
                            departamento: created.departamento,
                            telefono: created.telefono,
                            fecha: created.fecha instanceof Date ? created.fecha.toISOString() : created.fecha,
                            hora: created.hora instanceof Date ? created.hora.toISOString() : created.hora,
                            firma_entrega: created.firma_entrega,
                            firma_recibe: created.firma_recibe,
                            firma_responsable: created.firma_responsable,
                        },
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                }
            }
        });

        // Crear automáticamente movimientos de llave para llaves con cantidad_copias === 1
        const llaveMovements: { llave_id: number; id: number }[] = [];
        try {
            const llavesEnLlavero = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_llave_en_llavero",
                    operation: "findMany",
                    where: { llavero_id: llaveroId },
                    include: {
                        e_llave: true,
                    }
                }
            });

            if (Array.isArray(llavesEnLlavero)) {
                for (const llaveRel of llavesEnLlavero) {
                    let llave = (llaveRel as any).e_llave;
                    
                    // Si el include no funcionó, obtener la llave por separado
                    if (!llave && llaveRel.llave_id) {
                        llave = await callDynamicPrisma({
                            req,
                            data: {
                                action: "GET",
                                table: "e_llave",
                                operation: "findUnique",
                                where: { id: llaveRel.llave_id }
                            }
                        });
                    }

                    if (llave && llave.cantidad_copias === 1) {
                        // Crear movimiento de llave con los mismos datos del movimiento de llavero (misma normalización de hora que POST /api/llaves/[id]/movimientos)
                        const movCreado = await callDynamicPrisma({
                            req,
                            data: {
                                action: "POST",
                                table: "e_movimiento_llave",
                                data: {
                                    llave_id: llave.id,
                                    nombre_persona_recibe: String(nombre_persona_recibe),
                                    nombre_persona_entrega: String(nombre_persona_entrega),
                                    departamento: String(departamento),
                                    telefono: String(telefono),
                                    fecha: fechaDate.toISOString(),
                                    hora: horaNormalized,
                                    firma_entrega:
                                        firma_entrega != null && typeof firma_entrega === "string" && firma_entrega.trim().length > 0
                                            ? firma_entrega.trim()
                                            : null,
                                    firma_recibe:
                                        firma_recibe != null && typeof firma_recibe === "string" && firma_recibe.trim().length > 0
                                            ? firma_recibe.trim()
                                            : null,
                                    firma_responsable: String(firma_responsable),
                                }
                            }
                        });
                        if (movCreado?.id) {
                            llaveMovements.push({ llave_id: llave.id, id: movCreado.id });
                        }
                    }
                }
            }
        } catch (error) {
            // Si hay un error al crear los movimientos de llave, no fallar el movimiento de llavero
            console.error("Error al crear movimientos de llave automáticos:", error);
        }

        return NextResponse.json(
            {
                status: true,
                message: "Movimiento creado correctamente",
                id: created.id,
                llave_movements: llaveMovements,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/llaveros/[id]/movimientos:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


