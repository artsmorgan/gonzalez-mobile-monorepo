import { verifyGuardifyApiKey } from "./auth";

export type StructureDeps = { getDb: () => any; env?: Record<string, string | undefined> };

/** Un puesto con su ubicación completa. Guardify lo usa para guardar, en cada unidad de su estructura, el `nivel:id` de esta app. */
export type StructurePuesto = { id: number; codigo: string | null; nombre: string; corpo: number | null; contrato: number | null; cliente: number | null; empresa: number | null; division: number | null };

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/**
 * GET /api/guardify/structure → { puestos: StructurePuesto[] } (solo lectura, misma llave que los reportes).
 * Solo ids, códigos y nombres de la estructura (puesto → corpo → contrato → cliente/empresa/división); nada de personas.
 */
export async function handleGuardifyStructure(req: Request, deps: StructureDeps): Promise<Response> {
    const auth = verifyGuardifyApiKey(req.headers, deps.env);
    if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);
    try {
        const db = deps.getDb();
        const [puestos, corpos, contratos] = await Promise.all([
            db.e_estructura_puesto.findMany({ where: { deleted: null }, select: { id: true, codigo: true, nombre: true, sucursal_id: true } }),
            db.e_estructura_sucursal.findMany({ where: { deleted: null }, select: { id: true, contrato_id: true } }),
            db.e_estructura_contrato.findMany({ where: { deleted: null }, select: { id: true, cliente_id: true, empresa_id: true, division_id: true } }),
        ]);
        const corpoById = new Map<number, any>(corpos.map((c: any) => [Number(c.id), c]));
        const contratoById = new Map<number, any>(contratos.map((c: any) => [Number(c.id), c]));
        const num = (v: unknown) => (v == null ? null : Number(v));
        const out: StructurePuesto[] = puestos.map((p: any) => {
            const corpo = corpoById.get(Number(p.sucursal_id));
            const contrato = corpo ? contratoById.get(Number(corpo.contrato_id)) : undefined;
            return {
                id: Number(p.id), codigo: p.codigo ?? null, nombre: String(p.nombre ?? ""),
                corpo: corpo ? Number(corpo.id) : null, contrato: contrato ? Number(contrato.id) : null,
                cliente: num(contrato?.cliente_id), empresa: num(contrato?.empresa_id), division: num(contrato?.division_id),
            };
        });
        console.log(JSON.stringify({ level: "info", msg: "guardify_structure", puestos: out.length, user: auth.user }));
        return json({ puestos: out });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_structure_failed", error: String(e) }));
        return json({ error: "internal", message: "No se pudo leer la estructura." }, 500);
    }
}
