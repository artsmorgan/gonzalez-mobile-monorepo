export type IncidentInvolucrado = {
  codigo?: string;
  nombre: string;
};

export type IncidentLibroNovedades = {
  numero: string;
  fecha: string; // ISO 8601 string
};

export type IncidentExecutive = {
  id: number;
  name: string;
};

export type IncidentClassification = {
  id: number;
  name: string;
};

export type IncidentFile = {
  id: number;
  name: string;
  original_name: string;
  type: string;
  extension: string;
  // Offline-only (no viene del server)
  id_local?: string;
  base64?: string;
  mimeType?: string;
};

export type IncidentContributionFile = {
  id: number;
  name: string;
  original_name: string;
  type: string;
  extension: string;
  // Offline-only
  id_local?: string;
  base64?: string;
  mimeType?: string;
};

export type IncidentContribution = {
  id: number;
  incidente_id: number;
  empleado_id: number;
  empleado_nombre: string;
  aporte: string;
  rol_aporte: string; // OPERATIVO | SUPERVISOR | ADMINISTRATIVO
  created_at: string; // ISO
  files: IncidentContributionFile[];
  id_local: string; // "" si viene de server
};

export type Incident = {
  id: number;
  estado: boolean;
  ejecutivo: IncidentExecutive;
  fecha_incidente: string; // ISO 8601 string
  fecha_reporte: string; // ISO 8601 string
  nombre_responsable: string;
  clasificacion: IncidentClassification;
  descripcion: string;
  involucrados: IncidentInvolucrado[];
  fecha_libro_novedades: IncidentLibroNovedades;
  nombre_responsable_atencion: string;
  solucion: string;
  fecha_solucion: string; // ISO 8601 string | ""
  fecha_solucion_real: string; // ISO 8601 string | ""
  costo_asociado: string;
  consecutivo_informe: string;
  link_informe: string;
  files: IncidentFile[];
  id_local: string; // "" si viene de server
  owned: boolean; // Indica si el usuario actual puede editar este incidente
  aportes_count?: number;
  aportes?: IncidentContribution[]; // Aportes embebidos en /api/incidents (para offline)
};

export type IncidentClassificationOption = {
  id: number;
  nombre: string;
};

export type ExecutiveOption = {
  id: number;
  nombre: string;
};

export type IncidentsListResponse = {
  status: boolean;
  incidents?: Incident[];
  message?: string;
};

export type IncidentContributionsListResponse = {
  status: boolean;
  contributions?: IncidentContribution[];
  message?: string;
};

export type IncidentsClassificationsResponse = {
  status: boolean;
  classifications?: IncidentClassificationOption[];
  message?: string;
};

export type ExecutivesResponse = {
  status: boolean;
  executives?: ExecutiveOption[];
  message?: string;
};

export type IncidentFileInput = {
  type: 'image' | 'audio' | 'video' | 'document';
  extension: string;
  original_name?: string;
  file_base64: string; // base64 puro o data URI
  mimeType?: string;
};

export type IncidentContributionFileInput = {
  type: 'image' | 'audio' | 'video' | 'document';
  extension: string;
  original_name?: string;
  file_base64: string; // base64 puro o data URI
  mimeType?: string;
};

export type CreateIncidentRequest = {
  marca_id: number;
  empleado_id: number;
  fecha_incidente: string;
  fecha_reporte: string;
  nombre_responsable: string;
  clasificacion_id: number;
  descripcion: string;
  involucrados: string; // JSON string
  fecha_libro_novedades: string; // JSON string
  nombre_responsable_atencion: string;
  archivos: string | IncidentFileInput[]; // server acepta string o array
};

export type CreateIncidentResponse = {
  status: boolean;
  message: string;
  incidentId?: number;
};

export type UpdateIncidentRequest = {
  solucion: string;
  fecha_solucion: string;
  fecha_real_solucion: string;
  costo_asociado: string;
  consecutivo_informe: string;
  link_informe: string;
};

export type BasicResponse = { status: boolean; message: string };

export type CreateIncidentContributionRequest = {
  aporte: string;
  rol_aporte: string;
  archivos?: string | IncidentContributionFileInput[];
};

export type UpdateIncidentContributionRequest = {
  aporte?: string;
  archivos?: string | IncidentContributionFileInput[];
};



