import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

type GeneralInductionImageInput = {
  file_base64: string;
  extension?: string;
  original_name?: string;
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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");

    const where: any = {};

    // Si hay filtros jerárquicos, usarlos (prioridad: corpo > cliente > empresa)
    if (corpoIdStr) {
      where.corpo_id = parseInt(corpoIdStr);
    } else if (clienteIdStr) {
      // Si hay cliente pero no corpo, buscar todas las sucursales del cliente
      const clienteId = parseInt(clienteIdStr);
      const cliente = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_cliente",
          operation: "findUnique",
          where: { id: clienteId },
        },
      });
      if (!cliente) {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
      // Obtener todos los contratos del cliente y luego todas las sucursales
      const divisiones = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "n_division",
          operation: "findMany",
        },
      });
      const divisionesArray = Array.isArray(divisiones) ? divisiones : [];
      const contratoIds: number[] = [];
      for (const division of divisionesArray) {
        const divisionObj = division as any;
        const contratos = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_contrato",
            operation: "findMany",
            where: {
              cliente_id: clienteId,
              division_id: divisionObj.id,
              deleted: null,
            },
            select: { id: true },
          },
        });
        const contratosArray = Array.isArray(contratos) ? contratos : [];
        contratosArray.forEach((c: any) => {
          if (!contratoIds.includes(c.id)) contratoIds.push(c.id);
        });
      }
      if (contratoIds.length > 0) {
        const sucursales = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findMany",
            where: {
              contrato_id: { in: contratoIds },
            },
            select: { id: true },
          },
        });
        const sucursalesArray = Array.isArray(sucursales) ? sucursales : [];
        const sucursalIds = sucursalesArray.map((s: any) => s.id);
        if (sucursalIds.length > 0) {
          where.corpo_id = { in: sucursalIds };
        } else {
          return NextResponse.json({ status: true, data: [] }, { status: 200 });
        }
      } else {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
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
        // Obtener todos los contratos de estos clientes y luego todas las sucursales
        const divisiones = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "n_division",
            operation: "findMany",
          },
        });
        const divisionesArray = Array.isArray(divisiones) ? divisiones : [];
        const contratoIds: number[] = [];
        for (const division of divisionesArray) {
          const divisionObj = division as any;
          const contratos = await callDynamicPrisma({
            req,
            data: {
              action: "GET",
              table: "e_estructura_contrato",
              operation: "findMany",
              where: {
                cliente_id: { in: clienteIds },
                division_id: divisionObj.id,
                deleted: null,
              },
              select: { id: true },
            },
          });
          const contratosArray = Array.isArray(contratos) ? contratos : [];
          contratosArray.forEach((c: any) => {
            if (!contratoIds.includes(c.id)) contratoIds.push(c.id);
          });
        }
        if (contratoIds.length > 0) {
          const sucursales = await callDynamicPrisma({
            req,
            data: {
              action: "GET",
              table: "e_estructura_sucursal",
              operation: "findMany",
              where: {
                contrato_id: { in: contratoIds },
              },
              select: { id: true },
            },
          });
          const sucursalesArray = Array.isArray(sucursales) ? sucursales : [];
          const sucursalIds = sucursalesArray.map((s: any) => s.id);
          if (sucursalIds.length > 0) {
            where.corpo_id = { in: sucursalIds };
          } else {
            return NextResponse.json({ status: true, data: [] }, { status: 200 });
          }
        } else {
          return NextResponse.json({ status: true, data: [] }, { status: 200 });
        }
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
        table: "c_registro_induccion_general",
        operation: "findMany",
        where,
        orderBy: { created_at: "desc" },
        include: {
          c_imagenes_registro_induccion_general: true,
          e_estructura_empresa: { select: { nombre: true, codigo: true } },
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        },
      },
    });

    const recordsArray = Array.isArray(records) ? records : [];
    const recordsWithNames = recordsArray.map((r: any) => ({
      ...r,
      id_local: "",
      empresa_nombre: r.e_estructura_empresa ? `${r.e_estructura_empresa.codigo} - ${r.e_estructura_empresa.nombre}` : null,
      cliente_nombre: r.e_estructura_cliente?.nombre || null,
      corpo_nombre: r.e_estructura_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ${r.e_estructura_sucursal.nombre}` : null,
      images: (r?.c_imagenes_registro_induccion_general || []).map((img: any) => ({
        id: img.id,
        name: img.name,
        url: req.nextUrl.origin ? `${req.nextUrl.origin}/api/general-induction-register/${r.id}/get-image/${img.name}` : "",
      })),
    }));

    return NextResponse.json(
      { status: true, message: "Registros de inducción general obtenidos correctamente", data: recordsWithNames },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

function parseFechaInput(fecha: any): Date | undefined {
  if (!fecha) return undefined;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha === "string") {
    if (fecha.includes("/")) {
      const parts = fecha.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(fecha);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function ensureStringJson(value: any, fallback: string) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
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
      division,
      fecha,
      temas_a_tratar,
      colaboradores,
      capacitadores,
      firma_responsable,
      imagenes,
    } = await req.json();

    const required: Array<[string, any]> = [
      ["empresa_id", empresa_id],
      ["cliente_id", cliente_id],
      ["corpo_id", corpo_id],
      ["division", division],
      ["temas_a_tratar", temas_a_tratar],
      ["colaboradores", colaboradores],
      ["capacitadores", capacitadores],
      ["firma_responsable", firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const empresaIdNum = parseInt(String(empresa_id), 10);
    const clienteIdNum = parseInt(String(cliente_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    if ([empresaIdNum, clienteIdNum, corpoIdNum].some((n) => Number.isNaN(n) || n <= 0)) {
      return NextResponse.json({ status: false, message: "IDs inválidos" }, { status: 400 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (fecha !== undefined && fecha !== null && !fechaParsed) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");

    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

    const createData: any = {
      empresa_id: empresaIdNum,
      cliente_id: clienteIdNum,
      corpo_id: corpoIdNum,
      division: String(division).trim(),
      temas_a_tratar: ensureStringJson(temas_a_tratar, "[]"),
      colaboradores: ensureStringJson(colaboradores, "[]"),
      capacitadores: ensureStringJson(capacitadores, "[]"),
      firma_responsable: String(firma_responsable),
      created_at: createdAt.toISOString(),
      created_by: createdBy.toString(),
    };
    if (fechaParsed) {
      createData.fecha = fechaParsed.toISOString();
    }

    const record = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_registro_induccion_general",
        operation: "create",
        data: createData,
        include: {
          e_estructura_empresa: { select: { nombre: true, codigo: true } },
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        },
      },
    });
    const recordObj = record as any;

    // Guardar imágenes (si vienen)
    let imagesParsed: GeneralInductionImageInput[] = [];
    if (imagenes) imagesParsed = safeParseJson<GeneralInductionImageInput[]>(imagenes, []);

    if (imagesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `general-induction-register/${recordObj.id}`,
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
            table: "c_imagenes_registro_induccion_general",
            operation: "create",
            data: {
              name: uploaded.name,
              registro_id: recordObj.id,
            },
          },
        });
      }
    }

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findUnique",
        where: { id: recordObj.id },
        include: {
          c_imagenes_registro_induccion_general: true,
          e_estructura_empresa: { select: { nombre: true, codigo: true } },
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        },
      },
    });
    const fullRecordObj = fullRecord as any;
    const baseUrl = req.nextUrl.origin;

    // Registrar cambio de creación
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_registro_induccion_general",
          registro_id: recordObj.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: recordObj.id,
              empresa_id: recordObj.empresa_id,
              cliente_id: recordObj.cliente_id,
              corpo_id: recordObj.corpo_id,
              division: recordObj.division,
              fecha: fechaParsed ? fechaParsed.toISOString() : null,
              temas_a_tratar: recordObj.temas_a_tratar,
              colaboradores: recordObj.colaboradores,
              capacitadores: recordObj.capacitadores,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    if (recordObj) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      const fechaValue = recordObj.fecha instanceof Date ? recordObj.fecha.toISOString() : (typeof recordObj.fecha === 'string' ? recordObj.fecha : createdAt.toISOString());
      let fechaRegistro = fechaValue.split("T")[0];
      if (recordObj.created_by) {
        const empleado = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findUnique",
            where: { id: parseInt(String(recordObj.created_by), 10) },
          },
        });
        if (empleado) {
          const empleadoObj = empleado as any;
          empNombre = empleadoObj.nombre + " " + empleadoObj.primer_apellido + " " + empleadoObj.segundo_apellido;
        }
      }
      if (recordObj.corpo_id) {
        const sucursal = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: recordObj.corpo_id },
          },
        });
        if (sucursal) {
          const sucursalObj = sucursal as any;
          sucursalNombre = sucursalObj.nombre + " (" + sucursalObj.nro_sucursal + ")";
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de inducción general en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
      await sendNotificationByRole(req, recordObj.corpo_id, [parseInt(String(recordObj.created_by), 10)], "Registro de inducción general creado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Registro de inducción general creado correctamente",
        data: {
          ...fullRecordObj,
          id_local: "",
          empresa_nombre: fullRecordObj?.e_estructura_empresa ? `${fullRecordObj.e_estructura_empresa.codigo} - ${fullRecordObj.e_estructura_empresa.nombre}` : null,
          cliente_nombre: fullRecordObj?.e_estructura_cliente?.nombre || null,
          corpo_nombre: fullRecordObj?.e_estructura_sucursal ? `${fullRecordObj.e_estructura_sucursal.nro_sucursal} - ${fullRecordObj.e_estructura_sucursal.nombre}` : null,
          images: (fullRecordObj?.c_imagenes_registro_induccion_general || []).map((img: any) => ({
            id: img.id,
            name: img.name,
            url: baseUrl ? `${baseUrl}/api/general-induction-register/${fullRecordObj.id}/get-image/${img.name}` : "",
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


