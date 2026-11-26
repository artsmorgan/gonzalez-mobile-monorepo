import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../../utils/reportError";

export const runtime = "nodejs";

/**
 * DELETE una foto de mantenimiento: `slot` = `antes` | `despues`.
 * Limpia el campo en BD y elimina el archivo en uploads (si existía).
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ maintenance_id: string; slot: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const { maintenance_id, slot: slotRaw } = await context.params;
    const maintenanceId = parseInt(String(maintenance_id), 10);
    const slot = String(slotRaw || "")
      .trim()
      .toLowerCase();
    if (!maintenanceId || (slot !== "antes" && slot !== "despues")) {
      await reportError(
        req,
        "api/corporate-vehicles/maintenances/[maintenance_id]/image/[slot]",
        "DELETE",
        400,
        "ID de mantenimiento o slot inválido (use antes|despues)"
      );
      return NextResponse.json(
        { status: false, message: "ID de mantenimiento o slot inválido (use antes|despues)" },
        { status: 400 }
      );
    }

    const field = slot === "antes" ? "imagen_antes" : "imagen_despues";

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_mantenimiento_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: maintenanceId },
      },
    });
    if (!existing) {
      await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]/image/[slot]", "DELETE", 404, "Mantenimiento no encontrado");
      return NextResponse.json({ status: false, message: "Mantenimiento no encontrado" }, { status: 404 });
    }
    const row = existing as any;
    const vehiculoId = Number(row.vehiculo_id);
    if (!vehiculoId) {
      await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]/image/[slot]", "DELETE", 500, "vehiculo_id inválido");
      return NextResponse.json({ status: false, message: "vehiculo_id inválido" }, { status: 500 });
    }

    const fileName = String(row[field] ?? "").trim();
    if (fileName && !fileName.startsWith("data:")) {
      const relative = `corporate-vehicles/${vehiculoId}/maintenances/${fileName}`.replace(/\\/g, "/");
      try {
        await deleteDynamicFile({ req, url: relative, shouldVerifyAccessToken: true });
      } catch (e) {
        console.warn("deleteDynamicFile (maintenance image):", e);
      }
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_mantenimiento_vehiculos_corporativos",
        operation: "update",
        where: { id: maintenanceId },
        data: { [field]: "" },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Imagen eliminada correctamente",
        data: { id: maintenanceId, vehiculo_id: vehiculoId, slot, record: updated },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE /api/corporate-vehicles/maintenances/.../image/[slot]:", errorMessage);
    await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]/image/[slot]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
