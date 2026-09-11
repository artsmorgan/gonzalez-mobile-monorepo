/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";

export type AccionesPersonalesModuleFilters = {
    empleadoIds?: number[] | null;
    empresaIds?: number[] | null;
    clienteIds?: number[] | null;
    divisionIds?: number[] | null;
    contratoIds?: number[] | null;
    corpoIds?: number[] | null;
    puestoIds?: number[] | null;
    plazaIds?: number[] | null;
};

export type AccionesPersonalesOrderKey =
    | "empleado_id"
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "plaza_id";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
}

export function normalizeAccionesPersonalesFilters(raw: unknown): AccionesPersonalesModuleFilters {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: AccionesPersonalesModuleFilters = {};
    const eids = toValidIds(o.empleadoIds);
    const emp = toValidIds(o.empresaIds);
    const cli = toValidIds(o.clienteIds);
    const div = toValidIds(o.divisionIds);
    const con = toValidIds(o.contratoIds);
    const cor = toValidIds(o.corpoIds);
    const pue = toValidIds(o.puestoIds);
    const plz = toValidIds(o.plazaIds);
    if (eids.length) next.empleadoIds = eids;
    if (emp.length) next.empresaIds = emp;
    if (cli.length) next.clienteIds = cli;
    if (div.length) next.divisionIds = div;
    if (con.length) next.contratoIds = con;
    if (cor.length) next.corpoIds = cor;
    if (pue.length) next.puestoIds = pue;
    if (plz.length) next.plazaIds = plz;
    return next;
}

export function hasAccionesPersonalesListModuleFiltersContent(f: AccionesPersonalesModuleFilters): boolean {
    return !!(
        f.empleadoIds?.length ||
        f.empresaIds?.length ||
        f.clienteIds?.length ||
        f.divisionIds?.length ||
        f.contratoIds?.length ||
        f.corpoIds?.length ||
        f.puestoIds?.length ||
        f.plazaIds?.length
    );
}

export function filtersMatchAccionesPersonalesListQuery(
    parsedRowFilters: any,
    listModuleFilters?: AccionesPersonalesModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeAccionesPersonalesFilters((parsedRowFilters?.moduleFilters || {}) as any);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (!overlaps(listModuleFilters.empleadoIds ?? undefined, saved.empleadoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.plazaIds ?? undefined, saved.plazaIds ?? undefined)) return false;
    return true;
}

function fmtDate(d: unknown): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    if (d == null) return "";
    return String(d);
}

function fmtDateTime(d: unknown): string {
    if (d instanceof Date) return d.toISOString().replace("T", " ").slice(0, 19);
    if (d == null) return "";
    return String(d);
}

function fmtScalarExcel(v: unknown): string | number {
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "Sí" : "No";
    if (v instanceof Date) return fmtDateTime(v);
    if (typeof v === "number") return v;
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "object" && v !== null && "toFixed" in (v as object)) return String(v);
    return String(v);
}

/** Texto legible de una FK; si no hay texto útil, devuelve el id como último recurso. */
function fmtFkReadable(id: unknown, rel: any, formatRel: (x: any) => string): string {
    const txt = rel != null ? formatRel(rel).trim() : "";
    if (txt) return txt;
    if (id != null && id !== "") return String(id);
    return "";
}

function fmtEmp(e: any): string {
    if (!e) return "";
    const parts = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean);
    const name = parts.join(" ").trim();
    const c = e.codigo ? String(e.codigo).trim() : "";
    return c ? `${c} — ${name}` : name;
}

function fmtEmpresa(e: any): string {
    if (!e) return "";
    const code = e.codigo ? `${String(e.codigo).trim()} — ` : "";
    return `${code}${e.nombre ?? ""}`.trim();
}

function fmtDivisionFromContrato(contrato: any): string {
    const d = contrato?.n_division;
    if (!d) return "";
    const code = d.codigo ? `${String(d.codigo).trim()} — ` : "";
    return `${code}${d.nombre ?? ""}`.trim();
}

