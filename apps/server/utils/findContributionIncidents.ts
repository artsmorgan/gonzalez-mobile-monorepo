import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "./hydratePreexistentIncludes";

const CONTRIBUTION_INCLUDE = {
  c_empleado: true,
  c_archivos_aporte_incidente: true,
};

function buildEmpleadoNombre(e: any): string {
  const nombre = (e?.nombre ?? "").toString().trim();
  const a1 = (e?.primer_apellido ?? "").toString().trim();
  const a2 = (e?.segundo_apellido ?? "").toString().trim();
  return [nombre, a1, a2].filter(Boolean).join(" ").trim();
}

function buildContributionFileUrl(baseUrl: string, incidentId: number, contributionId: number, file: { name: string; type: string }): string {
  const fileName = file.name;
  const type = String(file.type || "file").toLowerCase();
  let urlPath: string;
  if (type === "image") {
    urlPath = `/api/incidents/${incidentId}/contributions/${contributionId}/get-image/${fileName}`;
  } else if (type === "audio") {
    urlPath = `/api/incidents/${incidentId}/contributions/${contributionId}/get-audio/${fileName}`;
  } else if (type === "video") {
    urlPath = `/api/incidents/${incidentId}/contributions/${contributionId}/get-video/${fileName}`;
  } else {
    urlPath = `/api/incidents/${incidentId}/contributions/${contributionId}/get-file/${fileName}`;
  }
  return `${baseUrl}${urlPath}`;
}

export const findContributionIncidents = async (req: NextRequest, incidentId: number, baseUrl?: string) => {
  const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(CONTRIBUTION_INCLUDE);

  const aportes = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "c_contribucion_incidente",
      operation: "findMany",
      where: { incidente_id: incidentId },
      orderBy: { id: "desc" },
      ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
    }
  });
  await hydratePreexistentRelations(aportes, preexistentSpecs);

  const origin = baseUrl ?? req.nextUrl.origin;

  const mapped = aportes.map((a: any) => ({
    id: a.id,
    incidente_id: a.incidente_id,
    empleado_id: a.empleado_id,
    rol_aporte: a.rol_aporte,
    nombre_aporte: a.nombre_aporte ?? null,
    firma_aporte_tercero: a.firma_aporte_tercero ?? null,
    aporte: a.aporte ?? "",
    created_at: a.created_at instanceof Date ? a.created_at.toISOString() : (a.created_at || ""),
    empleado_nombre: buildEmpleadoNombre(a.c_empleado),
    files: (a.c_archivos_aporte_incidente || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      original_name: f.original_name,
      type: f.type,
      extension: f.extension,
      url: buildContributionFileUrl(origin, incidentId, a.id, f),
    })),
    id_local: "",
  }));
  return mapped;
};