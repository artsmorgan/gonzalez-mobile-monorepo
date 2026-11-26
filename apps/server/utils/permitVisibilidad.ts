/**
 * Qué solicitudes de permiso devuelve el listado. Módulo puro (sin base de datos) para probarlo.
 *
 * El listado trae SIEMPRE las solicitudes propias de la persona y, además, las que ella debe aprobar o rechazar: aquellas cuyo ejecutivo de cuenta
 * (`ejecutivo_cuenta`) es el que corresponde a su `supervisor_id`. Es el mismo criterio de Mutuos acuerdos y el de `is_executive_for_record` /
 * `can_complete_by_executive` que decide si se ven los botones de aprobar y rechazar. Lo decide el DATO, no el puesto en el que la persona esté
 * trabajando ese día ni si tiene una marca vigente. Una persona que no es ejecutivo de ninguna solicitud ve solo las suyas.
 */
export type PermitVisibilityInput = { currentEmployeeId: number; mySupervisorId: number | null };

export function permitVisibilityWhere({ currentEmployeeId, mySupervisorId }: PermitVisibilityInput): Record<string, unknown> {
    const own = { empleado_id: currentEmployeeId };
    if (!mySupervisorId || mySupervisorId <= 0) return own;
    return { OR: [own, { ejecutivo_cuenta: mySupervisorId }] };
}