function fmtContrato(c: any): string {
    if (!c) return "";
    const nro = c.nro_contrato ? `${String(c.nro_contrato).trim()} — ` : "";
    const base = `${nro}${c.nombre ?? ""}`.trim();
    const div = fmtDivisionFromContrato(c);
    if (base && div) return `${base} · Div.: ${div}`;
    return base || div;
}

function fmtCorpo(s: any): string {
    if (!s) return "";
    const n = s.nro_sucursal ? `${String(s.nro_sucursal).trim()} — ` : "";
    return `${n}${s.nombre ?? ""}`.trim();
}

function fmtPuesto(p: any): string {
    if (!p) return "";
    const code = p.codigo ? `${String(p.codigo).trim()} — ` : "";
    return `${code}${p.nombre ?? ""}`.trim();
}

function fmtPlaza(pl: any): string {
    if (!pl) return "";
    const code = pl.codigo_plaza ? `${String(pl.codigo_plaza).trim()} — ` : "";
    return `${code}${pl.nombre ?? ""}`.trim();
}

function fmtTipoAccion(t: any): string {
    if (!t) return "";
    const code = t.codigo ? `${String(t.codigo).trim()} — ` : "";
    return `${code}${t.nombre ?? ""}`.trim();
}

function fmtCliente(c: any): string {
    if (!c) return "";
    return String(c.nombre ?? "").trim();
}

function fmtHorario(h: any): string {
    if (!h) return "";
    return String(h.titulo ?? "").trim();
}

function fmtLlegadaTardia(x: any): string {
    if (!x) return "";
    const parts = [
        x.tipo_turno,
        x.horario_str,
        x.cantidad_horas != null ? `${x.cantidad_horas} h` : "",
        x.minutos_descuento != null ? `desc. ${x.minutos_descuento} min` : "",
    ].filter(Boolean);
    return parts.join(" · ");
}

function fmtSalidaAnticipada(x: any): string {
    if (!x) return "";
    const parts = [x.tipo_turno, x.horario_str, x.cantidad_horas != null ? `${x.cantidad_horas} h` : "", x.motivo].filter(Boolean);
    return parts.join(" · ").slice(0, 500);
}

function fmtBaja(x: any): string {
    if (!x) return "";
    return x.preaviso_id != null ? `Baja (preaviso ${x.preaviso_id})` : "Baja";
}

function fmtAjusteSalario(x: any): string {
    if (!x) return "";
    const rango = `${x.salario_inicial ?? "?"} → ${x.salario_final ?? "?"}`;
    return x.motivo ? `${x.motivo} · ${rango}` : rango;
}

function fmtVacacionPago(x: any): string {
    if (!x) return "";
    const parts = [
        x.periodo,
        x.cantidad_dias_pagados != null ? `${x.cantidad_dias_pagados} días pagados` : "",
        x.monto_pagar != null ? String(x.monto_pagar) : "",
    ].filter(Boolean);
    return parts.join(" · ");
}

function fmtVacacionDisfrute(x: any): string {
    if (!x) return "";
    const parts = [
        x.periodo,
        x.cantidad_dias_disfrutados != null ? `${x.cantidad_dias_disfrutados} días` : "",
        x.monto_pagar != null ? String(x.monto_pagar) : "",
    ].filter(Boolean);
    return parts.join(" · ");
}

function fmtAusencia(x: any): string {
    if (!x) return "";
    return String(x.tipo ?? "").trim();
}

function fmtIncapacidadIns(x: any): string {
    if (!x) return "";
    const parts = [x.tipo, x.numero_poliza ? `Pól. ${x.numero_poliza}` : ""].filter(Boolean);
    return parts.join(" · ");
}

function fmtTraslado(x: any): string {
    if (!x) return "";
    const parts = [
        x.motivo_traslado,
        x.nombre_oficial_sustituido,
        x.observaciones_motivo_traslado,
    ].filter(Boolean);
    return parts.join(" · ").slice(0, 400);
}

