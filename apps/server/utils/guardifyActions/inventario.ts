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

/**
 * Tope de filas por carga: el MISMO en Guardify y en la app (Guardify baja el suyo a este valor) hasta que Planillas diga su tope real (solicitud 3 del
 * spike #189). Cada fila revisa varias tablas y el envío a Planillas es de una sola vez.
 */
export const INVENTARIO_MAX_FILAS = 2000;

/** Resultado de una fila de la carga: `fila` es su posición (1 = la primera) en `filas`. */
export type EstadoFila = "creada" | "omitida" | "error";
export type ResultadoFila = { fila: number; estado: EstadoFila; motivo: string | null };
/** Siempre suma: `creadas + omitidas + errores = recibidas`. */
export type ResumenCarga = { recibidas: number; creadas: number; omitidas: number; errores: number };

export const resumenDe = (filas: ResultadoFila[]): ResumenCarga => ({
    recibidas: filas.length,
    creadas: filas.filter((f) => f.estado === "creada").length,
    omitidas: filas.filter((f) => f.estado === "omitida").length,
    errores: filas.filter((f) => f.estado === "error").length,
});

export const MOTIVO_NO_PROCESADA = "No se procesó: la carga tiene filas con errores y no se envió nada.";

export type PlanCarga =
    | { kind: "invalid"; status: 400 | 404; message: string; errors: string[]; filas: ResultadoFila[] }
    | { kind: "ok"; send: FilaInventario[]; createdPlans: number; createdEntregas: number; skipped: string[]; filas: ResultadoFila[]; puestoIds: number[] };

/** Rechazo de toda la carga con el resultado de CADA fila: las que tienen error lo dicen y las demás quedan como no procesadas (nada se envió). */
function rechazo(total: number, status: 400 | 404, message: string, errors: string[], motivos: Map<number, string>): Extract<PlanCarga, { kind: "invalid" }> {
    const filas: ResultadoFila[] = Array.from({ length: total }, (_, i) => (motivos.has(i + 1) ? { fila: i + 1, estado: "error" as const, motivo: motivos.get(i + 1)! } : { fila: i + 1, estado: "omitida" as const, motivo: MOTIVO_NO_PROCESADA }));
    return { kind: "invalid", status, message, errors, filas };
}

/**
 * Valida y planifica la carga: qué se enviaría a Planillas y qué se omite, fila por fila. No escribe nada.
 *
 * Planillas recibe UNA línea por (puesto, artículo) (`formatearParaPlanillas`), así que de varias filas con el mismo puesto y artículo solo una viaja. Las demás
 * se informan como OMITIDAS con su motivo (y su fila) en lugar de contarse como creadas; al repetir la carga, la serie omitida pasa a ser la que se envía.
 */
