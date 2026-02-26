import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { fetchDynamicFile, uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";
import { toZonedTime } from "date-fns-tz";

const parseIntStrict = (value: any) => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

    const body = await req.json();
    const firmaDigital = String(body?.firma_ejecutivo_cuenta_digital || "").trim();
    const firmaManual = String(body?.firma_ejecutivo_cuenta_manual || "").trim();
    if (!firmaDigital || firmaDigital.length < 10 || !firmaManual || firmaManual.length < 10) {
      return NextResponse.json({ status: false, message: "Se requiere la firma digital y la firma manual del ejecutivo" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
      return NextResponse.json(
        { status: false, message: "Este mutuo acuerdo ya fue firmado por el ejecutivo" },
        { status: 400 }
      );
    }

    if (!existing.ausente_acepta || !existing.reemplaza_acepta) {
      return NextResponse.json({ status: false, message: "Ambos empleados deben aceptar antes de firmar" }, { status: 400 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });

    const empleado = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
    });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;
    const canSign = myEjecutivoCuentaId !== null && Number(myEjecutivoCuentaId) === Number(existing.ejecutivo_cuenta);
    if (!canSign) {
      return NextResponse.json({ status: false, message: "No autorizado para firmar este mutuo acuerdo" }, { status: 403 });
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_mutuos_acuerdos",
        where: { id: idNum },
        data: {
          firma_ejecutivo_cuenta_manual: firmaManual,
          firma_ejecutivo_cuenta_digital: firmaDigital,
        },
      },
    });

    const now = toZonedTime(new Date(), "America/Costa_Rica").toISOString();

    if (updated) {
      const marca_ausente = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_marca_dia",
          operation: "findUnique",
          where: { id: updated.marcaDiaAusente_id },
        },
      });

      console.log(marca_ausente);

      const marca_reemplaza = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_marca_dia",
          operation: "findUnique",
          where: { id: updated.marcaDiaReemplaza_id },
        },
      });

      if (marca_ausente && marca_reemplaza) {

        let turno_reemplaza = "Diurno";
        switch (marca_reemplaza.tipo_turno) {
          case "M":
            turno_reemplaza = "Mixto";
            break;
          case "N":
            turno_reemplaza = "Nocturno";
            break;
        }

        const hora_inicio_reemplaza = marca_reemplaza.hora_inicio.split("T")[1].split(":");
        const hora_fin_reemplaza = marca_reemplaza.hora_fin.split("T")[1].split(":");
        const hora_inicio_reemplaza_text = `${hora_inicio_reemplaza[0]}:${hora_inicio_reemplaza[1]}`;
        const hora_fin_reemplaza_text = `${hora_fin_reemplaza[0]}:${hora_fin_reemplaza[1]}`;
        const turno_reemplaza_text = `${turno_reemplaza} ${hora_inicio_reemplaza_text} - ${hora_fin_reemplaza_text}`;
        
        let turno_ausente = "Diurno";
        switch (marca_ausente.tipo_turno) {
          case "M":
            turno_ausente = "Mixto";
            break;
          case "N":
            turno_ausente = "Nocturno";
            break;
        }

        const hora_inicio_ausente = marca_ausente.hora_inicio.split("T")[1].split(":");
        const hora_fin_ausente = marca_ausente.hora_fin.split("T")[1].split(":");
        const hora_inicio_ausente_text = `${hora_inicio_ausente[0]}:${hora_inicio_ausente[1]}`;
        const hora_fin_ausente_text = `${hora_fin_ausente[0]}:${hora_fin_ausente[1]}`;
        const turno_ausente_text = `${turno_ausente} ${hora_inicio_ausente_text} - ${hora_fin_ausente_text}`;

        // Obtener el registro de c_cambio_guardia cuyo dato tipo sea 'MUT' y cuyo dato id sea el más alto
        const lastMutation = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_cambio_guardia", operation: "findFirst", where: { tipo: 'MUT', id: { gt: 0 } }, orderBy: { id: 'desc' } },
        });

        let consecutivo = 'MUT-CG-000001';
        if (lastMutation) {
          const separated = lastMutation.consecutivo?.split("-");
          if (separated && separated.length > 1) {
            const count = Number(separated[1]) + 1; // Debe tener 0 hasta alcanzar una extensión de 6 dígitos
            const countStr = count.toString().padStart(6, '0');
            consecutivo = `${separated[0]}-${separated[1]}-${countStr}`;
          }
        }

        const cambioGuardiaCreated = await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "c_cambio_guardia",
            data: {
              fecha_reemplaza: marca_reemplaza.fecha,
              turno_reemplaza: turno_reemplaza_text,
              fecha_ausente: marca_ausente.fecha,
              turno_ausente: turno_ausente_text,
              motivo_ausente: 'V_MUT',
              updated_at: now,
              fecha_insercion: now,
              empleadoReemplaza_id: marca_reemplaza.empleadoFijo_id,
              plazaReemplaza_id: marca_reemplaza.plaza_id,
              marcaDiaReemplaza_id: marca_reemplaza.id,
              empleadoAusente_id: marca_ausente.empleadoFijo_id,
              plazaAusente_id: marca_ausente.plaza_id,
              marcaDiaAusente_id: marca_ausente.id,
              coordinador_id: 3,
              tipo: 'MUT',
              consecutivo: consecutivo,
              mobile_upload: true,
            },
          },
        });
        if (cambioGuardiaCreated) {
          if (existing.file_name) {
            const fetched = await fetchDynamicFile({
              req,
              type: "file",
              url: `mutuos-acuerdos/${existing.id}/${existing.file_name}`,
            });
            const fileBase64 = fetched.buffer.toString("base64");
            const ext = String(existing.file_name).includes(".")
              ? String(existing.file_name).split(".").pop() || "dat"
              : "dat";
            const copiedName = String(existing.file_name);
            const uploadResp = await uploadDynamicFiles({
              req,
              folderPath: `cambio-guardia/${cambioGuardiaCreated.id}`,
              files: [
                {
                  type: "file",
                  extension: ext,
                  name: copiedName,
                  original_name: copiedName,
                  file_base64: fileBase64,
                },
              ],
            });
            const copiedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            if (copiedFiles[0]?.name) {
              await callDynamicPrisma({
                req,
                data: {
                  action: "UPDATE",
                  table: "c_cambio_guardia",
                  where: { id: cambioGuardiaCreated.id },
                  data: {
                    document: copiedName,
                  },
                },
              });
            }
          }

          // Actualizar el mutuo acuerdo con el id del cambio de guardia
          await callDynamicPrisma({
            req,
            data: {
              action: "UPDATE",
              table: "e_mutuos_acuerdos",
              where: { id: idNum },
              data: {
                cambio_guardia_id: cambioGuardiaCreated.id,
              },
            },
          });
        }
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_mutuos_acuerdos",
          registro_id: idNum,
          cambios: JSON.stringify([
            { prop: "firma_ejecutivo_cuenta_manual", before: existing.firma_ejecutivo_cuenta_manual || null, after: firmaManual },
            { prop: "firma_ejecutivo_cuenta_digital", before: existing.firma_ejecutivo_cuenta_digital || null, after: firmaDigital },
          ]),
          created_at: now,
          created_by: currentEmployeeId,
        },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Firmas del ejecutivo guardadas correctamente",
        data: {
          id: updated.id,
          firma_ejecutivo_cuenta_manual: updated.firma_ejecutivo_cuenta_manual,
          firma_ejecutivo_cuenta_digital: updated.firma_ejecutivo_cuenta_digital,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
