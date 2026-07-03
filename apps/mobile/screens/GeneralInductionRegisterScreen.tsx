import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from 'react-native-signature-canvas';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import Constants from 'expo-constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
import { formatDateDMY as formatDateDMYValue } from '@/utils/formatDate';
import { useAuth } from '@/contexts/AuthContext';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import {
  createGeneralInductionRegister,
  deleteGeneralInductionRegister,
  deleteGeneralInductionRegisterImage,
  listGeneralInductionRegisterByCorpo,
  updateGeneralInductionRegister,
} from '@/hooks/evaluationFunctions';
import { RootStackParamList } from '../App';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
  girRecordSucursalId,
  readAllGeneralInductionRegisterRecords,
  removeImageFromGeneralInductionCache,
  replaceGeneralInductionRecordsForCorpo,
  upsertGeneralInductionRegisterFromServerData,
  writeAllGeneralInductionRegisterRecords,
  removeGeneralInductionRegisterFromCacheByKeys,
} from '@/hooks/generalInductionRegisterCache';
import { saveFile, getFile, deleteFile, getLocalFileDisplayUri } from '@/hooks/fileStorage';

type GeneralInductionRegisterScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'GeneralInductionRegister'
>;

type MainStructureEmpleadoNode = { id: number; nombre: string; cedula?: string | null };
type MainStructurePlazaNode = { id: number; nombre: string; empleados?: MainStructureEmpleadoNode[] };
type MainStructurePuestoNode = { id: number; nombre: string; plazas: MainStructurePlazaNode[] };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

type TemaNode = { id: string; text: string; children?: TemaNode[] };
type TemaFlatItem = { key: string; id: string; text: string; level: number; isLeaf: boolean };
type TemaSelectedItem = { id: string; text: string };
type TemaSectionLeafItem = { id: string; text: string; checked: boolean };
type TemaSectionItem = { id: string; text: string; items: TemaSectionLeafItem[] };
type TemaData = { flat: TemaFlatItem[]; leafTextById: Record<string, string> };

type PersonaItem = {
  id_local: string;
  nombre: string;
  cedula: string;
  puesto_text: string;
  puesto_id: number | null;
  firma: string | null;
};

type GeneralInductionRegisterRecord = {
  id: number | string;
  id_local: string;
  empresa_id: number;
  cliente_id: number;
  corpo_id: number;
  division_id?: number;
  contrato_id?: number;
  puesto_id?: number;
  division: string;
  fecha: string | null;
  temas_a_tratar: string;
  colaboradores: string;
  capacitadores: string;
  firma_responsable: string;
  created_at: string;
  created_by: string;
  empresa_nombre?: string | null;
  cliente_nombre?: string | null;
  corpo_nombre?: string | null;
  images?: Array<{ id?: number; name?: string; base64?: string; extension?: string; url?: string }>;
  synced?: boolean;
};

type EditingRecord = {
  id: string | null;
  id_local: string;
};

const TEMAS_DIV_AYL: TemaNode[] = [
  { id: '1', text: 'Presentación del Asistente de Operaciones de Aseo y Limpieza' },
  { id: '2', text: 'Nombre de los Supervisores' },
  {
    id: '3',
    text: 'Manual de Puesto',
    children: [
      { id: '3.1', text: 'Información del cliente' },
      { id: '3.2', text: 'Reporte de asistencia' },
      { id: '3.3', text: 'Funciones y Responsabilidades' },
      { id: '3.4', text: 'Servicio al cliente' },
      { id: '3.5', text: 'Código de vestimenta' },
      { id: '3.6', text: 'Uso del teléfono' },
      { id: '3.7', text: 'Confidencialidad' },
      { id: '3.8', text: 'Gestión Documental: uso de registros y bitácoras' },
      { id: '3.9', text: 'Manejo de papelería del cliente (si aplica)' },
      { id: '3.10', text: 'Cuidados del Equipo' },
      { id: '3.11', text: 'Evaluación del Desempeño' },
    ],
  },
  {
    id: '4',
    text: 'Horario de trabajo',
    children: [
      { id: '4.1', text: 'Fecha y Hora de Primer día Ingreso' },
      { id: '4.2', text: 'Rol de trabajo (hora de entrada y salida)' },
      { id: '4.3', text: 'Prohibición de salida de las instalaciones' },
      { id: '4.4', text: 'Tiempo de alimentación' },
      { id: '4.5', text: 'Jornada laboral (8 horas/ 12 horas/ Mixta/ Diurna, etc)' },
      { id: '4.6', text: 'Día de descanso' },
    ],
  },
  {
    id: '5',
    text: 'Uso de Equipos',
    children: [
      { id: '5.1', text: 'Uso Correcto y Cuidado de Cepillo Eléctrico' },
      { id: '5.2', text: 'Uso Correcto y Cuidado de Aspiradora' },
      { id: '5.3', text: 'Uso Correcto y Cuidado de Hidrolavadora' },
      { id: '5.4', text: 'Uso Correcto y Cuidado de Máquina de vapor' },
      { id: '5.5', text: 'Uso Correcto y Cuidado de Equipo de Jardinería (guadañas, chapeadoras, orilladoras,etc)' },
    ],
  },
  {
    id: '6',
    text: 'Políticas',
    children: [
      { id: '6.1', text: 'Incapacidad' },
      { id: '6.2', text: 'Vacaciones' },
      { id: '6.3', text: 'Permisos con y sin goce salarial' },
      { id: '6.4', text: 'Devolución de uniformes, gafetes y otros' },
      { id: '6.5', text: 'Disciplina Progresiva' },
      { id: '6.6', text: 'Feriados' },
      { id: '6.7', text: 'Reporte de Accidentes (inmediato)' },
      { id: '6.8', text: 'Acoso Sexual y Laboral' },
    ],
  },
  {
    id: '7',
    text: 'Tipo de contratación y modalidades de pago.',
    children: [
      { id: '7.1', text: 'Comodín' },
      { id: '7.2', text: 'Fijo' },
    ],
  },
  { id: '8', text: 'Importancia de asistencia a capacitaciones' },
  {
    id: '9',
    text: 'Importancia de uso de equipo de protección personal (EPP) y medidas de seguridad en el trabajo:',
    children: [
      { id: '9.1', text: 'Lentes de seguridad' },
      { id: '9.2', text: 'Mascarillas' },
      { id: '9.3', text: 'Guantes' },
      { id: '9.4', text: 'Zapatos Antideslizantes' },
      { id: '9.5', text: 'Zapatos Seguridad' },
      { id: '9.6', text: 'Fajas de Levantamiento de Peso (si aplica)' },
      { id: '9.7', text: 'Batas/Gorrito/Cobertor zapatos hospitalario (si aplica)' },
      { id: '9.8', text: 'Botas (si aplica)' },
      { id: '9.9', text: 'Equipos de Trabajo en Altura' },
      { id: '9.10', text: 'Equipos de Protección Jardinería' },
      { id: '9.11', text: 'Rótulos Preventivos' },
      { id: '9.12', text: 'Otros:' },
    ],
  },
  {
    id: '10',
    text: 'Dilución y manipulación correcta de los químicos de limpieza',
    children: [
      { id: '10.1', text: 'Cloro / Sustituto de Cloro' },
      { id: '10.2', text: 'Desinfectante' },
      { id: '10.3', text: 'Multiuso' },
      { id: '10.4', text: 'Loza Sanitaria' },
      { id: '10.5', text: 'Otros químicos de limpieza (manipulación)' },
    ],
  },
  { id: '11', text: 'Procedimientos y Protocolos de Limpieza' },
  { id: '12', text: 'Procedimiento Limpieza Hospitalaria (si aplica)' },
  { id: '13', text: 'Protocolos de Emergencia o en Casos de Crisis' },
  { id: '14', text: 'Manejo y Levantamiento de Cargas y Movimiento Postural' },
  { id: '15', text: 'Manejo de Desechos Biopeligrosos' },
  { id: '16', text: 'Manejo y clasificación de Residuos (Reciclaje)' },
];

const TEMAS_DIV_SEG: TemaNode[] = [
  { id: '1', text: 'Presentación del Ejecutivo de cuenta o Coordinador Regional' },
  { id: '2', text: 'Nombre de los Supervisores' },
  { id: '3', text: 'Nombre de los Coordinadores (cuando aplique)' },
  { id: '4', text: 'Información sobre el Cliente y el Contrato' },
  { id: '5', text: 'Enlace del cliente en el lugar de trabajo' },
  { id: '6', text: 'Ubicación geográfica del puesto' },
  {
    id: '7',
    text: 'Horario de trabajo',
    children: [
      { id: '7.1', text: 'Fecha y Hora de Primer día Ingreso' },
      { id: '7.2', text: 'Rol de trabajo' },
      { id: '7.3', text: 'Jornada laboral (8 horas/ 12 horas/ Mixta/ Diurna, etc)' },
      { id: '7.4', text: 'Día de descanso' },
      { id: '7.5', text: 'Obligatoriedad de trabajar días feriados' },
    ],
  },
  {
    id: '8',
    text: 'Manual del puesto',
    children: [
      {
        id: '8.1',
        text: 'Descripción de funciones y responsabilidades en el puesto',
        children: [
          { id: '8.1.i', text: 'Espera de relevo' },
          { id: '8.1.ii', text: 'Reporte de asistencia' },
          { id: '8.1.iii', text: 'Tiempos de alimentación' },
          { id: '8.1.iv', text: 'Prohibición de salida de las instalaciones' },
          { id: '8.1.v', text: 'Revisión de perímetro' },
          { id: '8.1.vi', text: 'Manejo de llaves' },
          { id: '8.1.vii', text: 'Revisión de vehículos' },
          { id: '8.1.viii', text: 'Control de ingreso y salida de personas y activos' },
        ],
      },
      { id: '8.2', text: 'Reporte de incidencias' },
      { id: '8.3', text: 'Uso de sistemas de alarmas y CCTV' },
      { id: '8.4', text: 'Guía de funciones del puesto' },
      { id: '8.5', text: 'Correcto llenado de bitácoras.' },
      { id: '8.6', text: 'Gestión documental, uso y llenado de registros y papelería del cliente' },
      { id: '8.7', text: 'Realización correcta de rondas y realización de marcas' },
      { id: '8.8', text: 'Protocolos de Emergencia' },
      { id: '8.9', text: 'Uso y cuidado de los equipos del puesto y propiedad del cliente' },
      { id: '8.10', text: 'Evaluación de desempeño' },
      { id: '8.11', text: 'Multas en caso de que apliquen' },
      { id: '8.12', text: 'Servicio al cliente y trato de personas con capacidades reducidas' },
    ],
  },
  {
    id: '9',
    text: 'Políticas y procedimientos',
    children: [
      { id: '9.1', text: 'Código de Ética' },
      { id: '9.2', text: 'Confidencialidad' },
      { id: '9.3', text: 'Código de vestimenta' },
      { id: '9.4', text: 'Permisos con y sin goce' },
      { id: '9.5', text: 'Procedimiento para otorgar Horas extras' },
      { id: '9.6', text: 'Procedimiento para otorgar Vacaciones' },
      { id: '9.7', text: 'Procedimiento de incapacidades' },
      { id: '9.8', text: 'Procedimiento de traslados' },
      { id: '9.9', text: 'Manual de disciplina progresiva' },
      { id: '9.10', text: 'Reporte de accidentes (inmediato)' },
      { id: '9.11', text: 'Reglamento de Acoso Sexual y Acoso Laboral' },
    ],
  },
  { id: '10', text: 'Asistencia obligatoria a las Capacitaciones, según contrato con el cliente en el que se le asigne.' },
  {
    id: '11',
    text: 'Capacitaciones básicas',
    children: [
      { id: '11.1', text: 'Correcta entrega de puesto' },
      { id: '11.2', text: 'Protocolo de entrega y manejo de arma de fuego de forma segura.' },
      { id: '11.3', text: 'Uso de legítima defensa' },
      { id: '11.4', text: 'Uso de equipo contra incendio (extintores)' },
      { id: '11.5', text: 'Uso correcto de arma letal (armas de fuego)' },
      { id: '11.6', text: 'Vara de extensión (Black Jack)' },
      { id: '11.7', text: 'Esposas' },
      { id: '11.8', text: 'Uso correcto de arma menos letal (cuando corresponda)' },
      { id: '11.9', text: 'Gas pimienta' },
      { id: '11.10', text: 'Técnicas de aprensión o detención' },
      { id: '11.11', text: 'Uso de computadora, correo electrónico, office básico.' },
      { id: '11.12', text: 'Técnicas de descripción de personal y detección de posibles amenazas' },
      { id: '11.13', text: 'Uso de radio y sistemas de comunicación' },
    ],
  },
  {
    id: '12',
    text: 'Equipo de protección personal (EPP), equipo de seguridad y uso correcto de uniforme',
    children: [
      { id: '12.1', text: 'Chaleco antibalas' },
      { id: '12.2', text: 'Chaleco reflectivo o de seguridad' },
      { id: '12.3', text: 'Cinturón porta herramientas de seguridad' },
      { id: '12.4', text: 'Botas de hule' },
      { id: '12.5', text: 'Capa o poncho' },
      { id: '12.6', text: 'Casco de seguridad' },
      { id: '12.7', text: 'Calzado apropiado según el puesto de trabajo' },
      { id: '12.8', text: 'Gorra' },
      { id: '12.9', text: 'Cubre bocas o mascarilla' },
      { id: '12.10', text: 'Bloqueador solar' },
      { id: '12.11', text: 'Equipo Motorizados: casco, rodilleras, coderas, guantes, botas altas' },
      { id: '12.12', text: 'Uso correcto y completo de uniforme (limpio, planchado)' },
    ],
  },
];

function generateRandomId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mimeFromExtension(ext: string): string {
  const e = String(ext || 'jpg').replace(/^\./, '').toLowerCase();
  if (e === 'png') return 'png';
  if (e === 'webp') return 'webp';
  if (e === 'gif') return 'gif';
  return 'jpeg';
}

function getPuestosForCorpo(structureArr: MainStructureTree, corpoId: number | null): MainStructurePuestoNode[] {
  if (corpoId == null) return [];
  const cid = Number(corpoId);
  for (const empresa of structureArr || []) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionesFromCliente(cliente as any)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              return (sucursal.puestos || []) as MainStructurePuestoNode[];
            }
          }
        }
      }
    }
  }
  return [];
}

async function getConnectionStatus() {
  //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
}

function buildTemasSectionsFromFlat(flat: TemaFlatItem[], checkedIds: Set<string>): TemaSectionItem[] {
  const sections: TemaSectionItem[] = [];
  let currentSection: TemaSectionItem | null = null;

  for (const item of flat) {
    if (!item.isLeaf) {
      currentSection = { id: item.id, text: item.text, items: [] };
      sections.push(currentSection);
      continue;
    }
    const leaf: TemaSectionLeafItem = {
      id: item.id,
      text: item.text,
      checked: checkedIds.has(item.id),
    };
    if (item.level === 0 || !currentSection) {
      sections.push({ id: item.id, text: item.text, items: [leaf] });
      currentSection = null;
    } else {
      currentSection.items.push(leaf);
    }
  }

  return sections;
}

function parseTemasPayload(raw: unknown): {
  selected: TemaSelectedItem[];
  leafs: Array<{ id: string; text: string; checked?: boolean }> | null;
  sections: TemaSectionItem[] | null;
} {
  const empty = { selected: [] as TemaSelectedItem[], leafs: null as null, sections: null as null };
  if (!raw) return empty;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return empty;
    }
  }
  if (Array.isArray(obj)) {
    const selected = obj
      .map((item) => {
        if (typeof item === 'string') return { id: item, text: item };
        if (item && typeof item === 'object') {
          return { id: String((item as any).id || '').trim(), text: String((item as any).text || '').trim() };
        }
        return null;
      })
      .filter((x): x is TemaSelectedItem => !!x?.id);
    return { selected, leafs: null, sections: null };
  }
  return {
    selected: Array.isArray(obj?.selected) ? obj.selected : [],
    leafs: Array.isArray(obj?.leafs) ? obj.leafs : null,
    sections: Array.isArray(obj?.sections) ? obj.sections : null,
  };
}

