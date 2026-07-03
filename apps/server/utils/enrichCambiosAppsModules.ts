/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export type EnrichedCambioField = {
  prop: string;
  prop_label: string;
  kind: "text" | "signature_digital" | "signature_image" | "complex";
  display: string;
  raw?: string | null;
};

export type EnrichedCambioDiffLine = {
  label: string;
  before: string;
  after: string;
};

export type EnrichedCambioEntry = {
  prop: string;
  prop_label: string;
  kind: "created" | "deleted" | "updated" | "field";
  before_display?: string | null;
  after_display?: string | null;
  fields?: EnrichedCambioField[];
  diff_lines?: EnrichedCambioDiffLine[];
};

const STRUCTURE_ID_PROPS = new Set([
  "empresa_id",
  "cliente_id",
  "division_id",
  "contrato_id",
  "corpo_id",
  "puesto_id",
  "created_by",
]);

const DIGITAL_SIGNATURE_PROPS = new Set([
  "firma_responsable",
  "firma_ejecutivo_cuenta_digital",
]);

const IMAGE_SIGNATURE_PROPS = new Set([
  "firma_entrega",
  "firma_recibe",
  "firma_solicitante",
  "firma_representante_cliente",
  "firma_representante_empresa_entrante",
  "firma_representante_empresa_saliente",
  "firma_manual_responsable",
  "firma_manual_supervisor",
  "firma_supervisor",
  "firma_empleado",
  "firma_conductor",
  "firma_mecanico",
  "firma_persona_identifico_pnc",
  "firma_persona_origino_pnc",
  "firma_evaluado",
  "firma_ausente_manual",
  "firma_reemplaza_manual",
  "firma_ejecutivo_cuenta_manual",
]);

const COMMON_PROP_LABELS: Record<string, string> = {
  id: "ID",
  empresa_id: "Empresa",
  cliente_id: "Cliente",
  division_id: "División",
  contrato_id: "Contrato",
  corpo_id: "Corpo",
  puesto_id: "Puesto",
  created_by: "Creado por",
  fecha: "Fecha",
  observaciones: "Observaciones",
  firma_responsable: "Firma del responsable",
  firma_entrega: "Firma de entrega",
  firma_recibe: "Firma de quien recibe",
  firma_solicitante: "Firma del solicitante",
  firma_representante_cliente: "Firma representante cliente",
  firma_representante_empresa_entrante: "Firma representante empresa entrante",
  firma_representante_empresa_saliente: "Firma representante empresa saliente",
  description: "Descripción",
  titulo: "Título",
  categoria_id: "Categoría",
  relevancia: "Relevancia",
  is_modified: "Modificado",
  turno: "Turno",
  colaboradores: "Colaboradores",
  total_presentes: "Total presentes",
  total_empleados_turno: "Total empleados del turno",
  nombre_supervisor: "Nombre del supervisor",
  comentarios: "Comentarios",
  evaluacion: "Evaluación",
  articulos_puesto: "Artículos del puesto",
  ejecutivo_cuenta: "Ejecutivo de cuenta",
  tipo_documento: "Tipo de documento",
  nombre_oficial_entrega: "Oficial que entrega",
  nombre_oficial_recibe: "Oficial que recibe",
  descripcion: "Descripción",
  empresa_evaluado: "Empresa evaluada",
  evaluaciones: "Evaluaciones",
  nombre_evaluado: "Nombre evaluado",
  cedula_evaluado: "Cédula evaluado",
  telefono_evaluado: "Teléfono evaluado",
  email_evaluado: "Correo evaluado",
  nombre_responsable: "Nombre responsable",
  cedula_responsable: "Cédula responsable",
  estado: "Estado",
  cantidad_necesaria: "Cantidad necesaria",
  cantidad_real: "Cantidad real",
  accion: "Acción",
  numero_boleta_proveeduria: "N° boleta proveeduría",
  tipo: "Tipo",
  marca: "Marca",
  modelo: "Modelo",
  serie_placa: "Serie / placa",
  marca_nuevo: "Marca (nuevo)",
  modelo_nuevo: "Modelo (nuevo)",
  serie_placa_nuevo: "Serie / placa (nuevo)",
  categoria: "Categoría",
  tipo_mantenimiento_art: "Tipo de mantenimiento",
  fecha_salida: "Fecha de salida",
  fecha_entrada: "Fecha de entrada",
  kilometraje: "Kilometraje",
  categoria_mantinimiento: "Categoría de mantenimiento",
  numero_fc: "N° factura",
  proveedor: "Proveedor",
  costo_mo: "Costo mano de obra",
  costo_i: "Costo insumos",
  iva: "IVA",
  costo_total: "Costo total",
  reincidencia_treinta_dias: "Reincidencia 30 días",
  tipo_mant_art_reincid: "Tipo mantenimiento reincidencia",
  nombre_persona_recibe: "Persona que recibe",
  nombre_persona_entrega: "Persona que entrega",
  departamento: "Departamento",
  telefono: "Teléfono",
  entrega: "Entrega",
  recibe: "Recibe",
  hora: "Hora",
  numero_llave: "Número de llave",
  lugar_abre: "Lugar que abre",
  cantidad_copias: "Cantidad de copias",
  nombre_llavero: "Nombre del llavero",
  plaza_id: "Plaza",
  ausente_acepta: "Primer turno acepta",
  reemplaza_acepta: "Segundo turno acepta",
  ausente_acepta_at: "Fecha aceptación primer turno",
  reemplaza_acepta_at: "Fecha aceptación segundo turno",
  empleadoAusente_id: "Empleado primer turno",
  empleadoReemplaza_id: "Empleado segundo turno",
  plazaAusente_id: "Plaza primer turno",
  plazaReemplaza_id: "Plaza segundo turno",
  firma_ejecutivo_cuenta_manual: "Firma manual ejecutivo",
  firma_ejecutivo_cuenta_digital: "Firma digital ejecutivo",
  motivo: "Motivo",
  sucursal_id: "Corpo",
  vehiculo_id: "Vehículo",
  responsable_id: "Responsable",
  empleado_id: "Empleado",
  uso_id: "Uso de vehículo",
  capacitadores: "Capacitadores",
  fecha_identificacion: "Fecha de identificación",
  fecha_solucion: "Fecha de solución",
  responsable_cuenta: "Responsable de cuenta",
  tipo_servicio_no_conforme: "Tipo de servicio no conforme",
  persona_identifico_pnc: "Persona que identificó",
  persona_origino_pnc: "Persona que originó",
  accion_implementada: "Acción implementada",
  responsable_aprobar: "Responsable que aprueba",
  division: "División",
  temas_desarrollados: "Temas desarrollados",
  aspectos_especificos: "Aspectos específicos",
  renglon_edificio: "Renglón / edificio",
  supervisor_cliente: "Supervisor cliente",
  supervisor_corporacion: "Supervisor corporación",
  nombre: "Nombre",
  cedula: "Cédula",
  hora_entrada: "Hora de entrada",
  hora_salida: "Hora de salida",
  razon_visita: "Razón de visita",
  es_funcionario: "Es funcionario",
  tipo_accion: "Tipo de acción",
  foto_cedula: "Foto de cédula",
  pers_autoriza_salida: "Persona que autoriza salida",
  placa: "Placa",
  departamento_visita: "Departamento de visita",
  persona_visita: "Persona a visitar",
  file_name: "Archivo adjunto",
  prox_cambio_aceite: "Próximo cambio de aceite",
  anno: "Año",
  titulo_propiedad: "Título de propiedad",
  rtv: "RTV",
  marchamo: "Marchamo",
  nombre_conductor: "Nombre del conductor",
  codigo_conductor: "Código del conductor",
  inicio: "Inicio",
  fin: "Fin",
  combustible_inicio: "Combustible al inicio",
  combustible_fin: "Combustible al final",
  km_inicio: "Km al inicio",
  km_fin: "Km al final",
  bitacora_id: "Bitácora",
  mantenimiento: "Mantenimiento",
  diagnostico: "Diagnóstico",
  kilometraje_siguiente_revision: "Kilometraje próxima revisión",
  imagen_antes: "Imagen antes",
  imagen_despues: "Imagen después",
  nombre_mecanico: "Nombre del mecánico",
  informacion_general: "Información general",
  informacion_revision: "Información de revisión",
  movimientos_vehiculos: "Movimientos del vehículo",
};

