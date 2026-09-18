import fs from "fs/promises";
import path from "path";

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
    mergeWithExisting: boolean;
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
        mergeWithExisting: o.mergeWithExisting !== false,
    };
}

export function scopeHasFilter(scope: MainStructureScope): boolean {
    return (
        scope.puestoId != null ||
        scope.sucursalId != null ||
        scope.contratoId != null ||
        scope.divisionId != null ||
        scope.clienteId != null ||
        scope.empresaId != null
    );
}

type HierarchyContext = {
    empresaId: number;
    clienteId: number;
    divisionId: number;
    contratoId: number;
    sucursalId: number;
    puestoId?: number;
};

/** Determina si un nodo de la jerarquía cae dentro del alcance seleccionado. */
export function matchesMainStructureScope(ctx: HierarchyContext, scope: MainStructureScope): boolean {
    if (scope.puestoId != null) {
        return ctx.puestoId === scope.puestoId;
    }
    if (scope.sucursalId != null) {
        if (ctx.puestoId != null) {
            return ctx.sucursalId === scope.sucursalId;
        }
        return ctx.sucursalId === scope.sucursalId;
    }
    if (scope.contratoId != null) {
        if (ctx.sucursalId != null || ctx.puestoId != null) {
            return ctx.contratoId === scope.contratoId;
        }
        return ctx.contratoId === scope.contratoId;
    }
    if (scope.divisionId != null) {
        return ctx.divisionId === scope.divisionId;
    }
    if (scope.clienteId != null) {
        return ctx.clienteId === scope.clienteId;
    }
    if (scope.empresaId != null) {
        return ctx.empresaId === scope.empresaId;
    }
    return true;
}

/** Sucursal incluida si el alcance apunta a ella o a un puesto/contrato/cliente descendiente. */
export function sucursalMatchesScope(
    ctx: Omit<HierarchyContext, "puestoId">,
    scope: MainStructureScope,
): boolean {
    return matchesMainStructureScope({ ...ctx, puestoId: undefined }, scope);
}

export function puestoMatchesScope(ctx: HierarchyContext, scope: MainStructureScope): boolean {
    return matchesMainStructureScope(ctx, scope);
}

export function mainStructureCachePath(): string {
    return path.resolve(process.cwd(), "main-structure.json");
}

export async function loadMainStructureFragmentsFromDisk(): Promise<Record<string, unknown>> {
    const outPath = mainStructureCachePath();
    try {
        const data = await fs.readFile(outPath, "utf8");
        const parsed = JSON.parse(data) as { fragments?: unknown };
        if (parsed.fragments && typeof parsed.fragments === "object" && !Array.isArray(parsed.fragments)) {
            return parsed.fragments as Record<string, unknown>;
        }
    } catch {
        /* cache inexistente o corrupto */
    }
    return {};
}

export async function persistMainStructureFragmentsToDisk(
    fragments: Record<string, unknown>,
): Promise<number> {
    const { toZonedTime } = await import("date-fns-tz");
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica").getTime();
    const outPath = mainStructureCachePath();
    const tmpPath = `${outPath}.tmp`;
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const payload = JSON.stringify({ created_at: createdAt, fragmentsVersion: 2, fragments }, null, 2);
    await fs.writeFile(tmpPath, payload, "utf8");
    try {
        await fs.rename(tmpPath, outPath);
    } catch {
        await fs.unlink(outPath).catch(() => undefined);
        await fs.rename(tmpPath, outPath);
    }
    return createdAt;
}
