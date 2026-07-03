import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
  type HierarchySelectionPath,
  resolveHierarchyPathByPlazaId,
} from '@/hooks/hierarchySearch';

export type EmployeeSearchHit = {
  empleadoId: number;
  title: string;
  subtitle: string;
  path: HierarchySelectionPath;
  cedula: string;
  fechaContratacion: string;
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

function formatStructureEmpleadoNombre(emp: any): string {
  const parts = [emp?.nombre, emp?.primer_apellido, emp?.segundo_apellido].filter(Boolean);
  return parts.join(' ').trim() || `Empleado #${emp?.id ?? ''}`;
}

function empleadoMatchesQuery(emp: any, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return false;
  const values = [
    emp?.nombre,
    emp?.primer_apellido,
    emp?.segundo_apellido,
    emp?.cedula,
    emp?.codigo,
    emp?.codigo_empleado,
  ];
  return values.some((v) => normalizeQuery(String(v ?? '')).includes(q));
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

export function findHierarchyPathByEmpleadoId(tree: any[], empleadoId: number): HierarchySelectionPath | null {
  if (!Array.isArray(tree) || !Number.isFinite(empleadoId)) return null;
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionArray(cliente)) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              for (const plaza of puesto?.plazas || []) {
                const empleados = Array.isArray(plaza?.empleados) ? plaza.empleados : [];
                const emp = empleados.find((e: any) => Number(e?.id) === Number(empleadoId));
                if (emp) {
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

export function searchEmployeesInStructure(tree: any[], query: string): EmployeeSearchHit[] {
  if (!Array.isArray(tree) || tree.length === 0) return [];
  const q = String(query ?? '').trim();
  if (!q) return [];

  const hits: EmployeeSearchHit[] = [];

  for (const empresa of tree) {
    const empLabel = String(empresa?.nombre ?? '');
    for (const cliente of empresa?.clientes || []) {
      const cliLabel = String(cliente?.nombre ?? '');
      for (const division of getDivisionArray(cliente)) {
        const divLabel = String(division?.nombre ?? '');
        for (const contrato of division?.contratos || []) {
          const ctLabel = String(contrato?.nombre ?? '');
          for (const sucursal of contrato?.sucursales || []) {
            const sucLabel = String(sucursal?.nombre ?? '');
            for (const puesto of sucursal?.puestos || []) {
              const puestoLabel = String(puesto?.nombre ?? '');
              for (const plaza of puesto?.plazas || []) {
                const plazaLabel = String(plaza?.nombre ?? '');
                const empleados = Array.isArray(plaza?.empleados) ? plaza.empleados : [];
                for (const emp of empleados) {
                  if (!empleadoMatchesQuery(emp, q)) continue;
                  const title = formatStructureEmpleadoNombre(emp);
                  const cedula = String(emp?.cedula ?? '').trim();
                  const codigo = String(emp?.codigo ?? emp?.codigo_empleado ?? '').trim();
                  hits.push({
                    empleadoId: Number(emp.id),
                    title: codigo ? `${title} (${codigo})` : title,
                    subtitle: joinPath([
                      empLabel,
                      cliLabel,
                      divLabel,
                      ctLabel,
                      sucLabel,
                      puestoLabel,
                      plazaLabel,
                      cedula ? `Cédula: ${cedula}` : '',
                    ]),
                    path: basePath(empresa, cliente, division, contrato, sucursal, puesto, plaza),
                    cedula,
                    fechaContratacion: String(emp?.fecha_contratacion ?? '').split('T')[0],
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

/** Busca empleados en la jerarquía local (AsyncStorage / main-structure), igual que JerarquiaModule. */
export async function searchEmployeesForEvaluation(
  query: string,
  treeHint?: any[],
): Promise<EmployeeSearchHit[]> {
  const q = String(query ?? '').trim();
  if (!q) return [];

  const tree =
    Array.isArray(treeHint) && treeHint.length > 0
      ? treeHint
      : ((await loadMainStructureTreeMerged()) as any[]);

  await new Promise((resolve) => setTimeout(resolve, 120));

  return searchEmployeesInStructure(Array.isArray(tree) ? tree : [], q);
}

export function resolvePlazaPathForEmpleado(tree: any[], empleadoId: number): HierarchySelectionPath | null {
  return findHierarchyPathByEmpleadoId(tree, empleadoId) ?? null;
}

export { resolveHierarchyPathByPlazaId };
