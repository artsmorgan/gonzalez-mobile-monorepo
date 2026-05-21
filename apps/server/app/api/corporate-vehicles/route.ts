import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import fs from "fs";
import path from "path";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import {
  buildCorporateVehicleOptionalFields,
  normalizeMarca,
} from "../../../utils/corporateVehiclePayload";

export const runtime = "nodejs";

type VehicleImageInput = {
  extension: string;
  file_base64: string;
  original_name?: string;
};

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");

    const where: any = { isActive: true };

    // Si hay filtros jerárquicos, usarlos
    if (corpoIdStr) {
      where.sucursal_id = parseInt(corpoIdStr);
    } else if (clienteIdStr) {
      // Si hay cliente pero no corpo, filtrar directamente por cliente_id
      where.cliente_id = parseInt(clienteIdStr);
    } else if (empresaIdStr) {
      // Si hay empresa pero no cliente, buscar todos los clientes de la empresa
      const empresaId = parseInt(empresaIdStr);
      const clientes = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_cliente",
          operation: "findMany",
          where: { empresa_id: empresaId },
          select: { id: true },
        },
      });
      const clientesArray = Array.isArray(clientes) ? clientes : [];
      const clienteIds = clientesArray.map((c: any) => c.id);
      if (clienteIds.length > 0) {
        where.cliente_id = { in: clienteIds };
      } else {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    } else {
      return NextResponse.json({ status: false, message: "Debe especificar filtros jerárquicos" }, { status: 400 });
    }

    const items = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_vehiculos_corporativos",
        operation: "findMany",
        where,
        orderBy: { id: "desc" },
        include: {
          c_imagenes_vehiculos_corporativos: true,
          c_usos_vehiculos_corporativos: true,
          c_mantenimiento_vehiculos_corporativos: true,
        },
      },
    });

    const itemsArray = Array.isArray(items) ? items : [];
    // Adjuntamos el registro de bitácora a cada uso (si existe)
    const bitacoraIds = Array.from(
      new Set(
        itemsArray
          .flatMap((v: any) => (Array.isArray(v.c_usos_vehiculos_corporativos) ? v.c_usos_vehiculos_corporativos : []).map((u: any) => u.bitacora_id))
          .filter((id: any): id is number => typeof id === "number" && Number.isFinite(id))
      )
    );
    const bitacoras = bitacoraIds.length
      ? await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_bitacora_vehiculo_detenido",
            operation: "findMany",
            where: { id: { in: bitacoraIds } },
          },
        })
      : [];
    const bitacorasArray = Array.isArray(bitacoras) ? bitacoras : [];
    const bitacoraById = new Map(bitacorasArray.map((b: any) => [b.id, b]));

    const baseUrl = req.nextUrl.origin;
    const mapped = itemsArray.map((r: any) => ({
      ...r,
      id_local: "",
      corpo_id: r.sucursal_id, // compat con móvil
      empresa_id: r.empresa_id,
      cliente_id: r.cliente_id,
      images: (Array.isArray(r.c_imagenes_vehiculos_corporativos) ? r.c_imagenes_vehiculos_corporativos : []).map((i: any) => ({
        id: i.id,
        name: i.name,
        url: baseUrl ? `${baseUrl}/api/corporate-vehicles/${r.id}/get-image/${i.name}` : "",
      })),
      usos: (Array.isArray(r.c_usos_vehiculos_corporativos) ? r.c_usos_vehiculos_corporativos : []).map((u: any) => ({
        ...u,
        bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
      })),
      mantenimientos: (Array.isArray(r.c_mantenimiento_vehiculos_corporativos) ? r.c_mantenimiento_vehiculos_corporativos : []).map((m: any) => ({
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

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const {
      empresa_id,
      cliente_id,
      corpo_id,
      division_id,
      contrato_id,
      puesto_id,
      placa,
      tipo,
      tipo_autoria,
      estado,
      kilometraje,
      prox_cambio_aceite,
      modelo,
      anno,
      marca,
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
    const divisionId = Number(division_id ?? 0);
    const contratoIdNum = Number(contrato_id ?? 0);
    const puestoIdNum = Number(puesto_id ?? 0);
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

    const marcaNorm = normalizeMarca(marca);
    if (!marcaNorm) {
      return NextResponse.json({ status: false, message: "Marca es requerida" }, { status: 400 });
    }

    const optionalFields = buildCorporateVehicleOptionalFields({
      tipo,
      placa,
      kilometraje,
      prox_cambio_aceite,
      modelo,
      anno,
      descripcion,
      titulo_propiedad,
      rtv,
      marchamo,
    });

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

    const newRecord = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_vehiculos_corporativos",
        operation: "create",
        data: {
          empresa_id: empresaId,
          cliente_id: clienteId,
          sucursal_id: sucursalId,
          division_id: divisionId > 0 ? divisionId : 0,
          contrato_id: contratoIdNum > 0 ? contratoIdNum : 0,
          puesto_id: puestoIdNum > 0 ? puestoIdNum : 0,
          isActive: true,
          ...optionalFields,
          tipo: String(tipo ?? ""),
          tipo_autoria: String(tipo_autoria ?? ""),
          estado: String(estado ?? "Activo"),
          marca: marcaNorm,
          firma_responsable: String(firma_responsable ?? ""),
          created_by: createdBy,
          created_at: createdAt.toISOString(),
        },
        include: { c_imagenes_vehiculos_corporativos: true },
      },
    });
    const newRecordObj = newRecord as any;

    if (newRecordObj) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];
      if (newRecordObj.created_by) {
        const empleado = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findUnique",
            where: { id: newRecordObj.created_by },
          },
        });
        if (empleado) {
          const empleadoObj = empleado as any;
          empNombre = empleadoObj.nombre + " " + empleadoObj.primer_apellido + " " + empleadoObj.segundo_apellido;
        }
      }
      if (newRecordObj.sucursal_id) {
        const sucursal = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: newRecordObj.sucursal_id },
          },
        });
        if (sucursal) {
          const sucursalObj = sucursal as any;
          sucursalNombre = sucursalObj.nombre;
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha registrado un vehículo corporativo en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      await sendNotificationByRole(req, newRecordObj.sucursal_id, [Number(newRecordObj.created_by)], "Vehículo corporativo registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Imágenes anexas
    let imagesParsed: VehicleImageInput[] = [];
    if (imagenes !== undefined) {
      imagesParsed = safeParseJson<VehicleImageInput[]>(imagenes, []);
    }

    if (imagesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `corporate-vehicles/${newRecordObj.id}`,
        files: imagesParsed
          .filter((img) => img?.file_base64 && img?.extension)
          .map((img) => ({
            type: "image",
            extension: String(img.extension).replace(".", "").trim() || "jpg",
            original_name: img.original_name,
            file_base64: img.file_base64,
          })),
      });

      const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
      for (const uploaded of uploadedFiles) {
        await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "c_imagenes_vehiculos_corporativos",
            operation: "create",
            data: {
              name: uploaded.name,
              vehiculo_id: newRecordObj.id,
            },
          },
        });
      }
    }

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: newRecordObj.id },
        include: { c_imagenes_vehiculos_corporativos: true },
      },
    });

    // Registrar cambio de creación
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_vehiculos_corporativos",
          registro_id: newRecordObj.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: newRecordObj.id,
              empresa_id: newRecordObj.empresa_id,
              cliente_id: newRecordObj.cliente_id,
              sucursal_id: newRecordObj.sucursal_id,
              placa: newRecordObj.placa,
              tipo: newRecordObj.tipo,
              tipo_autoria: newRecordObj.tipo_autoria,
              estado: newRecordObj.estado,
              kilometraje: newRecordObj.kilometraje,
              prox_cambio_aceite: newRecordObj.prox_cambio_aceite,
              modelo: newRecordObj.modelo,
              anno: newRecordObj.anno,
              marca: newRecordObj.marca,
              descripcion: newRecordObj.descripcion,
              titulo_propiedad: newRecordObj.titulo_propiedad,
              rtv: newRecordObj.rtv,
              marchamo: newRecordObj.marchamo,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    const fullRecordObj = fullRecord as any;
    const imagenesArray = Array.isArray(fullRecordObj?.c_imagenes_vehiculos_corporativos) ? fullRecordObj.c_imagenes_vehiculos_corporativos : [];
    const baseUrlPost = req.nextUrl.origin;
    return NextResponse.json(
      {
        status: true,
        message: "Vehículo corporativo creado correctamente",
        data: {
          id: fullRecordObj?.id ?? newRecordObj.id,
          ...(fullRecordObj ?? newRecordObj),
          id_local: "",
          images: imagenesArray.map((i: any) => ({
            id: i.id,
            name: i.name,
            url: baseUrlPost ? `${baseUrlPost}/api/corporate-vehicles/${fullRecordObj?.id}/get-image/${i.name}` : "",
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


