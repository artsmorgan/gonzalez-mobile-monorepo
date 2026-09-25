/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { uploadDynamicFiles } from "./callDynamicFilesApi";
import { callDynamicPrisma } from "./callDynamicPrisma";

export type AgendaMinutaImageInput = {
  extension?: string;
  file_base64: string;
  original_name?: string;
};

function extensionFromBase64(value: string, fallback: string): string {
  const m = value.match(/^data:image\/([^;]+);base64,/);
  if (m) return m[1].replace("jpeg", "jpg");
  return fallback || "jpg";
}

/** Sube 1 o varias imágenes para una agenda minuta y crea sus filas en `c_imagenes_agenda_minuta`. */
export async function saveAgendaMinutaImages(
  req: NextRequest,
  agendaId: number,
  images: AgendaMinutaImageInput[] | null | undefined,
): Promise<void> {
  if (!Array.isArray(images) || images.length === 0) return;

  const files = images.map((img) => ({
    type: "image",
    extension: extensionFromBase64(img.file_base64, img.extension || "jpg"),
    file_base64: img.file_base64,
  }));

  const uploadResp = await uploadDynamicFiles({
    req,
    folderPath: `agenda-minuta/${agendaId}`,
    files,
  });
  const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];

  for (let i = 0; i < uploaded.length; i++) {
    const file = uploaded[i];
    if (!file?.name) continue;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_imagenes_agenda_minuta",
        operation: "create",
        data: {
          name: file.name,
          agenda_id: agendaId,
          original_name: images[i]?.original_name || file.original_name || file.name,
        },
      },
    });
  }
}
