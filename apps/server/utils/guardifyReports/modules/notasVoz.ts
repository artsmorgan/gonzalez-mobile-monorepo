import { queryNotasVozRows } from "../../reports-functions/notasVozReport";
import { ejecutivoPorCorpo } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { notasVozForm } from "./notasVozForm";

const MAX_TEXT = 500;

/** ¿Parece una imagen incrustada (data URI o base64 largo)? */
function esImagen(s: string): boolean {
    if (/^data:[a-z]+\/[^;,]+[;,]/i.test(s) || /^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR|PHN2Zy)/.test(s)) return true;
    const head = s.slice(0, 200);
    return s.length > 1000 && /^[A-Za-z0-9+/=_-]+$/.test(head) && /[A-Z]/.test(head) && /[a-z]/.test(head) && /\d/.test(head);
}

/** Texto libre recortado a 500 caracteres; descarta lo que parezca una imagen/base64. */
function text(v: unknown, max = MAX_TEXT): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (esImagen(s)) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Nombre de un nodo de la estructura; la consulta devuelve el id como texto cuando no lo encuentra y «—» si no hay. */
function nodo(nombre: unknown, id: unknown): string | null {
    if (!(Number(id) > 0)) return null;
    const s = String(nombre ?? "").trim();
    return s && s !== "—" ? s : null;
}

/**
 * Fila de `queryNotasVozRows` → fila plana. Se omiten a propósito `path`/`audio_relpath` (ruta del archivo de audio) y
 * `firma_responsable` (imagen de firma); solo se indica si la nota tiene audio.
 * `ejecutivo`: ejecutivo de cuenta de la sucursal (se carga por lote en `load`).
 */
export function mapNotaVozRow(r: any, ejecutivo?: string | null): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        empresa: nodo(r.empresa_nombre, r.empresa_id),
        cliente: nodo(r.cliente_nombre, r.cliente_id),
        division: nodo(r.division_nombre, r.division_id),
        contrato: nodo(r.contrato_nombre, r.contrato_id),
        sucursal: nodo(r.corpo_nombre, r.corpo_id),
        puesto: nodo(r.puesto_nombre, r.puesto_id),
        titulo: text(r.titulo),
        descripcion: text(r.descripcion),
        transcripcion: text(r.transcripcion),
        con_audio: String(r.path ?? "").trim() ? "Sí" : "No",
        creado_por: text(r.creador_nombre, 200),
        ejecutivo_cuenta: text(ejecutivo, 200),
    };
}

/**
 * Notas de voz (`c_notas_voz`). Cada fila trae sus ids de empresa/cliente/división/contrato/corpo/puesto. El periodo (`from`/`to`) se
 * aplica a `creado` (`created_at`, la fecha en que se registró la nota: «Fecha inicio/fin» del Excel «Notas de voz»).
 */
export const notasVoz: GuardifyReportModule = {
    id: "notas_voz",
    supportsScope: true,
    searchKeys: ["titulo", "descripcion", "transcripcion", "creado_por", "puesto", "sucursal"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "con_audio", "ejecutivo_cuenta"],
    sortKeys: ["creado", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "titulo", "creado_por", "ejecutivo_cuenta"],
    defaultSort: "creado",
    form: notasVozForm,
    async load(db, p) {
        const rows = await queryNotasVozRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const visibles = rows
            .filter((r: any) => {
                const d = fmtDt(r.created_at)?.slice(0, 10);
                return !!d && d >= p.from && d < p.to;
            })
            .filter(
                (r: any) =>
                    !scope ||
                    matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope),
            );
        const ejecutivos = await ejecutivoPorCorpo(db as any, visibles.map((r: any) => r.corpo_id));
        return visibles.map((r: any) => mapNotaVozRow(r, ejecutivos.get(Number(r.corpo_id)) ?? null));
    },
};