const TABLE_PROP_LABELS: Record<string, Record<string, string>> = {
  c_acta_entre_producto: {
    tipo_entrega: "Tipo de entrega",
    mensual: "Mensual",
    detalle: "Detalle de productos",
    nombre_entrega: "Nombre quien entrega",
    cedula_entrega: "Cédula quien entrega",
    fecha_entrega: "Fecha de entrega",
    nombre_recibe: "Nombre quien recibe",
    cedula_recibe: "Cédula quien recibe",
    fecha_recibe: "Fecha de recepción",
  },
  c_agenda_minuta: {
    numero: "Número",
    titulo: "Título",
    hora_inicio: "Hora de inicio",
    hora_fin: "Hora de fin",
    autor: "Autor",
    participantes: "Participantes",
    acuerdos: "Acuerdos",
    temas_a_tratar: "Temas a tratar",
  },
  c_apertura_cierre_puesto: {
    tipo: "Tipo de registro",
    actividades: "Actividades",
    inventario: "Inventario",
  },
  c_boleta_apreciacion_vulnerabilidad: {
    enlace: "Enlace",
    nombre_solicitante: "Nombre del solicitante",
    boleta: "Boleta de apreciación",
    metricas_vulnerablidad: "Métricas de vulnerabilidad",
  },
  e_actividades: {
    nombre_actividad: "Nombre de la actividad",
    descripcion_actividad: "Descripción",
    fecha_inicio: "Fecha de inicio",
    fecha_fin: "Fecha de fin",
    frecuencia: "Frecuencia",
    es_revision_equipo: "Es revisión de equipo",
  },
  c_puesto_notas: {
    titulo: "Título",
    description: "Descripción",
    categoria_id: "Categoría",
    relevancia: "Relevancia",
    firma_responsable: "Firma del responsable",
    firma_manual_responsable: "Firma manual del responsable",
    is_modified: "Marcada como modificada",
  },
  c_checklist_supervision: {
    fecha: "Fecha",
    ejecutivo_cuenta: "Ejecutivo de cuenta",
    evaluacion: "Evaluación",
    articulos_puesto: "Artículos del puesto",
    firma_supervisor: "Firma del supervisor",
    firma_responsable: "Firma del responsable",
  },
  c_control_asistencia: {
    fecha: "Fecha",
    turno: "Turno",
    colaboradores: "Colaboradores",
    total_presentes: "Total presentes",
    total_empleados_turno: "Total empleados del turno",
    nombre_supervisor: "Nombre del supervisor",
    comentarios: "Comentarios",
    firma_manual_supervisor: "Firma manual del supervisor",
  },
  e_control_documento_entregado_cliente: {
    fecha: "Fecha",
    nombre_oficial_entrega: "Oficial que entrega",
    nombre_oficial_recibe: "Oficial que recibe",
    tipo_documento: "Tipo de documento",
    descripcion: "Descripción",
    firma_representante_cliente: "Firma representante cliente",
    firma_responsable: "Firma del responsable",
  },
  c_encuesta_cliente: {
    fecha: "Fecha",
    empresa_evaluado: "Empresa evaluada",
    evaluaciones: "Evaluaciones",
    nombre_evaluado: "Nombre evaluado",
    cedula_evaluado: "Cédula evaluado",
    telefono_evaluado: "Teléfono evaluado",
    email_evaluado: "Correo evaluado",
    firma_evaluado: "Firma del evaluado",
    nombre_responsable: "Nombre responsable",
    cedula_responsable: "Cédula responsable",
    observaciones: "Observaciones",
    firma_responsable: "Firma del responsable",
  },
  c_articulo_mantenimiento: {
    estado: "Estado",
    cantidad_necesaria: "Cantidad necesaria",
    cantidad_real: "Cantidad real",
    observaciones: "Observaciones",
    fecha_solucion: "Fecha de solución",
    accion: "Acción",
    fecha_inicio: "Fecha de inicio",
    numero_boleta_proveeduria: "N° boleta proveeduría",
    tipo: "Tipo",
    marca: "Marca",
    modelo: "Modelo",
    serie_placa: "Serie / placa",
    marca_nuevo: "Marca (nuevo)",
    modelo_nuevo: "Modelo (nuevo)",
    serie_placa_nuevo: "Serie / placa (nuevo)",
    categoria: "Categoría",
    tipo_mantenimiento_art: "Tipo de mantenimiento",
    fecha_salida: "Fecha de salida",
    fecha_entrada: "Fecha de entrada",
    kilometraje: "Kilometraje",
    mant_armas_form: "Formulario de armas",
    categoria_mantinimiento: "Categoría de mantenimiento",
    detalle: "Detalle",
    numero_fc: "N° factura",
    proveedor: "Proveedor",
    costo_mo: "Costo mano de obra",
    costo_i: "Costo insumos",
    iva: "IVA",
    costo_total: "Costo total",
    fecha_fin: "Fecha de fin",
    reincidencia_treinta_dias: "Reincidencia 30 días",
    tipo_mant_art_reincid: "Tipo mantenimiento reincidencia",
  },
  c_movimientos_articulo_mantenimiento: {
    nombre_persona_recibe: "Persona que recibe",
    nombre_persona_entrega: "Persona que entrega",
    departamento: "Departamento",
    telefono: "Teléfono",
    entrega: "Entrega",
    recibe: "Recibe",
    fecha: "Fecha",
    hora: "Hora",
    firma_entrega: "Firma de entrega",
    firma_recibe: "Firma de quien recibe",
    firma_responsable: "Firma del responsable",
  },
  c_maestro_quejas: {
    sociedad: "Sociedad",
    nombre_realiza_queja: "Nombre quien realiza la queja",
    cliente: "Cliente (texto)",
    empresa_presenta_queja: "Empresa que presenta la queja",
    persona_presenta_queja: "Persona que presenta la queja",
    medio_recepcion_queja: "Medio de recepción",
    tipo_cliente: "Tipo de cliente",
    tipo_queja: "Tipo de queja",
    estimacion_dannio: "Estimación del daño",
    ubicacion: "Ubicación",
    nivel_queja: "Nivel de queja",
    fecha_queja: "Fecha de queja",
    motivo_queja: "Motivo de queja",
    descripcion_queja: "Descripción de la queja",
    fecha_inicio: "Fecha de inicio",
    fecha_revision: "Fecha de revisión",
    resolucion_queja: "Resolución de la queja",
    estado: "Estado",
    accion_correctiva_preventiva: "Acción correctiva / preventiva",
    plaza_id: "Plaza",
  },
  e_llave: {
    numero_llave: "Número de llave",
    lugar_abre: "Lugar que abre",
    cantidad_copias: "Cantidad de copias",
    observaciones: "Observaciones",
    firma_responsable: "Firma del responsable",
  },
  e_llavero: {
    nombre_llavero: "Nombre del llavero",
    observaciones: "Observaciones",
    firma_responsable: "Firma del responsable",
  },
  e_movimiento_llave: {
    nombre_persona_recibe: "Persona que recibe",
    nombre_persona_entrega: "Persona que entrega",
    departamento: "Departamento",
    telefono: "Teléfono",
    fecha: "Fecha",
    hora: "Hora",
    firma_entrega: "Firma de entrega",
    firma_recibe: "Firma de quien recibe",
    firma_responsable: "Firma del responsable",
  },
  e_movimiento_llavero: {
    nombre_persona_recibe: "Persona que recibe",
    nombre_persona_entrega: "Persona que entrega",
    departamento: "Departamento",
    telefono: "Teléfono",
    fecha: "Fecha",
    hora: "Hora",
    firma_entrega: "Firma de entrega",
    firma_recibe: "Firma de quien recibe",
    firma_responsable: "Firma del responsable",
  },
  e_mutuos_acuerdos: {
    motivo: "Motivo",
    estado: "Estado",
    ausente_acepta: "Primer turno acepta",
    reemplaza_acepta: "Segundo turno acepta",
    ausente_acepta_at: "Fecha aceptación primer turno",
    reemplaza_acepta_at: "Fecha aceptación segundo turno",
    empleadoAusente_id: "Empleado primer turno",
    empleadoReemplaza_id: "Empleado segundo turno",
    plazaAusente_id: "Plaza primer turno",
    plazaReemplaza_id: "Plaza segundo turno",
    ejecutivo_cuenta: "Ejecutivo de cuenta",
    firma_ausente_manual: "Firma manual primer turno",
    firma_reemplaza_manual: "Firma manual segundo turno",
    firma_ejecutivo_cuenta_manual: "Firma manual ejecutivo",
    firma_ejecutivo_cuenta_digital: "Firma digital ejecutivo",
    firma_responsable: "Firma del responsable",
  },
  e_manual_puesto: {
    title: "Título",
    description: "Descripción",
    quiz: "Cuestionario",
  },
  c_producto_no_conforme: {
    firma_persona_identifico_pnc: "Firma persona que identificó",
    firma_persona_origino_pnc: "Firma persona que originó",
  },
  c_registro_induccion_general: {
    temas_a_tratar: "Temas a tratar",
  },
  c_registro_induccion_recorrido: {
    participantes: "Participantes",
    firma_supervisor: "Firma del supervisor",
    firma_empleado: "Firma del empleado",
  },
  c_vehiculos_corporativos: {
    firma_responsable: "Firma del responsable",
  },
  c_usos_vehiculos_corporativos: {
    firma_conductor: "Firma del conductor",
  },
  c_mantenimiento_vehiculos_corporativos: {
    firma_mecanico: "Firma del mecánico",
  },
  c_bitacora_vehiculo_detenido: {
    firma_responsable: "Firma del responsable",
  },
};

