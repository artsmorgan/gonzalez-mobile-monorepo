import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { sendNotificationByRole, sendNotificationByPlaza } from "../../../utils/sendNotification";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const corpoIdParam = req.nextUrl.searchParams.get("corpo_id") ?? req.nextUrl.searchParams.get("c");
        const puestoIdParam = req.nextUrl.searchParams.get("puesto_id") ?? req.nextUrl.searchParams.get("p");

        if (!corpoIdParam) {
            return NextResponse.json({ status: false, message: "corpo_id no especificado" }, { status: 200 });
        }

        const corpoId = parseInt(String(corpoIdParam), 10);
        if (!Number.isFinite(corpoId) || corpoId <= 0) {
            return NextResponse.json({ status: false, message: "corpo_id inválido" }, { status: 200 });
        }

        const corpo = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpoId } }
        });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
        }

        let voiceNotesWhere: Record<string, unknown>;

        if (puestoIdParam != null && String(puestoIdParam).trim() !== "") {
            const puestoId = parseInt(String(puestoIdParam), 10);
            if (!Number.isFinite(puestoId) || puestoId <= 0) {
                return NextResponse.json({ status: false, message: "puesto_id inválido" }, { status: 200 });
            }
            const puestoRow = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoId } }
            });
            if (!puestoRow) {
                return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
            }
            if (puestoRow.sucursal_id == null || Number(puestoRow.sucursal_id) !== corpoId) {
                return NextResponse.json({ status: false, message: "El puesto no pertenece al corpo indicado" }, { status: 200 });
            }
            voiceNotesWhere = {
                AND: [
                    { isActive: true },
                    {
                        OR: [
                            { corpo_id: corpoId, puesto_id: puestoId },
                            { corpo_id: corpoId, puesto_id: null }
                        ],
                    },
                ],
            };
        } else {
            voiceNotesWhere = { corpo_id: corpoId, isActive: true };
        }

        const voiceNotes = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_notas_voz", operation: "findMany", where: voiceNotesWhere }
        });

        const voiceNotes_return: { id: number, isActive: boolean, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, corpo: { id: number, nombre: string }, puesto: { id: number, nombre: string } | null, titulo: string, descripcion: string, transcripcion: string, firma_responsable: string, nombre_firma: string, nombre_creator: string, id_local: string, file_base64: string, created_by: number, created_at: string }[] = [];

        for (const voiceNote of voiceNotes) {

            const empresa = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_empresa", operation: "findUnique", where: { id: voiceNote.empresa_id } }
            });
            if (!empresa) {
                continue;
            }

            const cliente = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: voiceNote.cliente_id } }
            });
            if (!cliente) {
                continue;
            }

            let nombre_creator = "-";
            const creator = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: voiceNote.created_by } }
            });
            if (creator) {
                nombre_creator = creator.nombre + " " + creator.primer_apellido + " " + creator.segundo_apellido;
                if (creator.cedula) {
                    nombre_creator += " (" + creator.cedula + ")";
                }
            }

            let nombre_firma = "No disponible";
            if (voiceNote.firma_responsable) {
                let id_firma: string | null = null;
                try {
                    const decoded = Buffer.from(String(voiceNote.firma_responsable), "base64").toString("utf8");
                    id_firma = decoded.split(":")[1] || null;
                } catch {
                    id_firma = null;
                }

                if (id_firma) {
                    const firma = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: parseInt(id_firma, 10) } }
                    });
                    if (firma) {
                        nombre_firma = firma.nombre + " " + firma.primer_apellido + " " + firma.segundo_apellido;
                        if (firma.cedula) {
                            nombre_firma += " (" + firma.cedula + ")";
                        }
                    }
                }
            }

            let corpoOut = { id: corpo.id, nombre: corpo.nombre };
            if (voiceNote.corpo_id != null && Number(voiceNote.corpo_id) !== corpoId) {
                const corpoNote = await callDynamicPrisma({
                    req,
                    data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: voiceNote.corpo_id } }
                });
                if (corpoNote) {
                    corpoOut = { id: corpoNote.id, nombre: corpoNote.nombre };
                }
            }

            let puestoNombre = "";
            if (voiceNote.puesto_id) {
                const puestoRow = await callDynamicPrisma({
                    req,
                    data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: voiceNote.puesto_id } }
                });
                if (puestoRow) {
                    puestoNombre = puestoRow.nombre;
                }
            }

            const vnAny = voiceNote as { isActive?: boolean; id: number };
            voiceNotes_return.push({
                id: voiceNote.id,
                isActive: vnAny.isActive !== false,
                empresa: {
                    id: empresa.id,
                    nombre: empresa.nombre
                },
                cliente: {
                    id: cliente.id,
                    nombre: cliente.nombre
                },
                corpo: corpoOut,
                puesto: voiceNote.puesto_id ? {
                    id: voiceNote.puesto_id,
                    nombre: puestoNombre || "—"
                } : null,
                titulo: voiceNote.titulo,
                descripcion: voiceNote.descripcion,
                transcripcion: voiceNote.transcripcion,
                firma_responsable: voiceNote.firma_responsable,
                nombre_firma: nombre_firma,
                nombre_creator: nombre_creator,
                id_local: "",
                file_base64: "",
                created_by: voiceNote.created_by,
                created_at: voiceNote.created_at
            });
        }

        return NextResponse.json({ status: true, voiceNotes: voiceNotes_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const body = await req.json();
        const {
            marca_id, setPuesto, titulo, descripcion, firma_responsable, file_base64, created_at,
            use_structure_from_hierarchy,
            structure_empresa_id, structure_cliente_id, structure_corpo_id, structure_puesto_id,
            structure_division_id, structure_contrato_id,
        } = body;

        if (!marca_id || !titulo || !descripcion || !firma_responsable || !file_base64 || !created_at) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marca = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(marca_id) } }
        });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        let empresaId = marca.empresa_id;
        let clienteId = marca.cliente_id;
        let corpoId = marca.corpo_id;
        let puestoIdFinal: number | null = null;
        let structureDivisionId: number | null = null;
        let structureContratoId: number | null = null;

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
            puestoIdFinal = null;
            if (structure_division_id != null && String(structure_division_id).trim() !== "") {
                const sd = parseInt(String(structure_division_id), 10);
                if (Number.isFinite(sd) && sd > 0) structureDivisionId = sd;
            }
            if (structure_contrato_id != null && String(structure_contrato_id).trim() !== "") {
                const sct = parseInt(String(structure_contrato_id), 10);
                if (Number.isFinite(sct) && sct > 0) structureContratoId = sct;
            }
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

        let resolvedDivisionId: number;
        let resolvedContratoId: number;
        if (use_structure_from_hierarchy === true && structureDivisionId != null && structureDivisionId > 0 && structureContratoId != null && structureContratoId > 0) {
            resolvedDivisionId = structureDivisionId;
            resolvedContratoId = structureContratoId;
        } else {
            const cFromSuc = corpo.contrato_id != null ? Number(corpo.contrato_id) : NaN;
            const cFromMarca = (marca as { contrato_id?: number | null }).contrato_id != null
                ? Number((marca as { contrato_id?: number | null }).contrato_id)
                : NaN;
            const cTry = Number.isFinite(cFromSuc) && cFromSuc > 0 ? cFromSuc : cFromMarca;
            if (!Number.isFinite(cTry) || cTry <= 0) {
                return NextResponse.json({ status: false, message: "No se pudo determinar el contrato (sucursal o marca)" }, { status: 200 });
            }
            const contrRow = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_contrato", operation: "findUnique", where: { id: cTry } }
            });
            const divFromContr = contrRow && (contrRow as { division_id?: number | null }).division_id != null
                ? Number((contrRow as { division_id?: number | null }).division_id)
                : NaN;
            if (!Number.isFinite(divFromContr) || divFromContr <= 0) {
                return NextResponse.json({ status: false, message: "No se pudo determinar la división del contrato" }, { status: 200 });
            }
            resolvedDivisionId = divFromContr;
            resolvedContratoId = cTry;
        }

        const newVoiceNote = await callDynamicPrisma({
            req,
            data: { action: "POST", table: "c_notas_voz", operation: "create", data: {
                empresa_id: empresa.id,
                cliente_id: cliente.id,
                corpo_id: corpo.id,
                puesto_id: puestoIdFinal,
                division_id: resolvedDivisionId,
                contrato_id: resolvedContratoId,
                titulo,
                descripcion,
                path: "-",
                transcripcion: '-',
                firma_responsable,
                created_by: payload.id,
                created_at: new Date(created_at)
            } }
        });

        if (newVoiceNote) {
            if (!/^[A-Za-z0-9+/=]+$/.test(file_base64)) {
                return NextResponse.json({ status: false, message: "Formato de archivo inválido" }, { status: 400 });
            }
            const extension = file_base64.startsWith('UklGR') ? 'wav' : 'm4a';
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `voice-notes/${newVoiceNote.id}`,
                files: [{ type: "audio", extension, file_base64 }],
            });
            const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            const path_file = uploaded[0]?.name || "";
            if (path_file) {
                await callDynamicPrisma({
                    req,
                    data: { action: "UPDATE", table: "c_notas_voz", operation: "update", where: { id: newVoiceNote.id }, data: { path: path_file } }
                });
            }

            const empleado = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: payload.id } }
            });
            if (empleado) {
                const datetime = new Date(created_at);
                const fecha = datetime.toISOString().split("T")[0];
                const hora = datetime.toISOString().split("T")[1].split(".")[0];
                const desc = `El usuario ${empleado.nombre} ${empleado.primer_apellido} ha creado una nueva nota de voz llamada ${titulo} el día ${fecha} a las ${hora}`;
                if (!puestoIdFinal) {
                    await sendNotificationByRole(req, corpo.id, [marca.plaza_id], "Nota de voz creada", desc, ["ADMINISTRATIVO", "SUPERVISOR", "OPERATIVO"]);
                } else {
                    const plaza = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_plazas", operation: "findMany", where: { puesto_id: puestoIdFinal } }
                    });
                    if (plaza.length > 0) {
                        await sendNotificationByPlaza(req, marca.id, "Nota de voz creada", desc, plaza.map((p: { id: number }) => p.id));
                    }
                }
            }
        }

        if (!newVoiceNote || typeof (newVoiceNote as { id?: number }).id !== "number") {
            return NextResponse.json({ status: false, message: "No se pudo crear el registro" }, { status: 200 });
        }
        const createdId = (newVoiceNote as { id: number }).id;
        return NextResponse.json(
            { status: true, message: "Nota de voz creada con éxito", id: createdId, data: { id: createdId } },
            { status: 200 }
        );
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
