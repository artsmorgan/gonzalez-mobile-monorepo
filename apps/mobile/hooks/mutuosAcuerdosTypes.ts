export type MutuoAcuerdo = {
  id: number;
  id_local?: string;
  cliente_id: number;
  corpo_id: number;
  ejecutivo_cuenta: number;
  fecha: string; // ISO o YYYY-MM-DD
  turno: string;
  informacion_oficial_interesado: string; // JSON string (array de strings)
  informacion_oficial_colaborador: string; // JSON string (array de strings)
  motivo: string;
  firma_ejecutivo_cuenta: string; // base64 puro (sin data:) o '' si pendiente
  firma_responsable: string; // hash (QR)
  created_at: string;
  created_by: number;

  // extras (server + UI)
  cliente_nombre?: string | null;
  corpo_nombre?: string | null;
  ejecutivo_nombre?: string | null;
  owned?: boolean;
  synced?: boolean;
};

export type ListMutuosAcuerdosResponse = {
  status: boolean;
  message?: string;
  data: MutuoAcuerdo[];
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