/** Restaura hojas marcadas para edición; ignora ids de sección que no son hoja del formulario actual. */
function restoreSelectedTemasFromStoredPayload(
  temasData: TemaData,
  parsed: ReturnType<typeof parseTemasPayload>,
): TemaSelectedItem[] {
  const { leafTextById } = temasData;
  const byId = new Map<string, TemaSelectedItem>();

  const addIfLeaf = (id: string, text: string) => {
    const sid = String(id || '').trim();
    if (!sid || !leafTextById[sid]) return;
    const displayText = leafTextById[sid] || String(text || '').trim();
    if (!displayText) return;
    if (!byId.has(sid)) byId.set(sid, { id: sid, text: displayText });
  };

  if (parsed.leafs && parsed.leafs.length > 0) {
    for (const l of parsed.leafs) {
      if (l?.checked) addIfLeaf(String(l.id), String(l.text));
    }
    return Array.from(byId.values());
  }

  if (parsed.sections && parsed.sections.length > 0) {
    for (const sec of parsed.sections) {
      const items = Array.isArray(sec?.items) ? sec.items : [];
      const hasSubItems = items.length > 1 || (items.length === 1 && items[0]?.id !== sec?.id);
      if (hasSubItems) {
        for (const it of items) {
          if (it?.checked) addIfLeaf(String(it.id), String(it.text));
        }
      } else if (items.length === 1 && items[0]?.checked) {
        addIfLeaf(String(items[0].id), String(items[0].text || sec.text));
      }
    }
    if (byId.size > 0) return Array.from(byId.values());
  }

  for (const s of parsed.selected) {
    addIfLeaf(String(s.id), String(s.text));
  }
  return Array.from(byId.values());
}

// Funciones para formatear datos dinámicos para mostrar en cambios
function formatTemasATratarForDisplay(temasJson: string, temasData: TemaData): string {
  try {
    const { selected, leafs, sections } = parseTemasPayload(temasJson);
    const lines: string[] = [];

    if (sections && sections.length > 0) {
      for (const sec of sections) {
        const title = String(sec?.text || '').trim() || sec?.id || '—';
        const items = Array.isArray(sec?.items) ? sec.items : [];
        const hasSubItems = items.length > 1 || (items.length === 1 && items[0]?.id !== sec?.id);
        if (hasSubItems) {
          lines.push(title);
          for (const it of items) {
            if (!it?.checked) continue;
            const leafText = temasData.leafTextById[it.id] || it.text || it.id || '—';
            lines.push(`  • ${leafText}`);
          }
        } else if (items.length === 1 && items[0]?.checked) {
          lines.push(title);
        }
      }
      if (lines.length > 0) return lines.join('\n');
    }

    if (leafs && leafs.length > 0) {
      const rebuilt = buildTemasSectionsFromFlat(
        temasData.flat,
        new Set(leafs.filter((l) => !!l?.checked).map((l) => String(l.id))),
      );
      if (rebuilt.length > 0) {
        return formatTemasATratarForDisplay(JSON.stringify({ sections: rebuilt }), temasData);
      }
    }

    if (!Array.isArray(selected) || selected.length === 0) return 'No hay temas seleccionados.';
    return selected
      .map((t, idx) => {
        const temaText = temasData.leafTextById[t.id] || t.text || t.id || '-';
        return `${idx + 1}. ${temaText}`;
      })
      .join('\n');
  } catch (e) {
    console.error('Error formatting temas a tratar for display:', e);
    return 'Error al formatear temas a tratar.';
  }
}

function formatPersonasForDisplay(personasJson: string, label: string): string {
  try {
    const personas: PersonaItem[] = safeJsonParse<PersonaItem[]>(personasJson, []);
    if (!Array.isArray(personas) || personas.length === 0) return `No hay ${label}.`;
    return personas.map((p, idx) => {
      const nombre = p?.nombre || '-';
      const cedula = p?.cedula || '-';
      const puesto = p?.puesto_text || '-';
      const tieneFirma = p?.firma ? 'Sí' : 'No';
      return `${idx + 1}. ${nombre} (Cédula: ${cedula}, Puesto: ${puesto}, Firma: ${tieneFirma})`;
    }).join('\n');
  } catch (e) {
    console.error(`Error formatting ${label} for display:`, e);
    return `Error al formatear ${label}.`;
  }
}

function safeJsonParse<T>(value: any, fallback: T): T {
  try {
    if (!value) return fallback;
    if (typeof value === 'string') return JSON.parse(value) as T;
    return value as T;
  } catch {
    return fallback;
  }
}

function getBase64Only(signature: string | null | undefined): string | null {
  if (!signature) return null;
  const s = String(signature);
  if (s.startsWith('data:')) {
    const parts = s.split(',');
    return parts.length >= 2 ? parts.slice(1).join(',') : null;
  }
  return s;
}

function formatSignatureForDisplay(signature: string | null | undefined): string | null {
  if (!signature) return null;
  const s = String(signature);
  if (s.startsWith('data:')) return s;
  return `data:image/png;base64,${s}`;
}

function formatDateDMY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

function buildTemaDataIterative(nodes: TemaNode[]): TemaData {
  const flat: TemaFlatItem[] = [];
  const leafTextById: Record<string, string> = {};

  // DFS iterativo (sin recursividad)
  const stack: Array<{ node: TemaNode; level: number }> = [];
  for (let i = nodes.length - 1; i >= 0; i--) stack.push({ node: nodes[i], level: 0 });

  while (stack.length > 0) {
    const current = stack.pop()!;
    const n = current.node;
    const level = current.level;
    const hasChildren = !!(n.children && n.children.length > 0);
    const isLeaf = !hasChildren;

    flat.push({ key: n.id, id: n.id, text: n.text, level, isLeaf });
    if (isLeaf) leafTextById[n.id] = n.text;

    if (hasChildren) {
      for (let i = n.children!.length - 1; i >= 0; i--) {
        stack.push({ node: n.children![i], level: level + 1 });
      }
    }
  }

  return { flat, leafTextById };
}

const TEMAS_DATA_AYL: TemaData = buildTemaDataIterative(TEMAS_DIV_AYL);
const TEMAS_DATA_SEG: TemaData = buildTemaDataIterative(TEMAS_DIV_SEG);
const TEMAS_DATA_EMPTY: TemaData = { flat: [], leafTextById: {} };

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDivisionesFromCliente(cliente: any): MainStructureDivisionNode[] {
  const a = Array.isArray(cliente?.division) ? cliente.division : [];
  const b = Array.isArray(cliente?.divisiones) ? cliente.divisiones : [];
  const byId = new Map<number, MainStructureDivisionNode>();
  for (const d of [...a, ...b]) {
    const id = Number(d?.id);
    if (Number.isFinite(id) && !byId.has(id)) byId.set(id, d);
  }
  return Array.from(byId.values());
}

function getDivisionIdFromMarcaJson(marca: any): number | null {
  const raw =
    marca?.roleDivision?.division?.id ??
    marca?.role_division?.division?.id ??
    marca?.division?.id ??
    marca?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findDivisionIdForContratoInStructure(
  tree: MainStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  contratoId: number | null,
): number | null {
  if (!contratoId || !Number.isFinite(Number(contratoId)) || Number(contratoId) <= 0) return null;
  if (!empresaId || !clienteId || !Array.isArray(tree)) return null;
  const empresa = tree.find((e: any) => Number(e.id) === Number(empresaId));
  const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(clienteId));
  const divisions = getDivisionesFromCliente(cliente);
  for (const div of divisions) {
    const contratos: MainStructureContratoNode[] = Array.isArray(div?.contratos) ? div.contratos : [];
    if (contratos.some((ct: any) => Number(ct.id) === Number(contratoId))) {
      return Number(div.id);
    }
  }
  return null;
}

function resolveDivisionIdInStructure(
  tree: MainStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null,
): number | null {
  if (divisionId == null || !Number.isFinite(Number(divisionId))) return null;
  if (!empresaId || !clienteId || !Array.isArray(tree)) return Number(divisionId);
  const empresa = tree.find((e: any) => Number(e.id) === Number(empresaId));
  const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(clienteId));
  const divisions = getDivisionesFromCliente(cliente);
  const found = divisions.find((d: any) => Number(d.id) === Number(divisionId));
  return found ? Number(found.id) : Number(divisionId);
}

function resolveMarcaDivisionForTree(current: any, tree: MainStructureTree): number | null {
  const empresaId =
    current?.empresa?.id != null
      ? Number(current.empresa.id)
      : current?.empresa_id != null
        ? Number(current.empresa_id)
        : null;
  const clienteId =
    current?.cliente?.id != null
      ? Number(current.cliente.id)
      : current?.cliente_id != null
        ? Number(current.cliente_id)
        : null;
  const contratoId =
    current?.contrato?.id != null
      ? Number(current.contrato.id)
      : current?.contrato_id != null
        ? Number(current.contrato_id)
        : null;
  let divId = getDivisionIdFromMarcaJson(current);
  if (divId == null && empresaId && clienteId && contratoId && Array.isArray(tree) && tree.length > 0) {
    divId = findDivisionIdForContratoInStructure(tree, empresaId, clienteId, contratoId);
  }
  if (divId == null) return null;
  return resolveDivisionIdInStructure(tree, empresaId, clienteId, divId);
}

type HierarchyCorpoIds = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
};

function findHierarchyByCorpoIn(structureArr: MainStructureTree, corpoId: number): HierarchyCorpoIds | null {
  const cid = Number(corpoId);
  if (!Number.isFinite(cid)) return null;
  for (const empresa of structureArr || []) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionesFromCliente(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              return {
                empresaId: Number(empresa.id),
                clienteId: Number(cliente.id),
                divisionId: Number(division.id),
                contratoId: Number(contrato.id),
                corpoId: Number(sucursal.id),
              };
            }
          }
        }
      }
    }
  }
  return null;
}

type HierarchyFormIds = HierarchyCorpoIds & { puestoId: number };

