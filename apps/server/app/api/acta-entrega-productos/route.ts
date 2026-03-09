import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenByApi } from '../../../utils/verifyAccessTokenByApi';
import { callDynamicPrisma } from '../../../utils/callDynamicPrisma';
import { toZonedTime } from 'date-fns-tz';
import { sendNotificationByRole } from '../../../utils/sendNotification';
import { uploadDynamicFiles } from '../../../utils/callDynamicFilesApi';

export const runtime = 'nodejs';

type ActaImageInput = {
  file_base64: string;
  extension?: string;
  original_name?: string;
};

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const divisionIdStr = req.nextUrl.searchParams.get("division_id");
    const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");

    const where: any = {};

    // Prioridad: corpo_id > contrato_id > division_id > cliente_id > empresa_id
    if (corpoIdStr) {
      where.corpo_id = parseInt(corpoIdStr);
    } else if (contratoIdStr) {
      where.contrato_id = parseInt(contratoIdStr);
    } else if (divisionIdStr) {
      where.division_id = parseInt(divisionIdStr);
    } else if (clienteIdStr) {
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

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_acta_entre_producto",
        operation: "findMany",
        where,
        orderBy: {
          fecha: 'desc'
        },
        include: {
          c_imagenes_acta_entrega_producto: true,
        },
      },
    });

    const recordsArray = Array.isArray(records) ? records : [];
    const baseUrl = req.nextUrl.origin;
    const recordsWithIdLocal = recordsArray.map((record: any) => ({
      ...record,
      id_local: "",
      images: (record.c_imagenes_acta_entrega_producto || []).map((img: any) => ({
        id: img.id,
        name: img.name,
        url: baseUrl ? `${baseUrl}/api/acta-entrega-productos/${record.id}/get-image/${img.name}` : "",
      })),
    }));

    return NextResponse.json({
      status: true,
      message: "Actas de entrega de productos obtenidas correctamente",
      data: recordsWithIdLocal
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === 'string') {
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
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const {
      marca_id,
      tipo_entrega,
      empresa_id,
      cliente_id,
      division_id,
      contrato_id,
      corpo_id,
      mensual,
      detalle,
      observaciones,
      nombre_entrega,
      cedula_entrega,
      fecha_entrega,
      firma_entrega,
      nombre_recibe,
      cedula_recibe,
      fecha_recibe,
      firma_recibe,
      firma_responsable,
      imagenes,
    } = await req.json();

    if (!marca_id) return NextResponse.json({ status: false, message: 'Marca no especificada' }, { status: 400 });

    const marcaDia = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findUnique",
        where: { id: parseInt(String(marca_id), 10) },
      },
    });
    if (!marcaDia) return NextResponse.json({ status: false, message: 'Marca no encontrada' }, { status: 404 });

    // Validaciones mínimas (campos NOT NULL en prisma). firma_entrega y firma_recibe son opcionales.
    const required: Array<[string, any]> = [
      ['tipo_entrega', tipo_entrega],
      ['empresa_id', empresa_id],
      ['cliente_id', cliente_id],
      ['division_id', division_id],
      ['contrato_id', contrato_id],
      ['corpo_id', corpo_id],
      ['mensual', mensual],
      ['detalle', detalle],
      ['observaciones', observaciones],
      ['nombre_entrega', nombre_entrega],
      ['cedula_entrega', cedula_entrega],
      ['fecha_entrega', fecha_entrega],
      ['nombre_recibe', nombre_recibe],
      ['cedula_recibe', cedula_recibe],
      ['fecha_recibe', fecha_recibe],
      ['firma_responsable', firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const createdAt = toZonedTime(new Date(), 'America/Costa_Rica');
    const createdByNum = payload?.id ? parseInt(String(payload.id), 10) : 0;
    const fechaEntregaDate = new Date(String(fecha_entrega));
    const fechaRecibeDate = new Date(String(fecha_recibe));

    const newRecord = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_acta_entre_producto",
        operation: "create",
        data: {
          empresa_id: Number(empresa_id),
          cliente_id: Number(cliente_id),
          division_id: Number(division_id),
          contrato_id: Number(contrato_id),
          corpo_id: Number(corpo_id),
          fecha: createdAt.toISOString(),
          tipo_entrega: String(tipo_entrega),
          mensual: String(mensual),
          division: "",
          detalle: String(detalle),
          observaciones: String(observaciones),
          nombre_entrega: String(nombre_entrega),
          cedula_entrega: String(cedula_entrega),
          fecha_entrega: fechaEntregaDate.toISOString(),
          firma_entrega: (firma_entrega != null && String(firma_entrega).trim() !== '') ? String(firma_entrega) : null,
          nombre_recibe: String(nombre_recibe),
          cedula_recibe: String(cedula_recibe),
          fecha_recibe: fechaRecibeDate.toISOString(),
          firma_recibe: (firma_recibe != null && String(firma_recibe).trim() !== '') ? String(firma_recibe) : null,
          firma_responsable: String(firma_responsable),
        },
        include: { c_imagenes_acta_entrega_producto: true },
      },
    });
    const newRecordObj = newRecord as any;

    // Registrar cambio de creación
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_acta_entre_producto",
          registro_id: newRecordObj.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: newRecordObj.id,
              empresa_id: newRecordObj.empresa_id,
              cliente_id: newRecordObj.cliente_id,
              division_id: newRecordObj.division_id,
              contrato_id: newRecordObj.contrato_id,
              corpo_id: newRecordObj.corpo_id,
              fecha: createdAt.toISOString(),
              tipo_entrega: newRecordObj.tipo_entrega,
              mensual: newRecordObj.mensual,
              detalle: newRecordObj.detalle,
              observaciones: newRecordObj.observaciones,
              nombre_entrega: newRecordObj.nombre_entrega,
              cedula_entrega: newRecordObj.cedula_entrega,
              fecha_entrega: fechaEntregaDate.toISOString(),
              nombre_recibe: newRecordObj.nombre_recibe,
              cedula_recibe: newRecordObj.cedula_recibe,
              fecha_recibe: fechaRecibeDate.toISOString(),
              firma_entrega: newRecordObj.firma_entrega,
              firma_recibe: newRecordObj.firma_recibe,
              firma_responsable: newRecordObj.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdByNum,
        },
      },
    });

    if (newRecordObj) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let clienteNombre = "Desconocido";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      if (payload?.id) {
        const empleado = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findUnique",
            where: { id: parseInt(String(payload.id), 10) },
          },
        });
        if (empleado) {
          const empleadoObj = empleado as any;
          empNombre = empleadoObj.nombre + " " + empleadoObj.primer_apellido + " " + empleadoObj.segundo_apellido;
        }
      }
      if (newRecordObj.corpo_id) {
        const sucursal = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: newRecordObj.corpo_id },
          },
        });
        if (sucursal) {
          const sucursalObj = sucursal as any;
          sucursalNombre = sucursalObj.nombre + " (" + sucursalObj.nro_sucursal + ")";
        }
      }
      if (newRecordObj.cliente_id) {
        const cliente = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_cliente",
            operation: "findUnique",
            where: { id: newRecordObj.cliente_id },
          },
        });
        if (cliente) {
          const clienteObj = cliente as any;
          clienteNombre = clienteObj.nombre;
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de acta de entrega de productos para el cliente " + clienteNombre + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
      await sendNotificationByRole(req, newRecordObj.corpo_id, [createdByNum], "Acta de entrega de productos creada", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Guardar imágenes (si vienen)
    let imagesParsed: ActaImageInput[] = [];
    if (imagenes) imagesParsed = safeParseJson<ActaImageInput[]>(imagenes, []);

    if (imagesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `acta-entrega-productos/${newRecordObj.id}`,
        files: imagesParsed
          .filter((img) => img?.file_base64)
          .map((img) => ({
            type: "image",
            extension: String(img.extension || "jpg").replace(".", "").trim() || "jpg",
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
            table: "c_imagenes_acta_entrega_producto",
            operation: "create",
            data: { name: uploaded.name, acta_id: newRecordObj.id },
          },
        });
      }
    }

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_acta_entre_producto",
        operation: "findUnique",
        where: { id: newRecordObj.id },
        include: { c_imagenes_acta_entrega_producto: true },
      },
    });

    const fullRecordObj = fullRecord as any;
    const baseUrl = req.nextUrl.origin;
    return NextResponse.json(
      {
        status: true,
        message: 'Acta creada correctamente',
        data: {
          ...(fullRecordObj ?? newRecordObj),
          id_local: '',
          images: ((fullRecordObj?.c_imagenes_acta_entrega_producto || []) as any[]).map((f: any) => ({
            id: f.id,
            name: f.name,
            url: baseUrl ? `${baseUrl}/api/acta-entrega-productos/${fullRecordObj?.id}/get-image/${f.name}` : '',
          })),
          created_by: payload?.id?.toString() || '',
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