const MANT_ARMAS_SUB_LABELS: Record<string, string> = {
  firma: "Firma",
  observaciones: "Observaciones",
  calibre: "Calibre",
  marca: "Marca",
  modelo: "Modelo",
  serie: "Serie",
  numero: "Número",
};

const EMPLEADO_LOOKUP_PROPS = new Set([
  "empleadoAusente_id",
  "empleadoReemplaza_id",
  "responsable_id",
  "empleado_id",
]);

const VEHICULO_LOOKUP_PROPS = new Set([
  "vehiculo_id",
]);

const PLAZA_LOOKUP_PROPS = new Set([
  "plaza_id",
  "plazaAusente_id",
  "plazaReemplaza_id",
]);

type IdCollector = {
  empresa: Set<number>;
  cliente: Set<number>;
  division: Set<number>;
  contrato: Set<number>;
  corpo: Set<number>;
  puesto: Set<number>;
  empleado: Set<number>;
  articuloNomenclador: Set<number>;
  categoria: Set<number>;
  ejecutivoCuenta: Set<number>;
  plaza: Set<number>;
  vehiculoCorporativo: Set<number>;
};

type LookupMaps = {
  empresa: Map<number, string>;
  cliente: Map<number, string>;
  division: Map<number, string>;
  contrato: Map<number, string>;
  corpo: Map<number, string>;
  puesto: Map<number, string>;
  empleado: Map<number, string>;
  articuloNomenclador: Map<number, string>;
  categoria: Map<number, string>;
  ejecutivoCuenta: Map<number, string>;
  plaza: Map<number, string>;
  vehiculoCorporativo: Map<number, string>;
};

function createIdCollector(): IdCollector {
  return {
    empresa: new Set(),
    cliente: new Set(),
    division: new Set(),
    contrato: new Set(),
    corpo: new Set(),
    puesto: new Set(),
    empleado: new Set(),
    articuloNomenclador: new Set(),
    categoria: new Set(),
    ejecutivoCuenta: new Set(),
    plaza: new Set(),
    vehiculoCorporativo: new Set(),
  };
}

function addPositiveId(set: Set<number>, value: unknown) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) set.add(Math.floor(n));
}

function collectIdsFromValue(value: unknown, prop: string | null, collector: IdCollector) {
  if (value == null) return;
  if (prop === "categoria_id") {
    addPositiveId(collector.categoria, value);
    return;
  }
  if (prop === "ejecutivo_cuenta") {
    addPositiveId(collector.ejecutivoCuenta, value);
    return;
  }
  if (prop && EMPLEADO_LOOKUP_PROPS.has(prop)) {
    addPositiveId(collector.empleado, value);
    return;
  }
  if (prop && PLAZA_LOOKUP_PROPS.has(prop)) {
    addPositiveId(collector.plaza, value);
    return;
  }
  if (prop === "sucursal_id") {
    addPositiveId(collector.corpo, value);
    return;
  }
  if (prop && VEHICULO_LOOKUP_PROPS.has(prop)) {
    addPositiveId(collector.vehiculoCorporativo, value);
    return;
  }
  if (prop && STRUCTURE_ID_PROPS.has(prop)) {
    if (prop === "created_by") addPositiveId(collector.empleado, value);
    else if (prop === "empresa_id") addPositiveId(collector.empresa, value);
    else if (prop === "cliente_id") addPositiveId(collector.cliente, value);
    else if (prop === "division_id") addPositiveId(collector.division, value);
    else if (prop === "contrato_id") addPositiveId(collector.contrato, value);
    else if (prop === "corpo_id") addPositiveId(collector.corpo, value);
    else if (prop === "puesto_id") addPositiveId(collector.puesto, value);
    return;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      for (const item of value) collectIdsFromObject(item, collector);
      return;
    }
    collectIdsFromObject(value as Record<string, unknown>, collector);
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        collectIdsFromValue(JSON.parse(trimmed), prop, collector);
      } catch {
        /* ignore */
      }
    }
  }
}

