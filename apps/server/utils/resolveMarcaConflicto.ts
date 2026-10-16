/**
 * Prioridad entre marcas del mismo empleado que chocan en horario (se traslapan en fecha y hora de entrada/salida), por ejemplo
 * un empleado con su propia marca y, a la vez, la de un compañero al que está reemplazando.
 *
 * Reglas (sobre el grupo de marcas en conflicto):
 *  1. Si alguna tiene como `empleadoReemplaza` al empleado consultado, se usa una de esas.
 *  2. Entre las candidatas (las del punto 1 o, si no hay, todo el grupo) gana la que va primero por «fecha + hora de inicio del
 *     horario»; con el mismo inicio, la de `id` menor.
 *
 * Todas las horas se tratan como "hora de reloj" (sin zona), igual que el resto de `attendance/user/[id]`.
 */

export type MarcaCandidata = {
    id: number;
    inicio: Date;
    fin: Date;
    /** Id del empleado que reemplaza al fijo en esta marca (null si no hay reemplazo). */
    empleadoReemplazaId: number | null;
};

export type MarcaCandidataInput = {
    id: number;
    /** `YYYY-MM-DD` o `Date` (se toma la parte de fecha en UTC, como el resto de la ruta). */
    fecha: string | Date;
    /** `HH:mm` / `HH:mm:ss` o `Date` (se toma la parte de hora en UTC). */
    horaInicio: string | Date | null | undefined;
    horaFin: string | Date | null | undefined;
    empleadoReemplazaId: number | string | null | undefined;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function fechaYmd(fecha: string | Date): string {
    if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);
    return String(fecha).trim().slice(0, 10);
}

function horaHms(hora: string | Date | null | undefined): string {
    if (hora == null) return "00:00:00";
    if (hora instanceof Date) return hora.toISOString().slice(11, 19);
    const m = String(hora).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return "00:00:00";
    return `${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
}

/** Normaliza una marca (de Planillas o de `c_marca_dia`) a su intervalo [inicio, fin). Si termina a/antes del inicio, cruza la medianoche. */
export function buildMarcaCandidata(input: MarcaCandidataInput): MarcaCandidata {
    const ymd = fechaYmd(input.fecha);
    const inicio = new Date(`${ymd}T${horaHms(input.horaInicio)}.000Z`);
    let fin = new Date(`${ymd}T${horaHms(input.horaFin)}.000Z`);
    if (fin.getTime() <= inicio.getTime()) fin = new Date(fin.getTime() + DAY_MS);
    const reemplaza = Number(input.empleadoReemplazaId);
    return {
        id: Number(input.id),
        inicio,
        fin,
        empleadoReemplazaId: Number.isFinite(reemplaza) && reemplaza > 0 ? reemplaza : null,
    };
}

/** Dos marcas chocan si sus intervalos se traslapan (tocarse en el borde, p. ej. una termina cuando la otra empieza, no es conflicto). */
export function marcasSeTraslapan(a: MarcaCandidata, b: MarcaCandidata): boolean {
    return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime();
}

/** Orden de prioridad: primero la de «fecha + inicio» menor y, a igual inicio, la de `id` menor. */
export function compararPrioridadMarca(a: MarcaCandidata, b: MarcaCandidata): number {
    return a.inicio.getTime() - b.inicio.getTime() || a.id - b.id;
}

/** Marcas en conflicto con `semilla`, incluida ella, siguiendo los traslapes en cadena (A choca con B y B con C → las tres). */
export function grupoEnConflicto(semilla: MarcaCandidata, pool: MarcaCandidata[]): MarcaCandidata[] {
    const porId = new Map<number, MarcaCandidata>();
    for (const m of pool) porId.set(m.id, m);
    porId.set(semilla.id, semilla);
    const grupo = new Map<number, MarcaCandidata>([[semilla.id, semilla]]);
    let cambio = true;
    while (cambio) {
        cambio = false;
        for (const m of porId.values()) {
            if (grupo.has(m.id)) continue;
            for (const g of grupo.values()) {
                if (marcasSeTraslapan(g, m)) {
                    grupo.set(m.id, m);
                    cambio = true;
                    break;
                }
            }
        }
    }
    return [...grupo.values()];
}

/** Elige la marca prioritaria de un grupo en conflicto para el empleado consultado. */
export function elegirMarcaPrioritaria(grupo: MarcaCandidata[], empleadoId: number): MarcaCandidata {
    const reemplazos = grupo.filter((m) => m.empleadoReemplazaId === Number(empleadoId));
    const candidatas = reemplazos.length > 0 ? reemplazos : grupo;
    return [...candidatas].sort(compararPrioridadMarca)[0];
}

/**
 * Dada la marca que la lógica normal eligió (`elegidaId`) y las marcas conocidas del empleado (`pool`), devuelve el id de la marca
 * que debe usarse: la misma si no choca con ninguna, o la prioritaria de su grupo en conflicto.
 */
export function resolverConflictoDeMarcas(elegidaId: number, pool: MarcaCandidata[], empleadoId: number): number {
    const semilla = pool.find((m) => m.id === Number(elegidaId));
    if (!semilla) return Number(elegidaId);
    const grupo = grupoEnConflicto(semilla, pool);
    if (grupo.length < 2) return semilla.id;
    return elegirMarcaPrioritaria(grupo, empleadoId).id;
}
