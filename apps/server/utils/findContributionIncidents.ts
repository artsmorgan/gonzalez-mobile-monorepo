import { prisma } from "./prismaClient";

function buildEmpleadoNombre(e: any): string {
    const nombre = (e?.nombre ?? "").toString().trim();
    const a1 = (e?.primer_apellido ?? "").toString().trim();
    const a2 = (e?.segundo_apellido ?? "").toString().trim();
    return [nombre, a1, a2].filter(Boolean).join(" ").trim();
  }

export const findContributionIncidents = async (incidentId: number) => {
    const aportes = await prisma.c_contribucion_incidente.findMany({
    where: { incidente_id: incidentId },
    orderBy: { id: "desc" },
    include: {
      c_empleado: true,
      c_archivos_aporte_incidente: true,
    },
  });

  const mapped = aportes.map((a: any) => ({
    id: a.id,
    incidente_id: a.incidente_id,
    empleado_id: a.empleado_id,
    rol_aporte: a.rol_aporte,
    aporte: a.aporte ?? "",
    created_at: a.created_at ? new Date(a.created_at).toISOString() : "",
    empleado_nombre: buildEmpleadoNombre(a.c_empleado),
    files: (a.c_archivos_aporte_incidente || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      original_name: f.original_name,
      type: f.type,
      extension: f.extension,
    })),
    id_local: "",
  }));
  return mapped;
};