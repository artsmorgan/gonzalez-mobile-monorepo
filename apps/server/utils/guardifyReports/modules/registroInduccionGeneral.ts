import { queryRegistroInduccionGeneralRows } from "../../reports-functions/registroInduccionGeneralReport";
import { getCheckedTemaIds } from "../../reports-functions/registroInduccionGeneralTemas";
import { ejecutivoPorCorpo, nombresEmpleado, usuarioInserta } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};

/** Texto libre largo: máximo 500 caracteres. */
const clip = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    if (s === null) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/** Nombre de la estructura; si la consulta original no lo encontró devuelve el id como texto (o «0»/vacío): eso no es un nombre. */
const place = (name: unknown, id: unknown): string | null => {
    const s = txt(name);
    if (s === null || s === "0" || s === "undefined" || s === "null") return null;
    if (id != null && s === String(id)) return null;
    return s;
};

function parseArr(raw: unknown): any[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

/** Código de empleado por cédula (solo si la cédula corresponde a un único código; si es ambigua no se muestra). En bloques de 1000. */
export async function codigosPorCedula(db: any, cedulas: unknown[]): Promise<Map<string, string>> {
    const all = [...new Set(cedulas.map((c) => String(c ?? "").trim()).filter(Boolean))];
    const found = new Map<string, Set<string>>();
    for (let i = 0; i < all.length; i += 1000) {
        const rows = await db.c_empleado.findMany({ where: { cedula: { in: all.slice(i, i + 1000) } }, select: { cedula: true, codigo: true } });
        for (const e of rows) {
            const ced = String(e.cedula ?? "").trim();
            const cod = String(e.codigo ?? "").trim();
            if (!ced || !cod) continue;
            if (!found.has(ced)) found.set(ced, new Set());
            found.get(ced)!.add(cod);
        }
    }
    const out = new Map<string, string>();
    for (const [ced, cods] of found) if (cods.size === 1) out.set(ced, [...cods][0]!);
    return out;
}

/**
 * «código - Nombre (cédula); …», recortado (sin código: «Nombre (cédula)»). Nunca incluye la firma de la persona.
 * `codigos` = cédula → código de empleado. `codigosTxt` lista los códigos encontrados, sin repetir.
 */
function personas(raw: unknown, codigos?: Map<string, string>): { n: number; nombres: string | null; codigosTxt: string | null } {
    const arr = parseArr(raw);
    const cods: string[] = [];
    const parts = arr
        .map((p: any) => {
            const nombre = txt(p?.nombre ?? p?.nombre_completo);
            const cedula = txt(p?.cedula);
            const cod = cedula ? codigos?.get(cedula) : undefined;
            if (cod && !cods.includes(cod)) cods.push(cod);
            const base = nombre && cedula ? `${nombre} (${cedula})` : nombre ?? cedula;
            return base && cod ? `${cod} - ${base}` : base;
        })
        .filter((x): x is string => !!x);
    return { n: arr.length, nombres: clip(parts.join("; ")), codigosTxt: clip(cods.join("; ")) };
}

/**
 * Registro de inducción general. Se omiten `firma_responsable` y las firmas de colaboradores y capacitadores.
 * `participantes` junta a colaboradores y capacitadores; `codigos_colaboradores` son los códigos de empleado de los
 * colaboradores (por su cédula). `ejecutivo_cuenta` y `usuario_inserta` los agrega `load` por lote.
 */
export function mapInduccionGeneralRow(r: any, codigos?: Map<string, string>): OutRow {
    const colab = personas(r.colaboradores, codigos);
    const cap = personas(r.capacitadores, codigos);
    const todos = [colab.nombres, cap.nombres].filter(Boolean).join("; ");
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha: fmtDt(r.fecha),
        empresa: place(r.empresa_nombre, r.empresa_id),
        cliente: place(r.cliente_nombre, r.cliente_id),
        division: place(r.division_nombre, r.division_id),
        contrato: place(r.contrato_nombre, r.contrato_id),
        sucursal: place(r.corpo_nombre, r.corpo_id),
        puesto: place(r.puesto_nombre, r.puesto_id),
        responsable: txt(r.empleado_creador_nombre),
        temas_marcados: getCheckedTemaIds(typeof r.temas_a_tratar === "string" ? r.temas_a_tratar : r.temas_a_tratar == null ? null : JSON.stringify(r.temas_a_tratar)).size,
        colaboradores: colab.n,
        nombres_colaboradores: colab.nombres,
        capacitadores: cap.n,
        nombres_capacitadores: cap.nombres,
        participantes: clip(todos),
        codigos_colaboradores: colab.codigosTxt,
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta),
        usuario_inserta: txt(r.usuario_inserta),
    };
}

/**
 * Registro de inducción general (`c_registro_induccion_general`). Cada fila trae su ubicación completa en la estructura.
 * El periodo (`from`/`to`) y la «hora del día» se aplican a la fecha de registro (`creado`, `created_at`), igual que el filtro de
 * fechas de la app; la «Fecha de la inducción» (`fecha`) es otra fecha y no se usa para el periodo.
 */
export const registroInduccionGeneral: GuardifyReportModule = {
    id: "registro_induccion_general",
    supportsScope: true,
    searchKeys: ["responsable", "nombres_colaboradores", "nombres_capacitadores", "contrato", "sucursal", "puesto", "cliente"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "creado", "participantes", "codigos_colaboradores", "nombres_colaboradores", "ejecutivo_cuenta", "usuario_inserta"],
    sortKeys: ["creado", "fecha", "empresa", "cliente", "contrato", "sucursal", "puesto", "responsable", "temas_marcados", "colaboradores", "capacitadores"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryRegistroInduccionGeneralRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        if (!kept.length) return [];
        // Datos para los filtros, en lote (nunca por fila).
        const cedulas = kept.flatMap((r: any) => [...parseArr(r.colaboradores), ...parseArr(r.capacitadores)].map((x: any) => txt(x?.cedula)));
        const [ejecutivos, nombres, codigos] = await Promise.all([
            ejecutivoPorCorpo(db, kept.map((r: any) => r.corpo_id)),
            nombresEmpleado(db, kept.map((r: any) => r.created_by)),
            codigosPorCedula(db, cedulas),
        ]);
        return kept.map((r: any) =>
            mapInduccionGeneralRow({ ...r, ejecutivo_cuenta: ejecutivos.get(Number(r.corpo_id)), usuario_inserta: usuarioInserta(r.created_by, nombres) }, codigos),
        );
    },
};
