/**
 * Formatos compartidos por los reportes, con el mismo criterio que la aplicación (módulo puro, sin base de datos):
 *  - Tipo de turno: «Diurno», «Mixto», «Nocturno», «Libre» (L) e «Indeterminable» para cualquier otro valor o si no hay.
 *  - Fechas visibles: DD-MM-AAAA.
 */
const TURNOS: Record<string, string> = { D: "Diurno", M: "Mixto", N: "Nocturno", L: "Libre" };

/** Etiqueta del tipo de turno. Acepta la letra (D, M, N, L) o la palabra ya escrita («Diurno»…); lo demás es «Indeterminable». */
export function tipoTurnoReporteLabel(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s) return "Indeterminable";
    const palabra = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (palabra === "diurno") return "Diurno";
    if (palabra === "mixto") return "Mixto";
    if (palabra === "nocturno") return "Nocturno";
    if (palabra === "libre") return "Libre";
    return TURNOS[s.toUpperCase()] ?? "Indeterminable";
}

/** `AAAA-MM-DD…` → `DD-MM-AAAA` (sin pasar por zonas horarias: solo reordena el texto). Un texto que no empieza como fecha se devuelve igual. */
export function ymdADmy(v: unknown): string {
    const s = String(v ?? "").trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

/** Puesto con su código: «CÓDIGO · Nombre» (o solo el nombre si no tiene código). */
export function puestoConCodigo(codigo: unknown, nombre: unknown): string {
    const n = String(nombre ?? "").trim();
    const c = String(codigo ?? "").trim();
    return c && n ? `${c} · ${n}` : n || c;
}