function collectIdsFromObject(obj: Record<string, unknown>, collector: IdCollector) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === "tipo_id") addPositiveId(collector.articuloNomenclador, v);
    else if (k === "categoria_id") addPositiveId(collector.categoria, v);
    else if (k === "ejecutivo_cuenta") addPositiveId(collector.ejecutivoCuenta, v);
    else if (EMPLEADO_LOOKUP_PROPS.has(k)) addPositiveId(collector.empleado, v);
    else if (PLAZA_LOOKUP_PROPS.has(k)) addPositiveId(collector.plaza, v);
    else if (k === "sucursal_id") addPositiveId(collector.corpo, v);
    else if (VEHICULO_LOOKUP_PROPS.has(k)) addPositiveId(collector.vehiculoCorporativo, v);
    else if (k === "agregados" || k === "puestos_vinculados" || k === "omitidos_ya_vinculados") {
      if (Array.isArray(v)) v.forEach((id) => addPositiveId(collector.puesto, id));
    }
    else if (STRUCTURE_ID_PROPS.has(k)) collectIdsFromValue(v, k, collector);
    else if (v != null && typeof v === "object") collectIdsFromValue(v, k, collector);
    else if (typeof v === "string" && (v.trim().startsWith("{") || v.trim().startsWith("["))) {
      collectIdsFromValue(v, k, collector);
    }
  }
}

function collectIdsFromCambios(rows: any[]): IdCollector {
  const collector = createIdCollector();
  for (const row of rows) {
    let parsed: any[] = [];
    try {
      parsed = row?.cambios ? JSON.parse(row.cambios) : [];
    } catch {
      parsed = [];
    }
    if (!Array.isArray(parsed)) continue;
    for (const c of parsed) {
      collectIdsFromValue(c?.before, c?.prop ?? null, collector);
      collectIdsFromValue(c?.after, c?.prop ?? null, collector);
    }
  }
  return collector;
}

async function findManyNames(
  req: NextRequest,
  table: string,
  ids: number[],
  labelFn: (row: any) => string,
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const rows = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table,
      operation: "findMany",
      where: { id: { in: ids } },
    },
  });
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    map.set(id, labelFn(row));
  }
  return map;
}

async function loadLookups(req: NextRequest, collector: IdCollector): Promise<LookupMaps> {
  const [empresa, cliente, division, contrato, corpo, puesto, empleado, articuloNomenclador, categoria, ejecutivoCuenta, plaza, vehiculoCorporativo] = await Promise.all([
    findManyNames(req, "e_estructura_empresa", [...collector.empresa], (r) => String(r?.nombre ?? "").trim() || `Empresa #${r.id}`),
    findManyNames(req, "e_estructura_cliente", [...collector.cliente], (r) => String(r?.nombre ?? "").trim() || `Cliente #${r.id}`),
    findManyNames(req, "n_division", [...collector.division], (r) => String(r?.nombre ?? "").trim() || `División #${r.id}`),
    findManyNames(req, "e_estructura_contrato", [...collector.contrato], (r) => String(r?.nombre ?? "").trim() || `Contrato #${r.id}`),
    findManyNames(req, "e_estructura_sucursal", [...collector.corpo], (r) => {
      const nro = r?.nro_sucursal != null ? String(r.nro_sucursal).trim() : "";
      const nombre = String(r?.nombre ?? "").trim();
      if (nro && nombre) return `${nro} - ${nombre}`;
      return nombre || nro || `Corpo #${r.id}`;
    }),
    findManyNames(req, "e_estructura_puesto", [...collector.puesto], (r) => {
      const codigo = r?.codigo != null ? String(r.codigo).trim() : "";
      const nombre = String(r?.nombre ?? "").trim();
      if (codigo && nombre) return `${codigo} - ${nombre}`;
      return nombre || codigo || `Puesto #${r.id}`;
    }),
    findManyNames(req, "c_empleado", [...collector.empleado], (r) => {
      const nombre = [r?.nombre, r?.primer_apellido, r?.segundo_apellido].filter(Boolean).join(" ").trim();
      const cedula = r?.cedula ? ` (${r.cedula})` : "";
      return (nombre || `Empleado #${r.id}`) + cedula;
    }),
    findManyNames(req, "n_articulo_corpo_puesto", [...collector.articuloNomenclador], (r) => String(r?.nombre ?? "").trim() || `Artículo #${r.id}`),
    findManyNames(req, "n_novedades_categoria", [...collector.categoria], (r) => String(r?.nombre ?? "").trim() || `Categoría #${r.id}`),
    findManyNames(req, "n_ejecutivo_cuenta", [...collector.ejecutivoCuenta], (r) => String(r?.nombre ?? "").trim() || `Ejecutivo #${r.id}`),
    findManyNames(req, "e_estructura_plazas", [...collector.plaza], (r) => {
      const codigo = r?.codigo_plaza != null ? String(r.codigo_plaza).trim() : "";
      const nombre = String(r?.nombre ?? "").trim();
      if (codigo && nombre) return `${codigo} - ${nombre}`;
      return nombre || codigo || `Plaza #${r.id}`;
    }),
    findManyNames(req, "c_vehiculos_corporativos", [...collector.vehiculoCorporativo], (r) => {
      const placa = String(r?.placa ?? "").trim();
      const modelo = String(r?.modelo ?? "").trim();
      if (placa && modelo) return `${placa} - ${modelo}`;
      return placa || modelo || `Vehículo #${r.id}`;
    }),
  ]);

  return { empresa, cliente, division, contrato, corpo, puesto, empleado, articuloNomenclador, categoria, ejecutivoCuenta, plaza, vehiculoCorporativo };
}

function propLabel(tabla: string, prop: string): string {
  if (prop === "__created__") return "Registro creado";
  if (prop === "__deleted__") return "Registro eliminado";
  if (prop === "__updated__") return "Registro actualizado";
  if (prop === "__puestos_agregados__") return "Puestos vinculados al manual";
  if (prop.startsWith("mant_armas_form.")) {
    const sub = prop.slice("mant_armas_form.".length);
    return MANT_ARMAS_SUB_LABELS[sub] ?? sub.replace(/_/g, " ");
  }
  return TABLE_PROP_LABELS[tabla]?.[prop] ?? COMMON_PROP_LABELS[prop] ?? prop.replace(/_/g, " ");
}

/** Campos de negocio que siempre son solo fecha (sin hora en pantalla). */
const DATE_ONLY_PROPS = new Set([
  "fecha",
  "fecha_entrega",
  "fecha_recibe",
  "fecha_limite",
  "endDate",
  "fecha_salida",
  "fecha_entrada",
  "fecha_fin",
  "fecha_solucion",
  "fecha_identificacion",
]);

function isDateOnlyValue(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  const ymd = s.includes("T") ? s.split("T")[0] : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const timePart = s.includes("T") ? s.split("T")[1]?.split(".")[0]?.split("Z")[0] ?? "" : "";
  if (!timePart) return true;
  return timePart === "00:00:00" || timePart === "12:00:00";
}

function formatDateOnlyDisplay(value: unknown): string {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const ymd = s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}

function formatDateTimeDisplay(value: unknown): string {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("es-CR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  } catch {
    /* ignore */
  }
  return s;
}

function formatDateValue(prop: string, value: unknown): string {
  if (DATE_ONLY_PROPS.has(prop) || isDateOnlyValue(value)) {
    return formatDateOnlyDisplay(value);
  }
  return formatDateTimeDisplay(value);
}

function formatTimeDisplay(value: unknown): string {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  if (s.includes("T")) {
    const part = s.split("T")[1]?.split(".")[0]?.slice(0, 5);
    if (part && /^\d{2}:\d{2}$/.test(part)) return part;
  }
  return "—";
}