function fmtPreaviso(x: any): string {
    if (!x) return "";
    const parts = [x.tipo_preaviso, x.numero_dias != null ? `${x.numero_dias} días` : ""].filter(Boolean);
    return parts.join(" · ");
}

function fmtIncapacidadCcss(x: any): string {
    if (!x) return "";
    return [x.tipo, x.dias_subsidio != null ? `${x.dias_subsidio} días subsidio` : ""].filter(Boolean).join(" · ");
}

function fmtLicencia(x: any): string {
    if (!x) return "";
    return [`Prom. ${x.promedio_salario}`, `Subsidio ${x.monto_subsidio_pagar}`].join(" · ");
}

function fmtPeriodoPagoCfg(x: any): string {
    if (!x) return "";
    return [x.nombre, x.tipo].filter(Boolean).join(" · ");
}

function fmtCategoriaEmpleado(x: any): string {
    if (!x) return "";
    const code = x.codigo ? `${String(x.codigo).trim()} — ` : "";
    return `${code}${x.nombre ?? ""}`.trim();
}

function fmtTrasladoTemp(x: any): string {
    if (!x) return "";
    const parts = [x.fecha_fin ? fmtDate(x.fecha_fin) : "", x.plazaInicial_id != null ? `plaza ini. ${x.plazaInicial_id}` : ""].filter(Boolean);
    return parts.join(" · ");
}

function fmtVacacionMes(x: any): string {
    if (!x) return "";
    const parts = [
        x.fecha ? fmtDate(x.fecha) : "",
        x.dias_saldo_final != null ? `saldo final ${x.dias_saldo_final}` : "",
        x.motivo_ajuste,
    ].filter(Boolean);
    return parts.join(" · ");
}

function fmtSeparacionTemp(x: any): string {
    if (!x) return "";
    return [x.tipo, x.motivoAccion].filter(Boolean).join(" · ");
}

function fmtCambioHorario(x: any): string {
    if (!x) return "";
    const hi = x.c_horario_c_cambio_horario_horarioInicial_idToc_horario?.titulo;
    const hf = x.c_horario_c_cambio_horario_horarioFinal_idToc_horario?.titulo;
    const parts: string[] = [];
    if (hi) parts.push(`De: ${hi}`);
    if (hf) parts.push(`A: ${hf}`);
    return parts.join(" · ");
}

function fmtCambioPeriodoPago(x: any): string {
    if (!x) return "";
    const pi =
        x.p_periodopago_config_c_cambio_periodo_pago_periodoPagoInicial_idTop_periodopago_config?.nombre;
    const pf = x.p_periodopago_config_c_cambio_periodo_pago_periodoPagoFinal_idTop_periodopago_config?.nombre;
    const parts: string[] = [];
    if (pi) parts.push(`De: ${pi}`);
    if (pf) parts.push(`A: ${pf}`);
    return parts.join(" · ");
}

function fmtTipoContratacion(x: any): string {
    if (!x) return "";
    const code = x.codigo ? `${String(x.codigo).trim()} — ` : "";
    return `${code}${x.nombre ?? ""}`.trim();
}

function fmtNombreCat(x: any): string {
    if (!x) return "";
    return String(x.nombre ?? "").trim();
}

function fmtAdenda(x: any): string {
    if (!x) return "";
    const parts = [x.observaciones, fmtDate(x.fecha_fin_contrato)].filter(Boolean);
    return parts.join(" · ").slice(0, 300);
}

function fmtAccionPersonalRef(x: any): string {
    if (!x) return "";
    if (x.consecutivo) return `Cons. ${String(x.consecutivo).trim()}`;
    return "";
}

type ColDef = { header: string; cell: (r: any) => string | number };

