import { EJECUTIVO_COORDINADOR_SLUG, EJECUTIVO_COORDINADOR_TABLE } from "./nomenclatorsEjecutivoCoordinador";
import { EMPLEADO_EJECUTIVO_SLUG, EMPLEADO_TABLE } from "./nomenclatorsEmpleadoEjecutivo";
import { MOBILE_VARIABLES_SLUG, MOBILE_VARIABLES_TABLE } from "./nomenclatorsMobileVariables";
import {
    TIPO_MANTENIMIENTO_ARTICULO_SLUG,
    TIPO_MANTENIMIENTO_ARTICULO_TABLE,
} from "./nomenclatorsTipoMantenimientoArticulo";

export type NomenclatorKind =
    | "nombre"
    | "ejecutivo-coordinador"
    | "empleado-ejecutivo"
    | "mobile-variable"
    | "tipo-mantenimiento-articulo";

export const NOMENCLATOR_SLUG_TO_TABLE: Record<string, string> = {
    "categorias-mantenimiento": "c_categoria_mantenimiento",
    "tipos-producto-no-conforme": "c_tipos_producto_no_conforme",
    "tipo-documento": "e_tipo_documento",
    "clasificacion-incidentes": "n_clasificacion_incidente",
    "categorias-novedades": "n_novedades_categoria",
    "tipo-activo-visitas": "n_tipo_activo_visitas",
    "tipo-quejas-clientes": "n_tipo_cliente_quejas",
    "tipo-quejas": "n_tipo_quejas",
    [EJECUTIVO_COORDINADOR_SLUG]: EJECUTIVO_COORDINADOR_TABLE,
    [EMPLEADO_EJECUTIVO_SLUG]: EMPLEADO_TABLE,
    [MOBILE_VARIABLES_SLUG]: MOBILE_VARIABLES_TABLE,
    [TIPO_MANTENIMIENTO_ARTICULO_SLUG]: TIPO_MANTENIMIENTO_ARTICULO_TABLE,
};

const NOMENCLATOR_KINDS: Record<string, NomenclatorKind> = {
    [EJECUTIVO_COORDINADOR_SLUG]: "ejecutivo-coordinador",
    [EMPLEADO_EJECUTIVO_SLUG]: "empleado-ejecutivo",
    [MOBILE_VARIABLES_SLUG]: "mobile-variable",
    [TIPO_MANTENIMIENTO_ARTICULO_SLUG]: "tipo-mantenimiento-articulo",
};

export function resolveNomenclatorTable(tipo: string): string | null {
    const normalized = String(tipo ?? "").trim().toLowerCase();
    return NOMENCLATOR_SLUG_TO_TABLE[normalized] ?? null;
}

export function resolveNomenclatorKind(tipo: string): NomenclatorKind {
    const normalized = String(tipo ?? "").trim().toLowerCase();
    return NOMENCLATOR_KINDS[normalized] ?? "nombre";
}

export function mapNomenclatorRow(row: unknown): { id: number; nombre: string } | null {
    if (!row || typeof row !== "object") return null;
    const r = row as { id?: unknown; nombre?: unknown };
    const id = Number(r.id);
    const nombre = String(r.nombre ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !nombre) return null;
    return { id, nombre };
}

const FK_ERROR_PATTERNS = [
    "foreign key constraint",
    "foreign key constraint fails",
    "foreign key constraint violated",
    "cannot delete or update a parent row",
    "p2003",
    "llave foránea",
    "violates foreign key",
];

export function isForeignKeyConstraintError(error: unknown): boolean {
    const parts: string[] = [];
    if (error instanceof Error) {
        parts.push(error.message);
        const code = (error as { code?: unknown }).code;
        if (code != null) parts.push(String(code));
    } else if (error != null) {
        parts.push(String(error));
    }

    const haystack = parts.join(" ").toLowerCase();
    return FK_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export const NOMENCLATOR_DELETE_BLOCKED_MESSAGE =
    "No se puede eliminar este registro porque está siendo utilizado en otros datos del sistema.";
