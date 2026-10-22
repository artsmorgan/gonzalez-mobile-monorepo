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
import { conEvidencia } from "./evidencia";
import type { OutRow } from "./listing";
import type { GuardifyReportModule } from "./types";

/**
 * Tabla donde se guarda cada registro de cada reporte, para mostrar su evidencia (dispositivo, latitud, longitud, firma y cédula; issue #153).
 * Vacío = el reporte no es de un registro de la app (sesiones, marcas de ingreso): lleva las cinco columnas, siempre en null.
 * Las tablas de Planillas (`c_accion_personal`, `v_vacacion_solicitud`, artículos del puesto) solo se leen allá: su evidencia, cuando exista, va únicamente en la tabla central.
 */
const TABLA_DE_EVIDENCIA: Record<string, string | ((row: OutRow) => string)> = {
    acciones_personales: "c_accion_personal", acta_entrega_productos: "c_acta_entre_producto", actividades: "e_actividades", agenda_minuta: "c_agenda_minuta",
    apertura_cierre_puesto: "c_apertura_cierre_puesto", apreciacion_vulnerabilidad: "c_boleta_apreciacion_vulnerabilidad",
    articulos_puesto: (row) => (row.origen === "Asignado" ? "e_estructura_articulo_corpo_puesto_entrega" : "e_estructura_articulo_corpo_puesto_plan"),
    bitacora_novedades: "c_puesto_notas", cambios_ubicacion_puesto: "c_ubicacion_puesto_registro_cambios", checklist_supervision: "c_checklist_supervision",
    control_asistencia: "c_control_asistencia", documentos_entregados: "e_control_documento_entregado_cliente", encuesta_satisfaccion: "c_encuesta_cliente",
    entrega_puesto: "e_registro_entrega_puesto", evaluacion_personal: "c_evaluacion_empleado", incidentes: "c_incidente", ingresos_usuario: "", llaveros: "e_llavero",
    llaves: "e_llave", login_marca: "", maestro_quejas: "c_maestro_quejas", mantenimiento_articulos: "c_articulo_mantenimiento", manuales_puesto: "e_manual_puesto",
    mutuos_acuerdos: "e_mutuos_acuerdos", notas_voz: "c_notas_voz", producto_no_conforme: "c_producto_no_conforme", registro_capacitaciones: "e_registro_capacitaciones",
    registro_induccion_general: "c_registro_induccion_general", registro_induccion_recorrido: "c_registro_induccion_recorrido",
    registro_vehiculos_corporativos: "c_vehiculos_corporativos", registro_visitas: "e_registro_personas", revision_vehiculos: "c_bitacora_vehiculo_detenido",
    solicitud_vacaciones: "v_vacacion_solicitud", solicitudes_permiso: "c_solicitud_permiso", tiempo_almuerzo: "c_empleado_almuerzo", visitas_vehiculos: "e_registro_vehiculos",
};

/** Reportes disponibles para Guardify. Agregar uno nuevo = un módulo en `modules/` y una línea aquí (y su definición en el manifiesto de Guardify). */
export const GUARDIFY_REPORT_MODULES: Record<string, GuardifyReportModule> = Object.fromEntries(
    [
        accionesPersonales, actaEntregaProductos, actividades, agendaMinuta, aperturaCierrePuesto, apreciacionVulnerabilidad, articulosPuesto, bitacoraNovedades, cambiosUbicacionPuesto, checklistSupervision, controlAsistencia, documentosEntregados, encuestaSatisfaccion, entregaPuesto, evaluacionPersonal, incidentes, ingresosUsuario, llaveros, llaves, loginMarca, maestroQuejas, mantenimientoArticulos, manualesPuesto, mutuosAcuerdos, notasVoz, productoNoConforme, registroCapacitaciones, registroInduccionGeneral, registroInduccionRecorrido, registroVehiculosCorporativos, registroVisitas, revisionVehiculos, solicitudVacaciones, solicitudesPermiso, tiempoAlmuerzo, visitasVehiculos,
    ].map((m) => [m.id, conEvidencia(m, TABLA_DE_EVIDENCIA[m.id] ?? "")]),
);