function buildColumnDefs(): ColDef[] {
    return [
        { header: "Identificador (id)", cell: (r) => fmtScalarExcel(r.id) },
        {
            header: "Empleado (empleado_id)",
            cell: (r) =>
                fmtFkReadable(r.empleado_id, r.c_empleado_c_accion_personal_empleado_idToc_empleado, fmtEmp),
        },
        {
            header: "Plaza (plaza_id)",
            cell: (r) => fmtFkReadable(r.plaza_id, r.e_estructura_plazas, fmtPlaza),
        },
        {
            header: "Puesto (puesto_id)",
            cell: (r) => fmtFkReadable(r.puesto_id, r.e_estructura_puesto, fmtPuesto),
        },
        {
            header: "Sucursal / corpo (corpo_id)",
            cell: (r) => fmtFkReadable(r.corpo_id, r.e_estructura_sucursal, fmtCorpo),
        },
        {
            header: "Contrato (contrato_id)",
            cell: (r) => fmtFkReadable(r.contrato_id, r.e_estructura_contrato, fmtContrato),
        },
        {
            header: "Cliente (cliente_id)",
            cell: (r) => fmtFkReadable(r.cliente_id, r.e_estructura_cliente, fmtCliente),
        },
        {
            header: "Empresa (empresa_id)",
            cell: (r) => fmtFkReadable(r.empresa_id, r.e_estructura_empresa, fmtEmpresa),
        },
        {
            header: "Horario (horario_id)",
            cell: (r) => fmtFkReadable(r.horario_id, r.c_horario, fmtHorario),
        },
        { header: "Consecutivo (consecutivo)", cell: (r) => fmtScalarExcel(r.consecutivo) },
        { header: "Fecha inicio (fecha_inicio)", cell: (r) => fmtDate(r.fecha_inicio) },
        { header: "Fecha fin (fecha_fin)", cell: (r) => (r.fecha_fin ? fmtDate(r.fecha_fin) : "") },
        {
            header: "Fecha fin traslado (fecha_fin_traslado)",
            cell: (r) => (r.fecha_fin_traslado ? fmtDate(r.fecha_fin_traslado) : ""),
        },
        { header: "Fecha inserción (fecha_insercion)", cell: (r) => fmtDateTime(r.fecha_insercion) },
        { header: "Usuario inserción (usuario_insercion)", cell: (r) => fmtScalarExcel(r.usuario_insercion) },
        { header: "Salario (salario)", cell: (r) => fmtScalarExcel(r.salario) },
        { header: "Motivo reversión (motivo_reversion)", cell: (r) => fmtScalarExcel(r.motivo_reversion) },
        {
            header: "Fecha reversión (fecha_reversion)",
            cell: (r) => (r.fecha_reversion ? fmtDateTime(r.fecha_reversion) : ""),
        },
        { header: "Usuario reversión (usuario_reversion)", cell: (r) => fmtScalarExcel(r.usuario_reversion) },
        { header: "Comentarios (comentarios)", cell: (r) => String(r.comentarios ?? "").slice(0, 5000) },
        { header: "Documento (document)", cell: (r) => String(r.document ?? "").slice(0, 500) },
        {
            header: "Fecha actualización (fecha_actualizacion)",
            cell: (r) => (r.fecha_actualizacion ? fmtDateTime(r.fecha_actualizacion) : ""),
        },
        {
            header: "Tipo de acción (tipoAccion_id)",
            cell: (r) => fmtFkReadable(r.tipoAccion_id, r.c_tipo_accion, fmtTipoAccion),
        },
        {
            header: "Empleado reemplazo (reemplazo_id)",
            cell: (r) => fmtFkReadable(r.reemplazo_id, r.c_empleado_c_accion_personal_reemplazo_idToc_empleado, fmtEmp),
        },
        { header: "Cantidad horas (cantidad_horas)", cell: (r) => fmtScalarExcel(r.cantidad_horas) },
        {
            header: "Llegada tardía (llegada_tardia_id)",
            cell: (r) => fmtFkReadable(r.llegada_tardia_id, r.c_llegada_tardia, fmtLlegadaTardia),
        },
        {
            header: "Salida anticipada (salida_anticipada_id)",
            cell: (r) => fmtFkReadable(r.salida_anticipada_id, r.c_salida_anticipada, fmtSalidaAnticipada),
        },
        {
            header: "Baja (baja_id)",
            cell: (r) => fmtFkReadable(r.baja_id, r.c_baja, fmtBaja),
        },
        {
            header: "Ajuste salario (ajuste_salario_id)",
            cell: (r) => fmtFkReadable(r.ajuste_salario_id, r.c_ajuste_salario, fmtAjusteSalario),
        },
        {
            header: "Vacación pago (vacacion_pago_id)",
            cell: (r) => fmtFkReadable(r.vacacion_pago_id, r.c_vacacion_pago, fmtVacacionPago),
        },
        {
            header: "Vacación disfrute (vacacion_disfrute_id)",
            cell: (r) => fmtFkReadable(r.vacacion_disfrute_id, r.c_vacacion_disfrute, fmtVacacionDisfrute),
        },
        {
            header: "Contratación (contratacion_id)",
            cell: (r) => fmtFkReadable(r.contratacion_id, r.c_contratacion, () => ""),
        },
        {
            header: "Ausencia (ausencia_id)",
            cell: (r) => fmtFkReadable(r.ausencia_id, r.c_ausencia, fmtAusencia),
        },
        {
            header: "Permiso sin goce (permiso_sin_goce_id)",
            cell: (r) => fmtFkReadable(r.permiso_sin_goce_id, r.c_permiso_sin_goce, () => ""),
        },
        {
            header: "Permiso con goce (permiso_con_goce_id)",
            cell: (r) => fmtFkReadable(r.permiso_con_goce_id, r.c_permiso_con_goce, () => ""),
        },
        {
            header: "Suspensión (suspension_id)",
            cell: (r) => fmtFkReadable(r.suspension_id, r.c_suspension, () => ""),
        },
        {
            header: "Incapacidad INS (incapacidad_ins_id)",
            cell: (r) => fmtFkReadable(r.incapacidad_ins_id, r.c_incapacidad_ins, fmtIncapacidadIns),
        },
        {
            header: "Traslado (traslado_id)",
            cell: (r) => fmtFkReadable(r.traslado_id, r.c_traslado, fmtTraslado),
        },
        { header: "Reversible (reversible)", cell: (r) => fmtScalarExcel(r.reversible) },
        {
            header: "Preaviso (preaviso_id)",
            cell: (r) => fmtFkReadable(r.preaviso_id, r.c_preaviso, fmtPreaviso),
        },
        {
            header: "Incapacidad CCSS (incapacidad_ccss_id)",
            cell: (r) => fmtFkReadable(r.incapacidad_ccss_id, r.c_incapacidad_ccss, fmtIncapacidadCcss),
        },
        {
            header: "Licencia (licencia_id)",
            cell: (r) => fmtFkReadable(r.licencia_id, r.c_licencia, fmtLicencia),
        },
        { header: "Salario base mensual (salario_base_mensual)", cell: (r) => fmtScalarExcel(r.salario_base_mensual) },
        { header: "Número HED (numero_hed)", cell: (r) => fmtScalarExcel(r.numero_hed) },
        { header: "Número HEM (numero_hem)", cell: (r) => fmtScalarExcel(r.numero_hem) },
        { header: "Número HEN (numero_hen)", cell: (r) => fmtScalarExcel(r.numero_hen) },
        {
            header: "Monto descontar turnos (monto_descontar_turnos)",
            cell: (r) => fmtScalarExcel(r.monto_descontar_turnos),
        },
        {
            header: "Periodo de pago (periodoPago_id)",
            cell: (r) => fmtFkReadable(r.periodoPago_id, r.p_periodopago_config, fmtPeriodoPagoCfg),
        },
        {
            header: "Categoría empleado (categoriaEmpleado_id)",
            cell: (r) => fmtFkReadable(r.categoriaEmpleado_id, r.pg_categoria_empleado, fmtCategoriaEmpleado),
        },
        { header: "Salario base diario (salario_base_diario)", cell: (r) => fmtScalarExcel(r.salario_base_diario) },
        {
            header: "Traslado temporal (traslado_temp_id)",
            cell: (r) => fmtFkReadable(r.traslado_temp_id, r.c_traslado_temp, fmtTrasladoTemp),
        },
        {
            header: "Vence subir adjunto (fecha_vence_subir_adjunto)",
            cell: (r) => (r.fecha_vence_subir_adjunto ? fmtDateTime(r.fecha_vence_subir_adjunto) : ""),
        },
        { header: "Usuario actualización (usuario_actualizacion)", cell: (r) => fmtScalarExcel(r.usuario_actualizacion) },
        {
            header: "Vence justificar ausencia (fecha_vence_justificar_ausencia)",
            cell: (r) => (r.fecha_vence_justificar_ausencia ? fmtDateTime(r.fecha_vence_justificar_ausencia) : ""),
        },
        { header: "Estado aprobación (estado_aprobacion)", cell: (r) => fmtScalarExcel(r.estado_aprobacion) },
        {
            header: "Fecha aprobado EC (fecha_aprobado_ec)",
            cell: (r) => (r.fecha_aprobado_ec ? fmtDateTime(r.fecha_aprobado_ec) : ""),
        },
        { header: "Usuario aprueba EC (usuario_aprueba_ec)", cell: (r) => fmtScalarExcel(r.usuario_aprueba_ec) },
        {
            header: "Fecha aprobado JO (fecha_aprobado_jo)",
            cell: (r) => (r.fecha_aprobado_jo ? fmtDateTime(r.fecha_aprobado_jo) : ""),
        },
        { header: "Usuario aprueba JO (usuario_aprueba_jo)", cell: (r) => fmtScalarExcel(r.usuario_aprueba_jo) },
        { header: "Operación (operacion)", cell: (r) => fmtScalarExcel(r.operacion) },
        {
            header: "Vacación mes (vacacionMes_id)",
            cell: (r) => fmtFkReadable(r.vacacionMes_id, r.v_vacacion_mes, fmtVacacionMes),
        },
        {
            header: "Separación temporal (separacion_temp_id)",
            cell: (r) => fmtFkReadable(r.separacion_temp_id, r.c_separacion_temp, fmtSeparacionTemp),
        },
        {
            header: "Cambio de horario (cambio_horario_id)",
            cell: (r) => fmtFkReadable(r.cambio_horario_id, r.c_cambio_horario, fmtCambioHorario),
        },
        {
            header: "Aceptar restricciones reversión (aceptar_restricciones_reversion)",
            cell: (r) => fmtScalarExcel(r.aceptar_restricciones_reversion),
        },
        {
            header: "Acción que genera separación (accionGeneraSeparacion_id)",
            cell: (r) => fmtFkReadable(r.accionGeneraSeparacion_id, r.c_accion_personal, fmtAccionPersonalRef),
        },
        { header: "Ausencia transformada (ausencia_transformada)", cell: (r) => fmtScalarExcel(r.ausencia_transformada) },
        {
            header: "Tipo contratación (tipoContratacion_id)",
            cell: (r) => fmtFkReadable(r.tipoContratacion_id, r.n_tipo_contratacion, fmtTipoContratacion),
        },
        {
            header: "Cambio periodo pago (cambio_periodo_pago_id)",
            cell: (r) => fmtFkReadable(r.cambio_periodo_pago_id, r.c_cambio_periodo_pago, fmtCambioPeriodoPago),
        },
        {
            header: "Coordinador (coordinador_id)",
            cell: (r) => fmtFkReadable(r.coordinador_id, r.n_coordinador, fmtNombreCat),
        },
        {
            header: "Coordinado por (coordinadoPor_id)",
            cell: (r) => fmtFkReadable(r.coordinadoPor_id, r.n_coordinado_por, fmtNombreCat),
        },
        {
            header: "Fecha sobrepuesto (fecha_sobrepuesto)",
            cell: (r) => (r.fecha_sobrepuesto ? fmtDateTime(r.fecha_sobrepuesto) : ""),
        },
        {
            header: "Adenda (adenda_id)",
            cell: (r) => fmtFkReadable(r.adenda_id, r.c_adendas, fmtAdenda),
        },
        {
            header: "Libre cubre vacaciones (libre_cubre_vacasiones_id)",
            cell: (r) => fmtFkReadable(r.libre_cubre_vacasiones_id, r.c_libre_cubre_vacasiones, () => ""),
        },
        { header: "Carga desde móvil (mobile_upload)", cell: (r) => fmtScalarExcel(r.mobile_upload) },
    ];
}

