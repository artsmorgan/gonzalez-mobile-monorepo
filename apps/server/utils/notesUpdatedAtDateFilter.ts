export function parseYmdDateParam(value: string | null | undefined): Date | null {
    if (!value) return null;
    const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day, 12, 0, 0, 0);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

export function buildUpdatedAtRangeWhere(
    fechaInicio?: string | null,
    fechaFin?: string | null
): { updated_at?: { gte?: Date; lte?: Date } } | null {
    const start = parseYmdDateParam(fechaInicio);
    const end = parseYmdDateParam(fechaFin);
    if (!start && !end) return null;

    const updated_at: { gte?: Date; lte?: Date } = {};
    if (start) {
        updated_at.gte = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
    }
    if (end) {
        updated_at.lte = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    }

    return { updated_at };
}

export function validateNotesDateRange(
    fechaInicio?: string | null,
    fechaFin?: string | null
): { valid: true } | { valid: false; message: string } {
    const start = parseYmdDateParam(fechaInicio);
    const end = parseYmdDateParam(fechaFin);
    if (!start || !end) return { valid: true };

    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    if (startMs > endMs) {
        return {
            valid: false,
            message: "La fecha inicio no puede ser posterior a la fecha fin.",
        };
    }

    return { valid: true };
}

export function mergeNotesWhereWithDateRange<T extends Record<string, unknown>>(
    baseWhere: T,
    fechaInicio?: string | null,
    fechaFin?: string | null
): T & { updated_at?: { gte?: Date; lte?: Date } } {
    const range = buildUpdatedAtRangeWhere(fechaInicio, fechaFin);
    if (!range) return baseWhere;
    return { ...baseWhere, ...range };
}
