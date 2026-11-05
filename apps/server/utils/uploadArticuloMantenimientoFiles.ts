/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { uploadDynamicFiles } from "./callDynamicFilesApi";

export type ArticuloMantenimientoUploadFile = {
  type: string;
  extension: string;
  original_name?: string;
  file_base64: string;
};

export type UploadedArticuloMantenimientoFile = {
  id?: number;
  name: string;
  original_name: string;
  type: string;
  extension: string;
};

/**
 * Sube archivos adjuntos a un registro de c_articulo_mantenimiento (misma lógica que PUT /articulo-mantenimiento/[id]).
 */
export async function uploadArticuloMantenimientoFiles(
  req: NextRequest,
  mantenimientoId: number,
  files: ArticuloMantenimientoUploadFile[]
): Promise<UploadedArticuloMantenimientoFile[]> {
  const id = Number(mantenimientoId);
  if (!Number.isFinite(id) || id <= 0) return [];
  if (!Array.isArray(files) || files.length === 0) return [];

  const validFiles = files.filter((f) => f?.file_base64 && f?.extension && f?.type);
  if (validFiles.length === 0) {
    if (Array.isArray(files) && files.length > 0) {
      console.warn(
        `[uploadArticuloMantenimientoFiles] ${files.length} archivo(s) recibido(s) para mantenimiento ${id}, ninguno con file_base64 válido`,
      );
    }
    return [];
  }

  const dir = path.join(process.cwd(), "public", "uploads", "articulo-mantenimiento", `${id}`);

  for (const file of validFiles) {
    const originalName =
      typeof file.original_name === "string" && file.original_name.trim().length > 0
        ? file.original_name.trim()
        : "";
    if (
      file.type === "image" &&
      (originalName.startsWith("arma_foto_antes") || originalName.startsWith("arma_foto_despues"))
    ) {
      try {
        const existingFiles = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_archivos_adjuntos_articulo_mantenimiento",
            operation: "findMany",
            where: { activo_mantenimiento_id: id, original_name: originalName, type: "image" },
          },
        });
        for (const ef of existingFiles as any[]) {
          try {
            const oldPath = path.join(dir, ef.name);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn("No se pudo eliminar archivo anterior:", e);
          }
        }
        if (Array.isArray(existingFiles) && existingFiles.length > 0) {
          await callDynamicPrisma({
            req,
            data: {
              action: "DELETE",
              table: "c_archivos_adjuntos_articulo_mantenimiento",
              operation: "deleteMany",
              where: { activo_mantenimiento_id: id, original_name: originalName, type: "image" },
            },
          });
        }
      } catch (e) {
        console.warn("No se pudo limpiar imagen previa:", e);
      }
    }
  }

  const uploadResp = await uploadDynamicFiles({
    req,
    folderPath: `articulo-mantenimiento/${id}`,
    files: validFiles.map((f) => ({
      type: (f.type === "document" ? "file" : f.type || "file") as "image" | "video" | "audio" | "file",
      extension: String(f.extension).replace(".", "").trim() || "bin",
      original_name: f.original_name,
      file_base64: f.file_base64,
    })),
  });

  const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
  const out: UploadedArticuloMantenimientoFile[] = [];

  for (let i = 0; i < uploadedFiles.length; i++) {
    const uploaded = uploadedFiles[i];
    const file = validFiles[i];
    const originalName =
      typeof file?.original_name === "string" && file.original_name.trim().length > 0
        ? file.original_name.trim()
        : uploaded?.original_name || uploaded?.name || "";
    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_archivos_adjuntos_articulo_mantenimiento",
        operation: "create",
        data: {
          name: uploaded.name,
          original_name: originalName,
          type: file?.type === "document" ? "file" : file?.type || "file",
          extension: file?.extension || "bin",
          activo_mantenimiento_id: id,
        },
      },
    });
    out.push({
      id: Number((created as any)?.id ?? 0) || undefined,
      name: uploaded.name,
      original_name: originalName,
      type: file?.type === "document" ? "file" : file?.type || "file",
      extension: file?.extension || "bin",
    });
  }

  return out;
}
