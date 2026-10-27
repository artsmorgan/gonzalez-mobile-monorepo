import { fail, type ActionEnv, type ActionHttp } from "./env";

/**
 * Carga masiva del inventario de un puesto (artículos planeados y entregados). Misma lógica que `POST /api/mantenimiento-equipo/bulk-articulos`
 * (esa ruta ahora llama a `cargarInventarioPuesto`): valida cada fila, comprueba que los artículos y los códigos de puesto existan, descarta lo que
 * ya está cargado (plan o entrega repetidos) y manda el resto a Planillas con el token de Planillas de la persona.
 *
 * Modo `validar`: hace TODO lo anterior menos el envío a Planillas (no escribe nada). Modo `aplicar`: además lo envía.
 * Es idempotente por naturaleza: lo que ya existe se omite, así que repetir una carga no duplica.
 */
export type FilaInventario = { codigo_puesto: string; numero_articulo: number; cantidad: number; serie: string; marca: string; modelo?: string | null; fecha_entrega: string };

type Partes = { dd: string; mm: string; yyyy: string; hh: string; mi: string; ss: string };

export function parseFechaEntregaParts(value: string): Partes | null {
    const s = String(value ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
    const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const day = Number(dd);
    const month = Number(mm);
    const year = Number(yyyy);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (Number.isNaN(year)) return null;
    // Calendario real: «31-02-2026» no existe (la fecha se normalizaría a marzo y se mandaría el texto original a Planillas).
    const real = new Date(Date.UTC(year, month - 1, day));
    if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null;
    return { dd: String(day).padStart(2, "0"), mm: String(month).padStart(2, "0"), yyyy: String(year), hh: "00", mi: "00", ss: "00" };
}

/** Solo para decidir si la fecha es válida al persistir; el texto del payload se conserva tal cual. */
function fechaEntregaStringToDbDate(value: string): Date | null {
    const parts = parseFechaEntregaParts(value);
    if (!parts) return null;
    const d = new Date(Number(parts.yyyy), Number(parts.mm) - 1, Number(parts.dd), Number(parts.hh), Number(parts.mi), Number(parts.ss));
    return Number.isNaN(d.getTime()) ? null : d;
}

export type PlanCarga =
    | { kind: "invalid"; status: 400 | 404; message: string; errors: string[] }
    | { kind: "ok"; send: FilaInventario[]; createdPlans: number; createdEntregas: number; skipped: string[] };

/** Valida y planifica la carga: qué se enviaría a Planillas y qué se omite. No escribe nada. */
export async function planificarCargaInventario(prisma: any, articulosRaw: unknown): Promise<PlanCarga> {
    if (!Array.isArray(articulosRaw) || articulosRaw.length === 0) return { kind: "invalid", status: 400, message: "Debe indicar al menos un artículo.", errors: [] };

    const articulos: FilaInventario[] = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < articulosRaw.length; i++) {
        const row = articulosRaw[i] as Record<string, unknown>;
        const codigoPuesto = String(row?.codigo_puesto ?? "").trim();
        // Solo texto o número: `true`, listas y objetos no valen como número (`Number(true)` es 1, `Number([5])` es 5).
        const esNum = (v: unknown) => typeof v === "number" || (typeof v === "string" && v.trim() !== "");
        const numero = esNum(row?.numero_articulo) ? Number(row?.numero_articulo) : NaN;
        const cantidad = esNum(row?.cantidad) ? Number(row?.cantidad) : NaN;
        const serie = String(row?.serie ?? "").trim();
        const marca = String(row?.marca ?? "").trim();
        const modelo = String(row?.modelo ?? "").trim() || null;
        const fechaEntrega = String(row?.fecha_entrega ?? "").trim();

        if (!codigoPuesto) { validationErrors.push(`Artículo ${i + 1}: código de puesto obligatorio.`); continue; }
        if (codigoPuesto.length > 40 || serie.length > 120 || marca.length > 120 || (modelo?.length ?? 0) > 120) { validationErrors.push(`Artículo ${i + 1}: algún texto es demasiado largo.`); continue; }
        if (!Number.isFinite(numero) || numero <= 0) { validationErrors.push(`Artículo ${i + 1}: número inválido.`); continue; }
        if (!Number.isFinite(cantidad) || cantidad < 0) { validationErrors.push(`Artículo ${i + 1}: cantidad inválida.`); continue; }
        if (!serie) { validationErrors.push(`Artículo ${i + 1}: serie obligatoria.`); continue; }
        if (!marca) { validationErrors.push(`Artículo ${i + 1}: marca obligatoria.`); continue; }
        if (!fechaEntrega || parseFechaEntregaParts(fechaEntrega) == null) { validationErrors.push(`Artículo ${i + 1}: fecha de entrega inválida (DD-MM-YYYY).`); continue; }

        const fechaParts = parseFechaEntregaParts(fechaEntrega);
        articulos.push({
            codigo_puesto: codigoPuesto,
            numero_articulo: Math.trunc(numero),
            cantidad: Math.trunc(cantidad),
            serie,
            marca,
            modelo,
            fecha_entrega: fechaParts ? `${fechaParts.dd}-${fechaParts.mm}-${fechaParts.yyyy} 00:00:00` : fechaEntrega,
        });
    }
    if (validationErrors.length > 0) return { kind: "invalid", status: 400, message: "Datos de artículos inválidos.", errors: validationErrors };

    const articuloNums = Array.from(new Set(articulos.map((a) => a.numero_articulo)));
    const catalogRows = await prisma.n_articulo_corpo_puesto.findMany({ where: { id: { in: articuloNums } } });
    const catalogIds = new Set((Array.isArray(catalogRows) ? catalogRows : []).map((a: { id: number }) => Number(a.id)));
    for (const n of articuloNums) if (!catalogIds.has(n)) validationErrors.push(`El artículo #${n} no existe.`);
    if (validationErrors.length > 0) return { kind: "invalid", status: 404, message: "Algunos artículos no existen.", errors: validationErrors };

    const codigosPuesto = Array.from(new Set(articulos.map((a) => a.codigo_puesto)));
    const puestos = await prisma.e_estructura_puesto.findMany({ where: { codigo: { in: codigosPuesto } } });
    const puestoIdByCodigo = new Map<string, number>();
    for (const p of Array.isArray(puestos) ? puestos : []) {
        const codigo = String(p.codigo ?? "").trim();
        if (!codigo) continue;
        puestoIdByCodigo.set(codigo, Number(p.id));
    }
    for (const codigo of codigosPuesto) if (!puestoIdByCodigo.has(codigo)) validationErrors.push(`El código de puesto «${codigo}» no existe.`);
    if (validationErrors.length > 0) return { kind: "invalid", status: 404, message: "Algunos códigos de puesto no existen.", errors: validationErrors };

    const puestoIds = Array.from(new Set(puestoIdByCodigo.values()));
    const existingPlans = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { puesto_id: { in: puestoIds }, articuloCP_id: { in: articuloNums } } });
    const existingEntregas = await prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({ where: { puesto_id: { in: puestoIds }, nomencladorArticuloCP_id: { in: articuloNums } } });

    const planKeys = new Set<string>();
    for (const p of Array.isArray(existingPlans) ? existingPlans : []) if (p.puesto_id != null && p.articuloCP_id != null) planKeys.add(`${p.puesto_id}:${p.articuloCP_id}`);
    const entregaKeys = new Set<string>();
    for (const e of Array.isArray(existingEntregas) ? existingEntregas : []) {
        if (e.puesto_id != null && e.nomencladorArticuloCP_id != null) {
            entregaKeys.add(`${e.puesto_id}:${e.nomencladorArticuloCP_id}:${String(e.marca ?? "").trim()}:${String(e.serie ?? "").trim()}:${String(e.modelo ?? "").trim()}`);
        }
    }

    const skipped: string[] = [];
    let createdPlans = 0;
    let createdEntregas = 0;
    const send: FilaInventario[] = [];
    for (const art of articulos) {
        const puestoId = puestoIdByCodigo.get(art.codigo_puesto)!;
        const planKey = `${puestoId}:${art.numero_articulo}`;
        const entregaKey = `${puestoId}:${art.numero_articulo}:${art.marca}:${art.serie}:${art.modelo ?? ""}`;
        if (!fechaEntregaStringToDbDate(art.fecha_entrega)) continue;

        if (!planKeys.has(planKey)) {
            send.push(art);
            planKeys.add(planKey);
            createdPlans++;
        } else {
            skipped.push(`Plan ya existente: puesto «${art.codigo_puesto}», artículo #${art.numero_articulo}.`);
        }

        if (!entregaKeys.has(entregaKey)) {
            send.push(art);
            entregaKeys.add(entregaKey);
            createdEntregas++;
        } else {
            skipped.push(`Entrega ya existente: puesto «${art.codigo_puesto}», artículo #${art.numero_articulo}, marca «${art.marca}», serie «${art.serie}», modelo «${art.modelo ?? ""}».`);
        }
    }
    return { kind: "ok", send, createdPlans, createdEntregas, skipped };
}

