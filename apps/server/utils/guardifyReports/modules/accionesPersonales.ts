import { batchFindManyByIds } from "../../reportDynamicPrisma";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const clip = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    return s ? s.slice(0, max) : null;
};
/** Fecha sin hora → `YYYY-MM-DDT00:00:00`. */
const fmtDay = (d: unknown): string | null => {
    const s = fmtDt(d as any);
    return s ? `${s.slice(0, 10)}T00:00:00` : null;
};
const withCode = (code: unknown, name: unknown, sep = " - "): string | null => {
    const n = txt(name);
    if (!n) return null;
    const c = txt(code);
    return c ? `${c}${sep}${n}` : n;
};
const join = (parts: unknown[]): string | null => {
    const s = parts.map(txt).filter(Boolean).join(" · ");
    return s ? s : null;
};

/**
 * Resumen corto de lo específico de cada tipo de acción (ausencia, llegada tardía, traslado…).
 * A propósito NO incluye montos ni salarios (ajustes de salario, pagos de vacaciones, subsidios).
 */
export function describeAccion(r: any): string | null {
    const lt = r.c_llegada_tardia;
    const sa = r.c_salida_anticipada;
    const tr = r.c_traslado;
    const pre = r.c_preaviso;
    const cch = r.c_cambio_horario;
    const cpp = r.c_cambio_periodo_pago;
    const vd = r.c_vacacion_disfrute;
    const vp = r.c_vacacion_pago;
    const sep = r.c_separacion_temp;
    return join([
        r.c_ausencia?.tipo,
        lt ? join([lt.tipo_turno, lt.horario_str, lt.cantidad_horas != null ? `${lt.cantidad_horas} h` : null]) : null,
        sa ? join([sa.tipo_turno, sa.horario_str, sa.cantidad_horas != null ? `${sa.cantidad_horas} h`: null, sa.motivo]) : null,
        r.c_baja ? "Baja" : null,
        r.c_incapacidad_ins?.tipo,
        r.c_incapacidad_ccss?.tipo,
        tr ? join([tr.motivo_traslado, tr.nombre_oficial_sustituido, tr.observaciones_motivo_traslado]) : null,
        pre ? join([pre.tipo_preaviso, pre.numero_dias != null ? `${pre.numero_dias} días` : null]) : null,
        vd ? join([vd.periodo, vd.cantidad_dias_disfrutados != null ? `${vd.cantidad_dias_disfrutados} días disfrutados` : null]) : null,
        vp ? join([vp.periodo, vp.cantidad_dias_pagados != null ? `${vp.cantidad_dias_pagados} días pagados` : null]) : null,
        r.c_ajuste_salario?.motivo,
        sep ? join([sep.tipo, sep.motivoAccion]) : null,
        cch
            ? join([
                  cch.c_horario_c_cambio_horario_horarioInicial_idToc_horario?.titulo ? `De: ${cch.c_horario_c_cambio_horario_horarioInicial_idToc_horario.titulo}` : null,
                  cch.c_horario_c_cambio_horario_horarioFinal_idToc_horario?.titulo ? `A: ${cch.c_horario_c_cambio_horario_horarioFinal_idToc_horario.titulo}` : null,
              ])
            : null,
        cpp
            ? join([
                  cpp.p_periodopago_config_c_cambio_periodo_pago_periodoPagoInicial_idTop_periodopago_config?.nombre ? `De: ${cpp.p_periodopago_config_c_cambio_periodo_pago_periodoPagoInicial_idTop_periodopago_config.nombre}` : null,
                  cpp.p_periodopago_config_c_cambio_periodo_pago_periodoPagoFinal_idTop_periodopago_config?.nombre ? `A: ${cpp.p_periodopago_config_c_cambio_periodo_pago_periodoPagoFinal_idTop_periodopago_config.nombre}` : null,
              ])
            : null,
        r.c_adendas?.observaciones,
        r.cantidad_horas != null && !lt && !sa ? `${r.cantidad_horas} h` : null,
    ])?.slice(0, 500) ?? null;
}

/** Acción de personal (`c_accion_personal`). `cedulas` = cédula por id de empleado (la consulta original no la trae). */
export function mapAccionPersonalRow(r: any, cedulas: Map<number, string | null> = new Map()): OutRow {
    const emp = r.c_empleado_c_accion_personal_empleado_idToc_empleado ?? null;
    const rep = r.c_empleado_c_accion_personal_reemplazo_idToc_empleado ?? null;
    const contrato = r.e_estructura_contrato ?? null;
    const div = contrato?.n_division ?? null;
    return {
        id: Number(r.id),
        fecha_inicio: fmtDay(r.fecha_inicio),
        fecha_fin: fmtDay(r.fecha_fin),
        consecutivo: txt(r.consecutivo),
        tipo_accion: withCode(r.c_tipo_accion?.codigo, r.c_tipo_accion?.nombre, " — "),
        estado: txt(r.estado_aprobacion),
        empleado: emp ? txt(buildNombre(emp)) : null,
        cedula: txt(cedulas.get(Number(r.empleado_id))),
        reemplazo: rep ? txt(buildNombre(rep)) : null,
        empresa: withCode(r.e_estructura_empresa?.codigo, r.e_estructura_empresa?.nombre),
        cliente: txt(r.e_estructura_cliente?.nombre),
        division: withCode(div?.codigo, div?.nombre),
        contrato: withCode(contrato?.nro_contrato, contrato?.nombre),
        sucursal: withCode(r.e_estructura_sucursal?.nro_sucursal, r.e_estructura_sucursal?.nombre),
        puesto: withCode(r.e_estructura_puesto?.codigo, r.e_estructura_puesto?.nombre),
        plaza: withCode(r.e_estructura_plazas?.codigo_plaza, r.e_estructura_plazas?.nombre),
        horario: txt(r.c_horario?.titulo),
        detalle: describeAccion(r),
        comentarios: clip(r.comentarios),
        reversible: r.reversible == null ? null : r.reversible ? "Sí" : "No",
        adjunto: txt(r.document) ? "Sí" : "No",
        registrada: fmtDt(r.fecha_insercion),
        // Nunca se exponen: salarios y montos, usuarios de inserción/aprobación/reversión, ni la ruta del documento adjunto.
    };
}

