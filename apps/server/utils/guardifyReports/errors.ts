/** Error de validación de la petición: se responde 400 con el mensaje. */
export class ParamError extends Error {
    status = 400 as const;
    constructor(message: string) {
        super(message);
    }
}

/** El reporte no puede restringirse por la estructura pedida: se responde 403 `scope_unsupported`. */
export class ScopeUnsupportedError extends Error {
    status = 403 as const;
    constructor(message = "Este reporte todavía no admite restringir por unidad de la estructura.") {
        super(message);
    }
}