const ACCIONES_COLUMN_DEFS = buildColumnDefs();

function sortLabelForOrder(r: any, orderKey: AccionesPersonalesOrderKey): string {
    switch (orderKey) {
        case "empleado_id":
            return fmtFkReadable(r.empleado_id, r.c_empleado_c_accion_personal_empleado_idToc_empleado, fmtEmp);
        case "empresa_id":
            return fmtFkReadable(r.empresa_id, r.e_estructura_empresa, fmtEmpresa);
        case "cliente_id":
            return fmtFkReadable(r.cliente_id, r.e_estructura_cliente, fmtCliente);
        case "division_id":
            return fmtDivisionFromContrato(r.e_estructura_contrato);
        case "contrato_id":
            return fmtFkReadable(r.contrato_id, r.e_estructura_contrato, fmtContrato);
        case "corpo_id":
            return fmtFkReadable(r.corpo_id, r.e_estructura_sucursal, fmtCorpo);
        case "puesto_id":
            return fmtFkReadable(r.puesto_id, r.e_estructura_puesto, fmtPuesto);
        case "plaza_id":
            return fmtFkReadable(r.plaza_id, r.e_estructura_plazas, fmtPlaza);
        default:
            return "";
    }
}

const accionesInclude = {
    c_empleado_c_accion_personal_empleado_idToc_empleado: {
        select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, codigo: true },
    },
    e_estructura_empresa: { select: { id: true, nombre: true, codigo: true } },
    e_estructura_cliente: { select: { id: true, nombre: true } },
    e_estructura_contrato: {
        select: {
            id: true,
            nombre: true,
            nro_contrato: true,
            division_id: true,
            n_division: { select: { id: true, nombre: true, codigo: true } },
        },
    },
    e_estructura_sucursal: { select: { id: true, nombre: true, nro_sucursal: true } },
    e_estructura_puesto: { select: { id: true, nombre: true, codigo: true } },
    e_estructura_plazas: { select: { id: true, nombre: true, codigo_plaza: true } },
    c_tipo_accion: { select: { id: true, nombre: true, codigo: true } },
    c_horario: { select: { id: true, titulo: true } },
    c_empleado_c_accion_personal_reemplazo_idToc_empleado: {
        select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, codigo: true },
    },
    c_llegada_tardia: {
        select: {
            id: true,
            tipo_turno: true,
            horario_str: true,
            cantidad_horas: true,
            minutos_descuento: true,
        },
    },
    c_salida_anticipada: {
        select: {
            id: true,
            tipo_turno: true,
            horario_str: true,
            cantidad_horas: true,
            motivo: true,
        },
    },
    c_baja: { select: { id: true, preaviso_id: true } },
    c_ajuste_salario: { select: { id: true, salario_inicial: true, salario_final: true, motivo: true } },
    c_vacacion_pago: {
        select: {
            id: true,
            cantidad_dias_pagados: true,
            periodo: true,
            monto_pagar: true,
        },
    },
    c_vacacion_disfrute: {
        select: {
            id: true,
            cantidad_dias_disfrutados: true,
            periodo: true,
            monto_pagar: true,
        },
    },
    c_contratacion: { select: { id: true } },
    c_ausencia: { select: { id: true, tipo: true } },
    c_permiso_sin_goce: { select: { id: true } },
    c_permiso_con_goce: { select: { id: true } },
    c_suspension: { select: { id: true } },
    c_incapacidad_ins: { select: { id: true, tipo: true, numero_poliza: true } },
    c_traslado: {
        select: {
            id: true,
            motivo_traslado: true,
            nombre_oficial_sustituido: true,
            observaciones_motivo_traslado: true,
        },
    },
    c_preaviso: {
        select: { id: true, tipo_preaviso: true, numero_dias: true },
    },
    c_incapacidad_ccss: { select: { id: true, tipo: true, dias_subsidio: true } },
    c_licencia: {
        select: { id: true, promedio_salario: true, monto_subsidio_pagar: true },
    },
    p_periodopago_config: { select: { id: true, nombre: true, tipo: true } },
    pg_categoria_empleado: { select: { id: true, nombre: true, codigo: true } },
    c_traslado_temp: { select: { id: true, fecha_fin: true, plazaInicial_id: true } },
    v_vacacion_mes: {
        select: { id: true, fecha: true, dias_saldo_final: true, motivo_ajuste: true },
    },
    c_separacion_temp: { select: { id: true, tipo: true, motivoAccion: true } },
    c_cambio_horario: {
        select: {
            id: true,
            c_horario_c_cambio_horario_horarioInicial_idToc_horario: { select: { id: true, titulo: true } },
            c_horario_c_cambio_horario_horarioFinal_idToc_horario: { select: { id: true, titulo: true } },
        },
    },
    /** Acción personal referenciada por accionGeneraSeparacion_id */
    c_accion_personal: {
        select: { id: true, consecutivo: true },
    },
    n_tipo_contratacion: { select: { id: true, nombre: true, codigo: true } },
    c_cambio_periodo_pago: {
        select: {
            id: true,
            p_periodopago_config_c_cambio_periodo_pago_periodoPagoInicial_idTop_periodopago_config: {
                select: { id: true, nombre: true },
            },
            p_periodopago_config_c_cambio_periodo_pago_periodoPagoFinal_idTop_periodopago_config: {
                select: { id: true, nombre: true },
            },
        },
    },
    n_coordinador: { select: { id: true, nombre: true } },
    n_coordinado_por: { select: { id: true, nombre: true } },
    c_adendas: {
        select: { id: true, observaciones: true, fecha_fin_contrato: true },
    },
    c_libre_cubre_vacasiones: { select: { id: true } },
} as const;

