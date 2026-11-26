/**
 * Compara dos versiones `mayor.menor.parche` por partes numéricas (`1.0.10` > `1.0.9`, a diferencia de quitar los puntos y comparar como número).
 * Devuelve un número negativo si `a < b`, 0 si son iguales y positivo si `a > b`. Una parte que no es número cuenta como 0.
 */
export function compareAppVersions(a: unknown, b: unknown): number {
  const parts = (v: unknown) =>
    String(v ?? '')
      .trim()
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((p) => {
        const n = parseInt(p, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function isNewerAppVersion(candidate: unknown, installed: unknown): boolean {
  return compareAppVersions(candidate, installed) > 0;
}