function resolveStructureId(prop: string, value: unknown, lookups: LookupMaps): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const id = Math.floor(n);
  if (prop === "empresa_id") return lookups.empresa.get(id) ?? null;
  if (prop === "cliente_id") return lookups.cliente.get(id) ?? null;
  if (prop === "division_id") return lookups.division.get(id) ?? null;
  if (prop === "contrato_id") return lookups.contrato.get(id) ?? null;
  if (prop === "corpo_id") return lookups.corpo.get(id) ?? null;
  if (prop === "puesto_id") return lookups.puesto.get(id) ?? null;
  if (prop === "created_by") return lookups.empleado.get(id) ?? null;
  if (prop === "categoria_id") return lookups.categoria.get(id) ?? null;
  if (prop === "ejecutivo_cuenta") return lookups.ejecutivoCuenta.get(id) ?? null;
  if (prop === "plaza_id" || prop === "plazaAusente_id" || prop === "plazaReemplaza_id") {
    return lookups.plaza.get(id) ?? null;
  }
  if (prop === "empleadoAusente_id" || prop === "empleadoReemplaza_id" || prop === "responsable_id" || prop === "empleado_id") {
    return lookups.empleado.get(id) ?? null;
  }
  if (prop === "sucursal_id") return lookups.corpo.get(id) ?? null;
  if (prop === "vehiculo_id") return lookups.vehiculoCorporativo.get(id) ?? null;
  return null;
}

function formatDetalleProductos(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin productos";
  return list.map((d, idx) => {
    const descripcion = d?.descripcion ?? "—";
    const unidad = d?.unidad_medida ?? "—";
    const cantidad = d?.cantidad ?? "—";
    const devolucion = d?.devolucion ?? "—";
    const faltantes = d?.faltantes ?? "—";
    return `${idx + 1}. ${descripcion}\n   Unidad: ${unidad}, Cantidad: ${cantidad}\n   Devolución: ${devolucion}, Faltantes: ${faltantes}`;
  }).join("\n\n");
}

function formatParticipantes(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin participantes";
  return list.map((p, idx) => {
    const nombre = p?.nombre ?? "—";
    const puesto = p?.puesto ?? p?.cedula ?? "—";
    const firma = p?.firma ? "Con firma" : "Sin firma";
    return `${idx + 1}. ${nombre} (Puesto: ${puesto}, ${firma})`;
  }).join("\n");
}

function formatAcuerdos(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin acuerdos";
  return list.map((a, idx) => {
    const texto = a?.texto ?? "—";
    const responsable = String(a?.responsable ?? "").trim() || "—";
    const fechaLimiteRaw = String(a?.fecha_limite ?? "").trim();
    const fechaLimite = fechaLimiteRaw ? formatDateOnlyDisplay(fechaLimiteRaw) : "—";
    return `${idx + 1}. ${texto}\n   Responsable: ${responsable}, Fecha límite: ${fechaLimite}`;
  }).join("\n");
}

function formatTemas(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin temas";
  return list.map((t, idx) => `${idx + 1}. ${String(t ?? "").trim() || "—"}`).join("\n");
}

function formatActividades(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin actividades";
  return list.map((a, idx) => {
    const pregunta = a?.pregunta ?? "—";
    const respuesta = a?.respuesta ?? "—";
    const observaciones = a?.observaciones ?? "Sin observaciones";
    return `${idx + 1}. ${pregunta}\n   Respuesta: ${respuesta}\n   Observaciones: ${observaciones}`;
  }).join("\n\n");
}

function formatInventario(raw: unknown, lookups: LookupMaps): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin inventario";
  return list.map((i, idx) => {
    const activos = i?.activos_equipos ?? "—";
    const tipoId = Number(i?.tipo_id);
    const tipoNombre = (i?.tipo_nombre && String(i.tipo_nombre).trim())
      || (Number.isFinite(tipoId) && tipoId > 0 ? lookups.articuloNomenclador.get(tipoId) : null)
      || "—";
    return `${idx + 1}. ${activos} (Tipo: ${tipoNombre})\n   N° activo: ${i?.numero_activo ?? "—"}, Serie: ${i?.numero_serie ?? "—"}\n   Marca: ${i?.marca ?? "—"}, Modelo: ${i?.modelo ?? "—"}\n   Descripción: ${i?.descripcion ?? "—"}`;
  }).join("\n\n");
}

function vulnerabilityLevelLabel(value: unknown): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "alta") return "Alta";
  if (v === "media") return "Media";
  if (v === "baja") return "Baja";
  return v || "—";
}

function formatBoleta(raw: unknown): string {
  let sections: any[] = [];
  if (Array.isArray(raw)) sections = raw;
  else if (typeof raw === "string") {
    try { sections = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(sections) || sections.length === 0) return "Sin datos de boleta";
  const lines: string[] = [];
  for (const section of sections) {
    lines.push(`--- ${section?.title ?? "Sección"} ---`);
    if (section?.key === "porcentaje_vulnerabilidad") {
      lines.push(`  Nivel seleccionado: ${vulnerabilityLevelLabel(section?.vulnerabilityLevel)}`);
      continue;
    }
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const item of items) {
      const answer = item?.answer === "si" ? "Sí" : item?.answer === "no" ? "No" : "Sin responder";
      lines.push(`  - ${item?.label ?? "Pregunta"}: ${answer}`);
    }
  }
  return lines.join("\n").trim();
}

function formatMetricas(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin métricas";
  return list.map((m, idx) => `${idx + 1}. ${String(m ?? "").trim() || "—"}`).join("\n");
}

function formatFrequency(raw: unknown): string {
  let parsed: any = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return raw; }
  }
  if (!parsed || typeof parsed !== "object") return String(raw ?? "—");
  const labels: Record<string, string> = {
    title: "Título",
    type: "Tipo",
    interval: "Intervalo",
    unit: "Unidad",
    weekday: "Día de semana",
    weekdays: "Días seleccionados",
    weekOrdinal: "Ordinal semanal",
    monthOption: "Opción mensual",
    month: "Mes",
    day: "Día",
    endType: "Finalización",
    endDate: "Fecha de finalización",
    schedule: "Horario",
  };
  const ordered = ["title", "type", "interval", "unit", "weekday", "weekdays", "weekOrdinal", "monthOption", "month", "day", "endType", "endDate", "schedule"];
  const lines: string[] = [];
  for (const key of ordered) {
    if (parsed[key] === undefined || parsed[key] === null || parsed[key] === "") continue;
    const rawVal = parsed[key];
    const val =
      key === "endDate"
        ? formatDateOnlyDisplay(rawVal)
        : Array.isArray(rawVal)
          ? rawVal.join(", ")
          : String(rawVal);
    lines.push(`${labels[key] || key}: ${val}`);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (ordered.includes(key)) continue;
    const shown =
      key === "endDate"
        ? formatDateOnlyDisplay(value)
        : Array.isArray(value)
          ? value.join(", ")
          : String(value);
    lines.push(`${labels[key] || key}: ${shown}`);
  }
  return lines.join("\n") || "—";
}

function resolvePuestoIdsList(ids: unknown, lookups: LookupMaps): string {
  const list = Array.isArray(ids) ? ids : [];
  if (list.length === 0) return "Ninguno";
  return list
    .map((raw) => {
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) return String(raw ?? "—");
      return lookups.puesto.get(Math.floor(id)) ?? `Puesto #${id}`;
    })
    .join("\n");
}

