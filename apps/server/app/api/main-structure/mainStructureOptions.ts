export type MainStructureScope = {
    empresaId?: number | null;
    clienteId?: number | null;
    divisionId?: number | null;
    contratoId?: number | null;
    sucursalId?: number | null;
    puestoId?: number | null;
};

export type MainStructureModules = {
    /** Tablas preexistentes: jerarquía, plazas, empleados, artículos base. */
    estructura: boolean;
    /** Tablas creadas: vehículos corporativos y bitácora. */
    vehiculos: boolean;
    /** Tablas creadas: llaves y llaveros. */
    llaves: boolean;
    /** Tablas creadas: tipos/mantenimientos/movimientos de artículos. */
    mantenimientos: boolean;
};

export type MainStructureBuildRequest = {
    scope: MainStructureScope;
    modules: MainStructureModules;
};

export const DEFAULT_MAIN_STRUCTURE_MODULES: MainStructureModules = {
    estructura: true,
    vehiculos: true,
    llaves: true,
    mantenimientos: true,
};

function parseOptionalId(value: unknown): number | null {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function parseScope(raw: unknown): MainStructureScope {
    const o = raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    return {
        empresaId: parseOptionalId(o.empresaId),
        clienteId: parseOptionalId(o.clienteId),
        divisionId: parseOptionalId(o.divisionId),
        contratoId: parseOptionalId(o.contratoId),
        sucursalId: parseOptionalId(o.sucursalId),
        puestoId: parseOptionalId(o.puestoId),
    };
}

function parseModules(raw: unknown): MainStructureModules {
    const o = raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const modules: MainStructureModules = {
        estructura: o.estructura !== false,
        vehiculos: o.vehiculos !== false,
        llaves: o.llaves !== false,
        mantenimientos: o.mantenimientos !== false,
    };
    const anyExplicit = ["estructura", "vehiculos", "llaves", "mantenimientos"].some((k) => k in o);
    if (!anyExplicit) return { ...DEFAULT_MAIN_STRUCTURE_MODULES };
    return modules;
}

export function parseMainStructureBuildRequest(body: unknown): MainStructureBuildRequest {
    const o = body != null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const modules = parseModules(o.modules);
    const anyModule =
        modules.estructura || modules.vehiculos || modules.llaves || modules.mantenimientos;
    return {
        scope: parseScope(o.scope),
        modules: anyModule ? modules : { ...DEFAULT_MAIN_STRUCTURE_MODULES },
    };
}
