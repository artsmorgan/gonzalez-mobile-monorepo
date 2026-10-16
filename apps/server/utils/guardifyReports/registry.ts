import { accionesPersonales } from "./modules/accionesPersonales";
import { actaEntregaProductos } from "./modules/actaEntregaProductos";
import { actividades } from "./modules/actividades";
import { agendaMinuta } from "./modules/agendaMinuta";
import { aperturaCierrePuesto } from "./modules/aperturaCierrePuesto";
import { apreciacionVulnerabilidad } from "./modules/apreciacionVulnerabilidad";
import { articulosPuesto } from "./modules/articulosPuesto";
import { bitacoraNovedades } from "./modules/bitacoraNovedades";
import { cambiosUbicacionPuesto } from "./modules/cambiosUbicacionPuesto";
import { checklistSupervision } from "./modules/checklistSupervision";
import { controlAsistencia } from "./modules/controlAsistencia";
import { documentosEntregados } from "./modules/documentosEntregados";
import { encuestaSatisfaccion } from "./modules/encuestaSatisfaccion";
import { entregaPuesto } from "./modules/entregaPuesto";
import { evaluacionPersonal } from "./modules/evaluacionPersonal";
import { incidentes } from "./modules/incidentes";
import { ingresosUsuario } from "./modules/ingresosUsuario";
import { llaveros } from "./modules/llaveros";
import { llaves } from "./modules/llaves";
import { loginMarca } from "./modules/loginMarca";
import { maestroQuejas } from "./modules/maestroQuejas";
import { mantenimientoArticulos } from "./modules/mantenimientoArticulos";
import { manualesPuesto } from "./modules/manualesPuesto";
import { mutuosAcuerdos } from "./modules/mutuosAcuerdos";
import { notasVoz } from "./modules/notasVoz";
import { productoNoConforme } from "./modules/productoNoConforme";
import { registroCapacitaciones } from "./modules/registroCapacitaciones";
import { registroInduccionGeneral } from "./modules/registroInduccionGeneral";
import { registroInduccionRecorrido } from "./modules/registroInduccionRecorrido";
import { registroVehiculosCorporativos } from "./modules/registroVehiculosCorporativos";
import { registroVisitas } from "./modules/registroVisitas";
import { revisionVehiculos } from "./modules/revisionVehiculos";
import { solicitudVacaciones } from "./modules/solicitudVacaciones";
import { solicitudesPermiso } from "./modules/solicitudesPermiso";
import { tiempoAlmuerzo } from "./modules/tiempoAlmuerzo";
import { visitasVehiculos } from "./modules/visitasVehiculos";
import type { GuardifyReportModule } from "./types";

/** Reportes disponibles para Guardify. Agregar uno nuevo = un módulo en `modules/` y una línea aquí (y su definición en el manifiesto de Guardify). */
export const GUARDIFY_REPORT_MODULES: Record<string, GuardifyReportModule> = Object.fromEntries(
    [
        accionesPersonales, actaEntregaProductos, actividades, agendaMinuta, aperturaCierrePuesto, apreciacionVulnerabilidad, articulosPuesto, bitacoraNovedades, cambiosUbicacionPuesto, checklistSupervision, controlAsistencia, documentosEntregados, encuestaSatisfaccion, entregaPuesto, evaluacionPersonal, incidentes, ingresosUsuario, llaveros, llaves, loginMarca, maestroQuejas, mantenimientoArticulos, manualesPuesto, mutuosAcuerdos, notasVoz, productoNoConforme, registroCapacitaciones, registroInduccionGeneral, registroInduccionRecorrido, registroVehiculosCorporativos, registroVisitas, revisionVehiculos, solicitudVacaciones, solicitudesPermiso, tiempoAlmuerzo, visitasVehiculos,
    ].map((m) => [m.id, m]),
);
