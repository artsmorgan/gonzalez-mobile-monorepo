import { ingresosUsuario } from "./modules/ingresosUsuario";
import { loginMarca } from "./modules/loginMarca";
import { tiempoAlmuerzo } from "./modules/tiempoAlmuerzo";
import type { GuardifyReportModule } from "./types";

/** Reportes disponibles para Guardify. Agregar uno nuevo = un módulo en `modules/` y una línea aquí (y su definición en el manifiesto de Guardify). */
export const GUARDIFY_REPORT_MODULES: Record<string, GuardifyReportModule> = Object.fromEntries(
    [loginMarca, tiempoAlmuerzo, ingresosUsuario].map((m) => [m.id, m]),
);