function enrichPuestosAgregadosEntry(c: any, lookups: LookupMaps): EnrichedCambioEntry {
  const beforeObj = c?.before && typeof c.before === "object" ? c.before as Record<string, unknown> : {};
  const afterObj = c?.after && typeof c.after === "object" ? c.after as Record<string, unknown> : {};
  const beforeLinked = resolvePuestoIdsList(beforeObj.puestos_vinculados, lookups);
  const added = resolvePuestoIdsList(afterObj.agregados, lookups);
  const skipped = resolvePuestoIdsList(afterObj.omitidos_ya_vinculados, lookups);
  return {
    prop: "__puestos_agregados__",
    prop_label: propLabel("e_manual_puesto", "__puestos_agregados__"),
    kind: "updated",
    diff_lines: [
      { label: "Puestos ya vinculados", before: beforeLinked, after: beforeLinked },
      { label: "Puestos agregados", before: "—", after: added },
      { label: "Puestos omitidos (ya vinculados)", before: "—", after: skipped },
    ],
  };
}

function formatTurnoDisplay(value: unknown): string {
  const val = String(value ?? "").trim().toUpperCase();
  if (!val) return "—";
  if (val === "D" || val === "DIURNO") return "Diurno";
  if (val === "M" || val === "MIXTO") return "Mixto";
  if (val === "N" || val === "NOCTURNO") return "Nocturno";
  return String(value);
}

function formatRelevanciaDisplay(value: unknown): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "alta") return "Alta";
  if (v === "media") return "Media";
  if (v === "baja") return "Baja";
  return String(value ?? "—");
}

function formatColaboradores(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "No hay colaboradores";
  return list.map((c, idx) => {
    const nombre = c?.nombre_colaborador ?? c?.nombre ?? "—";
    const cedula = c?.cedula ?? "—";
    const entrada = c?.entrada ?? "—";
    const salida = c?.salida ?? "—";
    const sustituto = c?.nombre_sustituto ? ` (Sustituto: ${c.nombre_sustituto} - ${c.cedula_sustituto ?? "—"})` : "";
    const firmaComentario = c?.firma_comentario ? "Sí" : "No";
    const firmaSustituto = c?.firma_sustituto ? "Sí" : "No";
    return `${idx + 1}. ${nombre} (Cédula: ${cedula})\n   Entrada: ${entrada}, Salida: ${salida}\n   Firma comentario: ${firmaComentario}, Firma sustituto: ${firmaSustituto}${sustituto}`;
  }).join("\n\n");
}

function formatSiNoNa(value: unknown): string {
  const v = String(value ?? "").trim();
  if (v === "SI") return "Sí";
  if (v === "NO") return "No";
  if (v === "NA") return "N/A";
  return v || "—";
}

function formatTemasInduccionGeneral(raw: unknown): string {
  let parsed: any = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return String(raw); }
  }
  if (!parsed || typeof parsed !== "object") return "Sin temas";
  const lines: string[] = [];
  if (Array.isArray(parsed.sections)) {
    for (const sec of parsed.sections) {
      const title = String(sec?.text ?? sec?.id ?? "Sección").trim();
      const items = Array.isArray(sec?.items) ? sec.items : [];
      const checked = items.filter((it: any) => it?.checked);
      if (checked.length > 0) {
        lines.push(title);
        for (const it of checked) {
          lines.push(`  • ${String(it?.text ?? it?.id ?? "—")}`);
        }
      } else if (items.length === 1 && items[0]?.checked) {
        lines.push(title);
      }
    }
  }
  if (Array.isArray(parsed.selected) && parsed.selected.length > 0) {
    parsed.selected.forEach((t: any, idx: number) => {
      lines.push(`${idx + 1}. ${String(t?.text ?? t?.id ?? "—")}`);
    });
  }
  if (Array.isArray(parsed.leafs)) {
    for (const l of parsed.leafs) {
      if (l?.checked) lines.push(`• ${String(l?.text ?? l?.id ?? "—")}`);
    }
  }
  return lines.join("\n").trim() || "Sin temas seleccionados";
}

function formatPersonasInduccion(raw: unknown, label: string): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return `No hay ${label}`;
  if (!Array.isArray(list) || list.length === 0) return `No hay ${label}`;
  return list.map((p, idx) => {
    const nombre = p?.nombre ?? "—";
    const cedula = p?.cedula ?? "—";
    const puesto = p?.puesto_text ?? "—";
    const firma = p?.firma ? "Sí" : "No";
    return `${idx + 1}. ${nombre} (Cédula: ${cedula}, Puesto: ${puesto}, Firma: ${firma})`;
  }).join("\n");
}

function formatTemasDesarrollados(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "No hay temas desarrollados";
  return list.map((t, idx) => {
    const tema = t?.tema ?? "—";
    const respuesta = formatSiNoNa(t?.respuesta);
    const comentarios = t?.comentarios ?? "—";
    return `${idx + 1}. ${tema}\n   Respuesta: ${respuesta}\n   Comentarios: ${comentarios}`;
  }).join("\n\n");
}

function formatAspectosEspecificos(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "No hay aspectos específicos";
  return list.map((a, idx) => {
    const aspecto = a?.aspecto ?? "—";
    const respuesta = formatSiNoNa(a?.respuesta);
    const comentarios = a?.comentarios ?? "—";
    return `${idx + 1}. ${aspecto}\n   Respuesta: ${respuesta}\n   Comentarios: ${comentarios}`;
  }).join("\n\n");
}

function formatParticipantesInduccionRecorrido(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "No hay participantes";
  return list.map((p, idx) => {
    const nombre = p?.nombre_completo ?? p?.nombre ?? "—";
    const cedula = p?.cedula ?? "—";
    const firma = p?.firma ? "Sí" : "No";
    return `${idx + 1}. ${nombre} (Cédula: ${cedula}, Firma: ${firma})`;
  }).join("\n");
}

function formatInformacionGeneralBitacora(raw: unknown): string {
  if (!raw) return "—";
  try {
    const info = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(info)) return String(raw);
    const partes: string[] = [];
    for (const item of info) {
      if (item && typeof item === "object" && item.key && item.label && item.kind !== "signature" && item.value) {
        partes.push(`${item.label}: ${item.value}`);
      }
    }
    return partes.length > 0 ? partes.join(" | ") : "Sin información";
  } catch {
    return String(raw);
  }
}

function formatInformacionRevisionBitacora(raw: unknown): string {
  if (!raw) return "—";
  try {
    const info = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(info)) return String(raw);
    const partes: string[] = [];
    for (const item of info) {
      if (!item || typeof item !== "object") continue;
      if (item.kind === "heading") {
        partes.push(`[${item.label}]`);
      } else if (item.key && item.label) {
        const value = item.value || "";
        const obs = item.observation ? ` (Obs: ${item.observation})` : "";
        partes.push(`${item.label}: ${value}${obs}`);
      }
    }
    return partes.length > 0 ? partes.join(" | ") : "Sin información";
  } catch {
    return String(raw);
  }
}