function findHierarchyByPuestoIn(structureArr: MainStructureTree, puestoId: number): HierarchyFormIds | null {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  for (const empresa of structureArr || []) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionesFromCliente(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            for (const puesto of sucursal.puestos || []) {
              if (Number(puesto.id) === pid) {
                return {
                  empresaId: Number(empresa.id),
                  clienteId: Number(cliente.id),
                  divisionId: Number(division.id),
                  contratoId: Number(contrato.id),
                  corpoId: Number(sucursal.id),
                  puestoId: pid,
                };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

export default function GeneralInductionRegisterScreen() {
  const navigation = useNavigation<GeneralInductionRegisterScreenNavigationProp>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => {
    setIsMenuVisible(false);
    navigation.navigate('Home');
  };

  // list state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Importante: "sin internet" NO cuenta como error (solo es un estado informativo)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  const isProbablyNetworkError = (err: any) => {
    const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    );
  };
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [records, setRecords] = useState<GeneralInductionRegisterRecord[]>([]);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

  // Filtros jerárquicos
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  /** Sucursal del filtro; ref actualizada antes de `fetchRecords` en el picker para evitar state obsoleto en el mismo evento. */
  const filterCorpoIdRef = useRef<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);

  useEffect(() => {
    filterCorpoIdRef.current = filterCorpoId;
  }, [filterCorpoId]);

  const [roleName, setRoleName] = useState<RoleName>(null);
  const listFiltersSyncedFromMarcaOnceRef = useRef(false);
  const [deletingRecordKey, setDeletingRecordKey] = useState<string | null>(null);

  // IDs de current_marca para inicialización
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);

  // structure tree
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const [divisionOptions, setDivisionOptions] = useState<Array<{ id: number; nombre: string }>>([]);
  const [isDivisionOptionsLoading, setIsDivisionOptionsLoading] = useState(false);

  // form
  const [isCreating, setIsCreating] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null);
  const pendingEditTemasRef = useRef<ReturnType<typeof parseTemasPayload> | null>(null);
  const editTemasRestoreDoneRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Temas seleccionados: array de objetos {id, text} (se guarda en DB como string JSON)
  const [selectedTemas, setSelectedTemas] = useState<TemaSelectedItem[]>([]);
  const [temasVisibleCount, setTemasVisibleCount] = useState(100);
  const [colaboradoresList, setColaboradoresList] = useState<PersonaItem[]>([]);
  const [capacitadoresList, setCapacitadoresList] = useState<PersonaItem[]>([]);
  const [expandedColaboradores, setExpandedColaboradores] = useState<string[]>([]);
  const [expandedCapacitadores, setExpandedCapacitadores] = useState<string[]>([]);
  const [colaboradorCodigoInput, setColaboradorCodigoInput] = useState<Record<string, string>>({});

  const [images, setImages] = useState<
    Array<{ id?: number; name?: string; base64?: string; extension?: string; url?: string; localFileName?: string }>
  >([]);
  const [photosDirty, setPhotosDirty] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

  const [firmaResponsableHash, setFirmaResponsableHash] = useState('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);

  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<{ list: 'colab' | 'cap'; id_local: string } | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const signatureWebStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: 1px solid #E0E0E0; background: #FFFFFF; }
    .m-signature-pad--footer { display: none; margin: 0px; }
    body,html { width: 100%; height: 100%; }
    canvas { background: #FFFFFF; }
  `;

  const closeSignatureModal = () => {
    setSignatureModalVisible(false);
  };

  const clearSignatureInModal = () => {
    setSignatureKey((prev) => prev + 1);
    if (signatureRef.current?.clearSignature) {
      signatureRef.current.clearSignature();
    }
  };

  const acceptSignature = () => {
    if (signatureRef.current?.readSignature) {
      signatureRef.current.readSignature();
      return;
    }
    Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
  };

  const handleSignatureRead = (signature: string) => {
    if (!signature) {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
      return;
    }
    let formatted = signature;
    if (!signature.startsWith('data:')) {
      formatted = `data:image/png;base64,${signature}`;
    }
    onSignatureOK(formatted);
  };

  const appendTokenToUrl = (url?: string | null) => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (!accessToken) return raw;
    return `${raw}${raw.includes('?') ? '&' : '?'}token=${encodeURIComponent(String(accessToken))}`;
  };

  const loadImageFromServer = useCallback(async (registroId: number, imageName: string): Promise<string | null> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return null;

      const resp = await authedFetch({
        url: appendTokenToUrl(`${apiUrl}/api/general-induction-register/${registroId}/get-image/${encodeURIComponent(imageName)}?t=${Date.now()}`),
        init: {
          method: 'GET',
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return null;
      if (!resp.ok) return null;

      const blob = await resp.blob();
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        reader.onloadend = () => resolve((reader.result as string) || null);
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    } catch (e) {
      console.error('Error loading general induction image from server:', e);
      return null;
    }
  }, [refreshAccessToken, logout, accessToken]);

  const preloadServerImagesForEdit = useCallback(
    async (record: GeneralInductionRegisterRecord) => {
      try {
        const isConnected = await getConnectionStatus();
        const recId = typeof record.id === 'number' ? record.id : parseInt(String(record.id || ''), 10);
        const imgs = Array.isArray((record as any).images) ? (record as any).images : [];
        if (imgs.length === 0) return;

        if (!isConnected || !recId || Number.isNaN(recId) || String(record.id_local || '').startsWith('local-')) {
          return;
        }

        const next: Array<{
          id?: number;
          name?: string;
          base64?: string;
          extension?: string;
          url?: string;
          localFileName?: string;
        }> = [];
        for (const img of imgs) {
          const im = img as any;
          if (im.base64 || im.localFileName) {
            next.push(im);
            continue;
          }
          if (!im.name) {
            next.push(im);
            continue;
          }
          const dataUrl = await loadImageFromServer(recId, String(im.name));
          if (dataUrl) next.push({ ...im, base64: dataUrl, extension: im.extension || 'jpg' });
          else next.push(im);
        }
        setImages(next);
      } catch (e) {
        console.error('Error preloading GIR images for edit:', e);
      }
    },
    [loadImageFromServer]
  );

  const preloadServerImagesForList = useCallback(async (recordsInput: GeneralInductionRegisterRecord[]) => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) return recordsInput;

      const nextRecords: GeneralInductionRegisterRecord[] = [];
      for (const rec of recordsInput) {
        const recId = typeof rec.id === 'number' ? rec.id : parseInt(String(rec.id || ''), 10);
        const imgs = Array.isArray((rec as any).images) ? (rec as any).images : [];
        if (!recId || imgs.length === 0) {
          nextRecords.push(rec);
          continue;
        }

        const nextImgs: any[] = [];
        for (const img of imgs) {
          if (img?.base64) {
            nextImgs.push(img);
            continue;
          }
          if (img?.localFileName) {
            nextImgs.push(img);
            continue;
          }
          if (!img?.name) {
            nextImgs.push(img);
            continue;
          }
          const dataUrl = await loadImageFromServer(recId, String(img.name));
          if (dataUrl) nextImgs.push({ ...img, base64: dataUrl, extension: img.extension || 'jpg' });
          else nextImgs.push(img);
        }
        nextRecords.push({ ...rec, images: nextImgs });
      }
      return nextRecords;
    } catch (e) {
      console.error('Error preloading general induction images for list:', e);
      return recordsInput;
    }
  }, [loadImageFromServer]);

  const loadMainStructureCache = useCallback(async (): Promise<MainStructureTree> => {
    setIsStructureLoading(true);
    try {
      const tree = await loadMainStructureTreeMerged();
      const arr = Array.isArray(tree) ? (tree as MainStructureTree) : [];
      setStructure(arr);
      return arr;
    } catch (e) {
      console.error('Error fetching main structure for general induction register:', e);
      setStructure([]);
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  type MarcaSnapshot = {
    current: Record<string, any> | null;
    roleName: RoleName;
    isOperativo: boolean;
    marcaDivisionId: number | null;
    marcaCorpoId: number | null;
    marcaClienteId: number | null;
    marcaEmpresaId: number | null;
    filterEmpresaId: number | null;
    filterClienteId: number | null;
    filterDivisionId: number | null;
    filterContratoId: number | null;
    filterCorpoId: number | null;
  };

  const syncMarcaFromStorage = useCallback(
    async (opts?: {
      applyFiltersFromMarca?: boolean;
      structureTree?: MainStructureTree | null;
    }): Promise<MarcaSnapshot | null> => {
      const applyFiltersFromMarca = opts?.applyFiltersFromMarca !== false;
      const structureTree = opts?.structureTree;
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasCurrentMarca(false);
        setMarcaEmpresaId(null);
        setMarcaClienteId(null);
        setMarcaCorpoId(null);
        setMarcaDivisionId(null);
        setMarcaContratoId(null);
        setMarcaPuestoId(null);
        setRoleName(null);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(null);
          setFilterClienteId(null);
          setFilterDivisionId(null);
          setFilterContratoId(null);
          setFilterCorpoId(null);
        }
        return null;
      }
      try {
        const current = JSON.parse(currentMarcaStr);
        if (!current) {
          setHasCurrentMarca(false);
          return null;
        }
        setHasCurrentMarca(true);
        const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
        const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
        const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
        const empresaId = numOrNull(empresaIdRaw);
        const clienteId = numOrNull(clienteIdRaw);
        const corpoId = numOrNull(corpoIdRaw);
        const divFromMarca = getDivisionIdFromMarcaJson(current);
        const divResolved =
          structureTree && structureTree.length > 0
            ? resolveMarcaDivisionForTree(current, structureTree)
            : null;
        const effectiveDivisionId = divResolved ?? divFromMarca ?? numOrNull(current?.roleDivision?.division?.id ?? current?.division_id);

        setMarcaEmpresaId(empresaId);
        setMarcaClienteId(clienteId);
        setMarcaCorpoId(corpoId);
        setMarcaDivisionId(effectiveDivisionId);
        const role =
          current?.roleDivision?.role?.nombre ??
          current?.role_division?.role?.nombre ??
          null;
        const rn = typeof role === 'string' ? (role as RoleName) : null;
        setRoleName(rn);

        const fe = numOrNull(current?.empresa?.id);
        const fc = numOrNull(current?.cliente?.id);
        const fco = numOrNull(current?.contrato?.id ?? current?.contrato_id);
        const fs = numOrNull(current?.corpo?.id);
        const fp = numOrNull(current?.puesto?.id ?? current?.puesto_id);
        setMarcaContratoId(fco);
        setMarcaPuestoId(fp);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(fe);
          setFilterClienteId(fc);
          setFilterDivisionId(effectiveDivisionId);
          setFilterContratoId(fco);
          setFilterCorpoId(fs);
        }

        return {
          current,
          roleName: rn,
          isOperativo: rn === 'OPERATIVO',
          marcaDivisionId: effectiveDivisionId,
          marcaCorpoId: corpoId,
          marcaClienteId: clienteId,
          marcaEmpresaId: empresaId,
          filterEmpresaId: fe,
          filterClienteId: fc,
          filterDivisionId: effectiveDivisionId,
          filterContratoId: fco,
          filterCorpoId: fs,
        };
      } catch {
        setHasCurrentMarca(false);
        setMarcaEmpresaId(null);
        setMarcaClienteId(null);
        setMarcaCorpoId(null);
        setMarcaDivisionId(null);
        setMarcaContratoId(null);
        setMarcaPuestoId(null);
        setRoleName(null);
        return null;
      }
    },
    []
  );

  const resetListFiltersFromCurrentMarca = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const currentMarca = JSON.parse(currentMarcaStr);
      const loaded = await loadMainStructureTreeMerged().catch(() => []);
      const tree = Array.isArray(loaded) ? (loaded as MainStructureTree) : [];
      const divId =
        tree.length > 0
          ? resolveMarcaDivisionForTree(currentMarca, tree) ?? getDivisionIdFromMarcaJson(currentMarca)
          : getDivisionIdFromMarcaJson(currentMarca);
      setFilterEmpresaId(currentMarca.empresa?.id != null ? Number(currentMarca.empresa.id) : null);
      setFilterClienteId(currentMarca.cliente?.id != null ? Number(currentMarca.cliente.id) : null);
      setFilterDivisionId(divId);
      setFilterContratoId(currentMarca.contrato?.id != null ? Number(currentMarca.contrato.id) : null);
      setFilterCorpoId(currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : null);
    } catch (e) {
      console.error('resetListFiltersFromCurrentMarca (GeneralInduction):', e);
    }
  }, []);

  const applyCurrentMarcaToCreateHierarchy = useCallback(async (treeFromCaller?: MainStructureTree) => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marca = JSON.parse(currentMarcaStr);
      const rn = marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;
      if (rn === 'OPERATIVO') return;

      let tree = treeFromCaller;
      if (!tree?.length) {
        const loaded = await loadMainStructureTreeMerged().catch(() => []);
        tree = Array.isArray(loaded) ? (loaded as MainStructureTree) : [];
        if (tree.length) setStructure(tree);
      }
      const divResolved =
        tree && tree.length > 0 ? resolveMarcaDivisionForTree(marca, tree) : null;

      setSelectedEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setSelectedClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setSelectedDivisionId(divResolved ?? getDivisionIdFromMarcaJson(marca));
      setSelectedContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setSelectedSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : null);
      setSelectedPuestoId(marca.puesto?.id != null ? Number(marca.puesto.id) : marca.puesto_id != null ? Number(marca.puesto_id) : null);
    } catch (e) {
      console.error('applyCurrentMarcaToCreateHierarchy (GeneralInduction):', e);
    }
  }, []);

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
  };

  const fetchCambios = useCallback(async (tabla: string, registroId: number) => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta función solo está disponible con conexión a internet.');
      return;
    }
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const resp = await authedFetch({
        url: `${apiUrl}/api/cambios-apps-modules?tabla=${encodeURIComponent(tabla)}&registro_id=${registroId}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return;

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        throw new Error(data.message || 'No se pudieron cargar los cambios');
      }
      setCambiosItems(Array.isArray(data.data) ? data.data : []);
      setIsCambiosModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudieron cargar los cambios');
    }
  }, [refreshAccessToken, logout]);

  const runFetchRecords = useCallback(
    async (snap: MarcaSnapshot) => {
      try {
        setIsLoading(true);
        setError(null);
        setOfflineMessage(null);

        if (!snap?.current && snap.isOperativo) {
          setRecords([]);
          setError('No se encontró el ID de la sucursal (corpo) en la marca actual');
          return;
        }

        const corpoId = snap.isOperativo
          ? snap.marcaCorpoId
          : (snap.filterCorpoId ?? snap.marcaCorpoId);
        if (!corpoId || corpoId <= 0) {
          setRecords([]);
          setError(
            snap.isOperativo
              ? 'No se encontró el ID de la sucursal (corpo) en la marca actual'
              : 'Seleccione sucursal en el filtro o defina la sucursal en la marca actual'
          );
          return;
        }

        const sid = Number(corpoId);
        const localAll = await readAllGeneralInductionRegisterRecords();
        const localByCorpo = localAll.filter((r: any) => girRecordSucursalId(r) === sid);
        /** Filas que aún no existen en el servidor (borrador / pendiente). No mezclar filas ya sincronizadas (id numérico + synced), o el GET duplica la misma fila. */
        const localOnly = localByCorpo.filter((r: any) => {
          if (r?.synced === true) {
            const rid = String(r?.id ?? '');
            if (rid && !rid.startsWith('local-')) {
              const n = Number(rid);
              if (Number.isFinite(n) && n > 0) return false;
            }
          }
          return true;
        });

        const isConnected = await getConnectionStatus();
        if (!isConnected) {
          setRecords(await preloadServerImagesForList(localByCorpo));
          return;
        }

        try {
          const result = await listGeneralInductionRegisterByCorpo({
            corpo_id: String(corpoId),
            refreshAccessToken,
            logout,
          });

          if (!result.status || !Array.isArray(result.data)) {
            setRecords(await preloadServerImagesForList(localByCorpo));
            return;
          }

          const serverRecords = (result.data as any[])
            .filter((r) => r?.isActive !== false)
            .map((r) => ({
              ...r,
              corpo_id: Number(r.corpo_id ?? r.sucursal_id ?? corpoId),
              synced: true,
            }));

          const merged = [...localOnly, ...serverRecords];
          setRecords(await preloadServerImagesForList(merged));

          const allGir = await readAllGeneralInductionRegisterRecords();
          const otherCorpo = allGir.filter((item: any) => girRecordSucursalId(item) !== sid);
          await writeAllGeneralInductionRegisterRecords([
            ...otherCorpo,
            ...merged.map((r: any) => ({
              ...r,
              type: 'general_induction_register',
              corpo_id: Number(r.corpo_id ?? r.sucursal_id ?? sid),
            })),
          ]);
        } catch (fetchErr) {
          console.error('Error listGeneralInductionRegisterByCorpo:', fetchErr);
          if (isProbablyNetworkError(fetchErr)) {
            setOfflineMessage('Modo Offline: error de conexión. Mostrando datos guardados si existen.');
          }
          setRecords(await preloadServerImagesForList(localByCorpo));
        }
      } catch (e) {
        console.error('Error fetching general induction register records:', e);
        if (isProbablyNetworkError(e)) {
          setOfflineMessage('Modo Offline: error de conexión. Mostrando datos guardados si existen.');
        } else {
          setError('Error al cargar los registros de inducción general');
        }
        try {
          const localAll = await readAllGeneralInductionRegisterRecords();
          const fallbackCorpo = snap?.isOperativo
            ? snap?.marcaCorpoId
            : (snap?.filterCorpoId ?? snap?.marcaCorpoId);
          const fb = Number(fallbackCorpo);
          if (Number.isFinite(fb) && fb > 0) {
            const local = localAll.filter((r: any) => girRecordSucursalId(r) === fb);
            setRecords(await preloadServerImagesForList(local));
          } else {
            setRecords([]);
          }
        } catch {
          // ignore
        }
      } finally {
        setIsLoading(false);
      }
    },
    [refreshAccessToken, logout, preloadServerImagesForList]
  );

  const fetchRecords = useCallback(async () => {
    const tree = await loadMainStructureCache();
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false, structureTree: tree });
    const effectiveSnap = snap ?? {
      current: null,
      roleName,
      isOperativo: roleName === 'OPERATIVO',
      marcaDivisionId: null,
      marcaCorpoId: null,
      marcaClienteId: null,
      marcaEmpresaId: null,
      filterEmpresaId,
      filterClienteId,
      filterDivisionId,
      filterContratoId,
      filterCorpoId: filterCorpoIdRef.current,
    };
    await runFetchRecords({
      ...effectiveSnap,
      filterEmpresaId,
      filterClienteId,
      filterDivisionId,
      filterContratoId,
      filterCorpoId: filterCorpoIdRef.current,
    });
  }, [
    syncMarcaFromStorage,
    runFetchRecords,
    loadMainStructureCache,
    roleName,
    filterEmpresaId,
    filterClienteId,
    filterDivisionId,
    filterContratoId,
  ]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!listFiltersSyncedFromMarcaOnceRef.current) {
          const tree = await loadMainStructureCache();
          if (cancelled) return;
          const snap = await syncMarcaFromStorage({
            applyFiltersFromMarca: true,
            structureTree: tree,
          });
          if (cancelled) return;
          listFiltersSyncedFromMarcaOnceRef.current = true;
          if (snap) await runFetchRecords(snap);
          else await fetchRecords();
        } else {
          await fetchRecords();
        }
      })();
      const handler = () => void fetchRecords();
      eventBus.on('connectionRestored', handler);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', handler);
      };
    }, [
      syncMarcaFromStorage,
      runFetchRecords,
      fetchRecords,
      loadMainStructureCache,
    ])
  );

  // Nodos computados para filtros jerárquicos
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => Number(e.id) === Number(filterEmpresaId));
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    if (!filterClienteId) return [];
    const cliente = filterClientes.find((c: any) => Number(c.id) === Number(filterClienteId));
    if (!cliente) return [];
    return getDivisionesFromCliente(cliente);
  }, [filterClientes, filterClienteId]);

  const filterContratos = useMemo(() => {
    if (!filterDivisionId) return [];
    const div = filterDivisiones.find((d: any) => Number(d.id) === Number(filterDivisionId));
    return div?.contratos || [];
  }, [filterDivisiones, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    if (filterClienteId == null || filterContratoId == null) return [];
    const empresa = filterEmpresas.find((e: any) => Number(e.id) === Number(filterEmpresaId));
    if (!empresa) return [];
    const cliente = empresa.clientes?.find((c: any) => Number(c.id) === Number(filterClienteId));
    if (!cliente) return [];

    const sucursalesMap = new Map<number, any>();
    for (const division of getDivisionesFromCliente(cliente)) {
      if (filterDivisionId != null && Number(division.id) !== Number(filterDivisionId)) continue;
      for (const contrato of division.contratos || []) {
        if (Number(contrato.id) !== Number(filterContratoId)) continue;
        for (const sucursal of contrato.sucursales || []) {
          const idNum = Number(sucursal?.id);
          if (Number.isFinite(idNum) && !sucursalesMap.has(idNum)) sucursalesMap.set(idNum, sucursal);
        }
      }
    }
    return Array.from(sucursalesMap.values());
  }, [filterEmpresas, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId]);

  const selectedEmpresaNode = useMemo(() => {
    if (selectedEmpresaId === null) return null;
    return structure.find((e) => Number(e.id) === Number(selectedEmpresaId)) ?? null;
  }, [structure, selectedEmpresaId]);

  const selectedClienteNode = useMemo(() => {
    if (!selectedEmpresaNode || selectedClienteId === null) return null;
    return selectedEmpresaNode.clientes.find((c) => Number(c.id) === Number(selectedClienteId)) ?? null;
  }, [selectedEmpresaNode, selectedClienteId]);

  const selectedDivisionNode = useMemo(() => {
    if (!selectedClienteNode || selectedDivisionId === null) return null;
    return (
      getDivisionesFromCliente(selectedClienteNode as any).find(
        (d) => Number(d.id) === Number(selectedDivisionId)
      ) ?? null
    );
  }, [selectedClienteNode, selectedDivisionId]);

  const selectedContratoNode = useMemo(() => {
    if (!selectedDivisionNode || selectedContratoId === null) return null;
    return (selectedDivisionNode.contratos || []).find((c) => Number(c.id) === Number(selectedContratoId)) ?? null;
  }, [selectedDivisionNode, selectedContratoId]);

  const selectedSucursalNode = useMemo(() => {
    if (!selectedContratoNode || selectedSucursalId === null) return null;
    return (selectedContratoNode.sucursales || []).find((s) => Number(s.id) === Number(selectedSucursalId)) ?? null;
  }, [selectedContratoNode, selectedSucursalId]);

  // Opciones memoizadas (patrón de OpeningClosingPositionScreen)
  const empresaOptions = useMemo(() => structure.map((e) => ({ id: e.id, nombre: e.nombre })), [structure]);
  const clienteOptions = useMemo(
    () => (selectedEmpresaNode?.clientes || []).map((c) => ({ id: c.id, nombre: c.nombre })),
    [selectedEmpresaNode]
  );
  const contratoOptions = useMemo(
    () => (selectedDivisionNode?.contratos || []).map((c) => ({ id: c.id, nombre: c.nombre })),
    [selectedDivisionNode]
  );
  const sucursalOptions = useMemo(
    () => (selectedContratoNode?.sucursales || []).map((s) => ({ id: s.id, nombre: s.nombre })),
    [selectedContratoNode]
  );

  const puestosForSelectedSucursal = useMemo(() => {
    if (roleName === 'OPERATIVO' && marcaCorpoId) {
      return getPuestosForCorpo(structure, marcaCorpoId);
    }
    return (selectedSucursalNode?.puestos || []) as MainStructurePuestoNode[];
  }, [roleName, marcaCorpoId, structure, selectedSucursalNode]);
  const plazasForSelectedSucursal = useMemo(
    () => puestosForSelectedSucursal.flatMap((p) => (Array.isArray(p.plazas) ? p.plazas : [])),
    [puestosForSelectedSucursal]
  );

  const divisionIdForTemas = useMemo(() => {
    if (roleName === 'OPERATIVO') return marcaDivisionId;
    return selectedDivisionId;
  }, [roleName, marcaDivisionId, selectedDivisionId]);

  const temasData = useMemo(() => {
    if (divisionIdForTemas === 5) return TEMAS_DATA_AYL;
    if (divisionIdForTemas === 4) return TEMAS_DATA_SEG;
    return TEMAS_DATA_EMPTY;
  }, [divisionIdForTemas]);
  const temasFlat = temasData.flat;
  const temasLeafTextById = temasData.leafTextById;
  const allTemasLeafSelected = useMemo<TemaSelectedItem[]>(
    () =>
      temasFlat
        .filter((t) => t.isLeaf)
        .map((t) => ({ id: t.id, text: t.text })),
    [temasFlat]
  );
  const temasVisible = useMemo(() => temasFlat.slice(0, temasVisibleCount), [temasFlat, temasVisibleCount]);
  const selectedTemaIdSet = useMemo(() => new Set(selectedTemas.map((t) => t.id)), [selectedTemas]);

  useEffect(() => {
    // Reiniciar cantidad visible cuando cambie la división (formulario dinámico)
    setTemasVisibleCount(100);
    if (!editingRecord) setSelectedTemas(allTemasLeafSelected);
  }, [divisionIdForTemas, editingRecord, allTemasLeafSelected]);

  // Al editar: reaplicar temas guardados cuando el formulario de la división ya esté cargado
  useEffect(() => {
    if (!editingRecord) {
      pendingEditTemasRef.current = null;
      editTemasRestoreDoneRef.current = false;
      return;
    }
    if (editTemasRestoreDoneRef.current || !pendingEditTemasRef.current) return;
    if (temasFlat.length === 0) return;

    const restored = restoreSelectedTemasFromStoredPayload(temasData, pendingEditTemasRef.current);
    setSelectedTemas(restored);
    editTemasRestoreDoneRef.current = true;
  }, [editingRecord, divisionIdForTemas, temasData, temasFlat.length]);

  const handleEmpresaChange = (empresaId: number | null) => {
    setSelectedEmpresaId(empresaId);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setDivisionOptions([]);
    setSelectedTemas([]);
  };

  const handleClienteChange = (clienteId: number | null) => {
    setSelectedClienteId(clienteId);
    // limpiar división inmediatamente para evitar estado inconsistente con el cliente anterior
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setDivisionOptions([]);
    setSelectedTemas([]);
  };

  const handleFilterHierarchyChange = useCallback(
    (v: HierarchyPickerValues) => {
      setFilterEmpresaId(v.empresaId);
      setFilterClienteId(v.clienteId);
      setFilterDivisionId(v.divisionId);
      setFilterContratoId(v.contratoId);
      filterCorpoIdRef.current = v.sucursalId;
      setFilterCorpoId(v.sucursalId);
      if (v.sucursalId != null) {
        void (async () => {
          const tree = await loadMainStructureCache();
          const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false, structureTree: tree });
          const effectiveSnap = snap ?? {
            current: null,
            roleName,
            isOperativo: roleName === 'OPERATIVO',
            marcaDivisionId: null,
            marcaCorpoId: null,
            marcaClienteId: null,
            marcaEmpresaId: null,
            filterEmpresaId: v.empresaId,
            filterClienteId: v.clienteId,
            filterDivisionId: v.divisionId,
            filterContratoId: v.contratoId,
            filterCorpoId: v.sucursalId,
          };
          await runFetchRecords({
            ...effectiveSnap,
            filterEmpresaId: v.empresaId,
            filterClienteId: v.clienteId,
            filterDivisionId: v.divisionId,
            filterContratoId: v.contratoId,
            filterCorpoId: v.sucursalId,
          });
        })();
      }
    },
    [syncMarcaFromStorage, runFetchRecords, loadMainStructureCache, roleName]
  );

  const handleFormHierarchyChange = useCallback(
    (v: HierarchyPickerValues) => {
      if (v.empresaId !== selectedEmpresaId || v.clienteId !== selectedClienteId) {
        setDivisionOptions([]);
        setSelectedTemas([]);
      }
      setSelectedEmpresaId(v.empresaId);
      setSelectedClienteId(v.clienteId);
      setSelectedDivisionId(v.divisionId);
      setSelectedContratoId(v.contratoId);
      setSelectedSucursalId(v.sucursalId);
      setSelectedPuestoId(v.puestoId ?? null);
    },
    [selectedEmpresaId, selectedClienteId]
  );

  // 1) Al seleccionar cliente, primero "cargar" divisiones en opciones (sin recursividad)
  useEffect(() => {
    if (editingRecord) return;
    if (isStructureLoading) return;
    setIsDivisionOptionsLoading(true);
    try {
      const opts = (selectedClienteNode ? getDivisionesFromCliente(selectedClienteNode as any) : []).map((d) => ({
        id: Number(d.id),
        nombre: String(d.nombre || ''),
      }));
      setDivisionOptions(opts);
    } finally {
      setIsDivisionOptionsLoading(false);
    }
  }, [selectedClienteNode, editingRecord, isStructureLoading]);

  // 2) La división ya no se auto-selecciona; el usuario debe elegirla manualmente

  // Cascada: si cambia división/contrato, limpiar selecciones inferiores (patrón de OpeningClosingPositionScreen)
  useEffect(() => {
    if (!selectedDivisionNode) {
      setSelectedContratoId(null);
      setSelectedSucursalId(null);
      return;
    }
    if (selectedContratoId !== null) {
      const exists = (selectedDivisionNode.contratos || []).some(
        (c) => Number(c.id) === Number(selectedContratoId)
      );
      if (!exists) setSelectedContratoId(null);
    }
  }, [selectedDivisionNode]);

  useEffect(() => {
    if (!selectedContratoNode) {
      setSelectedSucursalId(null);
      return;
    }
    if (selectedSucursalId !== null) {
      const exists = (selectedContratoNode.sucursales || []).some(
        (s) => Number(s.id) === Number(selectedSucursalId)
      );
      if (!exists) setSelectedSucursalId(null);
    }
  }, [selectedContratoNode]);

  const toggleTemaLeaf = useCallback(
    (id: string) => {
      const text = temasLeafTextById[id];
      if (!text) return; // solo hojas tienen checkbox
      setSelectedTemas((prev) => {
        const exists = prev.some((t) => t.id === id);
        if (exists) return prev.filter((t) => t.id !== id);
        return [...prev, { id, text }];
      });
    },
    [temasLeafTextById]
  );

  const openSignatureFor = (list: 'colab' | 'cap', id_local: string) => {
    setSignatureTarget({ list, id_local });
    setSignatureModalVisible(true);
  };

  const toggleExpandedPersona = (list: 'colab' | 'cap', id_local: string) => {
    const setter = list === 'colab' ? setExpandedColaboradores : setExpandedCapacitadores;
    setter((prev) => (prev.includes(id_local) ? prev.filter((x) => x !== id_local) : [...prev, id_local]));
  };

  const isPersonaExpanded = (list: 'colab' | 'cap', id_local: string) => {
    return (list === 'colab' ? expandedColaboradores : expandedCapacitadores).includes(id_local);
  };

  const onSignatureOK = (sig: string) => {
    if (!signatureTarget) return;
    const value = sig ? formatSignatureForDisplay(sig) : null;
    if (signatureTarget.list === 'colab') {
      setColaboradoresList((prev) => prev.map((p) => (p.id_local === signatureTarget.id_local ? { ...p, firma: value } : p)));
    } else {
      setCapacitadoresList((prev) => prev.map((p) => (p.id_local === signatureTarget.id_local ? { ...p, firma: value } : p)));
    }
    setSignatureModalVisible(false);
    setSignatureTarget(null);
  };

  const onSignatureEmpty = () => {
    Alert.alert('Error', 'La firma está vacía');
  };

  const decodeFirmaHash = (hash: string) => {
    try {
      const decoded = atob(String(hash));
      const parts = decoded.split(':');
      if (parts.length !== 5) return null;
      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
      return { sessionId, empleadoId, latitud, longitud, timestamp };
    } catch {
      return null;
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    try {
      setIsGeneratingFirmaResponsable(true);
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setFirmaResponsableHash(hash);
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }
      setFirmaResponsableHash(qrData);
    } catch (e) {
      console.error('Error scanning firma_responsable:', e);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const findEmployeeInMain = useCallback((empleadoId: number) => {
    // Prioridad: sucursal seleccionada en formulario
    for (const puesto of puestosForSelectedSucursal) {
      for (const plaza of (puesto.plazas || [])) {
        const empleados = Array.isArray((plaza as any).empleados) ? (plaza as any).empleados : [];
        if (empleados.some((emp: any) => Number(emp?.id) === Number(empleadoId))) {
          return { puesto_id: puesto.id, puesto_text: puesto.nombre };
        }
      }
    }

    // Fallback: búsqueda global en main_structure
    for (const empresa of structure || []) {
      for (const cliente of (empresa.clientes || [])) {
        for (const division of getDivisionesFromCliente(cliente as any)) {
          for (const contrato of (division.contratos || [])) {
            for (const sucursal of (contrato.sucursales || [])) {
              for (const puesto of (sucursal.puestos || [])) {
                for (const plaza of (puesto.plazas || [])) {
                  const empleados = Array.isArray((plaza as any).empleados) ? (plaza as any).empleados : [];
                  if (empleados.some((emp: any) => Number(emp?.id) === Number(empleadoId))) {
                    return { puesto_id: puesto.id, puesto_text: puesto.nombre };
                  }
                }
              }
            }
          }
        }
      }
    }

    return null;
  }, [puestosForSelectedSucursal, structure]);

  const applyEmployeeToColaborador = useCallback(
    (id_local: string, empleado: any) => {
      const id = Number(empleado?.id || 0);
      const nombre = [
        String(empleado?.nombre || '').trim(),
        String(empleado?.primer_apellido || '').trim(),
        String(empleado?.segundo_apellido || '').trim(),
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || String(empleado?.nombre_completo || '').trim();
      const cedula = String(empleado?.cedula || '').trim();

      const foundInMain = id ? findEmployeeInMain(id) : null;
      updatePersona('colab', id_local, {
        nombre,
        cedula,
        puesto_id: foundInMain?.puesto_id ?? null,
        puesto_text: foundInMain?.puesto_text ?? '',
      });
      if (!foundInMain) {
        Alert.alert('Aviso', 'Empleado encontrado, pero no se ubicó en main_structure para autocompletar el puesto.');
      }
    },
    [findEmployeeInMain]
  );

  const fetchEmpleadoByIdForColaborador = useCallback(
    async (id_local: string, empleadoId: number) => {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const response = await authedFetch({
        url: `${apiUrl}/api/empleados/${empleadoId}`,
        init: {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'No se pudo obtener el empleado por ID');
      }
      const empleadoData = await response.json();
      applyEmployeeToColaborador(id_local, empleadoData);
    },
    [refreshAccessToken, logout, applyEmployeeToColaborador]
  );

  const fetchEmpleadoByCodigoForColaborador = useCallback(
    async (id_local: string, codigo: string) => {
      const code = String(codigo || '').trim();
      if (!code) {
        Alert.alert('Error', 'Debes ingresar un código');
        return;
      }
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const response = await authedFetch({
        url: `${apiUrl}/api/empleados/codigo/${encodeURIComponent(code)}`,
        init: {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'No se pudo obtener el empleado por código');
      }
      const data = await response.json();
      if (!data?.status || !data?.data) {
        throw new Error(data?.message || 'No se encontró el empleado');
      }
      applyEmployeeToColaborador(id_local, data.data);
    },
    [refreshAccessToken, logout, applyEmployeeToColaborador]
  );

  const handleScanColaboradorQR = useCallback(async (id_local: string) => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Esta función requiere internet');
        return;
      }
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded?.empleadoId) {
        Alert.alert('Error', 'El QR no contiene un ID de empleado válido');
        return;
      }
      await fetchEmpleadoByIdForColaborador(id_local, Number(decoded.empleadoId));
    } catch (e: any) {
      console.error('Error scanning collaborator QR:', e);
      Alert.alert('Error', e?.message || 'No se pudo leer el QR del colaborador');
    }
  }, [scanQR, fetchEmpleadoByIdForColaborador]);

  const resetForm = async ( horaAccion: number ) => {
    setFecha(new Date(horaAccion));
    setSelectedTemas(allTemasLeafSelected);
    setColaboradoresList([]);
    setCapacitadoresList([]);
    setColaboradorCodigoInput({});
    setImages([]);
    setPhotosDirty(false);
    setFirmaResponsableHash('');
    pendingEditTemasRef.current = null;
    editTemasRestoreDoneRef.current = false;
    setEditingRecord(null);
  };

  const startCreate = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    resetForm(horaAccion);
    setIsCreating(true);
    const tree = await loadMainStructureCache();
    await applyCurrentMarcaToCreateHierarchy(tree);
  };

  const startEditing = async (record: GeneralInductionRegisterRecord) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    try {
      setIsCreating(true);
      setEditingRecord({ id: record.id ? String(record.id) : null, id_local: record.id_local || '' });

      setFecha(record.fecha ? new Date(record.fecha) : new Date(horaAccion));

      const temasParsed = parseTemasPayload(record.temas_a_tratar);
      pendingEditTemasRef.current = temasParsed;
      editTemasRestoreDoneRef.current = false;
      const meta = safeJsonParse<any>(record.temas_a_tratar, null)?.meta ?? null;

      let structureArr: MainStructureTree =
        Array.isArray(structure) && structure.length > 0 ? structure : [];
      if (!structureArr.length) {
        try {
          structureArr = await loadMainStructureCache();
        } catch {
          /* ignore */
        }
      }

      let usedHierarchy = false;
      if (roleName != null && roleName !== 'OPERATIVO' && Array.isArray(structureArr) && structureArr.length > 0) {
        const pid = record.puesto_id != null ? Number(record.puesto_id) : NaN;
        const byPuesto =
          Number.isFinite(pid) && pid > 0 ? findHierarchyByPuestoIn(structureArr, pid) : null;
        if (byPuesto) {
          setSelectedEmpresaId(byPuesto.empresaId);
          setSelectedClienteId(byPuesto.clienteId);
          setSelectedDivisionId(byPuesto.divisionId);
          setSelectedContratoId(byPuesto.contratoId);
          setSelectedSucursalId(byPuesto.corpoId);
          setSelectedPuestoId(byPuesto.puestoId);
          usedHierarchy = true;
        } else {
          const h = findHierarchyByCorpoIn(structureArr, Number(record.corpo_id));
          if (h) {
            setSelectedEmpresaId(h.empresaId);
            setSelectedClienteId(h.clienteId);
            setSelectedDivisionId(h.divisionId);
            setSelectedContratoId(h.contratoId);
            setSelectedSucursalId(h.corpoId);
            const mp = record.puesto_id != null ? Number(record.puesto_id) : null;
            setSelectedPuestoId(mp && Number.isFinite(mp) && mp > 0 ? mp : null);
            usedHierarchy = true;
          }
        }
      } else if (roleName === 'OPERATIVO') {
        setSelectedEmpresaId(null);
        setSelectedClienteId(null);
        setSelectedDivisionId(null);
        setSelectedContratoId(null);
        setSelectedSucursalId(null);
        setSelectedPuestoId(null);
      }

      if (!usedHierarchy && meta) {
        if (meta.empresa_id) setSelectedEmpresaId(Number(meta.empresa_id));
        if (meta.cliente_id) setSelectedClienteId(Number(meta.cliente_id));
        if (meta.division_id) setSelectedDivisionId(Number(meta.division_id));
        if (meta.contrato_id) setSelectedContratoId(Number(meta.contrato_id));
        if (meta.sucursal_id) setSelectedSucursalId(Number(meta.sucursal_id));
        if (meta.puesto_id) setSelectedPuestoId(Number(meta.puesto_id));
      }

      const divisionIdFromRecord =
        meta?.division_id != null
          ? Number(meta.division_id)
          : record.division_id != null
            ? Number(record.division_id)
            : null;
      const temasDataForRestore =
        divisionIdFromRecord === 5
          ? TEMAS_DATA_AYL
          : divisionIdFromRecord === 4
            ? TEMAS_DATA_SEG
            : temasData;
      const restoredTemas = restoreSelectedTemasFromStoredPayload(temasDataForRestore, temasParsed);
      if (temasDataForRestore.flat.length > 0) {
        setSelectedTemas(restoredTemas);
        editTemasRestoreDoneRef.current = true;
      }

      setColaboradoresList(safeJsonParse<PersonaItem[]>(record.colaboradores, []).map((p: any) => ({
        id_local: p.id_local || generateRandomId(),
        nombre: String(p.nombre || ''),
        cedula: String(p.cedula || ''),
        puesto_text: String(p.puesto_text || ''),
        puesto_id: p.puesto_id !== undefined && p.puesto_id !== null ? Number(p.puesto_id) : null,
        firma: p.firma ? formatSignatureForDisplay(String(p.firma)) : null,
      })));
      setCapacitadoresList(safeJsonParse<PersonaItem[]>(record.capacitadores, []).map((p: any) => ({
        id_local: p.id_local || generateRandomId(),
        nombre: String(p.nombre || ''),
        cedula: String(p.cedula || ''),
        puesto_text: String(p.puesto_text || ''),
        puesto_id: p.puesto_id !== undefined && p.puesto_id !== null ? Number(p.puesto_id) : null,
        firma: p.firma ? formatSignatureForDisplay(String(p.firma)) : null,
      })));

      setImages(Array.isArray((record as any).images) ? (record as any).images : []);
      setPhotosDirty(false);
      setFirmaResponsableHash(record.firma_responsable || '');
      void preloadServerImagesForEdit(record);
    } catch (e) {
      console.error('Error startEditing general induction register:', e);
      Alert.alert('Error', 'No se pudo cargar el registro para edición');
    }
  };

  const buildTemasPayload = (divisionNombre: string) => {
    const meta = {
      empresa_id: roleName === 'OPERATIVO' ? marcaEmpresaId : selectedEmpresaId,
      cliente_id: roleName === 'OPERATIVO' ? marcaClienteId : selectedClienteId,
      division_id: roleName === 'OPERATIVO' ? marcaDivisionId : selectedDivisionId,
      division_nombre: divisionNombre || null,
      contrato_id: roleName === 'OPERATIVO' ? marcaContratoId : selectedContratoId,
      contrato_nombre: roleName === 'OPERATIVO' ? null : selectedContratoNode?.nombre || null,
      sucursal_id: roleName === 'OPERATIVO' ? marcaCorpoId : selectedSucursalId,
      sucursal_nombre: roleName === 'OPERATIVO' ? null : selectedSucursalNode?.nombre || null,
      puesto_id: roleName === 'OPERATIVO' ? marcaPuestoId : selectedPuestoId,
    };

    // Persistimos como array de objetos (string JSON)
    // Por seguridad, dejamos únicamente hojas conocidas para la división actual.
    const selectedSafe = selectedTemas.filter((t) => !!temasLeafTextById[t.id]);
    // Guardar TODO el resultado (marcado/desmarcado) para poder mostrar el formulario completo en la lista
    const leafs = temasFlat
      .filter((t) => t.isLeaf)
      .map((t) => ({
        id: t.id,
        text: t.text,
        checked: selectedTemaIdSet.has(t.id),
      }));
    const sections = buildTemasSectionsFromFlat(temasFlat, selectedTemaIdSet);
    return { meta, selected: selectedSafe, leafs, sections };
  };

  type GirImageEntry = {
    id?: number;
    name?: string;
    base64?: string;
    extension?: string;
    url?: string;
    localFileName?: string;
  };

  const openCamera = async () => {
    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
          return;
        }
      }
      setIsCameraVisible(true);
    } catch (e) {
      console.error('Error opening camera:', e);
      Alert.alert('Error', 'No se pudo abrir la cámara');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'La cámara no está lista');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        Alert.alert('Error', 'No se pudo capturar la foto');
        setIsCameraVisible(false);
        return;
      }
      const fileName = await saveFile({
        uri: photo.uri,
        originalName: 'photo',
        extension: 'jpg',
        type: 'image',
        prefix: 'general_induction',
      });
      setIsCameraVisible(false);
      const newEntry: GirImageEntry = { localFileName: fileName, extension: 'jpg' };
      const nextImages = [...images, newEntry];
      setPhotosDirty(true);
      setImages(nextImages);
      const lid = editingRecord?.id_local ? String(editingRecord.id_local) : '';
      if (lid.startsWith('local-')) {
        void updatePendingGirCreateActionImagenes(lid, nextImages);
      }
    } catch (e) {
      console.error('Error capturing photo:', e);
      Alert.alert('Error', 'No se pudo capturar la foto');
      setIsCameraVisible(false);
    }
  };

  const buildImagenesJsonFromImageEntries = async (entries: GirImageEntry[]): Promise<string> => {
    const out: { file_base64: string; extension: string; original_name?: string }[] = [];
    for (let i = 0; i < entries.length; i++) {
      const img = entries[i];
      const hasServerId = img.id != null && Number(img.id) > 0;
      if (hasServerId && !img.localFileName) {
        continue;
      }
      let file_base64 = '';
      if (img.localFileName != null && String(img.localFileName).trim() !== '') {
        try {
          const g = await getFile(String(img.localFileName));
          const ext = String(img.extension || 'jpg').replace(/^\./, '').trim() || 'jpg';
          file_base64 = `data:image/${mimeFromExtension(ext)};base64,${g.base64}`;
        } catch {
          file_base64 = '';
        }
      }
      if (!file_base64 && img.base64 && !hasServerId) {
        file_base64 = String(img.base64).trim();
      }
      if (!file_base64) continue;
      const ext = String(img.extension || 'jpg').replace(/^\./, '').trim() || 'jpg';
      out.push({
        file_base64,
        extension: ext,
        original_name: img.name || `general-induction-${Date.now()}-${i + 1}.${ext}`,
      });
    }
    return JSON.stringify(out);
  };

  const buildImagenesJsonForUpload = async (): Promise<string> => buildImagenesJsonFromImageEntries(images);

  const updatePendingGirCreateActionImagenes = async (idLocal: string, imageEntries: GirImageEntry[]) => {
    const imagenesJson = await buildImagenesJsonFromImageEntries(imageEntries);
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const idx = actions.findIndex(
      (a: any) =>
        a?.type === 'general_induction_register' &&
        a?.action === 'create' &&
        String(a?.id) === String(idLocal)
    );
    if (idx === -1) return;
    actions[idx] = {
      ...actions[idx],
      payload: { ...(actions[idx].payload || {}), imagenes: imagenesJson },
    };
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
  };

  const confirmRemoveImageAt = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar este archivo adjunto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeRemoveImageAt(index),
      },
    ]);
  };

  const executeRemoveImageAt = async (index: number) => {
    const img = images[index];
    if (!img) return;
    const registroServerId =
      editingRecord?.id && !String(editingRecord.id).startsWith('local-')
        ? String(editingRecord.id)
        : null;
    const imageId = img.id != null && Number(img.id) > 0 ? Number(img.id) : null;

    const finalizeRemoveImageAtIndex = async (idx: number) => {
      const im = images[idx];
      if (!im) return;
      if (im.localFileName) {
        try {
          await deleteFile(String(im.localFileName));
        } catch {
          /* idempotente */
        }
      }
      const nextImages = images.filter((_, i) => i !== idx);
      setPhotosDirty(true);
      setImages(nextImages);
      const lid = editingRecord?.id_local ? String(editingRecord.id_local) : '';
      if (lid.startsWith('local-')) {
        await updatePendingGirCreateActionImagenes(lid, nextImages);
      }
    };

    if (imageId && registroServerId) {
      const connected = await getConnectionStatus();
      if (connected) {
        const res = await deleteGeneralInductionRegisterImage({
          registroId: registroServerId,
          imageId,
          refreshAccessToken,
          logout,
        });
        if (!res.status) {
          Alert.alert('Error', res.message || 'No se pudo eliminar el archivo');
          return;
        }
        await removeImageFromGeneralInductionCache(registroServerId, imageId);
        if (editingRecord?.id_local) {
          await removeImageFromGeneralInductionCache(editingRecord.id_local, imageId);
        }
        await finalizeRemoveImageAtIndex(index);
        return;
      }
      const actionsStr = await AsyncStorage.getItem('evaluations_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      const dedup = actions.filter(
        (a: any) =>
          !(
            a.type === 'general_induction_register' &&
            a.action === 'delete_file' &&
            String(a.id) === String(registroServerId) &&
            Number(a.payload?.imageId) === imageId
          )
      );
      dedup.push({
        id: registroServerId,
        action: 'delete_file',
        type: 'general_induction_register',
        payload: { imageId },
        synced: false,
      });
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(dedup));
      await removeImageFromGeneralInductionCache(registroServerId, imageId);
      if (editingRecord?.id_local) {
        await removeImageFromGeneralInductionCache(editingRecord.id_local, imageId);
      }
      await finalizeRemoveImageAtIndex(index);
      return;
    }

    await finalizeRemoveImageAtIndex(index);
  };

  const girCacheRowMatches = (item: any, r: GeneralInductionRegisterRecord) => {
    const idStr = r.id != null && r.id !== '' ? String(r.id) : '';
    const lid = r.id_local != null && r.id_local !== '' ? String(r.id_local) : '';
    return (
      (idStr && String(item.id) === idStr) ||
      (lid && String(item.id_local) === lid) ||
      (lid && String(item.id) === lid) ||
      (idStr && String(item.id_local) === idStr)
    );
  };

  const patchGirRecordImagesInCache = async (
    r: GeneralInductionRegisterRecord,
    nextImages: any[]
  ) => {
    const all = await readAllGeneralInductionRegisterRecords();
    const next = all.map((item: any) =>
      girCacheRowMatches(item, r) ? { ...item, images: nextImages } : item
    );
    await writeAllGeneralInductionRegisterRecords(next);
  };

  const confirmRemoveListImage = (r: GeneralInductionRegisterRecord, img: any, imageIndex: number) => {
    Alert.alert('Confirmar', '¿Eliminar este archivo adjunto del registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeRemoveListImage(r, img, imageIndex),
      },
    ]);
  };

  const executeRemoveListImage = async (r: GeneralInductionRegisterRecord, img: any, imageIndex: number) => {
    const regIdStr = r.id != null && r.id !== '' ? String(r.id) : '';
    const registroServerId =
      regIdStr && !regIdStr.startsWith('local-') && Number(regIdStr) > 0 ? regIdStr : null;
    const imageId = img?.id != null && Number(img.id) > 0 ? Number(img.id) : null;

    const imgs = Array.isArray((r as any).images) ? [...(r as any).images] : [];
    const nextImages = imgs.filter((_: any, i: number) => i !== imageIndex);

    const deleteLocalStored = async () => {
      if (img?.localFileName != null && String(img.localFileName).trim() !== '') {
        try {
          await deleteFile(String(img.localFileName));
        } catch {
          /* idempotente */
        }
      }
    };

    if (imageId && registroServerId) {
      const connected = await getConnectionStatus();
      if (connected) {
        const res = await deleteGeneralInductionRegisterImage({
          registroId: registroServerId,
          imageId,
          refreshAccessToken,
          logout,
        });
        if (!res.status) {
          Alert.alert('Error', res.message || 'No se pudo eliminar el archivo');
          return;
        }
        await removeImageFromGeneralInductionCache(registroServerId, imageId);
        if (r.id_local) await removeImageFromGeneralInductionCache(String(r.id_local), imageId);
        await deleteLocalStored();
        await fetchRecords();
        return;
      }
      const actionsStr = await AsyncStorage.getItem('evaluations_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      const dedup = actions.filter(
        (a: any) =>
          !(
            a.type === 'general_induction_register' &&
            a.action === 'delete_file' &&
            String(a.id) === String(registroServerId) &&
            Number(a.payload?.imageId) === imageId
          )
      );
      dedup.push({
        id: registroServerId,
        action: 'delete_file',
        type: 'general_induction_register',
        payload: { imageId },
        synced: false,
      });
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(dedup));
      await removeImageFromGeneralInductionCache(registroServerId, imageId);
      if (r.id_local) await removeImageFromGeneralInductionCache(String(r.id_local), imageId);
      await deleteLocalStored();
      await fetchRecords();
      return;
    }

    await deleteLocalStored();
    await patchGirRecordImagesInCache(r, nextImages);
    const pendingCreateId = regIdStr.startsWith('local-')
      ? regIdStr
      : String(r.id_local || '').startsWith('local-')
        ? String(r.id_local)
        : '';
    if (pendingCreateId) {
      await updatePendingGirCreateActionImagenes(pendingCreateId, nextImages);
    }
    await fetchRecords();
  };

  const validateSaveForm = (): string | null => {
    if (roleName == null) return 'Cargando contexto de marca...';
    if (roleName === 'OPERATIVO') {
      if (!hasCurrentMarca) return 'Debes tener una marca activa para usar este módulo.';
      if (!marcaClienteId || !marcaCorpoId || !marcaDivisionId || !marcaContratoId || !marcaPuestoId) {
        return 'No se pudo determinar cliente, sucursal, división, contrato o puesto desde la marca actual';
      }
    } else {
      if (!selectedEmpresaId || !selectedClienteId || !selectedSucursalId) {
        return 'Empresa, cliente y sucursal son obligatorios';
      }
      if (!selectedDivisionId || !selectedDivisionNode) {
        return 'División es obligatoria';
      }
      if (!selectedContratoId) return 'Contrato es obligatorio';
      if (!selectedPuestoId) return 'Puesto es obligatorio';
    }
    if (!firmaResponsableHash.trim()) return 'Firma responsable (QR/Generar) es obligatoria';
    return null;
  };

  const handleSave = () => {
    const err = validateSaveForm();
    if (err) {
      Alert.alert('Error', err);
      return;
    }
    const temasPayloadDraft = buildTemasPayload(
      roleName === 'OPERATIVO' ? '' : selectedDivisionNode?.nombre || ''
    );
    if (!Array.isArray(temasPayloadDraft.selected) || temasPayloadDraft.selected.length === 0) {
      Alert.alert('Error', 'Debe seleccionar al menos 1 tema (checkbox)');
      return;
    }
    Alert.alert('Confirmar', '¿Desea guardar el registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void executeSave() },
    ]);
  };

  const executeSave = async () => {
    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const err = validateSaveForm();
      if (err) {
        Alert.alert('Error', err);
        setIsSubmitting(false);
        return;
      }

      let divisionNombre = '';
      if (roleName === 'OPERATIVO') {
        const currentMarcaStr = await AsyncStorage.getItem('current_marca');
        if (currentMarcaStr) {
          try {
            const m = JSON.parse(currentMarcaStr);
            divisionNombre = String(
              m?.roleDivision?.division?.nombre || m?.role_division?.division?.nombre || ''
            );
          } catch {
            /* ignore */
          }
        }
      } else {
        divisionNombre = selectedDivisionNode?.nombre || '';
      }

      if (!divisionNombre.trim()) {
        Alert.alert('Error', 'No se pudo determinar el nombre de la división');
        setIsSubmitting(false);
        return;
      }

      const temasPayload = buildTemasPayload(divisionNombre);
      if (!Array.isArray(temasPayload.selected) || temasPayload.selected.length === 0) {
        Alert.alert('Error', 'Debe seleccionar al menos 1 tema (checkbox)');
        setIsSubmitting(false);
        return;
      }

      const empresaIdSave = roleName === 'OPERATIVO' ? marcaEmpresaId! : selectedEmpresaId!;
      const clienteIdSave = roleName === 'OPERATIVO' ? marcaClienteId! : selectedClienteId!;
      const corpoIdSave = roleName === 'OPERATIVO' ? marcaCorpoId! : selectedSucursalId!;
      const divisionIdSave = roleName === 'OPERATIVO' ? marcaDivisionId! : selectedDivisionId!;
      const contratoIdSave = roleName === 'OPERATIVO' ? marcaContratoId! : selectedContratoId!;
      const puestoIdSave = roleName === 'OPERATIVO' ? marcaPuestoId! : selectedPuestoId!;

      const imagenesJson = await buildImagenesJsonForUpload();

      const requestData = {
        empresa_id: empresaIdSave,
        cliente_id: clienteIdSave,
        corpo_id: corpoIdSave,
        division_id: divisionIdSave,
        contrato_id: contratoIdSave,
        puesto_id: puestoIdSave,
        division: divisionNombre,
        fecha: fecha.toISOString(),
        temas_a_tratar: JSON.stringify(temasPayload),
        colaboradores: JSON.stringify(
          colaboradoresList.map((c) => ({
            id_local: c.id_local,
            nombre: c.nombre,
            cedula: c.cedula,
            puesto_text: c.puesto_text,
            puesto_id: c.puesto_id,
            firma: getBase64Only(c.firma),
          }))
        ),
        capacitadores: JSON.stringify(
          capacitadoresList.map((c) => ({
            id_local: c.id_local,
            nombre: c.nombre,
            cedula: c.cedula,
            firma: getBase64Only(c.firma),
          }))
        ),
        firma_responsable: firmaResponsableHash.trim(),
        imagenes: imagenesJson,
      };

      const girImagesSnapshot = images.map((im) => ({
        id: im.id,
        name: im.name,
        extension: im.extension,
        url: im.url,
        localFileName: im.localFileName,
      }));

      const isConnected = await getConnectionStatus();

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        setIsSubmitting(false);
        return;
      }

      // create
      if (!editingRecord || (!editingRecord.id && !editingRecord.id_local)) {
        if (isConnected) {
          const result = await createGeneralInductionRegister({
            requestData,
            refreshAccessToken,
            logout,
          });
          if (!result.status) throw new Error(result.message || 'No se pudo crear el registro');
          if (result.data) {
            await upsertGeneralInductionRegisterFromServerData({ idLocal: null, serverRow: result.data });
          }
          Alert.alert('Éxito', result.message || 'Registro creado correctamente');
          setTimeout(() => {
            setIsCreating(false);
            resetForm(horaAccion);
            fetchRecords();
          }, 2000);
        } else {
          const id_local = generateRandomId();
          const newCacheRecord: GeneralInductionRegisterRecord = {
            id: id_local,
            id_local,
            empresa_id: requestData.empresa_id,
            cliente_id: requestData.cliente_id,
            corpo_id: requestData.corpo_id,
            division_id: requestData.division_id,
            contrato_id: requestData.contrato_id,
            puesto_id: requestData.puesto_id,
            division: requestData.division,
            fecha: requestData.fecha,
            temas_a_tratar: requestData.temas_a_tratar,
            colaboradores: requestData.colaboradores,
            capacitadores: requestData.capacitadores,
            firma_responsable: requestData.firma_responsable,
            created_at: new Date(horaAccion).toISOString(),
            created_by: String(employee?.id || ''),
            synced: false,
            images: girImagesSnapshot,
          };

          const actionsStr = await AsyncStorage.getItem('evaluations_actions');
          const actions = actionsStr ? JSON.parse(actionsStr) : [];
          actions.push({
            id: id_local,
            action: 'create',
            type: 'general_induction_register',
            payload: requestData,
            synced: false,
          });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

          const allGir = await readAllGeneralInductionRegisterRecords();
          await writeAllGeneralInductionRegisterRecords([
            ...allGir,
            { ...newCacheRecord, type: 'general_induction_register' },
          ]);

          Alert.alert('Éxito', 'Se guardó localmente y se sincronizará al recuperar conexión');
          setTimeout(() => {
            setIsCreating(false);
            resetForm(horaAccion);
            fetchRecords();
          }, 2000);
        }
        return;
      }

      // update
      const recordId = editingRecord.id || editingRecord.id_local;
      if (!recordId) return;

      const serverUpdateId =
        editingRecord.id && !String(editingRecord.id).startsWith('local-') ? String(editingRecord.id) : null;

      if (isConnected && serverUpdateId) {
        try {
          const updatePayload: Record<string, unknown> = {
            empresa_id: empresaIdSave,
            cliente_id: clienteIdSave,
            corpo_id: corpoIdSave,
            division_id: divisionIdSave,
            contrato_id: contratoIdSave,
            puesto_id: puestoIdSave,
            division: requestData.division,
            fecha: requestData.fecha,
            temas_a_tratar: requestData.temas_a_tratar,
            colaboradores: requestData.colaboradores,
            capacitadores: requestData.capacitadores,
            firma_responsable: requestData.firma_responsable,
          };
          if (photosDirty) {
            updatePayload.imagenes = await buildImagenesJsonForUpload();
          }
          const result = await updateGeneralInductionRegister({
            id: serverUpdateId,
            requestData: updatePayload as any,
            refreshAccessToken,
            logout,
          });
          if (!result.status) throw new Error(result.message || 'No se pudo actualizar el registro');
          if (result.data) {
            await upsertGeneralInductionRegisterFromServerData({
              idLocal: editingRecord.id_local || null,
              serverRow: result.data,
            });
          }
          Alert.alert('Éxito', result.message || 'Registro actualizado correctamente');
          const horaAccionAfter = await getHoraAccion();
          if (!horaAccionAfter) {
            Alert.alert('Error', 'No se pudo obtener la hora');
            return;
          }
          setTimeout(() => {
            setIsCreating(false);
            resetForm(horaAccionAfter);
            fetchRecords();
          }, 2000);
          return;
        } catch (e: any) {
          const msg = String(e?.message || e || '');
          console.warn('Error updating general induction register:', e);
          if (!msg.includes('status: 5') && !msg.includes('Network') && !msg.includes('fetch')) {
            throw e;
          }
        }
      }
      // offline fallback (incluye caso server 503, registros solo locales o sin id de servidor)
      {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        const isLocal = String(editingRecord.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
        if (isLocal) {
          const lid = String(editingRecord.id_local);
          let next = actions.filter(
            (a: any) =>
              !(
                a.type === 'general_induction_register' &&
                a.action === 'update' &&
                String(a.id) === lid
              )
          );
          const idx = next.findIndex(
            (a: any) => a.id === editingRecord.id_local && a.action === 'create' && a.type === 'general_induction_register'
          );
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              payload: { ...(next[idx].payload || {}), ...requestData },
              synced: false,
            };
          } else {
            next.push({
              id: recordId,
              action: 'create',
              type: 'general_induction_register',
              payload: { ...requestData, id_local: recordId },
              synced: false,
            });
          }
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
        } else {
          const filtered = actions.filter(
            (a: any) => !(a.id === recordId && a.action === 'update' && a.type === 'general_induction_register')
          );
          filtered.push({ id: recordId, action: 'update', type: 'general_induction_register', payload: requestData, synced: false });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
        }

        const allGir = await readAllGeneralInductionRegisterRecords();
        const updatedGir = allGir.map((item: any) => {
          if (item.id === recordId || item.id_local === recordId) {
            return {
              ...item,
              ...requestData,
              id: item.id,
              id_local: item.id_local,
              images: girImagesSnapshot,
              division_id: requestData.division_id,
              contrato_id: requestData.contrato_id,
              puesto_id: requestData.puesto_id,
              synced: false,
            };
          }
          return item;
        });
        await writeAllGeneralInductionRegisterRecords(updatedGir);

        Alert.alert('Éxito', 'El servidor no está disponible. Se guardó localmente y se sincronizará al recuperar conexión');
        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          Alert.alert('Error', 'No se pudo obtener la hora');
          return;
        }
        setTimeout(() => {
          setIsCreating(false);
          resetForm(horaAccion);
          fetchRecords();
        }, 2000);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteHandler = (record: GeneralInductionRegisterRecord) => {
    const recordId = record.id || record.id_local;
    if (!recordId) return;
    const rowKey = String(record.id || record.id_local || '');

    Alert.alert('Confirmar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteRecord(record, String(recordId), rowKey),
      },
    ]);
  };

  const executeDeleteRecord = async (
    record: GeneralInductionRegisterRecord,
    recordId: string,
    rowKey: string
  ) => {
    setDeletingRecordKey(rowKey);
    try {
      const isConnected = await getConnectionStatus();
      const isLocal =
        String(record.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
      if (isConnected && !isLocal) {
        const result = await deleteGeneralInductionRegister({ id: String(recordId), refreshAccessToken, logout });
        if (!result.status) throw new Error(result.message || 'No se pudo eliminar el registro');
        await removeGeneralInductionRegisterFromCacheByKeys(String(recordId), record.id_local);
        Alert.alert('Éxito', 'Registro eliminado');
        await fetchRecords();
        return;
      }

      const actionsStr = await AsyncStorage.getItem('evaluations_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      let updatedActions = actions;
      if (isLocal) {
        updatedActions = actions.filter(
          (a: any) =>
            !(
              a.type === 'general_induction_register' &&
              (a.action === 'create' || a.action === 'update') &&
              String(a.id) === String(record.id_local)
            )
        );
      } else {
        updatedActions = actions.filter(
          (a: any) => !(a.id === recordId && a.action === 'delete' && a.type === 'general_induction_register')
        );
        updatedActions.push({ id: recordId, action: 'delete', type: 'general_induction_register', synced: false });
      }
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

      await removeGeneralInductionRegisterFromCacheByKeys(String(recordId), record.id_local);

      Alert.alert('Eliminado', isLocal ? 'Se eliminó el registro local' : 'Se eliminará al sincronizar');
      await fetchRecords();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo eliminar');
    } finally {
      setDeletingRecordKey(null);
    }
  };

  const canShowMoreTemas = temasFlat.length > temasVisibleCount;

  const parseMetaFromTemas = (temasStr?: string | null) => {
    const temasObj = safeJsonParse<any>(temasStr, null);
    return temasObj?.meta || null;
  };

  // UI: collapsables tipo OpeningClosingPositionScreen
  const [expandedTemasById, setExpandedTemasById] = useState<Record<string, boolean>>({});
  const [expandedColaboradoresById, setExpandedColaboradoresById] = useState<Record<string, boolean>>({});
  const [expandedCapacitadoresById, setExpandedCapacitadoresById] = useState<Record<string, boolean>>({});
  const [expandedFirmaById, setExpandedFirmaById] = useState<Record<string, boolean>>({});
  const [expandedImagesById, setExpandedImagesById] = useState<Record<string, boolean>>({});

  const renderList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando registros...</ThemedText>
        </ThemedView>
      );
    }

    if (error) {
      return (
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (records.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay registros de inducción general.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {records.map((r) => {
          const itemKey = String(r.id || r.id_local || '');
          const meta = parseMetaFromTemas(r.temas_a_tratar);
          const contratoNombre = meta?.contrato_nombre || 'N/A';
          const sucursalNombre = meta?.sucursal_nombre || 'N/A';
          const fechaTxt = r.fecha ? convertDateTimestampToLocalString(r.fecha, false) : 'N/A';

          const temasParsed = parseTemasPayload(r.temas_a_tratar);
          const temasSelected = temasParsed.selected;
          const temasLeafs = temasParsed.leafs;
          const temasSections = temasParsed.sections;

          const colaboradores = safeJsonParse<any[]>(r.colaboradores, []);
          const capacitadores = safeJsonParse<any[]>(r.capacitadores, []);
          const images = Array.isArray((r as any).images) ? (r as any).images : [];

          const isTemasOpen = !!expandedTemasById[itemKey];
          const isColabsOpen = !!expandedColaboradoresById[itemKey];
          const isCapsOpen = !!expandedCapacitadoresById[itemKey];
          const isFirmaOpen = !!expandedFirmaById[itemKey];
          const isImagesOpen = !!expandedImagesById[itemKey];

          return (
            <ThemedView
              key={`gir-row-${String(r.id_local ?? '')}-${String(r.id ?? '')}`}
              style={styles.listItem}
            >
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>{sucursalNombre}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>Contrato: {contratoNombre}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>División: {r.division || meta?.division_nombre || 'N/A'}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>Fecha: {fechaTxt}</ThemedText>
                  {!r.synced && <ThemedText style={styles.unsyncedBadge}>Pendiente de sincronizar</ThemedText>}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItemDetails}>
                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedTemasById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>
                    {temasLeafs && temasLeafs.length > 0
                      ? `Temas (completo) (${temasLeafs.filter((l: any) => !!l?.checked).length}/${temasLeafs.length})`
                      : `Temas seleccionados (${temasSelected.length})`}
                  </ThemedText>
                  <Ionicons name={isTemasOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isTemasOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {temasSections && temasSections.length > 0 ? (
                      temasSections.map((sec) => {
                        const items = Array.isArray(sec?.items) ? sec.items : [];
                        const hasSubItems = items.length > 1 || (items.length === 1 && items[0]?.id !== sec?.id);
                        if (hasSubItems) {
                          return (
                            <ThemedView key={`sec-${sec.id}`} style={styles.temaSectionBlock}>
                              <ThemedText style={styles.temaSectionTitle}>{String(sec.text || '').trim() || '—'}</ThemedText>
                              {items.map((t) => {
                                const checked = !!t?.checked;
                                return (
                                  <ThemedView key={String(t?.id)} style={styles.fullTemaRow}>
                                    <Ionicons
                                      name={checked ? 'checkmark-circle' : 'close-circle'}
                                      size={18}
                                      color={checked ? '#34C759' : '#FF3B30'}
                                    />
                                    <ThemedText style={styles.detailLine}>{String(t?.text || '').trim() || '—'}</ThemedText>
                                  </ThemedView>
                                );
                              })}
                            </ThemedView>
                          );
                        }
                        const only = items[0];
                        const checked = !!only?.checked;
                        return (
                          <ThemedView key={`sec-leaf-${sec.id}`} style={styles.fullTemaRow}>
                            <Ionicons
                              name={checked ? 'checkmark-circle' : 'close-circle'}
                              size={18}
                              color={checked ? '#34C759' : '#FF3B30'}
                            />
                            <ThemedText style={styles.detailLine}>{String(sec.text || '').trim() || '—'}</ThemedText>
                          </ThemedView>
                        );
                      })
                    ) : temasLeafs && temasLeafs.length > 0 ? (
                      temasLeafs.map((t: any) => {
                        const checked = !!t?.checked;
                        return (
                          <ThemedView key={String(t?.id)} style={styles.fullTemaRow}>
                            <Ionicons
                              name={checked ? 'checkmark-circle' : 'close-circle'}
                              size={18}
                              color={checked ? '#34C759' : '#FF3B30'}
                            />
                            <ThemedText style={styles.detailLine}>{String(t?.text || '').trim() || '—'}</ThemedText>
                          </ThemedView>
                        );
                      })
                    ) : temasSelected.length > 0 ? (
                      temasSelected.map((t: any) => (
                        <ThemedText key={String(t?.id)} style={styles.detailLine}>
                          - {String(t?.text || '').trim() || '—'}
                        </ThemedText>
                      ))
                    ) : (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedColaboradoresById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Colaboradores ({colaboradores.length})</ThemedText>
                  <Ionicons name={isColabsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isColabsOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {colaboradores.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      colaboradores.map((c: any, idx: number) => {
                        const sigUri = formatSignatureForDisplay(c?.firma || null);
                        return (
                          <ThemedView key={String(c?.id_local || idx)} style={styles.personDetailCard}>
                            <ThemedText style={styles.personDetailTitle}>{String(c?.nombre || '').trim() || '—'}</ThemedText>
                            <ThemedText style={styles.detailLine}>Cédula: {String(c?.cedula || '').trim() || '—'}</ThemedText>
                            <ThemedText style={styles.detailLine}>Puesto: {String(c?.puesto_text || '').trim() || '—'}</ThemedText>
                            {sigUri ? (
                              <Image source={{ uri: sigUri }} style={styles.signaturePreview} resizeMode="contain" />
                            ) : (
                              <ThemedText style={styles.detailLine}>Firma: No</ThemedText>
                            )}
                          </ThemedView>
                        );
                      })
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedCapacitadoresById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Capacitadores ({capacitadores.length})</ThemedText>
                  <Ionicons name={isCapsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isCapsOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {capacitadores.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      capacitadores.map((c: any, idx: number) => {
                        const sigUri = formatSignatureForDisplay(c?.firma || null);
                        return (
                          <ThemedView key={String(c?.id_local || idx)} style={styles.personDetailCard}>
                            <ThemedText style={styles.personDetailTitle}>{String(c?.nombre || '').trim() || '—'}</ThemedText>
                            <ThemedText style={styles.detailLine}>Cédula: {String(c?.cedula || '').trim() || '—'}</ThemedText>
                            {sigUri ? (
                              <Image source={{ uri: sigUri }} style={styles.signaturePreview} resizeMode="contain" />
                            ) : (
                              <ThemedText style={styles.detailLine}>Firma: No</ThemedText>
                            )}
                          </ThemedView>
                        );
                      })
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedImagesById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Imágenes ({images.length})</ThemedText>
                  <Ionicons name={isImagesOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isImagesOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {images.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      <ThemedView style={styles.listImagesRow}>
                        {images.map((img: any, idx: number) => {
                          const localUri =
                            img?.localFileName != null && String(img.localFileName).trim() !== ''
                              ? getLocalFileDisplayUri(String(img.localFileName))
                              : '';
                          const base64Uri = String(img?.base64 || '').trim();
                          const uri =
                            localUri || base64Uri || appendTokenToUrl(String(img?.url || '').trim());
                          if (!uri) return null;
                          return (
                            <ThemedView
                              key={`img-${itemKey}-${String(img?.id ?? 'noid')}-${idx}`}
                              style={styles.listImageThumbWrap}
                            >
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => {
                                  setSelectedImageUrl(uri);
                                  setIsImagePreviewVisible(true);
                                }}
                              >
                                <Image source={{ uri }} style={styles.listImageThumb} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.girListImageTrashButton}
                                onPress={() => confirmRemoveListImage(r, img, idx)}
                                activeOpacity={0.85}
                                accessibilityLabel="Eliminar adjunto"
                              >
                                <Ionicons name="trash-outline" size={20} color="#fff" />
                              </TouchableOpacity>
                            </ThemedView>
                          );
                        })}
                      </ThemedView>
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedFirmaById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Firma responsable</ThemedText>
                  <Ionicons name={isFirmaOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isFirmaOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {!r.firma_responsable ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (() => {
                      const info = decodeFirmaHash(r.firma_responsable);
                      if (!info) return <ThemedText style={styles.detailLine}>QR sin información decodificable.</ThemedText>;
                      return (
                        <>
                          <ThemedText style={styles.detailLine}>Sesión: {info.sessionId}</ThemedText>
                          <ThemedText style={styles.detailLine}>Empleado: {info.empleadoId}</ThemedText>
                          <ThemedText style={styles.detailLine}>Lat/Lng: {info.latitud}, {info.longitud}</ThemedText>
                          <ThemedText style={styles.detailLine}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                )}

                <ThemedView style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startEditing(r)} activeOpacity={0.85}>
                    <Ionicons name="pencil" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.buttonText}>Editar</ThemedText>
                  </TouchableOpacity>
                  {!(r.id_local || String(r.id).startsWith('local-') || r.id === 0) && (
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.changesButton]}
                      onPress={() => {
                        setCambiosTitle(`Cambios - Registro #${r.id}`);
                        fetchCambios('c_registro_induccion_general', Number(r.id));
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.buttonText}>Cambios</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.listItemButton,
                      styles.deleteButton,
                      deletingRecordKey !== null && styles.buttonDisabled,
                    ]}
                    onPress={() => deleteHandler(r)}
                    activeOpacity={0.85}
                    disabled={deletingRecordKey !== null}
                  >
                    {deletingRecordKey === itemKey ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.buttonText}>Eliminar</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  const addPersona = (list: 'colab' | 'cap') => {
    const item: PersonaItem = { id_local: generateRandomId(), nombre: '', cedula: '', puesto_text: '', puesto_id: null, firma: null };
    if (list === 'colab') setColaboradoresList((prev) => [...prev, item]);
    else setCapacitadoresList((prev) => [...prev, item]);
    // expandir el nuevo item para edición rápida
    setTimeout(() => toggleExpandedPersona(list, item.id_local), 0);
  };

  const updatePersona = (list: 'colab' | 'cap', id_local: string, patch: Partial<PersonaItem>) => {
    const setter = list === 'colab' ? setColaboradoresList : setCapacitadoresList;
    setter((prev) => prev.map((p) => (p.id_local === id_local ? { ...p, ...patch } : p)));
  };

  const removePersona = (list: 'colab' | 'cap', id_local: string) => {
    const setter = list === 'colab' ? setColaboradoresList : setCapacitadoresList;
    setter((prev) => prev.filter((p) => p.id_local !== id_local));
  };

  const renderPersonaSection = (title: string, listKey: 'colab' | 'cap', items: PersonaItem[]) => {
    return (
      <ThemedView style={styles.sectionContainer}>
        <ThemedView style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.sectionBody}>
          {items.map((p, idx) => {
            const expanded = isPersonaExpanded(listKey, p.id_local);
            const displayName = (p.nombre || '').trim() || `${title.slice(0, -1)} ${idx + 1}`;
            return (
              <ThemedView key={p.id_local} style={styles.expandItem}>
                <TouchableOpacity
                  style={styles.expandHeader}
                  onPress={() => toggleExpandedPersona(listKey, p.id_local)}
                  activeOpacity={0.85}
                >
                  <ThemedView style={styles.expandHeaderContent}>
                    <ThemedText style={styles.expandHeaderText}>{displayName}</ThemedText>
                    {!!p.cedula && <ThemedText style={styles.expandHeaderSubText}>Cédula: {p.cedula}</ThemedText>}
                    {listKey === 'colab' && !!p.puesto_text && (
                      <ThemedText style={styles.expandHeaderSubText}>Puesto: {p.puesto_text}</ThemedText>
                    )}
                  </ThemedView>
                  <ThemedView style={styles.expandHeaderActions}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        removePersona(listKey, p.id_local);
                      }}
                      style={styles.removeExpandButton}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#000000" />
                  </ThemedView>
                </TouchableOpacity>

                {expanded && (
                  <ThemedView style={styles.expandContent}>
                    {listKey === 'colab' && (
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.formLabel}>Autocompletar colaborador (online)</ThemedText>
                        <ThemedView style={styles.firmaButtonsRow}>
                          <TouchableOpacity
                            style={styles.firmaBlueButton}
                            onPress={() => handleScanColaboradorQR(p.id_local)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.firmaBlueButtonText}>Escanear QR</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                        <ThemedView style={styles.codeRow}>
                          <TextInput
                            style={[styles.formInput, styles.codeInput]}
                            value={colaboradorCodigoInput[p.id_local] || ''}
                            onChangeText={(t) =>
                              setColaboradorCodigoInput((prev) => ({ ...prev, [p.id_local]: t }))
                            }
                            placeholder="Código del empleado"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.codeSearchButton}
                            onPress={async () => {
                              try {
                                const isConnected = await getConnectionStatus();
                                if (!isConnected) {
                                  Alert.alert('Sin conexión', 'Esta función requiere internet');
                                  return;
                                }
                                await fetchEmpleadoByCodigoForColaborador(
                                  p.id_local,
                                  colaboradorCodigoInput[p.id_local] || ''
                                );
                              } catch (e: any) {
                                Alert.alert('Error', e?.message || 'No se pudo buscar por código');
                              }
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="search" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.buttonText}>Buscar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      </ThemedView>
                    )}

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Nombre</ThemedText>
                      <TextInput
                        style={styles.formInput}
                        value={p.nombre}
                        onChangeText={(t) => updatePersona(listKey, p.id_local, { nombre: t })}
                        placeholder="Nombre"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Cédula</ThemedText>
                      <TextInput
                        style={styles.formInput}
                        value={p.cedula}
                        onChangeText={(t) => updatePersona(listKey, p.id_local, { cedula: t })}
                        placeholder="Cédula"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    {listKey === 'colab' && (
                      <>
                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Puesto</ThemedText>
                          <TextInput
                            style={styles.formInput}
                            value={p.puesto_text}
                            onChangeText={(t) => updatePersona(listKey, p.id_local, { puesto_text: t })}
                            placeholder="Puesto"
                            placeholderTextColor="#999"
                          />
                        </ThemedView>

                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Seleccionar puesto (sucursal)</ThemedText>
                          <ThemedView style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={p.puesto_id ?? 0}
                              onValueChange={(v) => {
                                const id = Number(v) || null;
                                const found = puestosForSelectedSucursal.find((pp) => pp.id === id);
                                updatePersona(listKey, p.id_local, {
                                  puesto_id: id,
                                  puesto_text: found ? found.nombre : p.puesto_text,
                                });
                              }}
                              enabled={
                                (roleName === 'OPERATIVO' ? marcaCorpoId : selectedSucursalId) != null &&
                                puestosForSelectedSucursal.length > 0
                              }
                              style={styles.picker}
                            >
                              <Picker.Item
                                label={
                                  (roleName === 'OPERATIVO' ? marcaCorpoId : selectedSucursalId)
                                    ? 'Seleccione puesto...'
                                    : 'Seleccione sucursal primero'
                                }
                                value={0}
                                color="#000000"
                              />
                              {puestosForSelectedSucursal.map((pp) => (
                                <Picker.Item key={pp.id} label={pp.nombre} value={pp.id} color="#000000" />
                              ))}
                            </Picker>
                          </ThemedView>
                        </ThemedView>
                      </>
                    )}

                    <ThemedText style={styles.formSectionTitle}>Firma</ThemedText>
                    {!p.firma ? (
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={() => openSignatureFor(listKey, p.id_local)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="create-outline" size={22} color="#007AFF" />
                        <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.signatureSaved}
                          onPress={() => openSignatureFor(listKey, p.id_local)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                          <ThemedText style={styles.signatureSavedText}>Firma registrada (toca para reemplazar)</ThemedText>
                        </TouchableOpacity>
                        <Image
                          source={{ uri: p.firma }}
                          style={styles.signaturePreview}
                          resizeMode="contain"
                        />
                      </>
                    )}
                  </ThemedView>
                )}
              </ThemedView>
            );
          })}

          <TouchableOpacity style={styles.addButton} onPress={() => addPersona(listKey)} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={24} color="#4CAF50" />
            <ThemedText style={styles.addButtonText}>Agregar {title.slice(0, -1)}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderPhotosSection = () => (
    <ThemedView style={styles.sectionContainer}>
      <ThemedView style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Fotos (opcional)</ThemedText>
      </ThemedView>
      <ThemedView style={styles.sectionBody}>
        <TouchableOpacity style={styles.captureImageButton} onPress={openCamera}>
          <Ionicons name="camera" size={20} color="#007AFF" />
          <ThemedText style={styles.captureImageButtonText}>
            {images.length > 0 ? 'Agregar otra foto' : 'Capturar foto'}
          </ThemedText>
        </TouchableOpacity>

        {images.length === 0 ? (
          <ThemedText style={styles.hintText}>Agrega una o varias fotos.</ThemedText>
        ) : (
          <ThemedView style={styles.thumbRow}>
            {images.map((img, idx) => {
              const localUri =
                img.localFileName != null && String(img.localFileName).trim() !== ''
                  ? getLocalFileDisplayUri(String(img.localFileName))
                  : '';
              const uri = localUri || String(img.base64 || '').trim() || appendTokenToUrl(String(img.url || '').trim());
              if (!uri) return null;
              return (
                <ThemedView key={`img-${idx}`} style={styles.thumbWrapper}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity style={styles.thumbDelete} onPress={() => confirmRemoveImageAt(idx)}>
                    <Ionicons name="trash" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              );
            })}
          </ThemedView>
        )}
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro inducción general" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedView style={styles.mainHeaderRow}>
              <Ionicons name="school-outline" size={22} color="#007AFF" />
              <ThemedText style={styles.title}>Registro inducción general</ThemedText>
            </ThemedView>
            <ThemedText style={styles.subtitle}>Control y firmas por puesto</ThemedText>
          </ThemedView>
          <ThemedView style={styles.titleDivider} />

          {!hasCurrentMarca && (
            <ThemedView style={styles.warningBox}>
              <ThemedText style={styles.warningText}>
                No se encontró una marca activa. Puede seleccionar la jerarquía manualmente en los filtros.
              </ThemedText>
            </ThemedView>
          )}

          {!isCreating ? (
            <>
          {!isStructureLoading &&
            Array.isArray(structure) &&
            structure.length > 0 &&
            roleName != null &&
            roleName !== 'OPERATIVO' && (
            <ThemedView style={styles.filtersContainer}>
              <ThemedView style={styles.filtersHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsHierarchyFiltersExpanded((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <ThemedText style={styles.filtersTitle}>Filtros jerárquicos</ThemedText>
                  <Ionicons
                    name={isHierarchyFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#007AFF"
                  />
                </TouchableOpacity>
                {isHierarchyFiltersExpanded && (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      void (async () => {
                        const tree = await loadMainStructureCache();
                        const snap = await syncMarcaFromStorage({
                          applyFiltersFromMarca: true,
                          structureTree: tree,
                        });
                        if (snap) await runFetchRecords(snap);
                        else await fetchRecords();
                      })();
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
              {isHierarchyFiltersExpanded && (
                <ThemedView style={styles.filtersContent}>
                  <HierarchyPickerFields
                    structure={structure}
                    levels={['cliente', 'contrato', 'sucursal']}
                    isLoading={isStructureLoading}
                    values={{
                      empresaId: filterEmpresaId,
                      clienteId: filterClienteId,
                      divisionId: filterDivisionId,
                      contratoId: filterContratoId,
                      sucursalId: filterCorpoId,
                    }}
                    onChange={handleFilterHierarchyChange}
                    renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}:</ThemedText>}
                    pickerStyle={styles.picker}
                    fieldGroupStyle={styles.filterGroup}
                  />
                </ThemedView>
              )}
            </ThemedView>
          )}

          {!!offlineMessage && !error && (
            <ThemedView style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color="#8A6D00" />
              <ThemedText style={styles.offlineBannerText}>{offlineMessage}</ThemedText>
            </ThemedView>
          )}

          {!isLoading && !error && (
            <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {renderList()}
            </>
          ) : (
            <ThemedView style={styles.formContainer}>
              <ThemedText style={styles.formTitle}>
                {editingRecord ? 'Editar registro' : 'Nuevo registro'}
              </ThemedText>

              {/* Fecha */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
                  <ThemedText style={styles.dateButtonText}>{convertDateTimestampToLocalString(fecha.toISOString(), false)}</ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fecha}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selected) => {
                      setShowDatePicker(false);
                      if (selected) setFecha(selected);
                    }}
                  />
                )}
              </ThemedView>

              {/* Estructura: solo usuarios no OPERATIVO; OPERATIVO usa current_marca al guardar */}
              {roleName !== null && roleName !== 'OPERATIVO' && (
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Estructura</ThemedText>
                </ThemedView>

                {(isStructureLoading || isDivisionOptionsLoading) ? (
                  <ThemedView style={styles.loadingInline}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <ThemedText style={styles.loadingInlineText}>
                      {isStructureLoading ? 'Cargando estructura...' : 'Cargando divisiones...'}
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.sectionBody}>
                    <HierarchyPickerFields
                      structure={structure}
                      levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                      isLoading={isStructureLoading || isDivisionOptionsLoading}
                      emptyPickerValue={0}
                      values={{
                        empresaId: selectedEmpresaId,
                        clienteId: selectedClienteId,
                        divisionId: selectedDivisionId,
                        contratoId: selectedContratoId,
                        sucursalId: selectedSucursalId,
                        puestoId: selectedPuestoId,
                      }}
                      onChange={handleFormHierarchyChange}
                      renderLabel={(text) => <ThemedText style={styles.formLabel}>{text}</ThemedText>}
                      pickerStyle={styles.picker}
                      fieldGroupStyle={styles.formGroup}
                    />
                  </ThemedView>
                )}
              </ThemedView>
              )}

              {/* Temas a tratar (como sección) */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Temas a tratar</ThemedText>
                </ThemedView>
                <ThemedView style={styles.sectionBody}>
                  <ThemedText style={styles.sectionSubtitle}>Seleccionados: {selectedTemas.length}</ThemedText>
                  {temasFlat.length === 0 ? (
                    <ThemedText style={styles.hintText}>No hay temas definidos para esta división.</ThemedText>
                  ) : (
                    <>
                      {temasVisible.map((item) => {
                        const checked = item.isLeaf ? selectedTemaIdSet.has(item.id) : false;
                        return (
                          <ThemedView key={item.key} style={[styles.temaItemRow, { paddingLeft: 8 + item.level * 14 }]}>
                            <ThemedView style={styles.temaItemLine}>
                              {item.isLeaf ? (
                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => toggleTemaLeaf(item.id)} activeOpacity={0.8}>
                                  <ThemedView style={styles.checkbox}>
                                    {checked ? <Ionicons name="checkmark" size={16} color="#FF9500" /> : null}
                                  </ThemedView>
                                </TouchableOpacity>
                              ) : (
                                <ThemedView style={styles.checkboxSpacer} />
                              )}
                              <ThemedText style={[styles.temaItemText, !item.isLeaf && styles.temaItemTextGroup]}>{item.text}</ThemedText>
                            </ThemedView>
                          </ThemedView>
                        );
                      })}

                      {canShowMoreTemas && (
                        <TouchableOpacity style={styles.addButton} onPress={() => setTemasVisibleCount((c) => c + 60)} activeOpacity={0.85}>
                          <Ionicons name="add-circle" size={24} color="#4CAF50" />
                          <ThemedText style={styles.addButtonText}>Mostrar más</ThemedText>
                        </TouchableOpacity>
                      )}

                      {temasVisibleCount > 100 && (
                        <TouchableOpacity style={[styles.addButton, styles.addButtonGray]} onPress={() => setTemasVisibleCount(100)} activeOpacity={0.85}>
                          <Ionicons name="remove-circle" size={24} color="#8E8E93" />
                          <ThemedText style={[styles.addButtonText, styles.addButtonTextGray]}>Mostrar menos</ThemedText>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </ThemedView>
              </ThemedView>

              {/* Participantes (listas expandibles) */}
              {renderPersonaSection('Colaboradores', 'colab', colaboradoresList)}
              {renderPersonaSection('Capacitadores', 'cap', capacitadoresList)}
              {renderPhotosSection()}

              {/* Firma responsable (QR) */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
                </ThemedView>
                <ThemedView style={styles.sectionBody}>
                  <ThemedView style={styles.firmaButtonsRow}>
                    <TouchableOpacity
                      style={[styles.firmaBlueButton, isGeneratingFirmaResponsable && styles.signatureQRButtonDisabled]}
                      onPress={handleGenerateFirmaResponsable}
                      disabled={isGeneratingFirmaResponsable}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.firmaBlueButtonText}>{isGeneratingFirmaResponsable ? 'Generando...' : 'Generar'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.firmaBlueButton} onPress={handleScanFirmaResponsable} activeOpacity={0.85}>
                      <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.firmaBlueButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {!firmaResponsableHash ? (
                    <ThemedText style={styles.hintText}>Debes generar o escanear una firma.</ThemedText>
                  ) : (
                    <ThemedView style={styles.firmaInfoBox}>
                      <ThemedView style={styles.firmaInfoHeader}>
                        <ThemedText style={styles.firmaInfoTitle}>Firma registrada</ThemedText>
                        <TouchableOpacity onPress={() => setFirmaResponsableHash('')} style={styles.firmaTinyTrash} activeOpacity={0.85}>
                          <Ionicons name="trash" size={14} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                      {(() => {
                        const info = decodeFirmaHash(firmaResponsableHash);
                        if (!info) return <ThemedText style={styles.hintText}>QR sin información decodificable.</ThemedText>;
                        return (
                          <>
                            <ThemedText style={styles.firmaInfoText}>Sesión: {info.sessionId}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Empleado: {info.empleadoId}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Lat/Lng: {info.latitud}, {info.longitud}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                          </>
                        );
                      })()}
                    </ThemedView>
                  )}
                </ThemedView>
              </ThemedView>

              {submitResponse && (
                <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                  <ThemedText style={styles.responseText}>
                    {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                    {submitResponse.message}
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.saveButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.buttonText}>Aceptar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.cancelButton]}
                  onPress={async () => {
                    setIsCreating(false);
                    const horaAccion = await getHoraAccion();
                    if (!horaAccion) {
                      Alert.alert('Error', 'No se pudo obtener la hora');
                      return;
                    }
                    resetForm(horaAccion);
                  }}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.buttonText}>Cancelar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />

      {/* Modal firma */}
      <Modal
        visible={signatureModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {signatureTarget?.list === 'colab' ? 'Firma colaborador' : 'Firma capacitador'}
              </ThemedText>
              <TouchableOpacity onPress={closeSignatureModal} activeOpacity={0.85}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <View style={styles.modalSignatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                onEmpty={onSignatureEmpty}
                descriptionText="Dibuja la firma en el área blanca"
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal} activeOpacity={0.85}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptSignature} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Camera Modal */}
      <Modal visible={isCameraVisible} animationType="slide" onRequestClose={() => setIsCameraVisible(false)}>
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraCancelButton} onPress={() => setIsCameraVisible(false)}>
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCaptureButton} onPress={capturePhoto}>
              <View style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />

      {/* Modal: vista previa de imagen */}
      <Modal
        visible={isImagePreviewVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setIsImagePreviewVisible(false);
          setSelectedImageUrl(null);
        }}
      >
        <View style={styles.modalOverlayDark}>
          <TouchableOpacity
            style={styles.imagePreviewClose}
            onPress={() => {
              setIsImagePreviewVisible(false);
              setSelectedImageUrl(null);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImageUrl ? (
            <Image source={{ uri: selectedImageUrl }} style={styles.imagePreviewFull} resizeMode="contain" />
          ) : (
            <ThemedText style={styles.emptyText}>No se pudo cargar la imagen</ThemedText>
          )}
        </View>
      </Modal>

      {QRScannerComponent}

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="GeneralInductionRegister"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollView: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: 100 },
  contentContainer: { padding: 16 },

  // Header principal (como LlavesScreen)
  titleContainer: { marginBottom: 8, alignItems: 'center' },
  mainHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#000000', textAlign: 'center' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.6, textAlign: 'center' },
  titleDivider: { height: 1, backgroundColor: '#E5E5EA', marginBottom: 16 },

  warningBox: { padding: 12, borderRadius: 10, backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FFE69C', marginBottom: 12 },
  warningText: { color: '#664D03' },

  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  formContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 8 },

  // Secciones estilo OpeningClosingPositionScreen
  sectionContainer: { width: '100%', marginTop: 14, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000000', flex: 1 },
  sectionBody: { marginTop: 10, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#EAEAEA' },
  sectionSubtitle: { fontSize: 12, color: '#666', marginBottom: 10, fontStyle: 'italic' },

  formGroup: { marginTop: 10 },
  formLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: '#333' },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  disabledField: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    marginBottom: 10,
  },
  disabledFieldText: { color: '#000', opacity: 0.7, fontSize: 14, fontWeight: '700' },

  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  picker: { height: 54, width: '100%', color: '#000', fontSize: 16 },
  pickerItem: { fontSize: 16, height: 54 },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: { fontSize: 16, color: '#000000' },

  // temas tree
  temaRow: { marginBottom: 6 },
  temaRowLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  temaChildren: { marginTop: 6 },
  // temas (lista plana)
  temaItemRow: { marginBottom: 10 },
  temaItemLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkboxContainer: { justifyContent: 'center' },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSpacer: { width: 24 },
  temaItemText: { color: '#000', flex: 1 },
  temaItemTextGroup: { fontWeight: '800' },

  emptyTextSmall: { color: '#000', opacity: 0.6 },
  smallHint: { color: '#000', opacity: 0.6, marginBottom: 8 },
  hintText: { marginTop: 6, fontSize: 12, color: '#666', fontStyle: 'italic' },

  // items expandibles (como inventario)
  expandItem: { marginBottom: 15, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  expandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#F5F5F5' },
  expandHeaderContent: { flex: 1, marginRight: 10 },
  expandHeaderText: { fontSize: 16, fontWeight: '600', color: '#000000' },
  expandHeaderSubText: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.7 },
  expandHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeExpandButton: { padding: 4 },
  expandContent: { padding: 15 },
  signaturePreview: { width: '100%', height: 140, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 10 },
  personDetailCard: { width: '100%', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, backgroundColor: '#FFFFFF', marginBottom: 12 },
  personDetailTitle: { fontSize: 14, fontWeight: '800', color: '#000000', marginBottom: 6 },

  formSectionTitle: { marginTop: 6, fontSize: 14, fontWeight: '800', color: '#007AFF', marginBottom: 6 },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  signatureButtonText: { color: '#007AFF', fontWeight: '700' },
  signatureSaved: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  signatureSavedText: { color: '#000', opacity: 0.7 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  codeInput: { flex: 1, marginBottom: 0 },
  codeSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  // acciones / agregar
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8, marginTop: 10, gap: 8 },
  addButtonText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  addButtonGray: { backgroundColor: '#F2F2F7' },
  addButtonTextGray: { color: '#8E8E93' },
  captureImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  captureImageButtonText: { color: '#007AFF', fontWeight: '700' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrapper: { position: 'relative' },
  thumb: { width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#F5F5F5' },
  thumbDelete: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // firma responsable
  signatureQRButtonDisabled: { opacity: 0.6 },
  firmaButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  firmaBlueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  firmaBlueButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  firmaInfoBox: { marginTop: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF' },
  firmaInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  firmaInfoTitle: { fontSize: 14, fontWeight: '800', color: '#000000' },
  firmaTinyTrash: { padding: 4 },
  firmaInfoText: { fontSize: 13, color: '#000000', opacity: 0.8, marginBottom: 4 },

  // list
  listContainer: { marginTop: 10 },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 12,
    overflow: 'hidden',
  },
  listItemHeader: { padding: 16 },
  listItemContent: {},
  listItemTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  listItemSubtitle: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.7 },
  unsyncedBadge: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#FF9500' },
  listItemDetails: { borderTopWidth: 1, borderTopColor: '#EEE', padding: 16 },
  // Filtros jerárquicos
  filtersContainer: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  filtersContent: {
    padding: 16,
    gap: 12,
    backgroundColor: '#F8F9FA',
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  // Collapsables en items (mismo patrón que OpeningClosingPositionScreen)
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
    backgroundColor: '#FAFAFA',
  },
  collapseButtonText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  collapsableContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },
  detailLine: { marginBottom: 6, color: '#000' },
  fullTemaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  temaSectionBlock: { marginBottom: 10 },
  temaSectionTitle: { fontWeight: '700', color: '#000', marginBottom: 6 },
  listImagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listImageThumbWrap: {
    position: 'relative',
  },
  listImageThumb: {
    width: 84,
    height: 84,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  girListImageTrashButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 6,
    zIndex: 2,
  },

  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  listItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: { backgroundColor: '#FF3B30' },
  saveButton: { backgroundColor: '#007AFF' },
  cancelButton: { backgroundColor: '#8E8E93' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  buttonDisabled: {
    opacity: 0.6,
  },
  responseContainer: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  responseSuccess: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  responseError: {
    backgroundColor: '#F8D7DA',
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  responseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
  filterGroupSearch: { marginBottom: 12 },

  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  addMiniButton: { backgroundColor: '#007AFF' },
  deleteMiniButton: { backgroundColor: '#FF3B30' },
  cancelMiniButton: { backgroundColor: '#8E8E93' },

  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#000', opacity: 0.7 },
  loadingInline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  loadingInlineText: { fontSize: 14, color: '#000' },

  // Modal firma (como OpeningClosingPositionScreen)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSignatureContainer: {
    height: 300,
    width: '100%',
  },
  cameraContainer: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  cameraControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  cameraCancelButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCaptureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
  },
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imagePreviewFull: {
    width: '100%',
    height: '85%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 10,
    padding: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    gap: 8,
  },
  modalAcceptButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorContainer: { padding: 14, borderRadius: 10, backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: '#B00020', fontWeight: '700' },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFEBAA',
    marginBottom: 12,
  },
  offlineBannerText: { flex: 1, color: '#8A6D00', fontWeight: '700' },
  emptyContainer: { padding: 14, borderRadius: 10, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA' },
  emptyText: { color: '#000', opacity: 0.6 },

  // signature modal (legacy - mantenido por compatibilidad, no se usa)
  signatureModalContainer: { flex: 1, backgroundColor: '#FFFFFF', padding: 16 },
  signatureModalTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 10 },
  signatureModalButtons: { marginTop: 12 },
});


