/**
 * Análisis estático de las rutas de la API (issue #181). Módulo puro: recibe el texto de cada `route.ts`, no toca el sistema de archivos.
 * Sirve para el inventario de `docs/auditoria-backend-2026-10-inventario.md` (generado por `scripts/auditRoutes.ts`) y para que las pruebas
 * detecten una ruta nueva que acceda a la base de datos sin verificar al usuario.
 *
 * Es un análisis por texto, no por ejecución: marca lo que se ve en el código, no demuestra que algo sea seguro. Una ruta marcada
 * «verifica sesión» solo está autenticada; que el usuario tenga alcance sobre el objeto lo decide `objectScope`.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Quita comentarios de bloque y de línea (la ruta puede conservar código viejo comentado que no se ejecuta). */
export function stripComments(source: string): string {
    let out = "";
    let i = 0;
    const n = source.length;
    let state: "code" | "line" | "block" | "single" | "double" | "template" = "code";
    while (i < n) {
        const c = source[i]!;
        const next = source[i + 1];
        if (state === "code") {
            if (c === "/" && next === "/") { state = "line"; i += 2; continue; }
            if (c === "/" && next === "*") { state = "block"; i += 2; continue; }
            if (c === "'") state = "single";
            else if (c === '"') state = "double";
            else if (c === "`") state = "template";
            out += c; i++;
        } else if (state === "line") {
            if (c === "\n") { state = "code"; out += c; }
            i++;
        } else if (state === "block") {
            if (c === "*" && next === "/") { state = "code"; i += 2; continue; }
            if (c === "\n") out += c;
            i++;
        } else {
            // dentro de una cadena: se conserva tal cual
            out += c;
            if (c === "\\") { out += next ?? ""; i += 2; continue; }
            if ((state === "single" && c === "'") || (state === "double" && c === '"') || (state === "template" && c === "`")) state = "code";
            i++;
        }
    }
    return out;
}

export function exportedMethods(code: string): HttpMethod[] {
    const found = new Set<HttpMethod>();
    for (const m of code.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) found.add(m[1] as HttpMethod);
    for (const m of code.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) found.add(m[1] as HttpMethod);
    return [...found];
}

/** Mecanismos con los que una ruta comprueba quién llama. */
const AUTH_MARKERS: Array<{ name: string; re: RegExp }> = [
    { name: "verifyAccessTokenByApi", re: /\bverifyAccessTokenByApi\s*\(/ },
    { name: "verifyAccessToken", re: /\bverifyAccessToken\s*\(/ },
    { name: "verifyMobileAccessToken", re: /\bverifyMobileAccessToken\s*\(/ },
    { name: "verifyMainStructureAccess", re: /\bverifyMainStructureAccess\s*\(/ },
    // Llave de servidor a servidor de Guardify: la comprueba cada manejador con `verifyGuardifyApiKey` (lo exige routeAudit.test.ts).
    { name: "guardify-key", re: /\bhandle(ActionDetail|ActionExecute|LookupEmpleado|Import|DbStatus|EnviarDocumento|TerminarAsignacion|VistaPreviaDocumento|PublicarDocumento|EvidenceVerification|GuardifyReport|GuardifyForms|GuardifyStructure)\b/ },
];

/** La ruta reenvía la petición (con el token del usuario) a la API dinámica, que es quien lo verifica. */
const DELEGATED_MARKERS = /\b(fetchDynamicFile|fetchDynamicFileStream|callDynamicPrisma|callDynamicFilesApi|callDynamicReportesApi|fetchDynamicReportsDownload|callDynamicReportes)\s*\(/;

export type RouteFacts = {
    file: string;
    endpoint: string;
    methods: HttpMethod[];
    auth: string[];
    /** Verifica al usuario en la API dinámica porque reenvía su token (no hay verificación en la propia ruta). */
    delegatedAuth: boolean;
    /** Accede a la base de datos directamente con Prisma desde la propia ruta. */
    directDb: boolean;
    pathIds: string[];
    queryIds: string[];
    bodyIds: string[];
    /** Usa la identidad del token (`payload.id`) para algo además de validar. */
    usesIdentity: boolean;
    /** Llama a un control de alcance sobre el objeto (`authorizeSelfOrAdmin`, `authorizeMarcaAccess`, `authorizeReportesOperation`, `isSuperAdminEmpleado`). */
    objectScope: boolean;
    writes: boolean;
};

export function endpointOf(file: string): string {
    return file.replace(/\\/g, "/").replace(/^.*?app\/api\//, "").replace(/\/route\.ts$/, "");
}

export function analyzeRoute(file: string, source: string): RouteFacts {
    const code = stripComments(source);
    const methods = exportedMethods(code);
    const auth = AUTH_MARKERS.filter((m) => m.re.test(code)).map((m) => m.name);
    const pathIds = [...endpointOf(file).matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!);
    const queryIds = [...new Set([...code.matchAll(/searchParams\.get\(\s*["'`]([A-Za-z_]*[iI]d[A-Za-z_]*)["'`]\s*\)/g)].map((m) => m[1]!))];
    const bodyIds = new Set<string>();
    for (const m of code.matchAll(/const\s*\{([^}]*)\}\s*=\s*(?:await\s+)?(?:req|request)\.json\(\)/g)) {
        for (const part of m[1]!.split(",")) {
            const name = part.split(":")[0]!.trim();
            if (/(^id$|_id$|Id$|^id_)/.test(name)) bodyIds.add(name);
        }
    }
    return {
        file,
        endpoint: endpointOf(file),
        methods,
        auth,
        delegatedAuth: DELEGATED_MARKERS.test(code),
        directDb: /\bprisma\.[A-Za-z_]+\.[A-Za-z]+\(/.test(code) || /\$queryRaw|\$executeRaw/.test(code),
        pathIds,
        queryIds,
        bodyIds: [...bodyIds],
        usesIdentity: /\bpayload\??\.(id|sessionId)\b|\bauth\.empleadoId\b/.test(code),
        objectScope: /\b(authorizeSelfOrAdmin|authorizeMarcaAccess|authorizeReportesOperation|isSuperAdminEmpleado|handleActionDetail|handleActionExecute|autorizarGestionManual)\s*\(/.test(code),
        writes: methods.some((m) => m !== "GET"),
    };
}

/** ¿Quien llama queda verificado, ya sea en la propia ruta o en la API dinámica a la que se reenvía su token? */
export function verifiesCaller(f: RouteFacts): boolean {
    return f.auth.length > 0 || f.delegatedAuth;
}

/**
 * Rutas que acceden a la base de datos con Prisma desde la propia ruta SIN verificar al usuario, y que no son públicas por diseño.
 * Es lo único que el análisis estático puede afirmar con certeza como falta de autenticación.
 */
export function unauthenticatedDirectDb(facts: RouteFacts[], publicByDesign: ReadonlySet<string>): RouteFacts[] {
    return facts.filter((f) => f.directDb && f.auth.length === 0 && !publicByDesign.has(f.endpoint));
}
