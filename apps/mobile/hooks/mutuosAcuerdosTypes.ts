export type MarcaDiaResumen = {
  id: number;
  fecha?: string | null;
  cliente_id: number | null;
  corpo_id: number | null;
  plaza_id: number | null;
  empleadoFijo_id: number | null;
  /** Jerarquía asociada a la marca (para alta de mutuo acuerdo). */
  empresa_id?: number | null;
  division_id?: number | null;
  contrato_id?: number | null;
  puesto_id?: number | null;
  cliente: string | null;
  sucursal: string | null;
  puesto: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo_turno: string | null;
  tipo_turno_texto: string;
};

export type MutuoAcuerdo = {
  id: number;
  estado?: string | null;
  cliente_id: number;
  corpo_id: number;
  ejecutivo_cuenta: number;
  empleadoReemplaza_id: number;
  plazaReemplaza_id: number;
  marcaDiaReemplaza_id: number;
  reemplaza_acepta: boolean;
  reemplaza_acepta_at?: string | null;
  empleadoAusente_id: number;
  plazaAusente_id: number;
  marcaDiaAusente_id: number;
  ausente_acepta: boolean;
  ausente_acepta_at?: string | null;
  motivo: string;
  firma_ejecutivo_cuenta_manual?: string | null;
  firma_ejecutivo_cuenta_digital: string;
  firma_responsable: string;
  file_name?: string | null;
  created_at: string;
  created_by: number;
  cambio_guardia_id?: number | null;

  cliente_nombre?: string | null;
  corpo_nombre?: string | null;
  ejecutivo_nombre?: string | null;
  empleado_reemplaza_nombre?: string | null;
  empleado_ausente_nombre?: string | null;
  puesto_reemplaza_nombre?: string | null;
  puesto_ausente_nombre?: string | null;
  marca_reemplaza?: MarcaDiaResumen | null;
  marca_ausente?: MarcaDiaResumen | null;

  can_accept_reemplaza?: boolean;
  can_accept_ausente?: boolean;
  can_sign_ejecutivo?: boolean;
  can_reject_ejecutivo?: boolean;
  isActive?: boolean;
};

export type ListMutuosAcuerdosResponse = {
  status: boolean;
  message?: string;
  data: MutuoAcuerdo[];
};

export type ListMarcasMutuoResponse = {
  status: boolean;
  message?: string;
  data: MarcaDiaResumen[];
};

export type MutuoAcuerdoUpsertResponse = {
  status: boolean;
  message?: string;
  data?: MutuoAcuerdo;
};

export type BasicResponse = {
  status: boolean;
  message?: string;
  data?: any;
};