function formatMovimientosBitacora(raw: unknown): string {
  if (!raw) return "—";
  try {
    const movs = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(movs)) return String(raw);
    const partes: string[] = [];
    for (const mov of movs) {
      if (!mov || typeof mov !== "object") continue;
      const movParts: string[] = [];
      if (mov.movimiento) movParts.push(`Mov: ${mov.movimiento}`);
      if (mov.fecha) movParts.push(`Fecha: ${mov.fecha}`);
      if (mov.hora) movParts.push(`Hora: ${mov.hora}`);
      if (mov.realizado_por) movParts.push(`Por: ${mov.realizado_por}`);
      if (mov.autorizado_por) movParts.push(`Autorizado: ${mov.autorizado_por}`);
      if (movParts.length > 0) partes.push(`{${movParts.join(", ")}}`);
    }
    return partes.length > 0 ? partes.join(" | ") : "Sin movimientos";
  } catch {
    return String(raw);
  }
}

function shouldShowChecklistInputTitle(inputTitle: unknown, subsectionTitle: unknown): boolean {
  const t = String(inputTitle ?? "").trim();
  const st = String(subsectionTitle ?? "").trim();
  if (!t) return false;
  if (st && t.toLowerCase() === st.toLowerCase()) return false;
  return true;
}

function formatEvaluacionChecklist(raw: unknown): string {
  let evalData: any[] = [];
  if (Array.isArray(raw)) evalData = raw;
  else if (typeof raw === "string") {
    try { evalData = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(evalData)) return String(raw ?? "—");
  const lines: string[] = [];
  for (const section of evalData) {
    if (section?.title) lines.push(`\n${section.title}:`);
    const subsections = Array.isArray(section?.subsections) ? section.subsections : [];
    for (const subsection of subsections) {
      if (subsection?.title) lines.push(`  - ${subsection.title}`);
      const inputs = Array.isArray(subsection?.inputs) ? subsection.inputs : [];
      for (const input of inputs) {
        let val = input?.value ?? "";
        if (input?.type === "checkbox") val = val === "true" ? "Marcado" : "No marcado";
        else if (input?.type === "photo") {
          val = input?.value || input?.file_name || input?.localFileName ? "Imagen adjunta" : "—";
        }
        if (shouldShowChecklistInputTitle(input?.title, subsection?.title)) {
          lines.push(`    • ${String(input.title).trim()}: ${val}`);
        } else {
          lines.push(`    • ${val}`);
        }
      }
    }
  }
  return lines.join("\n").trim() || "Sin evaluación";
}

function formatArticulosPuesto(raw: unknown): string {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return String(raw); }
  } else return "—";
  if (!Array.isArray(list) || list.length === 0) return "Sin artículos";
  return list.map((a, idx) => {
    const nombre = a?.nombre ?? a?.articulo ?? a?.descripcion ?? "—";
    const cantidad = a?.cantidad ?? a?.cantidad_entregada ?? "—";
    const estado = a?.estado ?? a?.condicion ?? "";
    const extra = estado ? `, Estado: ${estado}` : "";
    return `${idx + 1}. ${nombre} (Cantidad: ${cantidad}${extra})`;
  }).join("\n");
}

function formatEvaluacionesEncuesta(raw: unknown): string {
  let parsed: any = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return String(raw); }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.form)) {
    const lines: string[] = [];
    if (typeof parsed.know_process === "boolean") {
      lines.push(`Conoce el proceso: ${parsed.know_process ? "Sí" : "No"}`);
    }
    for (const section of parsed.form) {
      if (section?.title) lines.push(`\n${section.title}:`);
      const questions = Array.isArray(section?.questions) ? section.questions : [];
      for (const q of questions) {
        const val = q?.apply ? String(q?.value ?? "—") : "No aplica";
        lines.push(`  - ${q?.question ?? "Pregunta"}: ${val}`);
      }
    }
    return lines.join("\n").trim() || "Sin evaluaciones";
  }
  if (Array.isArray(parsed)) {
    return parsed.map((r, i) => `${i + 1}. ${r?.question ?? "Pregunta"}: ${r?.value ?? "—"}`).join("\n");
  }
  return String(raw ?? "—");
}

function formatMantArmasFormValue(raw: unknown): string {
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return String(raw); }
  }
  if (!obj || typeof obj !== "object") return String(raw ?? "—");
  const skip = new Set(["foto_antes", "foto_despues", "fotoAntes", "fotoDespues", "foto_antes_nombre", "foto_despues_nombre"]);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (skip.has(k) || k.toLowerCase().includes("foto_")) continue;
    if (k === "firma") {
      lines.push(`${MANT_ARMAS_SUB_LABELS.firma}: ${v ? "Registrada" : "—"}`);
      continue;
    }
    const label = MANT_ARMAS_SUB_LABELS[k] ?? k.replace(/_/g, " ");
    lines.push(`${label}: ${v == null || v === "" ? "—" : String(v)}`);
  }
  return lines.join("\n") || "—";
}

function fieldKind(prop: string): EnrichedCambioField["kind"] {
  if (DIGITAL_SIGNATURE_PROPS.has(prop)) return "signature_digital";
  if (IMAGE_SIGNATURE_PROPS.has(prop)) return "signature_image";
  if (prop.endsWith(".firma") || (prop.includes("mant_armas") && prop.endsWith("firma"))) {
    return "signature_image";
  }
  return "text";
}

