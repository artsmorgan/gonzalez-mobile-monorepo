/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import {
  buildCorporateVehicleCreateFromBitacora,
  canRegisterCorporateVehicleFromBitacora,
  isTipoBicicleta,
  normalizeMarca,
} from "../../../utils/corporateVehiclePayload";
import { hydrateBitacoraRevisionImagesFromMultipart } from "../../../utils/bitacoraRevisionImages";

type MultipartBody = { get(name: string): string | { arrayBuffer(): Promise<ArrayBuffer> } | null };

async function parseBitacoraRequestBody(req: NextRequest): Promise<{
  body: Record<string, any>;
  multipartForm: MultipartBody | null;
}> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = (await req.formData()) as unknown as MultipartBody;
    const rawMeta = formData.get("metadata");
    if (typeof rawMeta !== "string") {
      throw new Error("metadata faltante o inválido");
    }
    return { body: JSON.parse(rawMeta), multipartForm: formData };
  }
  return { body: await req.json(), multipartForm: null };
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

function normalizeToStringifiedJson(value: any): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? []);
}

/** Placa no vacía tras trim; para comparar suele normalizarse a mayúsculas. */
function normalizePlacaForMatch(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function isValidPlaca(value: unknown): boolean {
  return normalizePlacaForMatch(value).length > 0;
}

/** Tipo de vehículo (no confundir con `tipo` de la bitácora): trim y no vacío. */
function normalizeTipoVehiculoForMatch(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidTipoVehiculo(value: unknown): boolean {
  return normalizeTipoVehiculoForMatch(value).length > 0;
}

/** Tipo de vehículo (no confundir con `tipo` de la bitácora): trim y no vacío. */
function normalizeTipoAutoriaVehiculoForMatch(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidTipoAutoriaVehiculo(value: unknown): boolean {
  return normalizeTipoAutoriaVehiculoForMatch(value).length > 0;
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }
    // Soporte para filtros directos por estructura (sin depender de marca)
    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const sucursalIdStr = req.nextUrl.searchParams.get("sucursal_id");

    let empresaId: number | null = empresaIdStr ? parseInt(String(empresaIdStr), 10) : null;
    let clienteId: number | null = clienteIdStr ? parseInt(String(clienteIdStr), 10) : null;
    let sucursalId: number | null = sucursalIdStr ? parseInt(String(sucursalIdStr), 10) : null;

    // Compat: si no vienen ids directos, usamos marca (comportamiento anterior)
    if (!empresaId || !clienteId || !sucursalId) {
      const marcaIdStr = req.nextUrl.searchParams.get("m");
      if (!marcaIdStr) {
        return NextResponse.json(
          { status: false, message: "Marca no especificada" },
          { status: 200 }
        );
      }

      const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaIdStr) } });
      if (!marcaDia) {
        return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
      }

      if (!marcaDia.empleadoFijo_id) {
        return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
      }

      // Obtener la última marca del empleado (simplificado: obtener la más reciente)
      const lastMarca = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: marcaDia.empleadoFijo_id }, orderBy: { fecha: "desc", hora_inicio: "desc" } });
      if (!lastMarca) {
        return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
      }

      empresaId = marcaDia.empresa_id;
      clienteId = marcaDia.cliente_id;
      sucursalId = marcaDia.corpo_id;
    }

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_bitacora_vehiculo_detenido",
        operation: "findMany",
        where: { sucursal_id: Number(sucursalId), isActive: true },
        orderBy: { id: "desc" }
      }
    });

    const mapped = rows.map((r: any) => ({
      id: r.id,
      empresa_id: r.empresa_id,
      cliente_id: r.cliente_id,
      sucursal_id: r.sucursal_id,
      division_id: r.division_id,
      contrato_id: r.contrato_id,
      puesto_id: r.puesto_id,
      isActive: r.isActive !== false,
      vehiculo_id: r.vehiculo_id ?? null,
      uso_id: r.uso_id ?? null,
      tipo: r.tipo,
      informacion_general: safeParseJson<any[]>(r.informacion_general, []),
      informacion_revision: safeParseJson<any[]>(r.informacion_revision, []),
      movimientos_vehiculos: safeParseJson<any[]>(r.movimientos_vehiculos, []),
      observaciones: r.observaciones,
      firma_responsable: r.firma_responsable,
      created_by: r.created_by,
      created_at: r.created_at,
      id_local: "",
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/bitacora-vehiculo-detenido:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    let body: Record<string, any>;
    let multipartForm: MultipartBody | null = null;
    try {
      const parsed = await parseBitacoraRequestBody(req);
      body = parsed.body;
      multipartForm = parsed.multipartForm;
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : "Cuerpo inválido";
      return NextResponse.json({ status: false, message: msg }, { status: 200 });
    }
    const {
      marca_id,
      empresa_id,
      cliente_id,
      sucursal_id,
      division_id,
      contrato_id,
      puesto_id,
      isActive,
      vehiculo_id,
      uso_id,
      tipo,
      informacion_general,
      informacion_revision,
      movimientos_vehiculos,
      observaciones,
      firma_responsable,
      register_vehicle,
    } = body ?? {};

    // marca_id era requerido previamente. Ahora permitimos crear por estructura directa.
    const divId = division_id != null ? Number(division_id) : 0;
    const ctId = contrato_id != null ? Number(contrato_id) : 0;
    const puestoId = puesto_id != null ? Number(puesto_id) : 0;
    if (
      (!marca_id && (!empresa_id || !cliente_id || !sucursal_id || !divId || !ctId || !puestoId)) ||
      !tipo ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    let empresaId = empresa_id ? Number(empresa_id) : 0;
    let clienteId = cliente_id ? Number(cliente_id) : 0;
    let sucursalId = sucursal_id ? Number(sucursal_id) : 0;

    if (marca_id) {
      const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
      if (!marcaDia) {
        return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
      }
      // Si no vienen ids explícitos, usamos los de marca
      if (!empresaId) empresaId = marcaDia.empresa_id ?? 0;
      if (!clienteId) clienteId = marcaDia.cliente_id ?? 0;
      if (!sucursalId) sucursalId = marcaDia.corpo_id ?? 0;
    }

    if (!empresaId || !clienteId || !sucursalId) {
      return NextResponse.json({ status: false, message: "Estructura incompleta" }, { status: 200 });
    }

    let divisionIdFinal = divId;
    let contratoIdFinal = ctId;
    let puestoIdFinal = puestoId;
    if (marca_id && (!puestoIdFinal || !contratoIdFinal)) {
      const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
      if (marcaDia) {
        if (!puestoIdFinal) puestoIdFinal = Number((marcaDia as any).puesto_id ?? 0);
        if (!contratoIdFinal) contratoIdFinal = Number((marcaDia as any).contrato_id ?? 0);
      }
    }
    if (puestoIdFinal) {
      const puestoRow = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoIdFinal } });
      const sidP = puestoRow ? Number(puestoRow.sucursal_id ?? 0) : 0;
      if (sidP > 0 && sidP !== Number(sucursalId)) {
        return NextResponse.json(
          { status: false, message: "El puesto no pertenece a la sucursal indicada" },
          { status: 200 }
        );
      }
    }
    const sucRow = await prisma.e_estructura_sucursal.findUnique({ where: { id: Number(sucursalId) } });
    const contratoFromSucursal = sucRow ? Number(sucRow.contrato_id ?? 0) : 0;
    if (!contratoIdFinal && contratoFromSucursal) {
      contratoIdFinal = contratoFromSucursal;
    }
    if (contratoIdFinal && !divisionIdFinal) {
      const ctRow = await prisma.e_estructura_contrato.findUnique({ where: { id: contratoIdFinal } });
      if (ctRow && ctRow.division_id != null) {
        divisionIdFinal = Number(ctRow.division_id);
      }
    }
    if (!divisionIdFinal || !contratoIdFinal || !puestoIdFinal) {
      return NextResponse.json(
        { status: false, message: "División, contrato y puesto son requeridos" },
        { status: 200 }
      );
    }

    const activeFlag = isActive === false ? false : true;

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;

    // Si no hay vehiculo_id pero sí se solicitó registrar vehículo: validar placa/tipo del vehículo,
    // reutilizar vehículo corporativo de la misma sucursal si ya existe, o crear uno nuevo.
    let finalVehiculoId: number | null = vehiculo_id ? Number(vehiculo_id) : null;
    if (!finalVehiculoId && register_vehicle) {
      try {
        const reg = register_vehicle as Record<string, unknown>;
        const tipoVehiculoRaw = reg.tipo ?? (register_vehicle as any).tipo;

        if (canRegisterCorporateVehicleFromBitacora(reg)) {
          const tipoVehNorm = normalizeTipoVehiculoForMatch(tipoVehiculoRaw);
          const tipoAutoriaNorm = normalizeTipoAutoriaVehiculoForMatch(reg.tipo_autoria);
          const marcaNorm = normalizeMarca(reg.marca);

          if (!isTipoBicicleta(tipoVehiculoRaw) && isValidPlaca(reg.placa) && isValidTipoAutoriaVehiculo(reg.tipo_autoria)) {
            const placaNorm = normalizePlacaForMatch(reg.placa);
            const corporateFleet = await callDynamicPrisma({
              req,
              data: {
                action: "GET",
                table: "c_vehiculos_corporativos",
                operation: "findMany",
                where: {
                  sucursal_id: sucursalId,
                  placa: String(reg.placa ?? ""),
                  tipo: String(tipoVehiculoRaw ?? ""),
                  tipo_autoria: tipoAutoriaNorm,
                },
              },
            });

            const existingVehicle = Array.isArray(corporateFleet)
              ? (corporateFleet as any[]).find(
                  (v: any) =>
                    normalizePlacaForMatch(v?.placa) === placaNorm &&
                    normalizeTipoVehiculoForMatch(v?.tipo).toLowerCase() === tipoVehNorm.toLowerCase() &&
                    normalizeTipoAutoriaVehiculoForMatch(v?.tipo_autoria).toLowerCase() ===
                      tipoAutoriaNorm.toLowerCase()
                )
              : null;

            if (existingVehicle?.id != null) {
              finalVehiculoId = Number(existingVehicle.id);
            }
          } else if (isTipoBicicleta(tipoVehiculoRaw) && marcaNorm) {
            const corporateFleet = await callDynamicPrisma({
              req,
              data: {
                action: "GET",
                table: "c_vehiculos_corporativos",
                operation: "findMany",
                where: {
                  sucursal_id: sucursalId,
                  tipo: "Bicicleta",
                  marca: marcaNorm,
                  ...(tipoAutoriaNorm ? { tipo_autoria: tipoAutoriaNorm } : {}),
                },
              },
            });
            const existingBike = Array.isArray(corporateFleet) ? (corporateFleet as any[])[0] : null;
            if (existingBike?.id != null) {
              finalVehiculoId = Number(existingBike.id);
            }
          }
        }

        if (!finalVehiculoId && canRegisterCorporateVehicleFromBitacora(reg)) {
          const createData = buildCorporateVehicleCreateFromBitacora(reg, {
            empresa_id: empresaId,
            cliente_id: clienteId,
            sucursal_id: sucursalId,
            firma_responsable: String(firma_responsable ?? ""),
            created_by: createdBy,
            created_at: createdAt.toISOString(),
          });
          const newVehicle = await callDynamicPrisma({
            req,
            data: {
              action: "POST",
              table: "c_vehiculos_corporativos",
              operation: "create",
              data: createData,
            },
          });

          if (newVehicle && (newVehicle as any).id) {
            finalVehiculoId = Number((newVehicle as any).id);
          }
        }
      } catch (vehError) {
        console.error("Error creando vehículo corporativo desde bitácora:", vehError);
      }
    }

    let revisionStrInitial = normalizeToStringifiedJson(informacion_revision);

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_bitacora_vehiculo_detenido",
        data: {
          empresa_id: empresaId,
          cliente_id: clienteId,
          sucursal_id: sucursalId,
          division_id: divisionIdFinal,
          contrato_id: contratoIdFinal,
          puesto_id: puestoIdFinal,
          isActive: activeFlag,
          vehiculo_id: finalVehiculoId,
          uso_id: uso_id ? Number(uso_id) : null,
          tipo: String(tipo),
          informacion_general: normalizeToStringifiedJson(informacion_general),
          informacion_revision: revisionStrInitial,
          movimientos_vehiculos: normalizeToStringifiedJson(movimientos_vehiculos),
          observaciones: String(observaciones ?? "-"),
          firma_responsable: String(firma_responsable),
          created_by: createdBy,
          created_at: createdAt.toISOString(),
        }
      }
    });

    if (created?.id && multipartForm) {
      try {
        const hydrated = await hydrateBitacoraRevisionImagesFromMultipart(
          req,
          Number(created.id),
          revisionStrInitial,
          multipartForm
        );
        if (hydrated !== revisionStrInitial) {
          revisionStrInitial = hydrated;
          await callDynamicPrisma({
            req,
            data: {
              action: "UPDATE",
              table: "c_bitacora_vehiculo_detenido",
              where: { id: created.id },
              data: { informacion_revision: revisionStrInitial },
            },
          });
        }
      } catch (imgErr) {
        console.error("Error subiendo imágenes de revisión (bitácora create):", imgErr);
      }
    }

    // Vinculación: si viene `uso_id`, marcamos el uso con `bitacora_id = created.id`
    let description = "";
    let empNombre = "Desconocido";
    let sucursalNombre = "Desconocida";
    const fechaEntrada = createdAt.toISOString().split("T")[0];
    const horaEntrada = createdAt.toISOString().split("T")[1].split(".")[0];
    if (created.created_by) {
      const empleado = await prisma.c_empleado.findUnique({ where: { id: created.created_by } });
      if (empleado) {
        empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
      }
    }
    if (sucursalId) {
      const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: sucursalId } });
      if (sucursal) {
        sucursalNombre = sucursal.nombre;
      }
    }
    if (created) {
      description = "El empleado " + empNombre + " ha creado una bitácora de vehículo detenido de tipo " + tipo;
      if (uso_id) {
        try {
          const uso = await callDynamicPrisma({
            req,
            data: {
              action: "UPDATE",
              table: "c_usos_vehiculos_corporativos",
              where: { id: Number(uso_id) },
              data: { bitacora_id: created.id }
            }
          });
          if (uso) {
            const vehiculo = await callDynamicPrisma({
              req,
              data: { action: "GET", table: "c_vehiculos_corporativos", operation: "findUnique", where: { id: uso.vehiculo_id } }
            });
            if (vehiculo) {
              description += " para el vehículo con la placa " + vehiculo.placa;
            }
          }
        } catch {
          // si falla, no rompemos el create de bitácora
        }
      }
      description += " en la sucursal " + sucursalNombre + " el día " + fechaEntrada + " a las " + horaEntrada;
      await sendNotificationByRole(req, sucursalId, [], "Bitácora de vehículo detenido creada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_bitacora_vehiculo_detenido",
          registro_id: created.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: created.id,
              empresa_id: created.empresa_id,
              cliente_id: created.cliente_id,
              sucursal_id: created.sucursal_id,
              tipo: created.tipo,
              observaciones: created.observaciones,
              firma_responsable: created.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: created.created_by,
        }
      }
    });

    return NextResponse.json(
      { status: true, message: "Bitácora creada correctamente", id: created.id, data: { id: created.id } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/bitacora-vehiculo-detenido:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


