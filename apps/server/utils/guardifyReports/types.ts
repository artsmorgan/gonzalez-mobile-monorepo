import type { ReportDataAccess } from "../reportDynamicPrisma";
import type { OutRow } from "./listing";
import type { ReportParams } from "./params";

/** Un reporte que MonitoreApp expone a Guardify. Las columnas de `OutRow` deben coincidir con las del manifiesto de Guardify. */
export type GuardifyReportModule = {
    id: string;
    /** ¿Sabe restringir por nodos de la estructura? Si no, con un alcance pedido responde 403 `scope_unsupported`. */
    supportsScope: boolean;
    /** Columnas donde busca `q`. */
    searchKeys: string[];
    /** Informativo (protocolo v2): ya no restringe nada; se puede filtrar y ordenar por cualquier columna de las filas. */
    filterKeys: string[];
    /** Informativo (protocolo v2): ya no restringe nada. */
    sortKeys: string[];
    defaultSort: string;
    /** Trae TODAS las filas del periodo (y del alcance); la búsqueda, el orden y la paginación los aplica el manejador. */
    load: (db: ReportDataAccess, p: ReportParams) => Promise<OutRow[]>;
};
