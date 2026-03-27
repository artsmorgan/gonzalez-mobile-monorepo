import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { fetchDynamicFile, uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";

const parseIntStrict = (value: any) => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

const parseDateInputToDate = (input: unknown): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
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
    const horaAccion = parseDateInputToDate(body?.hora_accion);
    if (!firmaDigital || firmaDigital.length < 10 || !firmaManual || firmaManual.length < 10) {
      return NextResponse.json({ status: false, message: "Se requiere la firma digital y la firma manual del ejecutivo" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase() || "pendiente";
    if (estadoActual !== "pendiente") {
      return NextResponse.json({ status: false, message: "Solo se puede aprobar un mutuo acuerdo pendiente" }, { status: 400 });
    }

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
          estado: "aprobado",
        },
      },
    });

    const now = horaAccion ? horaAccion.toISOString() : toZonedTime(new Date(), "America/Costa_Rica").toISOString();

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

        // Update marca_reemplaza.empleadoReemplaza_id to the current employee id
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_marca_dia",
            operation: "update",
            where: { id: marca_reemplaza.id },
            data: {
              empleadoReemplaza_id: marca_ausente.empleadoFijo_id,
            },
          },
        });

        // Update marca_ausente.empleadoReemplaza_id to the current employee id
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_marca_dia",
            operation: "update",
            where: { id: marca_ausente.id },
            data: {
              empleadoReemplaza_id: marca_reemplaza.empleadoFijo_id,
            },
          },
        });

        let turno_reemplaza = "Diurno";
        switch (marca_reemplaza.tipo_turno) {
          case "M":
            turno_reemplaza = "Mixto";
            break;
          case "N":
            turno_reemplaza = "Nocturno";
            break;
        }

        const hora_inicio_reemplaza = marca_reemplaza.hora_inicio ? marca_reemplaza.hora_inicio.split("T")[1].split(":") : '-Sin hora-';
        const hora_fin_reemplaza = marca_reemplaza.hora_fin ? marca_reemplaza.hora_fin.split("T")[1].split(":") : '-Sin hora-';
        console.log(1);
        const hora_inicio_reemplaza_text = hora_inicio_reemplaza !== '-Sin hora-' ? `${hora_inicio_reemplaza[0]}:${hora_inicio_reemplaza[1]}` : '-Sin hora-';
        const hora_fin_reemplaza_text = hora_fin_reemplaza !== '-Sin hora-' ? `${hora_fin_reemplaza[0]}:${hora_fin_reemplaza[1]}` : '-Sin hora-';
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
        console.log(2);
        const hora_inicio_ausente_text = `${hora_inicio_ausente[0]}:${hora_inicio_ausente[1]}`;
        const hora_fin_ausente_text = `${hora_fin_ausente[0]}:${hora_fin_ausente[1]}`;
        const turno_ausente_text = `${turno_ausente} ${hora_inicio_ausente_text} - ${hora_fin_ausente_text}`;

        // Obtener el registro de c_cambio_guardia cuyo dato tipo sea 'MUT' y cuyo dato id sea el más alto
        const lastMutation = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_cambio_guardia", operation: "findFirst", where: { tipo: 'MUT', id: { gt: 0 } }, orderBy: { id: 'desc' } },
        });

        const empresa_ausente = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "e_estructura_empresa", operation: "findUnique", where: { id: marca_ausente.empresa_id } },
        });

        if (!empresa_ausente) {
          return NextResponse.json({ status: false, message: "Empresa del ausente no encontrada" }, { status: 400 });
        }

        let consecutivo = null;
        if (lastMutation) {
          const separated = lastMutation.consecutivo?.split("-");
          console.log(3);
          if (separated && separated.length > 1) {
            const result = (parseInt(separated[2], 10) + 1)
              .toString()
              .padStart(separated[2].length, "0");

              let corp = "CG";
              switch (empresa_ausente.id) {
                case 9:
                  corp = "CG";
                  break;
                case 10:
                  corp = "CH";
                  break;
              }

            consecutivo = `${separated[0]}-${corp}-${result}`;
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
              tipo: 'MUT',
              consecutivo: consecutivo,
              coordinadoPor_id: 3,
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
            console.log(4);
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
            { prop: "estado", before: (existing as any)?.estado || null, after: "aprobado" },
          ]),
          created_at: now,
          created_by: currentEmployeeId,
        },
      },
    });

    const empleadoAusenteId = Number((existing as any)?.empleadoAusente_id || 0);
    const empleadoReemplazaId = Number((existing as any)?.empleadoReemplaza_id || 0);
    const recipients = Array.from(new Set([empleadoAusenteId, empleadoReemplazaId].filter((x) => Number(x) > 0)));
    if (recipients.length > 0) {
      const [empleadoAusente, empleadoReemplaza, ejecutivo, marcaAusenteNotif, marcaReemplazaNotif] = await Promise.all([
        empleadoAusenteId
          ? callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: empleadoAusenteId } },
          })
          : null,
        empleadoReemplazaId
          ? callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: empleadoReemplazaId } },
          })
          : null,
        callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
        }),
        callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: Number((existing as any)?.marcaDiaAusente_id || 0) } },
        }),
        callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: Number((existing as any)?.marcaDiaReemplaza_id || 0) } },
        }),
      ]);
      const [puestoAusente, puestoReemplaza] = await Promise.all([
        (marcaAusenteNotif as any)?.puesto_id
          ? callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: Number((marcaAusenteNotif as any)?.puesto_id) } },
          })
          : null,
        (marcaReemplazaNotif as any)?.puesto_id
          ? callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: Number((marcaReemplazaNotif as any)?.puesto_id) } },
          })
          : null,
      ]);

      const ausenteNombre = empleadoAusente
        ? `${empleadoAusente.nombre ?? ""} ${empleadoAusente.primer_apellido ?? ""} ${empleadoAusente.segundo_apellido ?? ""}`.trim()
        : `ID ${empleadoAusenteId}`;
      const reemplazaNombre = empleadoReemplaza
        ? `${empleadoReemplaza.nombre ?? ""} ${empleadoReemplaza.primer_apellido ?? ""} ${empleadoReemplaza.segundo_apellido ?? ""}`.trim()
        : `ID ${empleadoReemplazaId}`;
      const ejecutivoNombre = ejecutivo
        ? `${ejecutivo.nombre ?? ""} ${ejecutivo.primer_apellido ?? ""} ${ejecutivo.segundo_apellido ?? ""}`.trim()
        : `ID ${currentEmployeeId}`;

      const ausenteCedula = String((empleadoAusente as any)?.cedula ?? "");
      const reemplazaCedula = String((empleadoReemplaza as any)?.cedula ?? "");
      const fecha = now.split("T")[0];
      const hora = now.split("T")[1]?.replace("Z", "") || "";
      console.log(5);

      const fechaAusente = (marcaAusenteNotif as any)?.fecha ? new Date((marcaAusenteNotif as any).fecha).toISOString().split("T")[0] : fecha;
      const fechaReemplaza = (marcaReemplazaNotif as any)?.fecha ? new Date((marcaReemplazaNotif as any).fecha).toISOString().split("T")[0] : fecha;
      const horaInicioAusente = (marcaAusenteNotif as any)?.hora_inicio ? new Date((marcaAusenteNotif as any).hora_inicio).toISOString().split("T")[1] : hora;
      const horaInicioReemplaza = (marcaReemplazaNotif as any)?.hora_inicio ? new Date((marcaReemplazaNotif as any).hora_inicio).toISOString().split("T")[1] : hora;
      const puestoNombreAusente = (puestoAusente as any)?.nombre || "Desconocido";
      const puestoNombreReemplaza = (puestoReemplaza as any)?.nombre || "Desconocido";
      console.log(6);
      await sendNotificationByEmployee(
        req,
        0,
        [currentEmployeeId],
        `Mutuo acuerdo aprobado`,
        `El mutuo acuerdo fue aprobado por ${ejecutivoNombre} el día ${fecha} a las ${hora}. El empleado ${ausenteNombre} (cédula ${ausenteCedula || "N/A"}) acordó cambiar el turno del día ${fechaAusente} a las ${horaInicioAusente} para el puesto ${puestoNombreAusente} por el turno del día ${fechaReemplaza} a las ${horaInicioReemplaza} para el puesto ${puestoNombreReemplaza} del empleado ${reemplazaNombre} (cédula ${reemplazaCedula || "N/A"}).`,
        recipients
      ).catch((error) => {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error sending mutuos-acuerdos firma-ejecutivo notification:", msg);
      });
    }

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
