import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../../../utils/hydratePreexistentIncludes";
import { reportError } from "../../../../../utils/reportError";

const AGENDA_MINUTA_ESTRUCTURA_INCLUDE = {
  e_estructura_cliente: { select: { nombre: true } },
  e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
  e_estructura_puesto: { select: { nombre: true, codigo: true } },
  c_imagenes_agenda_minuta: { select: { id: true, name: true, original_name: true } },
};

function timeToHHmm(val: any): string | null {
  if (val == null) return null;
  const d = val instanceof Date ? val : (typeof val === "string" ? new Date(val) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const corpoIdNum = parseInt(String(resolvedParams.corpo_id), 10);
    if (Number.isNaN(corpoIdNum) || corpoIdNum <= 0) {
      await reportError(req, "api/agenda-minuta/corpo/[corpo_id]", "GET", 400, "Corpo inválido");
      return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
    }

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(AGENDA_MINUTA_ESTRUCTURA_INCLUDE);

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_agenda_minuta",
        operation: "findMany",
        where: { corpo_id: corpoIdNum, isActive: true },
        orderBy: { created_at: "desc" },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
      },
    });
    await hydratePreexistentRelations(records, preexistentSpecs);

    const recordsArray = Array.isArray(records) ? records : [];
    const recordsWithNames = recordsArray.map((r: any) => ({
      ...r,
      id_local: "",
      hora_inicio: timeToHHmm(r.hora_inicio) ?? r.hora_inicio,
      hora_fin: timeToHHmm(r.hora_fin) ?? r.hora_fin,
      cliente_nombre: r.e_estructura_cliente?.nombre || null,
      corpo_nombre: r.e_estructura_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ${r.e_estructura_sucursal.nombre}` : null,
      puesto_nombre: r.e_estructura_puesto
        ? `${r.e_estructura_puesto.codigo ? `${r.e_estructura_puesto.codigo} - ` : ""}${r.e_estructura_puesto.nombre}`
        : null,
      imagenes: Array.isArray(r.c_imagenes_agenda_minuta) ? r.c_imagenes_agenda_minuta : [],
    }));

    return NextResponse.json(
      { status: true, message: "Agendas minuta obtenidas correctamente", data: recordsWithNames },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    await reportError(req, "api/agenda-minuta/corpo/[corpo_id]", "GET", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}


