import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export const runtime = "nodejs";

type VehicleImageInput = {
  extension: string; // jpg|png|...
  file_base64: string;
};

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");

    const where: any = {};

    // Si hay filtros jerárquicos, usarlos
    if (corpoIdStr) {
      where.sucursal_id = parseInt(corpoIdStr);
    } else if (clienteIdStr) {
      // Si hay cliente pero no corpo, filtrar directamente por cliente_id
      where.cliente_id = parseInt(clienteIdStr);
    } else if (empresaIdStr) {
      // Si hay empresa pero no cliente, buscar todos los clientes de la empresa
      const empresaId = parseInt(empresaIdStr);
      const clientes = await prisma.e_estructura_cliente.findMany({
        where: { empresa_id: empresaId },
        select: { id: true },
      });
      const clienteIds = clientes.map((c) => c.id);
      if (clienteIds.length > 0) {
        where.cliente_id = { in: clienteIds };
      } else {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    } else {
      return NextResponse.json({ status: false, message: "Debe especificar filtros jerárquicos" }, { status: 400 });
    }

    const items = await prisma.c_vehiculos_corporativos.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        c_imagenes_vehiculos_corporativos: true,
        c_usos_vehiculos_corporativos: true,
        c_mantenimiento_vehiculos_corporativos: true,
      },
    });

    // Adjuntamos el registro de bitácora a cada uso (si existe)
    const bitacoraIds = Array.from(
      new Set(
        items
          .flatMap((v: any) => (v.c_usos_vehiculos_corporativos || []).map((u: any) => u.bitacora_id))
          .filter((id: any): id is number => typeof id === "number" && Number.isFinite(id))
      )
    );
    const bitacoras = bitacoraIds.length
      ? await prisma.c_bitacora_vehiculo_detenido.findMany({ where: { id: { in: bitacoraIds } } })
      : [];
    const bitacoraById = new Map(bitacoras.map((b: any) => [b.id, b]));

    const mapped = items.map((r: any) => ({
      ...r,
      id_local: "",
      corpo_id: r.sucursal_id, // compat con móvil
      empresa_id: r.empresa_id,
      cliente_id: r.cliente_id,
      images: (r.c_imagenes_vehiculos_corporativos || []).map((i: any) => ({
        id: i.id,
        name: i.name,
      })),
      usos: (r.c_usos_vehiculos_corporativos || []).map((u: any) => ({
        ...u,
        bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
      })),
      mantenimientos: (r.c_mantenimiento_vehiculos_corporativos || []).map((m: any) => ({
        ...m,
      })),
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/corporate-vehicles:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

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

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const {
      empresa_id,
      cliente_id,
      corpo_id,
      placa,
      tipo,
      estado,
      kilometraje,
      prox_cambio_aceite,
      modelo,
      anno,
      descripcion,
      titulo_propiedad,
      rtv,
      marchamo,
      firma_responsable,
      imagenes,
    } = await req.json();

    const empresaId = Number(empresa_id);
    const clienteId = Number(cliente_id);
    const sucursalId = Number(corpo_id);
    if (!empresaId || !clienteId || !sucursalId) {
      return NextResponse.json(
        { status: false, message: "Empresa, Cliente y Sucursal son requeridos" },
        { status: 400 }
      );
    }

    if (!firma_responsable || String(firma_responsable).trim().length === 0) {
      return NextResponse.json(
        { status: false, message: "La firma del responsable es requerida" },
        { status: 400 }
      );
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const createdBy = payload.id !== undefined && payload.id !== null ? Number(payload.id) : 0;

    const newRecord = await prisma.c_vehiculos_corporativos.create({
      data: {
        empresa_id: empresaId,
        cliente_id: clienteId,
        sucursal_id: sucursalId,
        placa: String(placa ?? ""),
        tipo: String(tipo ?? ""),
        estado: String(estado ?? "Activo"),
        kilometraje: Number(kilometraje ?? 0),
        prox_cambio_aceite: Number(prox_cambio_aceite ?? 0),
        modelo: String(modelo ?? ""),
        anno: Number(anno ?? 0),
        descripcion: String(descripcion ?? ""),
        titulo_propiedad: Boolean(titulo_propiedad ?? true),
        rtv: Boolean(rtv ?? true),
        marchamo: Boolean(marchamo ?? true),
        firma_responsable: String(firma_responsable ?? ""),
        created_by: createdBy,
        created_at: createdAt,
      },
      include: { c_imagenes_vehiculos_corporativos: true },
    });

    if (newRecord) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];
      if (newRecord.created_by) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: newRecord.created_by } });
        if (empleado) {
          empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      if (newRecord.sucursal_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: newRecord.sucursal_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha registrado un vehículo corporativo en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      sendNotificationByRole(newRecord.sucursal_id, [Number(newRecord.created_by)], "Vehículo corporativo registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Imágenes anexas
    let imagesParsed: VehicleImageInput[] = [];
    if (imagenes !== undefined) {
      imagesParsed = safeParseJson<VehicleImageInput[]>(imagenes, []);
    }

    if (imagesParsed.length > 0) {
      const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${newRecord.id}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      for (const img of imagesParsed) {
        if (!img?.file_base64 || !img?.extension) continue;
        let buffer: Buffer;
        try {
          buffer = Buffer.from(normalizeBase64(String(img.file_base64)), "base64");
        } catch {
          continue;
        }

        const ext = String(img.extension).replace(".", "").trim() || "jpg";
        const fileName = `${uuidv4()}.${ext}`;
        fs.writeFileSync(path.join(dir, fileName), buffer);

        await prisma.c_imagenes_vehiculos_corporativos.create({
          data: {
            name: fileName,
            vehiculo_id: newRecord.id,
          },
        });
      }
    }

    const fullRecord = await prisma.c_vehiculos_corporativos.findUnique({
      where: { id: newRecord.id },
      include: { c_imagenes_vehiculos_corporativos: true },
    });

    // Registrar cambio de creación
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_vehiculos_corporativos",
        registro_id: newRecord.id,
        cambios: JSON.stringify([{
          prop: "__created__",
          before: null,
          after: {
            id: newRecord.id,
            empresa_id: newRecord.empresa_id,
            cliente_id: newRecord.cliente_id,
            sucursal_id: newRecord.sucursal_id,
            placa: newRecord.placa,
            tipo: newRecord.tipo,
            estado: (newRecord as any).estado,
            kilometraje: newRecord.kilometraje,
            prox_cambio_aceite: newRecord.prox_cambio_aceite,
            modelo: newRecord.modelo,
            anno: newRecord.anno,
            descripcion: newRecord.descripcion,
            titulo_propiedad: newRecord.titulo_propiedad,
            rtv: newRecord.rtv,
            marchamo: newRecord.marchamo,
          },
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Vehículo corporativo creado correctamente",
        data: {
          ...(fullRecord ?? newRecord),
          id_local: "",
          images: ((fullRecord as any)?.c_imagenes_vehiculos_corporativos || []).map((i: any) => ({
            id: i.id,
            name: i.name,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/corporate-vehicles:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