export async function planificarCargaInventario(prisma: any, articulosRaw: unknown): Promise<PlanCarga> {
    if (!Array.isArray(articulosRaw) || articulosRaw.length === 0) return { kind: "invalid", status: 400, message: "Debe indicar al menos un artículo.", errors: [], filas: [] };

    const total = articulosRaw.length;
    const articulos: { fila: number; art: FilaInventario }[] = [];
    const validationErrors: string[] = [];
    const motivos = new Map<number, string>();
    const marcar = (fila: number, motivo: string, conPrefijo = true) => {
        validationErrors.push(conPrefijo ? `Artículo ${fila}: ${motivo}` : motivo);
        if (!motivos.has(fila)) motivos.set(fila, motivo);
    };

    for (let i = 0; i < total; i++) {
        const fila = i + 1;
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

        if (!codigoPuesto) { marcar(fila, "código de puesto obligatorio."); continue; }
        if (codigoPuesto.length > 40 || serie.length > 120 || marca.length > 120 || (modelo?.length ?? 0) > 120) { marcar(fila, "algún texto es demasiado largo."); continue; }
        if (!Number.isFinite(numero) || numero <= 0) { marcar(fila, "número inválido."); continue; }
        if (!Number.isFinite(cantidad) || cantidad < 0) { marcar(fila, "cantidad inválida."); continue; }
        if (!serie) { marcar(fila, "serie obligatoria."); continue; }
        if (!marca) { marcar(fila, "marca obligatoria."); continue; }
        if (!fechaEntrega || parseFechaEntregaParts(fechaEntrega) == null) { marcar(fila, "fecha de entrega inválida (DD-MM-YYYY)."); continue; }

        const fechaParts = parseFechaEntregaParts(fechaEntrega);
        articulos.push({
            fila,
            art: {
                codigo_puesto: codigoPuesto,
                numero_articulo: Math.trunc(numero),
                cantidad: Math.trunc(cantidad),
                serie,
                marca,
                modelo,
                fecha_entrega: fechaParts ? `${fechaParts.dd}-${fechaParts.mm}-${fechaParts.yyyy} 00:00:00` : fechaEntrega,
            },
        });
    }
    if (validationErrors.length > 0) return rechazo(total, 400, "Datos de artículos inválidos.", validationErrors, motivos);

    const articuloNums = Array.from(new Set(articulos.map((a) => a.art.numero_articulo)));
    const catalogRows = await prisma.n_articulo_corpo_puesto.findMany({ where: { id: { in: articuloNums } } });
    const catalogIds = new Set((Array.isArray(catalogRows) ? catalogRows : []).map((a: { id: number }) => Number(a.id)));
    for (const n of articuloNums) if (!catalogIds.has(n)) validationErrors.push(`El artículo #${n} no existe.`);
    if (validationErrors.length > 0) {
        for (const { fila, art } of articulos) if (!catalogIds.has(art.numero_articulo)) motivos.set(fila, `El artículo #${art.numero_articulo} no existe.`);
        return rechazo(total, 404, "Algunos artículos no existen.", validationErrors, motivos);
    }

    const codigosPuesto = Array.from(new Set(articulos.map((a) => a.art.codigo_puesto)));
    const puestos = await prisma.e_estructura_puesto.findMany({ where: { codigo: { in: codigosPuesto } } });
    const puestoIdByCodigo = new Map<string, number>();
    for (const p of Array.isArray(puestos) ? puestos : []) {
        const codigo = String(p.codigo ?? "").trim();
        if (!codigo) continue;
        puestoIdByCodigo.set(codigo, Number(p.id));
    }
    for (const codigo of codigosPuesto) if (!puestoIdByCodigo.has(codigo)) validationErrors.push(`El código de puesto «${codigo}» no existe.`);
    if (validationErrors.length > 0) {
        for (const { fila, art } of articulos) if (!puestoIdByCodigo.has(art.codigo_puesto)) motivos.set(fila, `El código de puesto «${art.codigo_puesto}» no existe.`);
        return rechazo(total, 404, "Algunos códigos de puesto no existen.", validationErrors, motivos);
    }

    const puestoIds = Array.from(new Set(puestoIdByCodigo.values()));
    const articuloNumsUnicos = articuloNums;
    const existingPlans = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { puesto_id: { in: puestoIds }, articuloCP_id: { in: articuloNumsUnicos } } });
    const existingEntregas = await prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({ where: { puesto_id: { in: puestoIds }, nomencladorArticuloCP_id: { in: articuloNumsUnicos } } });

    const planKeys = new Set<string>();
    for (const p of Array.isArray(existingPlans) ? existingPlans : []) if (p.puesto_id != null && p.articuloCP_id != null) planKeys.add(`${p.puesto_id}:${p.articuloCP_id}`);
    const entregaKeys = new Set<string>();
    for (const e of Array.isArray(existingEntregas) ? existingEntregas : []) {
        if (e.puesto_id != null && e.nomencladorArticuloCP_id != null) {
            entregaKeys.add(`${e.puesto_id}:${e.nomencladorArticuloCP_id}:${String(e.marca ?? "").trim()}:${String(e.serie ?? "").trim()}:${String(e.modelo ?? "").trim()}`);
        }
    }

    const filas: ResultadoFila[] = [];
    const send: FilaInventario[] = [];
    let createdPlans = 0;
    let createdEntregas = 0;
    /** Qué fila ya viaja para cada (puesto, artículo): Planillas recibe una sola. */
    const viajaPorPlan = new Map<string, number>();
    /** Qué fila ya viaja para cada entrega concreta (puesto, artículo, marca, serie, modelo): para detectar filas repetidas en la misma carga. */
    const viajaPorEntrega = new Map<string, number>();

    for (const { fila, art } of articulos) {
        const puestoId = puestoIdByCodigo.get(art.codigo_puesto)!;
        const planKey = `${puestoId}:${art.numero_articulo}`;
        const entregaKey = `${puestoId}:${art.numero_articulo}:${art.marca}:${art.serie}:${art.modelo ?? ""}`;
        const detalle = `marca «${art.marca}», serie «${art.serie}», modelo «${art.modelo ?? ""}»`;
        if (!fechaEntregaStringToDbDate(art.fecha_entrega)) { filas.push({ fila, estado: "omitida", motivo: "Fecha de entrega inválida." }); continue; }

        const planNecesario = !planKeys.has(planKey);
        const entregaNecesaria = !entregaKeys.has(entregaKey);
        if (!planNecesario && !entregaNecesaria) {
            const igual = viajaPorEntrega.get(entregaKey);
            filas.push({ fila, estado: "omitida", motivo: igual ? `Repetida en la carga: igual a la fila ${igual} (${detalle}).` : `Ya existe en la base: el plan del puesto y la entrega (${detalle}).` });
            continue;
        }
        const yaViaja = viajaPorPlan.get(planKey);
        if (yaViaja) {
            filas.push({ fila, estado: "omitida", motivo: `Planillas recibe una sola fila por puesto y artículo y ya viaja la fila ${yaViaja}: esta serie (${detalle}) no se carga ahora; al repetir la carga se enviará.` });
            continue;
        }
        send.push(art);
        viajaPorPlan.set(planKey, fila);
        viajaPorEntrega.set(entregaKey, fila);
        if (planNecesario) {
            createdPlans++;
            planKeys.add(planKey);
        }
        if (entregaNecesaria) {
            createdEntregas++;
            entregaKeys.add(entregaKey);
        }
        filas.push({ fila, estado: "creada", motivo: planNecesario && entregaNecesaria ? null : planNecesario ? "Se crea el plan; la entrega ya existía." : "Se crea la entrega; el plan ya existía." });
    }
    const skipped = filas.filter((f) => f.estado === "omitida").map((f) => `Fila ${f.fila}: ${f.motivo}`);
    return { kind: "ok", send, createdPlans, createdEntregas, skipped, filas, puestoIds: Array.from(new Set(send.map((s) => puestoIdByCodigo.get(s.codigo_puesto)!))) };
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

