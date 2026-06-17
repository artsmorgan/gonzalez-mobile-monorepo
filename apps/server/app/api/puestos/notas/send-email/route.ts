import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";
import { transporter } from "../../../../../transporter";
import {
    mergeNotesWhereWithDateRange,
    validateNotesDateRange,
} from "../../../../../utils/notesUpdatedAtDateFilter";

function decodeFirmaHash(hash?: string | null) {
  if (!hash) return null;
  try {
    const decoded = atob(String(hash));
    const parts = decoded.split(":");
    if (parts.length !== 5) return null;
    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
    return { sessionId, empleadoId, latitud, longitud, timestamp };
  } catch {
    return null;
  }
}

function formatSignatureForDisplay(signature?: string | null): string | null {
  if (!signature) return null;
  const s = String(signature).trim();
  if (!s) return null;
  if (s.startsWith("data:")) return s;
  return `data:image/png;base64,${s}`;
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const { puesto_id, email, fecha_inicio, fecha_fin } = await req.json();
    const puestoId = parseInt(String(puesto_id), 10);
    if (!puestoId || Number.isNaN(puestoId)) {
      return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 400 });
    }
    if (!email || String(email).trim().length === 0) {
      return NextResponse.json({ status: false, message: "Email requerido" }, { status: 400 });
    }

    const rangeValidation = validateNotesDateRange(fecha_inicio, fecha_fin);
    if (!rangeValidation.valid) {
      return NextResponse.json({ status: false, message: rangeValidation.message }, { status: 400 });
    }

    const puesto = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoId } },
    });
    if (!puesto) {
      return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 404 });
    }

    const notas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_puesto_notas",
        operation: "findMany",
        where: mergeNotesWhereWithDateRange(
          { puesto_id: puestoId, isActive: true },
          fecha_inicio,
          fecha_fin
        ),
        orderBy: { updated_at: "desc" },
      },
    });

    let notesHtml = "";
    const attachments: any[] = [];
    for (const nota of Array.isArray(notas) ? notas : []) {
      const images = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_imagenes_puesto_notas",
          operation: "findMany",
          where: { nota_id: nota.id },
        },
      });
      const firmaInfo = decodeFirmaHash(nota.firma_responsable);
      const updatedAt = nota.updated_at instanceof Date ? nota.updated_at.toISOString() : String(nota.updated_at || "");
      const createdAt = nota.created_at instanceof Date ? nota.created_at.toISOString() : String(nota.created_at || "");

      let imagesHtml = "<p><b>Imágenes:</b></p>";
      let imagesCounter = 0;
      for (const img of Array.isArray(images) ? images : []) {
        try {
          const fetched = await fetchDynamicFile({
            req,
            type: "image",
            url: `puesto-notas/${nota.id}/${img.name}`,
            download: false,
          });
          const b64 = Buffer.from(fetched.buffer).toString("base64");
          imagesHtml += `<div style="margin-top:8px;"><img src="cid:img${img.id}" alt="${String(img.name || "imagen")}" style="max-width:420px;border:1px solid #ddd;border-radius:6px;" /></div>`;
          attachments.push({
            filename: img.name,
            content: b64,
            encoding: "base64",
            cid: "img" + img.id
          });
          imagesCounter++;
        } catch (e) {
          imagesHtml += `<p style="color:#a00;">No se pudo cargar la imagen ${String(img?.name || "")}</p>`;
        }
      }

      let firmaManualHtml = "<p><b>Firma manual responsable:</b> No registrada</p>";
      if (nota.firma_manual_responsable) {
        firmaManualHtml = `<div><b>Firma manual responsable:</b><br/><img src="cid:imgSignature" alt="firma manual" style="max-width:320px;border:1px solid #ddd;border-radius:6px;" /></div>`;
        attachments.push({
          filename: "firma_manual_" + nota.id + ".png",
          content: nota.firma_manual_responsable.replace("data:image/png;base64,", ""),
          encoding: "base64",
          cid: "imgSignature"
        });
      }

      let categoria_db = "-";
      if (nota.categoria_id) {
        const categoria = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "n_novedades_categoria", operation: "findUnique", where: { id: nota.categoria_id } },
        });
        categoria_db = String(categoria?.nombre || "-");
      }

      notesHtml += `
        <div style="border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:14px;">
          <h3 style="margin:0 0 8px 0;">${String(nota.titulo || "-")}</h3>
          <p><b>Descripción:</b> ${String(nota.description || "-")}</p>
          <p><b>Categoría ID:</b> ${categoria_db}</p>
          <p><b>Relevancia:</b> ${String(nota.relevancia || "-")}</p>
          <p><b>Creado:</b> ${createdAt}</p>
          <p><b>Actualizado:</b> ${updatedAt}</p>
          <p><b>Modificado:</b> ${nota.is_modified ? "Sí" : "No"}</p>
          <p><b>Firma responsable:</b> ${firmaInfo ? `Empleado ${firmaInfo.empleadoId} | Sesión ${firmaInfo.sessionId} | ${firmaInfo.timestamp}` : "No disponible"}</p>
          ${firmaManualHtml}
          ${imagesCounter > 0 ? imagesHtml : "Sin imágenes"}
        </div>
      `;
    }

    await transporter.sendMail({
      from: `Bitácora de novedades - <${process.env.EMAIL_USER}>`,
      to: String(email).trim(),
      subject: `Notas del puesto ${String((puesto as any).nombre || puestoId)}`,
      html: `
        <h2>Notas del puesto ${String((puesto as any).nombre || puestoId)}</h2>
        <p>Este correo contiene el listado de notas e imágenes adjuntas.</p>
        ${notesHtml || "<p>No hay notas registradas para este puesto.</p>"}
      `,
      attachments: attachments,
    });

    return NextResponse.json({ status: true, message: "Correo enviado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
