/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";

function parseTimeInput(time: any): Date | undefined {
  if (!time) return undefined;
  if (time instanceof Date) {
    return Number.isNaN(time.getTime()) ? undefined : time;
  }
  if (typeof time === "string") {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
      return new Date(Date.UTC(1970, 0, 1, hh, mm, 0, 0));
    }
    const parsed = new Date(time);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

export function validateChecklistEmpleadoHoras(input: {
  empleado_id?: unknown;
  empleado_nombre?: unknown;
  empleado_codigo?: unknown;
  hora_inicio?: unknown;
  hora_fin?: unknown;
}):
  | {
      ok: true;
      empleadoId: number;
      empleadoNombre: string;
      empleadoCodigo: string;
      horaInicio: Date;
      horaFin: Date;
    }
  | { ok: false; message: string } {
  const empleadoId = parseInt(String(input.empleado_id ?? ""), 10);
  const empleadoNombre = String(input.empleado_nombre ?? "").trim();
  const empleadoCodigo = String(input.empleado_codigo ?? "").trim();
  const horaInicio = parseTimeInput(input.hora_inicio);
  const horaFin = parseTimeInput(input.hora_fin);
  const missing: string[] = [];
  if (!Number.isFinite(empleadoId) || empleadoId <= 0) missing.push("empleado");
  if (!empleadoNombre) missing.push("nombre de empleado");
  if (!empleadoCodigo) missing.push("código de empleado");
  if (!horaInicio) missing.push("hora de inicio");
  if (!horaFin) missing.push("hora de fin");
  if (missing.length) {
    return {
      ok: false,
      message: `Datos incompletos: ${missing.join(", ")} son obligatorios`,
    };
  }
  return {
    ok: true,
    empleadoId,
    empleadoNombre,
    empleadoCodigo,
    horaInicio: horaInicio as Date,
    horaFin: horaFin as Date,
  };
}

function collectEvaluationPhotoUploads(obj: any, photoInputs: Array<{ input: any; value: string }>) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectEvaluationPhotoUploads(item, photoInputs));
    return;
  }
  if (obj.type === "photo") {
    if (Array.isArray(obj.photos)) {
      for (const photo of obj.photos) {
        if (photo?.value && typeof photo.value === "string" && photo.value.startsWith("data:image/")) {
          photoInputs.push({ input: photo, value: photo.value });
        }
      }
    } else if (obj.value && typeof obj.value === "string" && obj.value.startsWith("data:image/")) {
      photoInputs.push({ input: obj, value: obj.value });
    }
  }
  if (obj.subsections) obj.subsections.forEach((sub: any) => collectEvaluationPhotoUploads(sub, photoInputs));
  if (obj.inputs) obj.inputs.forEach((inp: any) => collectEvaluationPhotoUploads(inp, photoInputs));
}

export async function processChecklistEvaluationImages(
  req: NextRequest,
  evaluation: any,
  checklistId: number,
  uploadDynamicFiles: (params: any) => Promise<any>,
  callDynamicPrisma: (params: any) => Promise<any>,
): Promise<any> {
  if (!evaluation || typeof evaluation !== "object") return evaluation;

  const photoInputs: Array<{ input: any; value: string }> = [];
  collectEvaluationPhotoUploads(evaluation, photoInputs);

  if (photoInputs.length > 0) {
    const getExt = (v: string) => {
      const m = v.match(/data:image\/([^;]+)/);
      return m ? m[1].replace("jpeg", "jpg") : "jpg";
    };
    const uploadResp = await uploadDynamicFiles({
      req,
      folderPath: `checklist-supervision/${checklistId}`,
      files: photoInputs.map(({ value }) => ({ type: "image", extension: getExt(value), file_base64: value })),
    });
    const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];

    for (let i = 0; i < photoInputs.length; i++) {
      const { input } = photoInputs[i];
      const file = uploaded[i];
      if (!file) continue;

      input.file_name = file.name;
      if (typeof input.value === "string" && input.value.startsWith("data:image/")) {
        input.value = null;
      }

      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_imagenes_checklist_supervision",
          operation: "create",
          data: {
            name: file.name,
            checklist_id: checklistId,
            original_name: file.original_name || file.name,
          },
        },
      });
    }
  }
  return evaluation;
}

export { parseTimeInput };
