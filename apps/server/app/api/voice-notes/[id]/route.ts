import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!Number.isFinite(id)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 200 });
        }

        const body = await req.json();
        const {
            titulo, descripcion,
            marca_id, setPuesto, use_structure_from_hierarchy,
            structure_empresa_id, structure_cliente_id, structure_corpo_id, structure_puesto_id,
        } = body;

        if (titulo == null || descripcion == null || String(titulo).trim() === "" || String(descripcion).trim() === "") {
            return NextResponse.json({ status: false, message: "Título y descripción son obligatorios" }, { status: 200 });
        }

        const voiceNote = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_notas_voz", operation: "findUnique", where: { id } }
        });
        if (!voiceNote) return NextResponse.json({ status: false, message: "Nota de voz no encontrada" }, { status: 200 });

        const editorId = typeof payload?.id === "number" ? payload.id : parseInt(String(payload?.id), 10);
        if (!Number.isFinite(editorId) || voiceNote.created_by !== editorId) {
            return NextResponse.json({ status: false, message: "No autorizado a modificar esta nota" }, { status: 200 });
        }

        const updateData: Record<string, unknown> = {
            titulo: String(titulo).trim(),
            descripcion: String(descripcion).trim(),
        };

        const marcaIdNum = marca_id != null && String(marca_id).trim() !== "" ? parseInt(String(marca_id), 10) : NaN;
        if (Number.isFinite(marcaIdNum) && marcaIdNum > 0 && typeof use_structure_from_hierarchy === "boolean") {
            const marca = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marcaIdNum } }
            });
            if (!marca) {
                return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
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
                    return NextResponse.json({ status: false, message: "Jerarquía incompleta (empresa, cliente o corpo)" }, { status: 200 });
                }
                empresaId = se;
                clienteId = sc;
                corpoId = sco;
                if (structure_puesto_id !== undefined && structure_puesto_id !== null && String(structure_puesto_id).trim() !== "") {
                    const sp = parseInt(String(structure_puesto_id), 10);
                    if (!Number.isFinite(sp) || sp <= 0) {
                        return NextResponse.json({ status: false, message: "puesto_id inválido en la jerarquía" }, { status: 200 });
                    }
                    const puestoSel = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: sp } }
                    });
                    if (!puestoSel) {
                        return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
                    }
                    if (puestoSel.sucursal_id == null || Number(puestoSel.sucursal_id) !== corpoId) {
                        return NextResponse.json({ status: false, message: "El puesto no pertenece al corpo seleccionado" }, { status: 200 });
                    }
                    puestoIdFinal = sp;
                }
            } else {
                puestoIdFinal = setPuesto === true && marca.puesto_id != null ? Number(marca.puesto_id) : null;
                if (setPuesto === true) {
                    if (!Number.isFinite(puestoIdFinal as number) || (puestoIdFinal as number) <= 0) {
                        return NextResponse.json({ status: false, message: "La marca no tiene puesto asignado" }, { status: 200 });
                    }
                    const puesto = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoIdFinal } }
                    });
                    if (!puesto) {
                        return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
                    }
                }
            }

            const empresa = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_empresa", operation: "findUnique", where: { id: empresaId } }
            });
            if (!empresa) {
                return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
            }
            const cliente = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: clienteId } }
            });
            if (!cliente) {
                return NextResponse.json({ status: false, message: "Cliente no encontrada" }, { status: 200 });
            }
            const corpo = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpoId } }
            });
            if (!corpo) {
                return NextResponse.json({ status: false, message: "Corpo no encontrada" }, { status: 200 });
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
        if (!voiceNote) return NextResponse.json({ status: false, message: "Nota de voz no encontrada" }, { status: 200 });

        await callDynamicPrisma({
            req,
            data: { action: "DELETE", table: "c_notas_voz", where: { id }, returning: false }
        });
        return NextResponse.json({ status: true, message: "Nota de voz eliminada con éxito" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}