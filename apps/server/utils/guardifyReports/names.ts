export function buildNombre(row: { nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null }): string {
    return [row.nombre, row.primer_apellido, row.segundo_apellido].filter(Boolean).join(" ").trim();
}
