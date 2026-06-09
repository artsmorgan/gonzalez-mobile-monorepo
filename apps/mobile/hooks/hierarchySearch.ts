import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';

export type HierarchySearchLevel = 'cliente' | 'contrato' | 'sucursal' | 'puesto' | 'plaza';

export type HierarchySelectionPath = {
  empresaId: number;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  sucursalId: number | null;
  puestoId: number | null;
  plazaId: number | null;
};

export type HierarchySearchHit = {
  id: number;
  title: string;
  subtitle: string;
  path: HierarchySelectionPath;
};

function getDivisionArray(cliente: any): any[] {
  if (Array.isArray(cliente?.division)) return cliente.division;
  if (Array.isArray(cliente?.divisiones)) return cliente.divisiones;
  return [];
}

function normalizeQuery(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function textMatchesQuery(values: (string | null | undefined)[], query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return false;
  return values.some((v) => normalizeQuery(String(v ?? '')).includes(q));
}

function textMatchesNombreOnly(nombre: string | null | undefined, query: string): boolean {
  return textMatchesQuery([nombre], query);
}

function joinPath(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => String(p ?? '').trim().length > 0).join(' › ');
}

function basePath(
  empresa: any,
  cliente: any,
  division: any,
  contrato?: any,
  sucursal?: any,
  puesto?: any,
  plaza?: any,
): HierarchySelectionPath {
  return {
    empresaId: Number(empresa?.id),
    clienteId: cliente != null ? Number(cliente.id) : null,
    divisionId: division != null ? Number(division.id) : null,
    contratoId: contrato != null ? Number(contrato.id) : null,
    sucursalId: sucursal != null ? Number(sucursal.id) : null,
    puestoId: puesto != null ? Number(puesto.id) : null,
    plazaId: plaza != null ? Number(plaza.id) : null,
  };
}

/** Busca en el árbol jerárquico (mismo origen que JerarquiaModule / main-structure). */
export function searchHierarchyInTree(
  tree: any[],
  level: HierarchySearchLevel,
  query: string,
): HierarchySearchHit[] {
  if (!Array.isArray(tree) || tree.length === 0) return [];
  const q = String(query ?? '').trim();
  if (!q) return [];

  const hits: HierarchySearchHit[] = [];

  for (const empresa of tree) {
    const empLabel = String(empresa?.nombre ?? '');
    for (const cliente of empresa?.clientes || []) {
      const cliLabel = String(cliente?.nombre ?? '');

      if (level === 'cliente') {
        if (textMatchesNombreOnly(cliLabel, q)) {
          hits.push({
            id: Number(cliente.id),
            title: cliLabel,
            subtitle: joinPath([empLabel]),
            path: basePath(empresa, cliente, null),
          });
        }
        continue;
      }

      const divisions = getDivisionArray(cliente);
      for (const division of divisions) {
        const divLabel = String(division?.nombre ?? '');
        for (const contrato of division?.contratos || []) {
          const ctLabel = String(contrato?.nombre ?? '');
          const ctCode = String(contrato?.nro_contrato ?? '');

          if (level === 'contrato') {
            if (textMatchesQuery([ctLabel, ctCode], q)) {
              hits.push({
                id: Number(contrato.id),
                title: ctCode ? `${ctCode} — ${ctLabel}` : ctLabel,
                subtitle: joinPath([empLabel, cliLabel, divLabel]),
                path: basePath(empresa, cliente, division, contrato),
              });
            }
            continue;
          }

          for (const sucursal of contrato?.sucursales || []) {
            const sucLabel = String(sucursal?.nombre ?? '');
            const sucCode = String(sucursal?.nro_sucursal ?? '');

            if (level === 'sucursal') {
              if (textMatchesQuery([sucLabel, sucCode], q)) {
                hits.push({
                  id: Number(sucursal.id),
                  title: sucCode ? `${sucCode} — ${sucLabel}` : sucLabel,
                  subtitle: joinPath([empLabel, cliLabel, divLabel, ctLabel]),
                  path: basePath(empresa, cliente, division, contrato, sucursal),
                });
              }
              continue;
            }

            for (const puesto of sucursal?.puestos || []) {
              const puestoLabel = String(puesto?.nombre ?? '');
              const puestoCode = String(puesto?.codigo ?? '');

              if (level === 'puesto') {
                if (textMatchesQuery([puestoLabel, puestoCode], q)) {
                  hits.push({
                    id: Number(puesto.id),
                    title: puestoCode ? `${puestoCode} — ${puestoLabel}` : puestoLabel,
                    subtitle: joinPath([empLabel, cliLabel, divLabel, ctLabel, sucLabel]),
                    path: basePath(empresa, cliente, division, contrato, sucursal, puesto),
                  });
                }
                continue;
              }

              for (const plaza of puesto?.plazas || []) {
                const plazaLabel = String(plaza?.nombre ?? '');
                const plazaCode = String(plaza?.codigo_plaza ?? '');
                if (textMatchesQuery([plazaLabel, plazaCode], q)) {
                  hits.push({
                    id: Number(plaza.id),
                    title: plazaCode ? `${plazaCode} — ${plazaLabel}` : plazaLabel,
                    subtitle: joinPath([empLabel, cliLabel, divLabel, ctLabel, sucLabel, puestoLabel]),
                    path: basePath(empresa, cliente, division, contrato, sucursal, puesto, plaza),
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return hits.sort((a, b) => a.title.localeCompare(b.title, 'es'));
}

/** Carga el árbol desde caché y ejecuta la búsqueda (permite mostrar spinner en UI). */
export async function searchHierarchy(
  level: HierarchySearchLevel,
  query: string,
  treeHint?: any[],
): Promise<{ hits: HierarchySearchHit[]; tree: any[] }> {
  const tree =
    Array.isArray(treeHint) && treeHint.length > 0
      ? treeHint
      : ((await loadMainStructureTreeMerged()) as any[]);

  await new Promise((resolve) => setTimeout(resolve, 120));

  const hits = searchHierarchyInTree(Array.isArray(tree) ? tree : [], level, query);
  return { hits, tree: Array.isArray(tree) ? tree : [] };
}

export const HIERARCHY_SEARCH_LEVEL_LABELS: Record<HierarchySearchLevel, string> = {
  cliente: 'Buscar cliente',
  contrato: 'Buscar contrato',
  sucursal: 'Buscar sucursal',
  puesto: 'Buscar puesto',
  plaza: 'Buscar plaza',
};

export function resolveHierarchyPathByPlazaId(tree: any[], plazaId: number): HierarchySelectionPath | null {
  if (!Array.isArray(tree) || !Number.isFinite(plazaId)) return null;
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionArray(cliente)) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              for (const plaza of puesto?.plazas || []) {
                if (Number(plaza?.id) === Number(plazaId)) {
                  return basePath(empresa, cliente, division, contrato, sucursal, puesto, plaza);
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

export function resolveHierarchyPathByPuestoId(tree: any[], puestoId: number): HierarchySelectionPath | null {
  if (!Array.isArray(tree) || !Number.isFinite(puestoId)) return null;
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionArray(cliente)) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              if (Number(puesto?.id) === Number(puestoId)) {
                return basePath(empresa, cliente, division, contrato, sucursal, puesto);
              }
            }
          }
        }
      }
    }
  }
  return null;
}
