import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ corpo_id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const corpoId = parseInt(resolvedParams.corpo_id, 10);

        if (!corpoId) {
            return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
        }

        const proto = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
        const baseUrl = host ? `${proto}://${host}` : "";

        const records = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_apertura_cierre_puesto",
                operation: "findMany",
                where: {
                    corpo_id: corpoId,
                    isActive: true,
                },
                orderBy: {
                    created_at: 'desc'
                },
                include: {
                    c_imagenes_apertura_cierre_puesto: true,
                    e_estructura_cliente: { select: { nombre: true } },
                    e_estructura_sucursal: { select: { nombre: true } },
                    e_estructura_puesto: { select: { nombre: true } },
                    n_division: { select: { nombre: true } },
                },
            },
        });

        const recordsArray = Array.isArray(records) ? records : [];

        const empresaIds = [
            ...new Set(
                recordsArray
                    .map((r: any) => Number(r?.empresa_id))
                    .filter((n: number) => Number.isFinite(n) && n > 0)
            ),
        ];
        const contratoIds = [
            ...new Set(
                recordsArray
                    .map((r: any) => Number(r?.contrato_id))
                    .filter((n: number) => Number.isFinite(n) && n > 0)
            ),
        ];

        const empresaNombreById = new Map<number, string>();
        const contratoNombreById = new Map<number, string>();

        await Promise.all([
            ...empresaIds.map(async (id) => {
                try {
                    const row = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "e_estructura_empresa",
                            operation: "findUnique",
                            where: { id },
                        },
                    });
                    if (row && typeof (row as any).nombre === "string") {
                        empresaNombreById.set(id, String((row as any).nombre));
                    }
                } catch {
                    /* ignore */
                }
            }),
            ...contratoIds.map(async (id) => {
                try {
                    const row = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "e_estructura_contrato",
                            operation: "findUnique",
                            where: { id },
                        },
                    });
                    if (row && typeof (row as any).nombre === "string") {
                        contratoNombreById.set(id, String((row as any).nombre));
                    }
                } catch {
                    /* ignore */
                }
            }),
        ]);

        const recordsWithIdLocal = recordsArray.map((record: any) => ({
            ...record,
            id_local: "",
            empresa_nombre:
                Number(record?.empresa_id) > 0
                    ? empresaNombreById.get(Number(record.empresa_id)) ?? null
                    : null,
            cliente_nombre: record.e_estructura_cliente?.nombre || null,
            contrato_nombre:
                Number(record?.contrato_id) > 0
                    ? contratoNombreById.get(Number(record.contrato_id)) ?? null
                    : null,
            corpo_nombre: record.e_estructura_sucursal?.nombre || null,
            puesto_nombre: record.e_estructura_puesto?.nombre || null,
            division_nombre: record.n_division?.nombre || null,
            images: (record.c_imagenes_apertura_cierre_puesto || []).map((f: any) => ({
                id: f.id,
                name: f.name,
                original_name: f.original_name,
                url: baseUrl ? `${baseUrl}/api/opening-closing-position/${record.id}/get-image/${f.name}` : "",
            })),
        }));

        return NextResponse.json({
            status: true,
            message: "Aperturas-Cierres de Puesto obtenidos correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
    }
}