function formatScalarValue(tabla: string, prop: string, value: unknown, lookups: LookupMaps): { display: string; kind: EnrichedCambioField["kind"]; raw?: string | null } {
  if (value === null || value === undefined || value === "") {
    return { display: "—", kind: fieldKind(prop) };
  }
  if (value === "[base64]") {
    return { display: "Firma registrada", kind: fieldKind(prop) };
  }
  if (typeof value === "boolean") {
    return { display: value ? "Sí" : "No", kind: "text" };
  }

  const resolved = resolveStructureId(prop, value, lookups);
  if (resolved) return { display: resolved, kind: "text" };

  if (DIGITAL_SIGNATURE_PROPS.has(prop) || IMAGE_SIGNATURE_PROPS.has(prop) || prop.endsWith(".firma")) {
    const raw = String(value);
    return { display: DIGITAL_SIGNATURE_PROPS.has(prop) ? "Firma digital registrada" : "Firma registrada", kind: fieldKind(prop), raw };
  }

  if (prop === "imagen_antes" || prop === "imagen_despues" || prop === "foto_cedula" || prop === "file_name") {
    const s = String(value).trim();
    if (!s) return { display: "—", kind: "text" };
    return { display: "Archivo o imagen registrado", kind: "text" };
  }

  if (prop === "detalle" && tabla === "c_acta_entre_producto") return { display: formatDetalleProductos(value), kind: "complex" };
  if (prop === "participantes" && tabla === "c_registro_induccion_recorrido") {
    return { display: formatParticipantesInduccionRecorrido(value), kind: "complex" };
  }
  if (prop === "participantes") return { display: formatParticipantes(value), kind: "complex" };
  if (prop === "acuerdos") return { display: formatAcuerdos(value), kind: "complex" };
  if (prop === "temas_a_tratar" && tabla === "c_registro_induccion_general") {
    return { display: formatTemasInduccionGeneral(value), kind: "complex" };
  }
  if (prop === "temas_a_tratar") return { display: formatTemas(value), kind: "complex" };
  if (prop === "temas_desarrollados") return { display: formatTemasDesarrollados(value), kind: "complex" };
  if (prop === "aspectos_especificos") return { display: formatAspectosEspecificos(value), kind: "complex" };
  if (prop === "capacitadores") return { display: formatPersonasInduccion(value, "capacitadores"), kind: "complex" };
  if (prop === "colaboradores" && tabla === "c_registro_induccion_general") {
    return { display: formatPersonasInduccion(value, "colaboradores"), kind: "complex" };
  }
  if (prop === "informacion_general") return { display: formatInformacionGeneralBitacora(value), kind: "complex" };
  if (prop === "informacion_revision") return { display: formatInformacionRevisionBitacora(value), kind: "complex" };
  if (prop === "movimientos_vehiculos") return { display: formatMovimientosBitacora(value), kind: "complex" };
  if (prop === "actividades") return { display: formatActividades(value), kind: "complex" };
  if (prop === "inventario") return { display: formatInventario(value, lookups), kind: "complex" };
  if (prop === "boleta") return { display: formatBoleta(value), kind: "complex" };
  if (prop === "metricas_vulnerablidad") return { display: formatMetricas(value), kind: "complex" };
  if (prop === "frecuencia") return { display: formatFrequency(value), kind: "complex" };
  if (prop === "colaboradores") return { display: formatColaboradores(value), kind: "complex" };
  if (prop === "evaluacion") return { display: formatEvaluacionChecklist(value), kind: "complex" };
  if (prop === "articulos_puesto") return { display: formatArticulosPuesto(value), kind: "complex" };
  if (prop === "evaluaciones") return { display: formatEvaluacionesEncuesta(value), kind: "complex" };
  if (prop === "mant_armas_form") return { display: formatMantArmasFormValue(value), kind: "complex" };

  if (prop === "turno") return { display: formatTurnoDisplay(value), kind: "text" };
  if (prop === "relevancia") return { display: formatRelevanciaDisplay(value), kind: "text" };
  if (prop === "is_modified") {
    const b = value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
    return { display: b ? "Sí" : "No", kind: "text" };
  }

  if (prop === "es_revision_equipo") {
    const b = value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
    return { display: b ? "Sí (Inventario)" : "No (Actividad normal)", kind: "text" };
  }

  if (prop === "tipo" && tabla === "c_apertura_cierre_puesto") {
    const t = String(value).trim();
    if (t.toLowerCase() === "apertura") return { display: "Apertura", kind: "text" };
    if (t.toLowerCase() === "cierre") return { display: "Cierre", kind: "text" };
    return { display: t, kind: "text" };
  }

  if (
    prop === "fecha" ||
    prop === "fecha_inicio" ||
    prop === "fecha_fin" ||
    prop === "fecha_entrega" ||
    prop === "fecha_recibe" ||
    prop === "fecha_limite" ||
    prop === "fecha_queja" ||
    prop === "fecha_revision" ||
    prop.endsWith("_fecha")
  ) {
    return { display: formatDateValue(prop, value), kind: "text" };
  }
  if (prop.includes("hora")) {
    return { display: formatTimeDisplay(value), kind: "text" };
  }

  if (typeof value === "object") {
    return { display: JSON.stringify(value, null, 2), kind: "complex" };
  }

  if (typeof value === "string" && (value.trim().startsWith("{") || value.trim().startsWith("["))) {
    try {
      return formatScalarValue(tabla, prop, JSON.parse(value), lookups);
    } catch {
      return { display: value, kind: "text" };
    }
  }

  return { display: String(value), kind: "text" };
}

function enrichObjectFields(tabla: string, obj: Record<string, unknown>, lookups: LookupMaps): EnrichedCambioField[] {
  const fields: EnrichedCambioField[] = [];
  for (const [prop, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const formatted = formatScalarValue(tabla, prop, value, lookups);
    fields.push({
      prop,
      prop_label: propLabel(tabla, prop),
      kind: formatted.kind,
      display: formatted.display,
      raw: formatted.raw ?? null,
    });
  }
  return fields;
}

function enrichCambioEntry(tabla: string, c: any, lookups: LookupMaps): EnrichedCambioEntry {
  const prop = String(c?.prop ?? "-");

  if (prop === "__puestos_agregados__") {
    return enrichPuestosAgregadosEntry(c, lookups);
  }

  if (prop === "__created__" && c?.after && typeof c.after === "object") {
    return {
      prop,
      prop_label: propLabel(tabla, prop),
      kind: "created",
      fields: enrichObjectFields(tabla, c.after as Record<string, unknown>, lookups),
    };
  }

  if (prop === "__deleted__" && c?.before && typeof c.before === "object") {
    return {
      prop,
      prop_label: propLabel(tabla, prop),
      kind: "deleted",
      fields: enrichObjectFields(tabla, c.before as Record<string, unknown>, lookups),
    };
  }

  if (prop === "__updated__" && c?.before && c?.after && typeof c.before === "object" && typeof c.after === "object") {
    const before = c.before as Record<string, unknown>;
    const after = c.after as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const diff_lines: EnrichedCambioDiffLine[] = [];
    for (const key of keys) {
      const b = formatScalarValue(tabla, key, before[key], lookups).display;
      const a = formatScalarValue(tabla, key, after[key], lookups).display;
      if (b === a) continue;
      diff_lines.push({ label: propLabel(tabla, key), before: b, after: a });
    }
    return {
      prop,
      prop_label: propLabel(tabla, prop),
      kind: "updated",
      diff_lines,
    };
  }

  const beforeFmt = formatScalarValue(tabla, prop, c?.before, lookups);
  const afterFmt = formatScalarValue(tabla, prop, c?.after, lookups);
  return {
    prop,
    prop_label: propLabel(tabla, prop),
    kind: "field",
    before_display: beforeFmt.display,
    after_display: afterFmt.display,
    fields: afterFmt.kind !== "text"
      ? [{
          prop,
          prop_label: propLabel(tabla, prop),
          kind: afterFmt.kind,
          display: afterFmt.display,
          raw: afterFmt.raw ?? null,
        }]
      : undefined,
  };
}

const SUPPORTED_TABLES = new Set([
  "c_acta_entre_producto",
  "c_agenda_minuta",
  "c_apertura_cierre_puesto",
  "c_boleta_apreciacion_vulnerabilidad",
  "e_actividades",
  "c_puesto_notas",
  "c_checklist_supervision",
  "c_control_asistencia",
  "e_control_documento_entregado_cliente",
  "c_encuesta_cliente",
  "c_articulo_mantenimiento",
  "c_movimientos_articulo_mantenimiento",
  "c_maestro_quejas",
  "e_llave",
  "e_llavero",
  "e_movimiento_llave",
  "e_movimiento_llavero",
  "e_mutuos_acuerdos",
  "e_manual_puesto",
  "c_producto_no_conforme",
  "c_registro_induccion_general",
  "c_registro_induccion_recorrido",
  "e_registro_personas",
  "e_registro_vehiculos",
  "c_vehiculos_corporativos",
  "c_usos_vehiculos_corporativos",
  "c_mantenimiento_vehiculos_corporativos",
  "c_bitacora_vehiculo_detenido",
]);

export async function enrichCambiosAppsModulesRows(
  req: NextRequest,
  tabla: string,
  rows: any[],
): Promise<any[]> {
  if (!SUPPORTED_TABLES.has(tabla) || !Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  const collector = collectIdsFromCambios(rows);
  const lookups = await loadLookups(req, collector);

  return rows.map((row) => {
    let parsed: any[] = [];
    try {
      parsed = row?.cambios ? JSON.parse(row.cambios) : [];
    } catch {
      parsed = [];
    }
    const cambios_display: EnrichedCambioEntry[] = Array.isArray(parsed)
      ? parsed.map((c) => enrichCambioEntry(tabla, c, lookups))
      : [];

    return {
      ...row,
      cambios_display,
    };
  });
}