export type CargaOk = {
    status: true;
    message: string;
    created_plans: number;
    created_entregas: number;
    /** Una línea de texto por fila omitida (`Fila N: motivo`); el detalle por fila está en `filas`. */
    skipped: string[];
    modo: "validar" | "aplicar";
    /** Resultado de CADA fila recibida: `{ fila, estado: "creada" | "omitida" | "error", motivo }`. */
    filas: ResultadoFila[];
    /** `creadas + omitidas + errores = recibidas`. */
    resumen: ResumenCarga;
    /** Ids de los puestos a los que llegó algo (para la evidencia de la acción). */
    puestoIds: number[];
};

export type CargaResult = { ok: true; status: 200; body: CargaOk } | Extract<ActionHttp, { ok: false }>;

const mensajeCarga = (verbo: string, p: { createdPlans: number; createdEntregas: number }, r: ResumenCarga) =>
    `${verbo} ${p.createdPlans} plan(es) y ${p.createdEntregas} entrega(s)` + (r.omitidas > 0 ? `; ${r.omitidas} fila(s) omitida(s), con su motivo en el detalle por fila.` : ".");

export async function cargarInventarioPuesto(env: ActionEnv, input: { filas: unknown; planillasToken: string | null; modo: "validar" | "aplicar" }): Promise<CargaResult> {
    if (input.modo === "aplicar" && !input.planillasToken) {
        await env.report(400, "Token de Planillas no encontrado");
        return fail(400, "planillas_session_required", "Token de Planillas no encontrado");
    }
    const plan = await planificarCargaInventario(env.prisma, input.filas);
    if (plan.kind === "invalid") {
        await env.report(plan.status, plan.message);
        return fail(plan.status, plan.status === 404 ? "not_found" : "invalid_request", plan.message, plan.errors, { filas: plan.filas, resumen: resumenDe(plan.filas) });
    }
    const resumen = resumenDe(plan.filas);
    const base = { status: true as const, created_plans: plan.createdPlans, created_entregas: plan.createdEntregas, skipped: plan.skipped, filas: plan.filas, resumen, puestoIds: plan.puestoIds };
    if (input.modo === "validar") {
        return { ok: true, status: 200, body: { ...base, modo: "validar", message: mensajeCarga("Se crearían", plan, resumen) } };
    }
    // Issue #181: si todo ya existía no hay nada que enviar; antes se llamaba a Planillas con una lista vacía.
    if (plan.send.length === 0) {
        return { ok: true, status: 200, body: { ...base, modo: "aplicar", message: `Se crearon 0 plan(es) y 0 entrega(s): todo ya existía (${resumen.omitidas} fila(s) omitida(s), con su motivo en el detalle por fila).` } };
    }
    const planillasResponse = await env.planillas("/articulos-puesto/carga-masiva", formatearParaPlanillas(plan.send), input.planillasToken!);
    if (!planillasResponse.success) {
        // Planillas respondió que no: es un fallo de ellos, no una petición mal formada (el protocolo reserva `invalid_request` para 400/422).
        await env.report(502, "Error al cargar los artículos en Planillas");
        return fail(502, "planillas_unavailable", "Error al cargar los artículos en Planillas");
    }
    return { ok: true, status: 200, body: { ...base, modo: "aplicar", message: mensajeCarga("Se crearon", plan, resumen) } };
}