export async function queryAccionesPersonalesRows(
    prisma: ReportDataAccess,
    filters: AccionesPersonalesModuleFilters,
    orderKey: AccionesPersonalesOrderKey,
) {
    const where: any = {};

    if (filters.empleadoIds?.length) where.empleado_id = { in: filters.empleadoIds };
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.plazaIds?.length) where.plaza_id = { in: filters.plazaIds };
    if (filters.divisionIds?.length) {
        where.contrato = { division_id: { in: filters.divisionIds } };
    }

    const rows = await prisma.c_accion_personal.findMany({
        where,
        take: 50_000,
        orderBy: { id: "desc" },
        include: accionesInclude as any,
    });

    const cmp = (a: string, b: string) => a.localeCompare(b, "es");

    return [...rows].sort((a: any, b: any) => {
        const la = sortLabelForOrder(a, orderKey);
        const lb = sortLabelForOrder(b, orderKey);
        if (la && lb) return cmp(la, lb);
        return Number(b.id) - Number(a.id);
    });
}

export async function buildAccionesPersonalesExcelConsolidado(rows: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Acciones");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const headers = ACCIONES_COLUMN_DEFS.map((c) => c.header);

    const hdrRow = ws.addRow(headers);
    hdrRow.font = { bold: true };
    hdrRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    hdrRow.eachCell((c) => {
        c.fill = hdrFill;
        c.border = borderThin;
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.columns = headers.map(() => ({ width: 22, outlineLevel: 1 }));

    for (const r of rows) {
        const values = ACCIONES_COLUMN_DEFS.map((def) => def.cell(r));
        const row = ws.addRow(values);
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", wrapText: true };
        });
    }

    ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };

    return Buffer.from(await wb.xlsx.writeBuffer());
}
