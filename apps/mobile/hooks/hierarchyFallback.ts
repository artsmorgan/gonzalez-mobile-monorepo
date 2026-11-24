/**
 * Jerarquía sin descargar: respaldo con los datos de la marca actual. Módulo PURO (sin React Native) para probarlo en Node.
 *
 * Los selectores de jerarquía (empresa → cliente → división → contrato → sucursal → puesto → plaza) se llenan con la estructura que la persona
 * descarga en el módulo «Jerarquía». Si todavía no la descargó no hay nada que elegir. En ese caso —y solo en ese caso— los formularios toman los
 * datos de la MARCA ACTUAL (empresa, cliente, contrato, sucursal, puesto y plaza del turno) para completar lo que se envía a los endpoints, y la
 * pantalla avisa que lo hizo. Con la jerarquía descargada nada de esto se usa.
 */
export type HierarchyIds = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  sucursalId: number | null;
  puestoId: number | null;
  plazaId: number | null;
};

type Nodo = { id?: unknown; nombre?: unknown; codigo?: unknown } | null | undefined;

/** `id` válido (> 0) o null. Un 0 es el «Indefinido» que el servidor pone cuando falta el dato. */
function idOf(node: unknown): number | null {
  const raw = node && typeof node === 'object' ? (node as { id?: unknown }).id : node;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function text(v: unknown): string {
  return String(v ?? '').trim();
}

/** Los datos de jerarquía de la marca actual (`current_marca`), o null si no hay marca o no trae un puesto ni una sucursal. */
export function hierarchyIdsFromMarca(marca: unknown): HierarchyIds | null {
  if (!marca || typeof marca !== 'object') return null;
  const m = marca as Record<string, unknown>;
  const roleDivision = (m.roleDivision ?? m.role_division) as { division?: unknown } | null | undefined;
  const ids: HierarchyIds = {
    empresaId: idOf(m.empresa),
    clienteId: idOf(m.cliente),
    divisionId: idOf(roleDivision?.division),
    contratoId: idOf(m.contrato),
    // En la marca la sucursal viaja como `corpo`.
    sucursalId: idOf(m.corpo ?? m.sucursal),
    puestoId: idOf(m.puesto),
    plazaId: idOf(m.plaza),
  };
  if (ids.puestoId == null && ids.sucursalId == null) return null;
  return ids;
}

/** ¿No hay ningún nivel elegido? (`null`, `undefined`, `0` y `''` cuentan como vacío.) Con algo elegido —por ejemplo al editar un registro— no se pisa. */
export function hierarchyIdsAreEmpty(values: Partial<Record<keyof HierarchyIds, unknown>> | null | undefined): boolean {
  if (!values) return true;
  return Object.values(values).every((v) => v == null || v === '' || v === 0);
}

/** Texto para el aviso: «Puesto X · Sucursal Y» (lo que se usará). */
export function marcaHierarchySummary(marca: unknown): string {
  if (!marca || typeof marca !== 'object') return '';
  const m = marca as Record<string, Nodo>;
  const partes: string[] = [];
  const puesto = text(m.puesto?.nombre);
  const sucursal = text(m.corpo?.nombre ?? m.sucursal?.nombre);
  if (puesto && puesto.toLowerCase() !== 'indefinido') partes.push(`Puesto ${puesto}`);
  if (sucursal) partes.push(`Sucursal ${sucursal}`);
  return partes.join(' · ');
}

/** ¿Hay jerarquía descargada? (La estructura es una lista de empresas.) */
export function hasHierarchy(structure: unknown): boolean {
  return Array.isArray(structure) && structure.length > 0;
}

export const HIERARCHY_MISSING_TITLE = 'Jerarquía sin descargar';
export const HIERARCHY_MISSING_TEXT = 'Todavía no has descargado la jerarquía, por eso no se pueden elegir sus niveles.';
export const HIERARCHY_GO_TITLE = 'Descargar jerarquía';
export const HIERARCHY_GO_QUESTION = '¿Quieres ir al módulo Jerarquía para descargarla?';
export const HIERARCHY_FALLBACK_NOTICE = 'Mientras tanto se usan los datos de tu marca actual para completar lo que se envía';