const COLS = {
    id: true, empleado_id: true, reemplazo_id: true, tipoAccion_id: true, empresa_id: true, cliente_id: true, contrato_id: true, corpo_id: true, puesto_id: true, plaza_id: true, horario_id: true,
    consecutivo: true, fecha_inicio: true, fecha_fin: true, fecha_insercion: true, comentarios: true, document: true, reversible: true, estado_aprobacion: true, cantidad_horas: true,
} as const;
const NOMBRE = { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true } as const;

/**
 * Acciones de personal (`c_accion_personal`, tabla preexistente). Se consulta la tabla sola (el periodo se aplica por `fecha_inicio`)
 * y los nombres de empleado, tipo y estructura se cargan en lote: así no depende de las relaciones del cliente Prisma, que la app
 * regenera a partir de la base en cada arranque. Cada fila trae empresa/cliente/contrato/sucursal/puesto y la división sale del
 * contrato, así que admite alcance. El detalle por tipo de acción (ausencia, traslado…) no se incluye: queda solo lo de la propia fila.
 */
export const accionesPersonales: GuardifyReportModule = {
    id: "acciones_personales",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "consecutivo", "tipo_accion", "puesto", "sucursal"],
    filterKeys: ["tipo_accion", "estado", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "reversible"],
    sortKeys: ["fecha_inicio", "fecha_fin", "consecutivo", "tipo_accion", "estado", "empleado", "cedula", "empresa", "cliente", "contrato", "sucursal", "puesto", "registrada"],
    defaultSort: "fecha_inicio",
    async load(db, p) {
        const rows: any[] = await db.c_accion_personal!.findMany({
            where: { fecha_inicio: { gte: new Date(`${p.from}T00:00:00.000Z`), lt: new Date(`${p.to}T00:00:00.000Z`) } },
            select: COLS,
            orderBy: { id: "desc" },
            take: 50_000,
        });
        const ids = (k: string) => rows.map((r) => Number(r[k]));
        const load = (table: string, key: string[], select: Record<string, boolean>, extra: number[] = []) => batchFindManyByIds<any>(db, table, [...key.flatMap(ids), ...extra], select);
        const empleados = await load("c_empleado", ["empleado_id", "reemplazo_id"], NOMBRE);
        const [tipos, empresas, clientes, contratos, corpos, puestos, plazas, horarios] = await Promise.all([
            load("c_tipo_accion", ["tipoAccion_id"], { id: true, codigo: true, nombre: true }),
            load("e_estructura_empresa", ["empresa_id"], { id: true, codigo: true, nombre: true }),
            load("e_estructura_cliente", ["cliente_id"], { id: true, nombre: true }),
            load("e_estructura_contrato", ["contrato_id"], { id: true, nro_contrato: true, nombre: true, division_id: true }),
            load("e_estructura_sucursal", ["corpo_id"], { id: true, nro_sucursal: true, nombre: true }),
            load("e_estructura_puesto", ["puesto_id"], { id: true, codigo: true, nombre: true }),
            load("e_estructura_plazas", ["plaza_id"], { id: true, codigo_plaza: true, nombre: true }),
            load("c_horario", ["horario_id"], { id: true, titulo: true }),
        ]);
        const divisiones = await batchFindManyByIds<any>(db, "n_division", [...contratos.values()].map((c) => Number(c.division_id)), { id: true, codigo: true, nombre: true });
        const scope = p.scope;
        const cedulas = new Map<number, string | null>([...empleados].map(([id, e]) => [id, e.cedula ?? null]));
        const out: OutRow[] = [];
        for (const r of rows) {
            const contrato = contratos.get(Number(r.contrato_id)) ?? null;
            if (scope && !matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: contrato?.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope)) continue;
            out.push(mapAccionPersonalRow({
                ...r,
                c_empleado_c_accion_personal_empleado_idToc_empleado: empleados.get(Number(r.empleado_id)) ?? null,
                c_empleado_c_accion_personal_reemplazo_idToc_empleado: empleados.get(Number(r.reemplazo_id)) ?? null,
                c_tipo_accion: tipos.get(Number(r.tipoAccion_id)) ?? null,
                e_estructura_empresa: empresas.get(Number(r.empresa_id)) ?? null,
                e_estructura_cliente: clientes.get(Number(r.cliente_id)) ?? null,
                e_estructura_contrato: contrato ? { ...contrato, n_division: divisiones.get(Number(contrato.division_id)) ?? null } : null,
                e_estructura_sucursal: corpos.get(Number(r.corpo_id)) ?? null,
                e_estructura_puesto: puestos.get(Number(r.puesto_id)) ?? null,
                e_estructura_plazas: plazas.get(Number(r.plaza_id)) ?? null,
                c_horario: horarios.get(Number(r.horario_id)) ?? null,
            }, cedulas));
        }
        return out;
    },
};
