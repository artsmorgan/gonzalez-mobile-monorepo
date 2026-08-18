/** Parámetros al abrir Incidentes desde Checklist de supervisión. */
export type ChecklistSupervisionIncidentLinkParams = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  sucursalId: number;
  puestoId: number;
  involucrado: {
    codigo: string;
    nombre: string;
  };
};

export function isChecklistSupervisionIncidentLinkComplete(
  link: Partial<ChecklistSupervisionIncidentLinkParams> | null | undefined,
): link is ChecklistSupervisionIncidentLinkParams {
  if (!link) return false;
  const ids = [
    link.empresaId,
    link.clienteId,
    link.divisionId,
    link.contratoId,
    link.sucursalId,
    link.puestoId,
  ];
  if (!ids.every((id) => Number.isFinite(Number(id)) && Number(id) > 0)) return false;
  const codigo = String(link.involucrado?.codigo ?? '').trim();
  const nombre = String(link.involucrado?.nombre ?? '').trim();
  return Boolean(codigo && nombre);
}
