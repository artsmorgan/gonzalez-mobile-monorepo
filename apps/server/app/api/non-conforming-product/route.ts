import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export const runtime = "nodejs";

type PncFileInput = {
  type: string; // image | audio | video | document
  extension: string;
  original_name?: string;
  file_base64: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return fallback;
      return JSON.parse(trimmed) as T;
    }
    if (value === null || value === undefined) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

function normalizeBase64(b64: string): string {
  if (!b64) return "";
  const idx = b64.indexOf("base64,");
  if (idx !== -1) return b64.slice(idx + "base64,".length);
  return b64;
}

function parseDateOnly(input: any): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (s.length === 0) return null;
  // aceptar YYYY-MM-DD
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);

    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const {
      cliente_id,
      corpo_id,
      fecha_identificacion,
      responsable_cuenta,
      tipo_servicio_no_conforme,
      persona_identifico_pnc,
      firma_persona_identifico_pnc,
      descripcion,
      persona_origino_pnc,
      firma_persona_origino_pnc,
      accion_implementada,
      fecha_solucion,
      responsable_aprobar,
      firma_responsable,
      archivos,
    } = await req.json();

    const clienteId = Number(cliente_id);
    const corpoId = Number(corpo_id);
    if (!clienteId || !corpoId) {
      return NextResponse.json({ status: false, message: "Cliente y Sucursal son requeridos" }, { status: 400 });
    }

    const fechaIdent = parseDateOnly(fecha_identificacion);
    const fechaSol = parseDateOnly(fecha_solucion);
    if (!fechaIdent || !fechaSol) {
      return NextResponse.json({ status: false, message: "Fechas inválidas (identificación / solución)" }, { status: 400 });
    }

    if (!firma_responsable || String(firma_responsable).trim().length === 0) {
      return NextResponse.json({ status: false, message: "La firma del responsable es requerida" }, { status: 400 });
    }

    if (!firma_persona_identifico_pnc || String(firma_persona_identifico_pnc).trim().length === 0) {
      return NextResponse.json({ status: false, message: "La firma de la persona que identificó el PNC es requerida" }, { status: 400 });
    }

    if (!firma_persona_origino_pnc || String(firma_persona_origino_pnc).trim().length === 0) {
      return NextResponse.json({ status: false, message: "La firma de la persona que originó el PNC es requerida" }, { status: 400 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");

    const newRecord = await prisma.c_producto_no_conforme.create({
      data: {
        cliente_id: clienteId,
        corpo_id: corpoId,
        fecha_identificacion: fechaIdent,
        responsable_cuenta: String(responsable_cuenta ?? ""),
        tipo_servicio_no_conforme: String(tipo_servicio_no_conforme ?? ""),
        persona_identifico_pnc: String(persona_identifico_pnc ?? ""),
        firma_persona_identifico_pnc: String(firma_persona_identifico_pnc ?? ""),
        descripcion: String(descripcion ?? ""),
        persona_origino_pnc: String(persona_origino_pnc ?? ""),
        firma_persona_origino_pnc: String(firma_persona_origino_pnc ?? ""),
        accion_implementada: String(accion_implementada ?? ""),
        fecha_solucion: fechaSol,
        responsable_aprobar: String(responsable_aprobar ?? ""),
        firma_responsable: String(firma_responsable ?? ""),
        created_at: createdAt,
        created_by: payload.id?.toString() || "",
      },
      include: {
        e_archivos_producto_no_conforme: true,
      },
    });

    // Archivos anexos
    let filesParsed: PncFileInput[] = [];
    if (archivos) {
      filesParsed = safeParseJson<PncFileInput[]>(archivos, []);
    }

    if (newRecord) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];
      if (newRecord.created_by) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: Number(newRecord.created_by) } });
        if (empleado) {
          empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      if (newRecord.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: newRecord.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha registrado un producto no conforme en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      sendNotificationByRole(newRecord.corpo_id, [Number(newRecord.created_by)], "Producto no conforme registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    if (filesParsed.length > 0) {
      const dir = path.join(process.cwd(), "public", "uploads", "non-conforming-product", `${newRecord.id}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      for (const f of filesParsed) {
        if (!f?.file_base64 || !f?.extension || !f?.type) continue;
        let buffer: Buffer;
        try {
          buffer = Buffer.from(normalizeBase64(String(f.file_base64)), "base64");
        } catch {
          continue;
        }

        const ext = String(f.extension).replace(".", "").trim() || "dat";
        const fileName = `${uuidv4()}.${ext}`;
        fs.writeFileSync(path.join(dir, fileName), buffer);

        const originalName =
          typeof f.original_name === "string" && f.original_name.trim().length > 0
            ? f.original_name.trim()
            : fileName;

        await prisma.e_archivos_producto_no_conforme.create({
          data: {
            name: fileName,
            original_name: originalName,
            type: String(f.type),
            extension: ext,
            pnc_id: newRecord.id,
          },
        });
      }
    }

    const fullRecord = await prisma.c_producto_no_conforme.findUnique({
      where: { id: newRecord.id },
      include: { e_archivos_producto_no_conforme: true },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Producto no conforme creado correctamente",
        data: {
          ...(fullRecord ?? newRecord),
          id_local: "",
          files: ((fullRecord as any)?.e_archivos_producto_no_conforme || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            original_name: f.original_name,
            type: f.type,
            extension: f.extension,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

