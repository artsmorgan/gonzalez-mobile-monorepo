import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { reportError } from "../../../../utils/reportError";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!Number.isFinite(id)) {
            await reportError(req, "api/voice-notes/[id]", "PATCH", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const body = await req.json();
        const {
            titulo, descripcion,
            marca_id, setPuesto, use_structure_from_hierarchy,
            structure_empresa_id, structure_cliente_id, structure_corpo_id, structure_puesto_id,
        } = body;

        if (titulo == null || descripcion == null || String(titulo).trim() === "" || String(descripcion).trim() === "") {
            await reportError(req, "api/voice-notes/[id]", "PATCH", 400, "Título y descripción son obligatorios");
            return NextResponse.json({ status: false, message: "Título y descripción son obligatorios" }, { status: 400 });
        }

        const voiceNote = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_notas_voz", operation: "findUnique", where: { id } }
        });
        if (!voiceNote) {
            await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "Nota de voz no encontrada");
            return NextResponse.json({ status: false, message: "Nota de voz no encontrada" }, { status: 404 });
        }

        const editorId = typeof payload?.id === "number" ? payload.id : parseInt(String(payload?.id), 10);
        if (!Number.isFinite(editorId) || voiceNote.created_by !== editorId) {
            await reportError(req, "api/voice-notes/[id]", "PATCH", 400, "No autorizado a modificar esta nota");
            return NextResponse.json({ status: false, message: "No autorizado a modificar esta nota" }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
            titulo: String(titulo).trim(),
            descripcion: String(descripcion).trim(),
        };

        const marcaIdNum = marca_id != null && String(marca_id).trim() !== "" ? parseInt(String(marca_id), 10) : NaN;
        if (Number.isFinite(marcaIdNum) && marcaIdNum > 0 && typeof use_structure_from_hierarchy === "boolean") {
            const marca = await prisma.c_marca_dia.findUnique({ where: { id: marcaIdNum } });
            if (!marca) {
                await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "Marca no encontrada");
                return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
            }

            let empresaId = marca.empresa_id;
            let clienteId = marca.cliente_id;
            let corpoId = marca.corpo_id;
            let puestoIdFinal: number | null = null;

            if (use_structure_from_hierarchy === true) {
                const se = parseInt(String(structure_empresa_id), 10);
                const sc = parseInt(String(structure_cliente_id), 10);
                const sco = parseInt(String(structure_corpo_id), 10);
                if (!Number.isFinite(se) || se <= 0 || !Number.isFinite(sc) || sc <= 0 || !Number.isFinite(sco) || sco <= 0) {
                    await reportError(req, "api/voice-notes/[id]", "PATCH", 400, "Jerarquía incompleta (empresa, cliente o corpo)");
                    return NextResponse.json({ status: false, message: "Jerarquía incompleta (empresa, cliente o corpo)" }, { status: 400 });
                }
                empresaId = se;
                clienteId = sc;
                corpoId = sco;
                if (structure_puesto_id !== undefined && structure_puesto_id !== null && String(structure_puesto_id).trim() !== "") {
                    const sp = parseInt(String(structure_puesto_id), 10);
                    if (!Number.isFinite(sp) || sp <= 0) {
                        await reportError(req, "api/voice-notes/[id]", "PATCH", 400, "puesto_id inválido en la jerarquía");
                        return NextResponse.json({ status: false, message: "puesto_id inválido en la jerarquía" }, { status: 400 });
                    }
                    const puestoSel = await prisma.e_estructura_puesto.findUnique({ where: { id: sp } });
                    if (!puestoSel) {
                        await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "Puesto no encontrado");
                        return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 404 });
                    }
                    if (puestoSel.sucursal_id == null || Number(puestoSel.sucursal_id) !== corpoId) {
                        await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "El puesto no pertenece al corpo seleccionado");
                        return NextResponse.json({ status: false, message: "El puesto no pertenece al corpo seleccionado" }, { status: 404 });
                    }
                    puestoIdFinal = sp;
                }
            } else {
                puestoIdFinal = setPuesto === true && marca.puesto_id != null ? Number(marca.puesto_id) : null;
                if (setPuesto === true && puestoIdFinal) {
                    if (!Number.isFinite(puestoIdFinal as number) || (puestoIdFinal as number) <= 0) {
                        await reportError(req, "api/voice-notes/[id]", "PATCH", 400, "La marca no tiene puesto asignado");
                        return NextResponse.json({ status: false, message: "La marca no tiene puesto asignado" }, { status: 400 });
                    }
                    const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoIdFinal } });
                    if (!puesto) {
                        await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "Puesto no encontrado");
                        return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 404 });
                    }
                }
            }

            if (!empresaId || !clienteId || !corpoId) {
                await reportError(req, "api/voice-notes/[id]", "PATCH", 500, "Empresa, cliente o corpo no identificable");
                return NextResponse.json({ status: false, message: "Empresa, cliente o corpo no identificable" }, { status: 500 });
            }

            const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: empresaId } });
            if (!empresa) {
                await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "Empresa no encontrada");
                return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 404 });
            }
            const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: clienteId } });
            if (!cliente) {
                await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "Cliente no encontrada");
                return NextResponse.json({ status: false, message: "Cliente no encontrada" }, { status: 404 });
            }
            const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: corpoId } });
            if (!corpo) {
                await reportError(req, "api/voice-notes/[id]", "PATCH", 404, "Corpo no encontrada");
                return NextResponse.json({ status: false, message: "Corpo no encontrada" }, { status: 404 });
            }

            updateData.empresa_id = empresa.id;
            updateData.cliente_id = cliente.id;
            updateData.corpo_id = corpo.id;
            updateData.puesto_id = puestoIdFinal;
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_notas_voz",
                operation: "update",
                where: { id },
                data: updateData
            }
        });
        return NextResponse.json({ status: true, message: "Nota de voz actualizada con éxito" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/voice-notes/[id]", "PATCH", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const voiceNote = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_notas_voz", operation: "findUnique", where: { id } }
        });
        if (!voiceNote) {
            await reportError(req, "api/voice-notes/[id]", "DELETE", 404, "Nota de voz no encontrada");
            return NextResponse.json({ status: false, message: "Nota de voz no encontrada" }, { status: 404 });
        }

        await callDynamicPrisma({
            req,
            data: { action: "DELETE", table: "c_notas_voz", where: { id }, returning: false }
        });
        return NextResponse.json({ status: true, message: "Nota de voz eliminada con éxito" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/voice-notes/[id]", "DELETE", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}