/** Lo que recibe Planillas: una fila por (puesto, artículo), con la fecha como YYYY-MM-DD. */
export function formatearParaPlanillas(data: FilaInventario[]): { items: Record<string, unknown>[] } {
    const formattedList: Record<string, unknown>[] = [];
    for (const item of data) {
        // Asegurarse de que no exista ya una combinación de codigo_puesto y numero_articulo
        if (formattedList.find((i) => i.codigo_puesto === item.codigo_puesto && i.numero_articulo === item.numero_articulo)) continue;
        const formattedFecha = item.fecha_entrega.split(" ")[0].split("-").reverse().join("-");
        formattedList.push({ codigo_puesto: item.codigo_puesto, numero_articulo: item.numero_articulo, cantidad: item.cantidad, serie: item.serie, marca: item.marca, modelo: item.modelo ?? "", fecha_entrega: formattedFecha });
    }
    return { items: formattedList };
}

export type CargaOk = { status: true; message: string; created_plans: number; created_entregas: number; skipped: string[]; modo: "validar" | "aplicar" };

export type CargaResult = { ok: true; status: 200; body: CargaOk } | Extract<ActionHttp, { ok: false }>;

export async function cargarInventarioPuesto(env: ActionEnv, input: { filas: unknown; planillasToken: string | null; modo: "validar" | "aplicar" }): Promise<CargaResult> {
    if (input.modo === "aplicar" && !input.planillasToken) {
        await env.report(400, "Token de Planillas no encontrado");
        return fail(400, "planillas_session_required", "Token de Planillas no encontrado");
    }
    const plan = await planificarCargaInventario(env.prisma, input.filas);
    if (plan.kind === "invalid") {
        await env.report(plan.status, plan.message);
        return fail(plan.status, plan.status === 404 ? "not_found" : "invalid_request", plan.message, plan.errors);
    }
    if (input.modo === "validar") {
        return { ok: true, status: 200, body: { status: true, modo: "validar", message: `Se crearían ${plan.createdPlans} plan(es) y ${plan.createdEntregas} entrega(s).`, created_plans: plan.createdPlans, created_entregas: plan.createdEntregas, skipped: plan.skipped } };
    }
    const planillasResponse = await env.planillas("/articulos-puesto/carga-masiva", formatearParaPlanillas(plan.send), input.planillasToken!);
    if (!planillasResponse.success) {
        await env.report(500, "Error al actualizar la ubicación del puesto");
        return fail(500, "invalid_request", "Error al actualizar la ubicación del puesto");
    }
    return { ok: true, status: 200, body: { status: true, modo: "aplicar", message: `Se crearon ${plan.createdPlans} plan(es) y ${plan.createdEntregas} entrega(s).`, created_plans: plan.createdPlans, created_entregas: plan.createdEntregas, skipped: plan.skipped } };
}
