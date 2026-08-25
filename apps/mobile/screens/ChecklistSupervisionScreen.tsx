import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform, Modal, View, Image, Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import getCurrentUserDigitalSignature from '../hooks/getCurrentUserDigitalSignature';
import Ionicons from '@expo/vector-icons/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';
import * as Network from 'expo-network';
import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
import EmployeeSearchModal, { type EmployeeSearchHit } from '@/components/EmployeeSearchModal';
import { Collapsible } from '@/components/Collapsible';
import { useAuth } from '../contexts/AuthContext';
import { eventBus } from '../hooks/eventBus';
import getHoraAccion from '../hooks/getHoraAccion';
import getValidAccessTokenOrLogout from '../hooks/getValidAccessTokenOrLogout';
import { useQRScanner } from '../hooks/useQRScanner';
import authedFetch from '../hooks/authedFetch';
import {
  createChecklistSupervision,
  deleteChecklistSupervision,
  listChecklistSupervision,
  ChecklistSupervisionItem,
  updateChecklistSupervision,
  updateChecklistSupervisionFirmaSupervisor,
} from '../hooks/checklistSupervisionFunctions';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
  loadChecklistSupervisionCacheForPuesto,
  mergeChecklistSupervisionServerIntoCacheForPuesto,
  saveChecklistSupervisionCacheForPuesto,
  normalizeChecklistRowForCache,
  dedupeChecklistRows,
  resolveChecklistRowPuestoId,
  applyServerPayloadToCachedChecklistRow,
} from '@/hooks/checklistSupervisionCacheStorage';
import {
  loadPuestoArticulosForTable,
  refreshPuestoArticulosFromServer,
  rewritePuestoArticulosInMainStructure,
} from '@/hooks/puestoArticulosSync';
import { prioritizePlanByArticuloNomencladorId } from '@/hooks/prioritizePlanByArticuloNomencladorId';
import ArticuloMantenimientoArchivosModal from '@/components/ArticuloMantenimientoArchivosModal';
import type { ArticuloMantenimientoPendingFile } from '@/utils/articuloMantenimientoFiles';
import { serializeArticulosPuestoForStorage } from '@/utils/articuloMantenimientoFiles';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { deleteFile, getLocalFileDisplayUri, saveFile } from '@/hooks/fileStorage';
import {
  clearChecklistSupervisionFormDraft,
  collectChecklistFormDraftLocalFileNames,
  deleteChecklistSupervisionFormDraftFiles,
  loadChecklistSupervisionFormDraft,
  persistEvaluationPhotosForDraft,
  removeChecklistSupervisionFormDraftMeta,
  saveChecklistSupervisionFormDraft,
  type ChecklistSupervisionFormDraft,
} from '@/hooks/checklistSupervisionFormDraftStorage';
import {
  isChecklistSupervisionIncidentLinkComplete,
  type ChecklistSupervisionIncidentLinkParams,
} from '@/hooks/checklistSupervisionIncidentLink';
import {
  MODULES_RELEASE_UPDATED_EVENT,
  readModulesReleaseFromStorage,
} from '@/hooks/getModulesRelease';
import Constants from 'expo-constants';
import { isStoredPlanillasTokenValid, readStoredPlanillasToken } from '@/hooks/planillasTokenStorage';
import PlanillasPasswordRevalidationModal from '@/components/PlanillasPasswordRevalidationModal';

const CHECKLIST_SUPERVISION_PHOTO_PREFIX = 'checklist_supervision';

/** Alcance listado/caché: puesto (puesto_id). */
type ChecklistListPuestoScope = { filterPuestoId: number | null };

type ChecklistSupervisionUI = ChecklistSupervisionItem & { id_local?: string };

function checklistRowShowsOfflineBadge(it: ChecklistSupervisionUI): boolean {
  if (Number(it.id) === 0) return true;
  const loc = it.id_local;
  return loc != null && String(loc).trim() !== '';
}

function checklistListKey(it: ChecklistSupervisionUI, index: number): string {
  const id = Number(it.id ?? 0);
  const idLocal = String(it.id_local ?? '').trim();
  if (id > 0) {
    return idLocal ? `checklist-${id}-${idLocal}` : `checklist-${id}`;
  }
  if (idLocal) return `checklist-local-${idLocal}`;
  return `checklist-idx-${index}`;
}

/** Nombres para título de fila; offline/API sin include suele venir sin `cliente`/`corpo`/`puesto`. */
function resolveChecklistHierarchyLabels(
  tree: any[],
  puestoId: number | null | undefined
): { cliente: string; corpo: string; puesto: string; codigo: string } {
  const pid = Number(puestoId);
  const empty = { cliente: '', corpo: '', puesto: '', codigo: '' };
  if (!Array.isArray(tree) || !Number.isFinite(pid) || pid <= 0) return empty;

  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of cliente?.division || []) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              if (Number(puesto?.id) === pid) {
                return {
                  cliente: String(cliente?.nombre ?? '').trim(),
                  corpo: String(sucursal?.nombre ?? '').trim(),
                  puesto: String(puesto?.nombre ?? '').trim(),
                  codigo: String((puesto as any)?.codigo ?? '').trim(),
                };
              }
            }
          }
        }
      }
    }
  }
  return empty;
}

// Tipos para estructura jerárquica
type StructureNode = {
  id: number;
  nombre: string;
  clientes?: StructureNode[];
  division?: StructureNode[];
  contratos?: StructureNode[];
  sucursales?: StructureNode[];
  puestos?: StructureNode[];
};

type HierarchyPath = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  sucursalId: number | null;
  puestoId: number | null;
};

// Tipos para evaluación dinámica
type EvaluationPhotoItem = {
  id: string;
  value?: string;
  file_name?: string;
  localFileName?: string;
  imageOrientation?: 'horizontal' | 'vertical';
};

type EvaluationInput = {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'photo' | 'checkbox';
  title?: string;
  value: string;
  options?: string[]; // Para select
  imageOrientation?: 'horizontal' | 'vertical'; // Para fotos (como StaffEvaluationsScreen)
  file_name?: string; // Solo para registros sincronizados (se establece en backend)
  /** Archivo en `Paths.document` (solo borrador/local; el base64 va al API al enviar). */
  localFileName?: string;
  /** Varias fotos por punto (formato nuevo). */
  photos?: EvaluationPhotoItem[];
};

type EvaluationSubsection = {
  id: string;
  title: string;
  inputs: EvaluationInput[];
  /** Detalle libre del punto evaluado. */
  detalle?: string;
  /** Si es true, no se puede eliminar (plantilla). Las añadidas por el usuario quedan en false. */
  isPredefined?: boolean;
};

type EvaluationSection = {
  id: string;
  title: string;
  subsections: EvaluationSubsection[];
  isPredefined: boolean; // Si es true, no se puede eliminar
};

/** La pregunta va en `subsection.title`; "Respuesta" en inputs de plantilla no se muestra. */
function shouldShowInputTitle(inputTitle: string | undefined, subsectionTitle?: string): boolean {
  const t = String(inputTitle ?? '').trim();
  if (!t || t.toLowerCase() === 'respuesta') return false;
  const sub = String(subsectionTitle ?? '').trim();
  return !sub || t !== sub;
}

function isEvaluationPhotoInput(input: EvaluationInput): boolean {
  return (
    input.type === 'photo' ||
    (input.type === 'text' && String(input.title ?? '').toLowerCase().includes('foto'))
  );
}

type EvaluationInputType = 'text' | 'textarea' | 'select' | 'date' | 'photo' | 'checkbox';

const EVALUATION_INPUT_TYPE_OPTIONS: Array<{
  type: EvaluationInputType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { type: 'text', label: 'Texto', icon: 'text-outline' },
  { type: 'textarea', label: 'Texto largo', icon: 'document-text-outline' },
  { type: 'select', label: 'Select', icon: 'list-outline' },
  { type: 'date', label: 'Fecha', icon: 'calendar-outline' },
  { type: 'photo', label: 'Multifoto', icon: 'images-outline' },
  { type: 'checkbox', label: 'Checkbox', icon: 'checkbox-outline' },
];

/** Recoge `localFileName` de una subsección (incl. multifotos) para borrar de disco. */
function collectLocalFileNamesFromSubsection(subsection: EvaluationSubsection): string[] {
  const names = new Set<string>();
  for (const input of subsection.inputs || []) {
    if (!isEvaluationPhotoInput(input) && input.type !== 'photo') {
      const ln = String(input.localFileName ?? '').trim();
      if (ln) names.add(ln);
      continue;
    }
    const photos = normalizePhotoInput(input);
    for (const photo of photos) {
      const ln = String(photo.localFileName ?? '').trim();
      if (ln) names.add(ln);
    }
    const top = String(input.localFileName ?? '').trim();
    if (top) names.add(top);
  }
  return [...names];
}

// Tipos para artículos del puesto (similar a EntregaPuestosScreen)
interface ArticuloForm {
  id: number;
  nombre: string;
  tipo?: string;
  /** Clave estable para React (plan-123 / asignado-456); evita colisión Plan vs Asignado con mismo id numérico. */
  rowKey?: string;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: 'Bueno' | 'Malo' | 'No está';
  observaciones?: string;
  ultimo_mantenimiento_id?: number | null;
  mantenimiento_files?: ArticuloMantenimientoPendingFile[];
}

function articuloListKey(art: Pick<ArticuloForm, 'id' | 'tipo' | 'rowKey'>, index = 0): string {
  if (art.rowKey && String(art.rowKey).trim()) return String(art.rowKey).trim();
  const tipo = String(art.tipo ?? '').toLowerCase();
  const prefix = tipo.includes('asignado') ? 'asignado' : 'plan';
  const id = Number(art.id);
  if (Number.isFinite(id) && id > 0) return `${prefix}-${id}`;
  return `articulo-${index}`;
}

function evaluationInputKey(sectionId: string, subsectionId: string, inputId: string): string {
  return `${sectionId}::${subsectionId}::${inputId}`;
}

/** Reloj de 24 h sin aplicar zona local (HH:mm). */
const wallClockDate = (hours: number, minutes: number): Date =>
  new Date(1970, 0, 1, hours, minutes, 0, 0);

const formatTimeHHmm = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const parseTimeHHmm = (s: string | null | undefined): Date => {
  if (!s || typeof s !== 'string') return wallClockDate(0, 0);
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return wallClockDate(0, 0);
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return wallClockDate(hh, mm);
};

/**
 * Hora de acción para inicio/fin: usa componentes UTC del timestamp
 * (server_time / TIME en BD) para no restar la zona local (p. ej. 12:20 → 06:20).
 */
const timeDateFromHoraAccion = (horaAccion: number | Date): Date => {
  const src = horaAccion instanceof Date ? horaAccion : new Date(horaAccion);
  if (Number.isNaN(src.getTime())) {
    const n = new Date();
    return wallClockDate(n.getHours(), n.getMinutes());
  }
  return wallClockDate(src.getUTCHours(), src.getUTCMinutes());
};

/** Valor del DateTimePicker: hora de reloj del dispositivo, sin reconvertir por UTC. */
const timeDateFromPicker = (selectedDate: Date): Date =>
  wallClockDate(selectedDate.getHours(), selectedDate.getMinutes());

const normalizeTimeToHHmm = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    const hhmm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (hhmm) return `${String(Number(hhmm[1])).padStart(2, '0')}:${hhmm[2]}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    }
    return null;
  }
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

function normalizePhotoInput(input: EvaluationInput): EvaluationPhotoItem[] {
  if (Array.isArray(input.photos) && input.photos.length > 0) {
    return input.photos;
  }
  if (
    input.localFileName ||
    input.file_name ||
    (input.value && typeof input.value === 'string' && (input.value.startsWith('data:image/') || input.value.length > 100))
  ) {
    return [
      {
        id: `${input.id}-legacy`,
        value: input.value,
        file_name: input.file_name,
        localFileName: input.localFileName,
        imageOrientation: input.imageOrientation,
      },
    ];
  }
  return [];
}

function isCarnesEvaluationSection(section: EvaluationSection): boolean {
  const id = String(section.id ?? '').trim().toLowerCase();
  if (id === 'carnes') return true;
  return /carn[eé]s?/.test(String(section.title ?? '').trim().toLowerCase());
}

function isEmpresaCarneSubsection(subsection: Pick<EvaluationSubsection, 'id' | 'title'>): boolean {
  const id = String(subsection.id ?? '').trim().toLowerCase();
  if (id === 'car-sub-0') return true;
  return /carn[eé]\s+de\s+la\s+empresa/.test(String(subsection.title ?? '').trim().toLowerCase());
}

function isUserAddedSubsection(section: EvaluationSection, subsection: EvaluationSubsection): boolean {
  if (subsection.isPredefined === false) return true;
  if (subsection.isPredefined === true) return false;
  const id = String(subsection.id ?? '');
  if (id.startsWith('subsection-')) return true;
  return !section.isPredefined;
}

function resolveCarneFechaVencimientoId(subsection: EvaluationSubsection): string | null {
  if (isEmpresaCarneSubsection(subsection)) return null;
  const subId = String(subsection.id ?? '').trim();
  const subMatch = subId.match(/^car-sub-(\d+)$/i);
  if (subMatch) return `car-${subMatch[1]}-fecha-vencimiento`;
  const cal = subsection.inputs.find((inp) => inp.type === 'select' && /^(car-\d+)-cal$/i.test(inp.id));
  if (!cal) return null;
  const prefix = cal.id.match(/^(car-\d+)/i);
  return prefix ? `${prefix[1]}-fecha-vencimiento` : null;
}

type EmpleadoDocumento = {
  nombre: string;
  tipo: 'carn' | 'lic';
  identificador: number | string;
  fecha_vencimiento: string | Date | null;
};

const LICENCIA_SUBSECTION_DEFS: { code: string; title: string }[] = [
  { code: 'A1', title: 'A1 - (0 a 125cc) Bicimoto y motocicleta. (Hasta 250 cc) cuadr' },
  { code: 'A2', title: 'A2 - (126 a 500 cc) Bicimoto y motocicleta. (256 hasta los 50' },
  { code: 'A3', title: 'A3 - (501 cc en adelante) Bicimoto o motocicleta, cuadriciclo' },
  { code: 'B1', title: 'B1 - Vehículo < 4000 kg' },
  { code: 'B2', title: 'B2 - Vehículo 4001 a 8000 Kg' },
  { code: 'B3', title: 'B3 - (8.001 Kg en adelante, excepto vehículos pesados articul' },
  { code: 'B4', title: 'B4 - (8.001 Kg, vehículos pesados articulados), Vehículo comp' },
  { code: 'C2', title: 'C2 - Vehículos como Autobús, Buseta y Microbús' },
  { code: 'D1', title: 'D1 - Vehículos tractores de llanta' },
  { code: 'D2', title: 'D2 - Tractor de oruga' },
  { code: 'D3', title: 'D3 - Otro equipo especial no contemplado como D-1 o D-2' },
];

function buildLicenciaSubsection(def: { code: string; title: string }, idx: number): EvaluationSubsection {
  const slug = def.code.toLowerCase();
  return {
    id: `lic-sub-${slug}`,
    title: def.title,
    isPredefined: true,
    inputs: [
      {
        id: `lic-${slug}-cal`,
        type: 'select' as const,
        value: 'No aplica',
        options: ['Vigente', 'Vencido', 'No aplica'],
      },
      {
        id: `lic-${slug}-fecha-vencimiento`,
        type: 'date' as const,
        title: 'Fecha de vencimiento',
        value: '',
      },
      {
        id: `lic-${slug}-photo`,
        type: 'photo' as const,
        title: 'Foto',
        value: '',
        photos: [],
      },
    ],
  };
}

const LICENCIAS_SECTION: EvaluationSection = {
  id: 'licencias',
  title: 'Licencias',
  isPredefined: true,
  subsections: LICENCIA_SUBSECTION_DEFS.map(buildLicenciaSubsection),
};

function isLicenciasEvaluationSection(section: EvaluationSection): boolean {
  const id = String(section.id ?? '').trim().toLowerCase();
  if (id === 'licencias') return true;
  return /licencias/.test(String(section.title ?? '').trim().toLowerCase());
}

function resolveLicenciaCodeFromSubsection(subsection: EvaluationSubsection): string | null {
  const subId = String(subsection.id ?? '').trim();
  const idMatch = subId.match(/^lic-sub-([a-z0-9]+)$/i);
  if (idMatch) return idMatch[1].toUpperCase();
  const titleMatch = String(subsection.title ?? '').trim().match(/^([A-Z]\d+)\s*-/i);
  return titleMatch ? titleMatch[1].toUpperCase() : null;
}

function resolveLicenciaFechaVencimientoId(subsection: EvaluationSubsection): string | null {
  const code = resolveLicenciaCodeFromSubsection(subsection);
  if (!code) return null;
  return `lic-${code.toLowerCase()}-fecha-vencimiento`;
}

function resolveCarneDocumentoIdentificador(subsection: EvaluationSubsection): number | null {
  const subId = String(subsection.id ?? '').trim().toLowerCase();
  if (subId === 'car-sub-1') return 5;
  if (subId === 'car-sub-2') return 15;
  const title = String(subsection.title ?? '').trim().toLowerCase();
  if (/portaci[oó]n\s+de\s+armas/.test(title)) return 5;
  if (/agente\s+de\s+seguridad\s+privada/.test(title)) return 15;
  return null;
}

function normalizeLicenciaIdentificador(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function documentoFechaToIso(value: unknown): string {
  if (value == null || String(value).trim() === '') return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function resolveVigenciaFromExpiry(isoDate: string, referenceMs: number): 'Vigente' | 'Vencido' | 'No aplica' {
  if (!isoDate) return 'No aplica';
  const expiry = new Date(isoDate);
  if (Number.isNaN(expiry.getTime())) return 'No aplica';
  const ref = new Date(referenceMs);
  ref.setHours(23, 59, 59, 999);
  return expiry.getTime() < ref.getTime() ? 'Vencido' : 'Vigente';
}

function resolveEmpleadoDocumentosFromTree(tree: StructureNode[], empleadoId: number): EmpleadoDocumento[] {
  const eid = Number(empleadoId);
  if (!Array.isArray(tree) || !Number.isFinite(eid) || eid <= 0) return [];
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of cliente?.division || []) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              for (const plaza of (puesto as any)?.plazas || []) {
                const empleados = Array.isArray((plaza as any)?.empleados) ? (plaza as any).empleados : [];
                const emp = empleados.find((e: any) => Number(e?.id) === eid);
                if (emp && Array.isArray(emp.documentos)) {
                  return emp.documentos as EmpleadoDocumento[];
                }
              }
            }
          }
        }
      }
    }
  }
  return [];
}

function applyEmpleadoDocumentosToEvaluation(
  sections: EvaluationSection[],
  documentos: EmpleadoDocumento[],
  referenceMs: number,
): EvaluationSection[] {
  if (!Array.isArray(documentos) || documentos.length === 0) return sections;

  const carnDocs = documentos.filter((d) => d.tipo === 'carn');
  const licDocs = documentos.filter((d) => d.tipo === 'lic');

  return sections.map((section) => {
    if (isCarnesEvaluationSection(section)) {
      return {
        ...section,
        subsections: section.subsections.map((subsection) => {
          if (isEmpresaCarneSubsection(subsection)) return subsection;
          const carnId = resolveCarneDocumentoIdentificador(subsection);
          if (carnId == null) return subsection;
          const doc = carnDocs.find((d) => Number(d.identificador) === carnId);
          if (!doc?.fecha_vencimiento) return subsection;
          const isoDate = documentoFechaToIso(doc.fecha_vencimiento);
          if (!isoDate) return subsection;
          const vigencia = resolveVigenciaFromExpiry(isoDate, referenceMs);
          const dateId = resolveCarneFechaVencimientoId(subsection);
          return {
            ...subsection,
            inputs: subsection.inputs.map((inp) => {
              if (inp.type === 'select') return { ...inp, value: vigencia };
              if (dateId && inp.id === dateId) return { ...inp, value: isoDate };
              if (inp.type === 'date' || String(inp.id).includes('fecha-vencimiento')) {
                return { ...inp, value: isoDate };
              }
              return inp;
            }),
          };
        }),
      };
    }

    if (isLicenciasEvaluationSection(section)) {
      return {
        ...section,
        subsections: section.subsections.map((subsection) => {
          const licCode = resolveLicenciaCodeFromSubsection(subsection);
          if (!licCode) return subsection;
          const doc = licDocs.find(
            (d) => normalizeLicenciaIdentificador(d.identificador) === licCode,
          );
          if (!doc?.fecha_vencimiento) return subsection;
          const isoDate = documentoFechaToIso(doc.fecha_vencimiento);
          if (!isoDate) return subsection;
          const vigencia = resolveVigenciaFromExpiry(isoDate, referenceMs);
          const dateId = resolveLicenciaFechaVencimientoId(subsection);
          return {
            ...subsection,
            inputs: subsection.inputs.map((inp) => {
              if (inp.type === 'select') return { ...inp, value: vigencia };
              if (dateId && inp.id === dateId) return { ...inp, value: isoDate };
              if (inp.type === 'date' || String(inp.id).includes('fecha-vencimiento')) {
                return { ...inp, value: isoDate };
              }
              return inp;
            }),
          };
        }),
      };
    }

    return section;
  });
}

function ensureLicenciaFechaVencimientoInputs(section: EvaluationSection): EvaluationSection {
  if (!isLicenciasEvaluationSection(section)) return section;
  return {
    ...section,
    subsections: section.subsections.map((subsection) => {
      const dateId = resolveLicenciaFechaVencimientoId(subsection);
      if (!dateId) return subsection;
      const hasDate = subsection.inputs.some(
        (inp) =>
          inp.type === 'date' ||
          inp.id === dateId ||
          String(inp.id).includes('fecha-vencimiento'),
      );
      if (hasDate) return subsection;
      const dateInput: EvaluationInput = {
        id: dateId,
        type: 'date',
        title: 'Fecha de vencimiento',
        value: '',
      };
      const inputs = [...subsection.inputs];
      const selectIdx = inputs.findIndex((inp) => inp.type === 'select');
      inputs.splice(selectIdx >= 0 ? selectIdx + 1 : 0, 0, dateInput);
      return { ...subsection, inputs };
    }),
  };
}

function ensureLicenciasSection(sections: EvaluationSection[]): EvaluationSection[] {
  const licIdx = sections.findIndex((s) => isLicenciasEvaluationSection(s));
  const predefined = JSON.parse(JSON.stringify(LICENCIAS_SECTION)) as EvaluationSection;
  if (licIdx === -1) {
    const carnIdx = sections.findIndex((s) => isCarnesEvaluationSection(s));
    const next = [...sections];
    if (carnIdx >= 0) next.splice(carnIdx + 1, 0, predefined);
    else next.push(predefined);
    return next;
  }
  const existing = sections[licIdx];
  const mergedSubs = predefined.subsections.map((preSub) => {
    const found =
      existing.subsections.find((s) => s.id === preSub.id) ??
      existing.subsections.find(
        (s) => resolveLicenciaCodeFromSubsection(s) === resolveLicenciaCodeFromSubsection(preSub),
      );
    return found ? { ...preSub, ...found, isPredefined: true } : preSub;
  });
  const next = [...sections];
  next[licIdx] = { ...predefined, ...existing, subsections: mergedSubs, isPredefined: true };
  return next;
}

function migrateLegacyLicenciaConduccionFromCarnes(sections: EvaluationSection[]): EvaluationSection[] {
  return sections.map((section) => {
    if (!isCarnesEvaluationSection(section)) return section;
    return {
      ...section,
      subsections: section.subsections.filter((sub) => {
        const id = String(sub.id ?? '').trim().toLowerCase();
        const title = String(sub.title ?? '').trim().toLowerCase();
        if (id === 'car-sub-3') return false;
        return !/licencia\s+de\s+conducci[oó]n/.test(title);
      }),
    };
  });
}

function ensureCarnetNoAplicaDefaults(section: EvaluationSection): EvaluationSection {
  if (!isCarnesEvaluationSection(section)) return section;
  return {
    ...section,
    subsections: section.subsections.map((subsection) => {
      if (isEmpresaCarneSubsection(subsection)) return subsection;
      return {
        ...subsection,
        inputs: subsection.inputs.map((inp) => {
          if (inp.type !== 'select') return inp;
          const options = inp.options ?? ['Vigente', 'Vencido', 'No aplica'];
          const hasNoAplica = options.some((o) => String(o).toLowerCase() === 'no aplica');
          const normalizedOptions = hasNoAplica
            ? options
            : [...options, 'No aplica'];
          return {
            ...inp,
            options: normalizedOptions,
            value:
              inp.value == null || String(inp.value).trim() === ''
                ? 'No aplica'
                : inp.value,
          };
        }),
      };
    }),
  };
}

function ensureCarneFechaVencimientoInputs(section: EvaluationSection): EvaluationSection {
  if (!isCarnesEvaluationSection(section)) return section;
  return {
    ...section,
    subsections: section.subsections.map((subsection) => {
      if (isEmpresaCarneSubsection(subsection)) return subsection;
      const dateId = resolveCarneFechaVencimientoId(subsection);
      if (!dateId) return subsection;
      const hasDate = subsection.inputs.some(
        (inp) =>
          inp.type === 'date' ||
          inp.id === dateId ||
          String(inp.id).includes('fecha-vencimiento'),
      );
      if (hasDate) return subsection;
      const dateInput: EvaluationInput = {
        id: dateId,
        type: 'date',
        title: 'Fecha de vencimiento',
        value: '',
      };
      const inputs = [...subsection.inputs];
      const selectIdx = inputs.findIndex((inp) => inp.type === 'select');
      inputs.splice(selectIdx >= 0 ? selectIdx + 1 : 0, 0, dateInput);
      return { ...subsection, inputs };
    }),
  };
}

function migrateEmpresaCarneSubsection(subsection: EvaluationSubsection): EvaluationSubsection {
  if (!isEmpresaCarneSubsection(subsection)) return subsection;
  return {
    ...subsection,
    inputs: subsection.inputs
      .filter((inp) => {
        if (inp.type === 'date') return false;
        return !String(inp.id ?? '').includes('fecha-vencimiento');
      })
      .map((inp) => {
        if (inp.type !== 'select') return inp;
        const raw = String(inp.value ?? '').trim().toLowerCase();
        const value = raw === 'malo' || raw === 'vencido' ? 'Malo' : 'Bueno';
        return {
          ...inp,
          value,
          options: ['Bueno', 'Malo'],
        };
      }),
  };
}

function normalizeEvaluationSections(sections: EvaluationSection[]): EvaluationSection[] {
  const migrated = migrateLegacyLicenciaConduccionFromCarnes(sections);
  const withLicencias = ensureLicenciasSection(migrated);
  return withLicencias.map((section) => {
    const withDates = ensureCarneFechaVencimientoInputs(ensureLicenciaFechaVencimientoInputs(section));
    const withCarnetDefaults = ensureCarnetNoAplicaDefaults(withDates);
    return {
      ...withCarnetDefaults,
      subsections: withCarnetDefaults.subsections.map((subsection) => {
        const migrated = migrateEmpresaCarneSubsection(subsection);
        return {
          ...migrated,
          isPredefined: isUserAddedSubsection(withCarnetDefaults, migrated) ? false : (migrated.isPredefined ?? true),
          detalle: migrated.detalle ?? '',
          inputs: migrated.inputs.map((input) => {
            if (input.type !== 'photo') return input;
            const photos = normalizePhotoInput(input);
            return {
              ...input,
              photos,
              value: '',
              localFileName: undefined,
              file_name: undefined,
              imageOrientation: undefined,
            };
          }),
        };
      }),
    };
  });
}

function resolveEmpleadoCodigoFromTree(tree: StructureNode[], empleadoId: number): string {
  const eid = Number(empleadoId);
  if (!Array.isArray(tree) || !Number.isFinite(eid) || eid <= 0) return '';
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of cliente?.division || []) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              for (const plaza of (puesto as any)?.plazas || []) {
                const empleados = Array.isArray((plaza as any)?.empleados) ? (plaza as any).empleados : [];
                const emp = empleados.find((e: any) => Number(e?.id) === eid);
                if (emp) {
                  return String(emp?.codigo ?? emp?.codigo_empleado ?? '').trim();
                }
              }
            }
          }
        }
      }
    }
  }
  return '';
}

function empleadoFromSearchHit(hit: EmployeeSearchHit, tree: StructureNode[]): {
  id: number;
  nombre: string;
  codigo: string;
} {
  const codigoFromTree = resolveEmpleadoCodigoFromTree(tree, hit.empleadoId);
  const codigoFromTitle = hit.title.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? '';
  const nombre = hit.title.replace(/\s*\([^)]+\)\s*$/, '').trim() || hit.title;
  return {
    id: hit.empleadoId,
    nombre,
    codigo: codigoFromTree || codigoFromTitle,
  };
}

// Constantes predefinidas para Aseo y limpieza
const ASEO_LIMPIEZA_SECTIONS: EvaluationSection[] = [
  {
    id: 'limpieza-general',
    title: 'Limpieza general del área',
    isPredefined: true,
    subsections: [
      'Basureros', 'Mesas y Sillas', 'Escritorios', 'Teléfonos', 'Computadoras',
      'Archivos y Estantes', 'Vidrios', 'Paredes', 'Pisos', 'Esquinas y Orillas',
      'Sillones', 'Jefaturas', 'Exteriores', 'Ventiladores', 'Extintores',
      'Pasa Manos', 'Bibliotecas', 'Credenzas', 'Arturitos', 'Aéreos',
      'Rotulos', 'Puertas y Llavines', 'Canaletas y Tomas', 'Plantas y Macetas', 'Partes Altas'
    ].map((item, idx) => ({
      id: `lg-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `lg-${idx}-cal`,
          type: 'select' as const,
          value: '5',
          options: ['No aplica', '1', '2', '3', '4', '5'],
        },
        {
          id: `lg-${idx}-obs`,
          type: 'text' as const,
          title: 'Observaciones',
          value: '',
        },
        {
          id: `lg-${idx}-photo`,
          type: 'photo' as const,
          title: 'Foto',
          value: '',
        },
      ]
    }))
  },
  {
    id: 'cuarto-aseo',
    title: 'Cuarto de aseo',
    isPredefined: true,
    subsections: [
      'Documentos ISO Completos', 'Registros del Día Llenos', 'Pilas Limpias',
      'Utiles de Limpieza Buen Estado', 'Productos Etiquetados y Ordenados', 'Almacenamiento de Comidas'
    ].map((item, idx) => ({
      id: `ca-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `ca-${idx}-cal`,
          type: 'select' as const,
          value: '5',
          options: ['No aplica', '1', '2', '3', '4', '5'],
        },
        {
          id: `ca-${idx}-obs`,
          type: 'text' as const,
          title: 'Observaciones',
          value: '',
        },
        {
          id: `ca-${idx}-photo`,
          type: 'photo' as const,
          title: 'Foto',
          value: '',
        }
      ]
    }))
  },
  {
    id: 'servicios-sanitarios',
    title: 'Cuarto de aseo',
    isPredefined: true,
    subsections: [
      'Orinales', 'Sanitarios y Parte Trasera', 'Lavamanos y Grifería',
      'Espejos', 'Paredes y Puertas', 'Duchas', 'Partes Altas'
    ].map((item, idx) => ({
      id: `ss-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `ss-${idx}-cal`,
          type: 'select' as const,
          value: '5',
          options: ['No aplica', '1', '2', '3', '4', '5'],
        },
        {
          id: `ss-${idx}-obs`,
          type: 'text' as const,
          title: 'Observaciones',
          value: '',
        },
        {
          id: `ss-${idx}-photo`,
          type: 'photo' as const,
          title: 'Foto',
          value: '',
        }
      ]
    }))
  },
  {
    id: 'uniforme-presentacion',
    title: 'Uniforme y presentación',
    isPredefined: true,
    subsections: [
      {
        id: 'up-sub-0',
        title: 'Uniforme y Carnet',
        inputs: [
          {
            id: 'up-0-cal',
            type: 'select' as const,
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No aplica'],
          },
          {
            id: 'up-0-obs',
            type: 'text' as const,
            title: 'Observaciones',
            value: '',
          },
          {
            id: 'up-0-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
          }
        ]
      },
      {
        id: 'up-sub-1',
        title: 'Equipo De Proteccion Personal',
        inputs: [
          {
            id: 'up-1-cal',
            type: 'select' as const,
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No aplica'],
          },
          {
            id: 'up-1-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
          }
        ]
      }
    ]
  },
  {
    id: 'calificacion-general',
    title: 'Estado de los equipos',
    isPredefined: true,
    subsections: [
      {
        id: 'calificacion-general-item',
        title: 'Calificación general',
        inputs: [
          {
            id: 'cg-0-cal',
            type: 'select' as const,
            value: '5',
            options: ['1', '2', '3', '4', '5'],
          },
          {
            id: 'cg-0-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
          }
        ]
      }
    ]
  }
];

// Constantes predefinidas para Seguridad
const SEGURIDAD_SECTIONS: EvaluationSection[] = [
  {
    id: 'carnes',
    title: 'Carnés',
    isPredefined: true,
    subsections: [
      {
        id: 'car-sub-0',
        title: 'Carne de la empresa',
        isPredefined: true,
        inputs: [
          {
            id: 'car-0-cal',
            type: 'select' as const,
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No aplica'],
          },
          {
            id: 'car-0-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
            photos: [],
          }
        ]
      },
      {
        id: 'car-sub-1',
        title: 'Carne de Portación de Armas',
        inputs: [
          {
            id: 'car-1-cal',
            type: 'select' as const,
            value: 'No aplica',
            options: ['Vigente', 'Vencido', 'No aplica'],
          },
          {
            id: 'car-1-fecha-vencimiento',
            type: 'date' as const,
            title: 'Fecha de vencimiento',
            value: '',
          },
          {
            id: 'car-1-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
            photos: [],
          }
        ]
      },
      {
        id: 'car-sub-2',
        title: 'Carne de Agente de Seguridad Privada',
        inputs: [
          {
            id: 'car-2-cal',
            type: 'select' as const,
            value: 'No aplica',
            options: ['Vigente', 'Vencido', 'No aplica'],
          },
          {
            id: 'car-2-fecha-vencimiento',
            type: 'date' as const,
            title: 'Fecha de vencimiento',
            value: '',
          },
          {
            id: 'car-2-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
            photos: [],
          }
        ]
      },
    ]
  },
  JSON.parse(JSON.stringify(LICENCIAS_SECTION)) as EvaluationSection,
  {
    id: 'uniforme-seguridad',
    title: 'Uniforme',
    isPredefined: true,
    subsections: [
      {
        id: 'us-sub-0',
        title: 'SEG-PO-001 Código de vestimenta Seguridad',
        inputs: [
          {
            id: 'us-0-cal',
            type: 'select' as const,
            value: 'Cumple',
            options: ['Cumple', 'No cumple'],
          },
          {
            id: 'us-0-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
          }
        ]
      },
      {
        id: 'us-sub-1',
        title: 'Equipo de invierno: Botas de hule, paraguas y capa impermeable',
        inputs: [
          {
            id: 'us-1-cal',
            type: 'select' as const,
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No existe'],
          },
          {
            id: 'us-1-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
          }
        ]
      }
    ]
  },
  {
    id: 'bitacora',
    title: 'Bitácora',
    isPredefined: true,
    subsections: [
      'Anotaciones legibles, sin manchones ni tachaduras',
      'Nombre completo y firma en entrega y recibo de puesto',
      'No deben existir espacios en blanco',
      'Folios completos',
      'Escritura sólo con tinta azul (si aplica según el cliente)',
    ].map((item, idx) => ({
      id: `bit-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `bit-${idx}-1`,
          type: 'checkbox' as const,
          title: 'Resultado',
          value: 'true',
        },
        {
          id: `bit-${idx}-photo`,
          type: 'photo' as const,
          value: '',
        },
      ],
    })),
  },
  {
    id: 'marcas',
    title: 'Marcas',
    isPredefined: true,
    subsections: [
      'Dispositivos de marcas en buen estado',
      'SEG-F-038-Control de recorrido y marcas Electronicas (Completo, sin manchones ni tachaduras, y no debe estar completo antes de tiempo)',
      'Verificación del estado de las pastillas',
    ].map((item, idx) => ({
      id: `mar-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `mar-${idx}-1`,
          type: 'checkbox' as const,
          title: 'Resultado',
          value: 'true',
        },
        {
          id: `mar-${idx}-photo`,
          type: 'photo' as const,
          value: '',
        },
      ],
    })),
  },
  {
    id: 'perimetro',
    title: 'Perímetro',
    isPredefined: true,
    subsections: [
      'Rerrido por el perimetro revisando barreras perimetrales',
      'Revisar que no exitan activos cerca de las barreras perimetrales',
    ].map((item, idx) => ({
      id: `per-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `per-${idx}-1`,
          type: 'checkbox' as const,
          title: 'Resultado',
          value: 'true',
        },
        {
          id: `per-${idx}-photo`,
          type: 'photo' as const,
          value: '',
        },
      ],
    })),
  },
  {
    id: 'vehiculos',
    title: 'Vehículos',
    isPredefined: true,
    subsections: [
      'Revisar aleatoriamente el/los vehículos custodiados en el puesto',
    ].map((item, idx) => ({
      id: `veh-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `veh-${idx}-1`,
          type: 'checkbox' as const,
          title: 'Resultado',
          value: 'true',
        },
        {
          id: `veh-${idx}-photo`,
          type: 'photo' as const,
          value: '',
        },
      ],
    })),
  },
  {
    id: 'capacitacion-iso',
    title: 'Política integrada',
    isPredefined: true,
    subsections: [
      {
        id: 'pol-sub-0',
        title: 'ISO de calidad',
        isPredefined: true,
        inputs: [
          {
            id: 'pol-0-cual',
            type: 'text' as const,
            title: '¿Cual es?',
            value: '',
          },
          {
            id: 'pol-0-aporta',
            type: 'textarea' as const,
            title: '¿Cómo aporta?',
            value: '',
          },
        ],
      },
      {
        id: 'pol-sub-1',
        title: 'ISO de ambiente',
        isPredefined: true,
        inputs: [
          {
            id: 'pol-1-cual',
            type: 'text' as const,
            title: '¿Cual es?',
            value: '',
          },
          {
            id: 'pol-1-aporta',
            type: 'textarea' as const,
            title: '¿Cómo aporta?',
            value: '',
          },
        ],
      },
      {
        id: 'pol-sub-2',
        title: 'ISO de antisoborno',
        isPredefined: true,
        inputs: [
          {
            id: 'pol-2-cual',
            type: 'text' as const,
            title: '¿Cual es?',
            value: '',
          },
          {
            id: 'pol-2-aporta',
            type: 'textarea' as const,
            title: '¿Cómo aporta?',
            value: '',
          },
        ],
      },
      {
        id: 'pol-sub-3',
        title: 'ISO de seguridad',
        isPredefined: true,
        inputs: [
          {
            id: 'pol-3-cual',
            type: 'text' as const,
            title: '¿Cual es?',
            value: '',
          },
          {
            id: 'pol-3-aporta',
            type: 'textarea' as const,
            title: '¿Cómo aporta?',
            value: '',
          },
        ],
      },
    ],
  },
  {
    id: 'papeleria',
    title: 'Papelería',
    isPredefined: true,
    subsections: [
      ...[
        'SEG-F-016-Pernocte de vehículos',
        'SEG-F-017-Bitácora de revisión bicicletas detenidas y SEG-F-007-Bitácora de revisión motos detenidas',
        'SEG-F-018-Control de ingreso y salida de visitas y vehículos particulares',
        'SEG-F-019-Entradas y salida de materiales activos del cliente',
        'SEG-F-020-Control de ingreso y salida de vehículos Institucionales',
        'SEG-F-021-Registro de llaves',
        'SEG-F-022-Boleta de salida de vehículos',
        'SEG-F-023-Control de entrega de puesto',
        'SEG-F-024-Control de activos visitantes',
      ].map((item, idx) => ({
        id: `pap-sub-${idx}`,
        title: item,
        inputs: [
          {
            id: `pap-${idx}-1`,
            type: 'checkbox' as const,
            title: 'Resultado',
            value: 'true',
          },
          {
            id: `pap-${idx}-photo`,
            type: 'photo' as const,
            value: '',
          },
        ],
      })),
      {
        id: 'pap-sub-9',
        title: 'Número de Serie del arma vrs documento de matrícula',
        inputs: [
          {
            id: 'pap-9-1',
            type: 'text' as const,
            value: '',
          },
          {
            id: 'pap-9-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
          },
        ],
      },
    ],
  },
  {
    id: 'funcion',
    title: 'Función',
    isPredefined: true,
    subsections: [
      'Revisar aleatoriamente 3 puntos de la SEG-F-038-Guia de Funciones del puesto de cada lugar y anotar en las observaciones los hallazgos de todos los corpos visitados',
    ].map((item, idx) => ({
      id: `fun-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `fun-${idx}-1`,
          type: 'checkbox' as const,
          title: 'Resultado',
          value: 'true',
        },
        {
          id: `fun-${idx}-photo`,
          type: 'photo' as const,
          value: '',
        },
      ],
    })),
  }
];

const signatureWebStyle = `
  body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
  }
  .m-signature-pad {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
`;

function generateRandomId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function normalizeCantidadNecesaria(value: any): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

/**
 * Actualiza en main_structure_cache el último mantenimiento de los artículos del puesto
 * supervisado usando el estado actual del formulario de checklist.
 * Con esquema de fragmentos: lee/escribe `puesto_{id}_articulos` y mantiene compatibilidad
 * con `puestos_{id}_articulos` si existe en datos previos.
 * Solo actualiza caché local; no encola acciones de articulo_mantenimiento_actions.
 */
async function updateMainStructureCacheWithChecklist(
  selectedPuestoId: number | null,
  articulos: ArticuloForm[],
  options?: { horaAccion?: number }
) {
  try {
    if (!selectedPuestoId || !Array.isArray(articulos) || articulos.length === 0) return;
    const horaAccionValue = options?.horaAccion ?? Date.now();
    const articulosById = new Map<number, ArticuloForm>(
      articulos.map((a) => [a.id, a] as [number, ArticuloForm])
    );
    await rewritePuestoArticulosInMainStructure({
      puestoId: Number(selectedPuestoId),
      formsById: articulosById,
      horaAccionMs: horaAccionValue,
      origin: 'checklist_supervision',
    });
  } catch (e) {
    console.error('Error updating main_structure_cache from checklist:', e);
  }
}

/**
 * Actualiza activities_cache con el estado de artículos del checklist
 * solo si el puesto supervisado coincide con el puesto de current_marca.
 */
async function updateActivitiesCacheWithChecklist(
  selectedPuestoId: number | null,
  articulos: ArticuloForm[]
) {
  try {
    if (!selectedPuestoId || !Array.isArray(articulos) || articulos.length === 0) return;

    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) return;
    const currentMarca = JSON.parse(currentMarcaStr);
    const currentPuestoId = currentMarca?.puesto?.id;
    if (!currentPuestoId || currentPuestoId !== selectedPuestoId) {
      return;
    }

    const cacheStr = await AsyncStorage.getItem('activities_cache');
    if (!cacheStr) return;
    const parsed: any = JSON.parse(cacheStr);
    if (!Array.isArray(parsed)) return;

    const articulosById = new Map<number, ArticuloForm>(
      articulos.map((a) => [a.id, a] as [number, ArticuloForm])
    );

    const updatedActivities = parsed.map((act: any) => {
      if (!act?.is_revision_equipo || !Array.isArray(act.inventario)) return act;

      const updatedInventario = act.inventario.map((inv: any) => {
        const form = articulosById.get(Number(inv.id));
        if (!form) return inv;

        const estado = form.estado;
        const cantidad_real = form.cantidad_real;
        const observaciones = form.observaciones || '';
        const rev = inv.revision_equipo || {};

        return {
          ...inv,
          cantidad_requerida:
            inv.cantidad_requerida != null
              ? normalizeCantidadNecesaria(inv.cantidad_requerida)
              : normalizeCantidadNecesaria(form.cantidad_requerida),
          cantidad_real,
          estado,
          observaciones,
          revision_equipo: {
            ...rev,
            es_correcto: estado === 'Bueno',
            motivo_incorrecto: estado === 'Bueno' ? '-' : (observaciones || '-'),
          },
        };
      });

      return {
        ...act,
        inventario: updatedInventario,
      };
    });

    await AsyncStorage.setItem('activities_cache', JSON.stringify(updatedActivities));
  } catch (e) {
    console.error('Error updating activities_cache from checklist:', e);
  }
}

function dateToLocalString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatYMDToDMY(value?: string): string {
  const v = String(value || '').trim();
  if (!v) return '';
  const onlyDate = v.split('T')[0];
  const ymd = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
  const dmy = onlyDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  return onlyDate;
}

function decodeFirmaHash(hash: string): { sessionId?: string; empleadoId?: string; latitud?: string; longitud?: string; timestamp?: string } | null {
  try {
    const decoded = atob(hash);
    const parts = decoded.split(':');
    if (parts.length >= 5) {
      return {
        sessionId: parts[0],
        empleadoId: parts[1],
        latitud: parts[2],
        longitud: parts[3],
        timestamp: parts[4],
      };
    }
    return null;
  } catch {
    return null;
  }
}

function formatSignatureForDisplay(value?: string | null): string {
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
}

export default function ChecklistSupervisionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [queryAccessToken, setQueryAccessToken] = useState('');
  const refreshQueryAccessToken = useCallback(async () => {
    try {
      const t = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      setQueryAccessToken(t != null && String(t).trim() !== '' ? String(t).trim() : '');
    } catch {
      setQueryAccessToken('');
    }
  }, [refreshAccessToken, logout]);

  useEffect(() => {
    void refreshQueryAccessToken();
  }, [accessToken, refreshQueryAccessToken]);

  const appendTokenToUrl = useCallback((url: string) => {
    if (!url) return '';
    const fromContext = accessToken != null ? String(accessToken).trim() : '';
    const fromRefresh = queryAccessToken.trim();
    const token = fromContext || fromRefresh;
    if (!token) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }, [accessToken, queryAccessToken]);

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<ChecklistSupervisionUI[]>([]);

  // Estados para estructura jerárquica
  const [structure, setStructure] = useState<StructureNode[]>([]);
  const structureRef = useRef<StructureNode[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedCorpoId, setSelectedCorpoId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);

  // Estados para filtros
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);

  // Mensaje informativo jerarquía (cerrable)
  const [isHierarchyHintVisible, setIsHierarchyHintVisible] = useState(true);

  // Estados para formulario
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<ChecklistSupervisionUI | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingChecklistId, setDeletingChecklistId] = useState<number | string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [horaInicio, setHoraInicio] = useState<Date>(new Date());
  const [horaFin, setHoraFin] = useState<Date>(new Date());
  const [showTimePickerInicio, setShowTimePickerInicio] = useState(false);
  const [showTimePickerFin, setShowTimePickerFin] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<{ id: number; nombre: string; codigo: string } | null>(null);
  const [isEmployeeSearchVisible, setIsEmployeeSearchVisible] = useState(false);
  const [ejecutivoCuenta, setEjecutivoCuenta] = useState('-');
  const [evaluation, setEvaluation] = useState<EvaluationSection[]>([]);
  const [firmaSupervisor, setFirmaSupervisor] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);

  // Estados para firma dibujada (formulario y firma supervisor desde lista)
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  /** Si no es null, el lienzo corresponde a la firma del supervisor de este registro en lista. */
  const [signatureModalListTarget, setSignatureModalListTarget] = useState<ChecklistSupervisionUI | null>(null);
  const [isSavingSupervisorFirma, setIsSavingSupervisorFirma] = useState(false);
  const savingSupervisorFirmaRef = useRef(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

  // Estados para cámara (recreado desde cero)
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Estado para date pickers de inputs de evaluación
  const [datePickerInput, setDatePickerInput] = useState<{ sectionId: string; subsectionId: string; inputId: string } | null>(null);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());

  // Estados para modal de agregar subsección
  const [isAddSubsectionModalVisible, setIsAddSubsectionModalVisible] = useState(false);
  const [addSubsectionSectionId, setAddSubsectionSectionId] = useState<string | null>(null);
  const [newSubsectionTitle, setNewSubsectionTitle] = useState('');
  const [newSubsectionInputs, setNewSubsectionInputs] = useState<Omit<EvaluationInput, 'id' | 'value'>[]>([]);

  /** Modal flotante para elegir tipo de input (Alert de Android solo muestra ~3 botones). */
  const [isInputTypeModalVisible, setIsInputTypeModalVisible] = useState(false);
  const [inputTypeModalTarget, setInputTypeModalTarget] = useState<
    | { mode: 'existing'; sectionId: string; subsectionId: string }
    | { mode: 'new-subsection' }
    | null
  >(null);

  // Estado para items expandidos (como StaffEvaluationsScreen)
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());
  const [expandedChecklistFirmas, setExpandedChecklistFirmas] = useState<Set<string>>(new Set());

  // Estados para artículos del puesto
  const [articulos, setArticulos] = useState<ArticuloForm[]>([]);
  const [archivosModalIndex, setArchivosModalIndex] = useState<number | null>(null);

  // Borrador local del formulario (continuar más tarde)
  const skipHierarchySideEffectsRef = useRef(false);
  /** Tras restaurar borrador: evita que división/puesto pisen evaluación, fotos y artículos. */
  const draftFormContentLockRef = useRef(false);
  const [hasFormDraft, setHasFormDraft] = useState(false);
  const [formDraftSavedAt, setFormDraftSavedAt] = useState<string | null>(null);
  const [draftStatusMessage, setDraftStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [isSavingFormDraft, setIsSavingFormDraft] = useState(false);
  const [isRestoringFormDraft, setIsRestoringFormDraft] = useState(false);
  const [isResettingFormDraft, setIsResettingFormDraft] = useState(false);
  const [isIncidentsModuleVisible, setIsIncidentsModuleVisible] = useState(false);
  const planillasRevalidationModalShownRef = useRef(false);
  const [showPlanillasRevalidationModal, setShowPlanillasRevalidationModal] = useState(false);
  const pendingPlanillasSubmitRef = useRef(false);

  const requestPlanillasRevalidationIfNeeded = useCallback(async (horaAccionMs: number): Promise<boolean> => {
    const tokenCheck = await isStoredPlanillasTokenValid(horaAccionMs);
    if (tokenCheck.valid) {
      planillasRevalidationModalShownRef.current = false;
      return true;
    }
    if (!planillasRevalidationModalShownRef.current) {
      planillasRevalidationModalShownRef.current = true;
      setShowPlanillasRevalidationModal(true);
    }
    return false;
  }, []);

  const handlePlanillasRevalidationSuccess = useCallback(() => {
    setShowPlanillasRevalidationModal(false);
    planillasRevalidationModalShownRef.current = false;
    if (pendingPlanillasSubmitRef.current) {
      pendingPlanillasSubmitRef.current = false;
      void submitSaveRef.current();
    }
  }, []);

  const handlePlanillasRevalidationDismiss = useCallback(() => {
    planillasRevalidationModalShownRef.current = false;
    pendingPlanillasSubmitRef.current = false;
    setShowPlanillasRevalidationModal(false);
    setIsSubmitting(false);
  }, []);

  const applyEmpleadoDocumentosToForm = useCallback(
    async (empleadoId: number) => {
      if (!(Number(empleadoId) > 0)) return;
      const documentos = resolveEmpleadoDocumentosFromTree(structureRef.current, empleadoId);
      if (documentos.length === 0) return;
      let referenceMs = Date.now();
      try {
        const hora = await getHoraAccion();
        if (hora && Number.isFinite(Number(hora))) referenceMs = Number(hora);
      } catch {
        /* ignore */
      }
      setEvaluation((prev) =>
        normalizeEvaluationSections(applyEmpleadoDocumentosToEvaluation(prev, documentos, referenceMs)),
      );
    },
    [],
  );

  const submitSaveRef = useRef<() => Promise<void>>(async () => {});

  const isCurrentUserSuperAdmin = useCallback(async (): Promise<boolean> => {
    if (Boolean(employee?.isSuperAdmin)) return true;
    // Fallback: sesión persistida (por si AuthContext aún no hidrató isSuperAdmin).
    try {
      const raw = await AsyncStorage.getItem('employee_data');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.isSuperAdmin);
    } catch {
      return false;
    }
  }, [employee?.isSuperAdmin]);

  const refreshIncidentsModuleVisibility = useCallback(async () => {
    // Superadmin = usuario autenticado actual, no el empleado seleccionado en el formulario.
    if (await isCurrentUserSuperAdmin()) {
      setIsIncidentsModuleVisible(true);
      return;
    }
    const modules = await readModulesReleaseFromStorage();
    const mod = modules.find((m: any) => String(m?.module_name ?? '').trim() === 'incidents');
    setIsIncidentsModuleVisible(Boolean(mod?.is_visible));
  }, [isCurrentUserSuperAdmin]);

  useEffect(() => {
    void refreshIncidentsModuleVisibility();
  }, [refreshIncidentsModuleVisibility]);

  useFocusEffect(
    useCallback(() => {
      void refreshIncidentsModuleVisibility();
    }, [refreshIncidentsModuleVisibility]),
  );

  useEffect(() => {
    const handler = () => {
      void refreshIncidentsModuleVisibility();
    };
    eventBus.on(MODULES_RELEASE_UPDATED_EVENT, handler);
    return () => {
      eventBus.off(MODULES_RELEASE_UPDATED_EVENT, handler);
    };
  }, [refreshIncidentsModuleVisibility]);

  const isFormHierarchyComplete = useMemo(
    () =>
      Boolean(
        selectedEmpresaId &&
          selectedClienteId &&
          selectedDivisionId &&
          selectedContratoId &&
          selectedCorpoId &&
          selectedPuestoId,
      ),
    [
      selectedEmpresaId,
      selectedClienteId,
      selectedDivisionId,
      selectedContratoId,
      selectedCorpoId,
      selectedPuestoId,
    ],
  );

  /** Código/nombre del empleado seleccionado en el checklist (involucrado del incidente). */
  const selectedInvolucrado = useMemo(() => {
    const codigo = String(selectedEmpleado?.codigo ?? '').trim();
    const nombre = String(selectedEmpleado?.nombre ?? '').trim();
    if (!selectedEmpleado || !codigo || !nombre) return null;
    return { codigo, nombre };
  }, [selectedEmpleado]);

  /** Mostrar enlace si incidents está liberado o el usuario actual es superadmin. */
  const showReportIncidentOption = isIncidentsModuleVisible;

  const canReportIncidentFromChecklist = useMemo(() => {
    if (!showReportIncidentOption || !isFormHierarchyComplete) return false;
    return selectedInvolucrado != null;
  }, [showReportIncidentOption, isFormHierarchyComplete, selectedInvolucrado]);

  const resolveOwnerEmpleadoId = useCallback((): number => {
    const id = Number(employee?.id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }, [employee?.id]);

  const refreshFormDraftPresence = useCallback(async () => {
    const ownerId = resolveOwnerEmpleadoId();
    if (ownerId <= 0) {
      setHasFormDraft(false);
      setFormDraftSavedAt(null);
      return;
    }
    const draft = await loadChecklistSupervisionFormDraft(ownerId);
    setHasFormDraft(Boolean(draft));
    setFormDraftSavedAt(draft?.savedAt ?? null);
  }, [resolveOwnerEmpleadoId]);

  useEffect(() => {
    void refreshFormDraftPresence();
  }, [refreshFormDraftPresence]);

  useFocusEffect(
    useCallback(() => {
      void refreshFormDraftPresence();
    }, [refreshFormDraftPresence]),
  );

  const getMarcaRoleDivisionId = useCallback((currentMarca: any): number | null => {
    const id = Number(currentMarca?.roleDivision?.division?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, []);

  const resolveHierarchyByPuestoId = useCallback((tree: StructureNode[], puestoId: number | null | undefined): HierarchyPath | null => {
    const targetPuestoId = Number(puestoId);
    if (!Number.isFinite(targetPuestoId) || targetPuestoId <= 0 || !Array.isArray(tree)) return null;

    for (const empresa of tree) {
      for (const cliente of empresa?.clientes || []) {
        for (const division of cliente?.division || []) {
          for (const contrato of division?.contratos || []) {
            for (const sucursal of contrato?.sucursales || []) {
              for (const puesto of sucursal?.puestos || []) {
                if (Number(puesto?.id) === targetPuestoId) {
                  return {
                    empresaId: Number(empresa.id),
                    clienteId: Number(cliente.id),
                    divisionId: Number(division.id),
                    contratoId: Number(contrato.id),
                    sucursalId: Number(sucursal.id),
                    puestoId: Number(puesto.id),
                  };
                }
              }
            }
          }
        }
      }
    }
    return null;
  }, []);

  const buildHierarchyFromCurrentMarca = useCallback((currentMarca: any, tree: StructureNode[]): HierarchyPath | null => {
    if (!currentMarca) return null;

    const puestoId = Number(currentMarca?.puesto?.id);
    const byPuesto = resolveHierarchyByPuestoId(tree, puestoId);
    if (byPuesto) {
      const roleDivisionId = getMarcaRoleDivisionId(currentMarca);
      if (roleDivisionId) byPuesto.divisionId = roleDivisionId;
      return byPuesto;
    }

    const empresaId = Number(currentMarca?.empresa?.id);
    const clienteId = Number(currentMarca?.cliente?.id);
    const divisionId = getMarcaRoleDivisionId(currentMarca) ?? Number(currentMarca?.division?.id);
    const contratoId = Number(currentMarca?.contrato?.id);
    const sucursalId = Number(currentMarca?.corpo?.id);

    const toValid = (value: number) => (Number.isFinite(value) && value > 0 ? value : null);

    return {
      empresaId: toValid(empresaId),
      clienteId: toValid(clienteId),
      divisionId: toValid(divisionId),
      contratoId: toValid(contratoId),
      sucursalId: toValid(sucursalId),
      puestoId: toValid(puestoId),
    };
  }, [getMarcaRoleDivisionId, resolveHierarchyByPuestoId]);

  const applyFilterHierarchyPath = useCallback((path: HierarchyPath | null) => {
    if (!path) return;
    setFilterEmpresaId(path.empresaId);
    setFilterClienteId(path.clienteId);
    setFilterDivisionId(path.divisionId);
    setFilterContratoId(path.contratoId);
    setFilterCorpoId(path.sucursalId);
    setFilterPuestoId(path.puestoId);
  }, []);

  const applyFormHierarchyPath = useCallback((path: HierarchyPath | null) => {
    if (!path) return;
    setSelectedEmpresaId(path.empresaId);
    setSelectedClienteId(path.clienteId);
    setSelectedDivisionId(path.divisionId);
    setSelectedContratoId(path.contratoId);
    setSelectedCorpoId(path.sucursalId);
    setSelectedPuestoId(path.puestoId);
  }, []);

  // Nodos computados para estructura jerárquica
  const empresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const clientes = useMemo(() => {
    const empresa = empresas.find((e: any) => e.id === selectedEmpresaId);
    return empresa?.clientes || [];
  }, [empresas, selectedEmpresaId]);

  const divisiones = useMemo(() => {
    const cliente = clientes.find((c: any) => c.id === selectedClienteId);
    return cliente?.division || [];
  }, [clientes, selectedClienteId]);

  const contratos = useMemo(() => {
    const division = divisiones.find((d: any) => d.id === selectedDivisionId);
    return division?.contratos || [];
  }, [divisiones, selectedDivisionId]);

  const sucursales = useMemo(() => {
    const contrato = contratos.find((c: any) => c.id === selectedContratoId);
    return contrato?.sucursales || [];
  }, [contratos, selectedContratoId]);

  const puestos = useMemo(() => {
    const sucursal = sucursales.find((s: any) => s.id === selectedCorpoId);
    return sucursal?.puestos || [];
  }, [sucursales, selectedCorpoId]);

  // Cargar estructura principal (fragmentos mergeados o caché legada)
  const fetchMainStructure = useCallback(async (): Promise<StructureNode[]> => {
    if (structureRef.current.length > 0) {
      return structureRef.current;
    }
    setIsStructureLoading(true);
    try {
      const parsed = await loadMainStructureTreeMerged();
      const tree = Array.isArray(parsed) ? parsed : [];
      structureRef.current = tree;
      setStructure(tree);
      return tree;
    } catch (error) {
      console.error('Error fetching main structure:', error);
      structureRef.current = [];
      setStructure([]);
    } finally {
      setIsStructureLoading(false);
    }
    return [];
  }, []);

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

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
  }, [getConnectionStatus, refreshAccessToken, logout]);

  const refreshAccessTokenRef = useRef(refreshAccessToken);
  const logoutRef = useRef(logout);
  useEffect(() => {
    refreshAccessTokenRef.current = refreshAccessToken;
    logoutRef.current = logout;
  }, [refreshAccessToken, logout]);

  const filterPuestoIdRef = useRef(filterPuestoId);
  const listPuestoScopeRef = useRef<number | null>(null);
  filterPuestoIdRef.current = filterPuestoId;
  if (filterPuestoId != null) listPuestoScopeRef.current = filterPuestoId;

  const normalizeApiChecklistRows = useCallback((rows: any[], puestoScope: number) => {
    return (Array.isArray(rows) ? rows : []).map(
      (it: any) => normalizeChecklistRowForCache(it, puestoScope) as ChecklistSupervisionUI,
    );
  }, []);

  // Cargar checklists: caché por puesto (offline) + API (online). `checklists` queda acotado al puesto activo.
  const fetchChecklists = useCallback(async (scopeOverride?: ChecklistListPuestoScope | null) => {
    
    setIsLoading(true);
    setError(null);
    try {
      const scope: ChecklistListPuestoScope =
        scopeOverride != null
          ? scopeOverride
          : { filterPuestoId: filterPuestoIdRef.current ?? listPuestoScopeRef.current };

      const puestoScope = Number(scope.filterPuestoId ?? listPuestoScopeRef.current);
      if (!Number.isFinite(puestoScope) || puestoScope <= 0) {
        setChecklists([]);
        setIsLoading(false);
        return;
      }

      listPuestoScopeRef.current = puestoScope;
      filterPuestoIdRef.current = puestoScope;
      setFilterPuestoId(puestoScope);

      try {
        const cached = await loadChecklistSupervisionCacheForPuesto(puestoScope);
        setChecklists(dedupeChecklistRows(cached) as ChecklistSupervisionUI[]);
      } catch {
        /* conservar lista previa si falla la caché */
      }

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      const result = await listChecklistSupervision({
        puestoId: puestoScope,
        refreshAccessToken: () => refreshAccessTokenRef.current(),
        logout: () => logoutRef.current(),
      });

      const rawRows = Array.isArray(result?.data) ? result.data : null;
      if (result.status && rawRows != null) {
        const list = dedupeChecklistRows(
          normalizeApiChecklistRows(rawRows, puestoScope) as ChecklistSupervisionItem[],
        );
        setChecklists(list as ChecklistSupervisionUI[]);
        await mergeChecklistSupervisionServerIntoCacheForPuesto(puestoScope, list);
      } else if (!result.status) {
        setError(result.message || 'Error al cargar checklists');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar checklists');
    } finally {
      setIsLoading(false);
    }
  }, [normalizeApiChecklistRows]);

  const fetchChecklistsRef = useRef(fetchChecklists);
  fetchChecklistsRef.current = fetchChecklists;

  /** Lee el bucket del puesto activo en AsyncStorage y actualiza la lista UI. */
  const syncChecklistsFromCache = useCallback(async (puestoId?: number | null) => {
    const pid = Number(puestoId ?? listPuestoScopeRef.current ?? filterPuestoIdRef.current);
    if (!Number.isFinite(pid) || pid <= 0) return;
    const rows = await loadChecklistSupervisionCacheForPuesto(pid);
    setChecklists(dedupeChecklistRows(rows) as ChecklistSupervisionUI[]);
  }, []);

  const handleFilterHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    setFilterCorpoId(v.sucursalId);
    setFilterPuestoId(v.puestoId ?? null);
    if (v.puestoId != null) {
      fetchChecklistsRef.current({ filterPuestoId: v.puestoId });
    } else {
      setChecklists([]);
    }
  }, []);

  const handleFormHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    // Cambio manual de jerarquía: permitir recarga de evaluación/artículos.
    draftFormContentLockRef.current = false;
    skipHierarchySideEffectsRef.current = false;
    setSelectedEmpresaId(v.empresaId);
    setSelectedClienteId(v.clienteId);
    setSelectedDivisionId(v.divisionId);
    setSelectedContratoId(v.contratoId);
    setSelectedCorpoId(v.sucursalId);
    setSelectedPuestoId(v.puestoId ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const loadedStructure = await fetchMainStructure();
        let marcaScope: ChecklistListPuestoScope | null = null;
        try {
          const currentMarcaStr = await AsyncStorage.getItem('current_marca');
          const currentMarca = currentMarcaStr ? JSON.parse(currentMarcaStr) : null;
          const hierarchy = buildHierarchyFromCurrentMarca(currentMarca, loadedStructure);
          applyFilterHierarchyPath(hierarchy);
          if (hierarchy?.puestoId != null) {
            marcaScope = { filterPuestoId: hierarchy.puestoId };
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) await fetchChecklistsRef.current(marcaScope);
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      const puesto = listPuestoScopeRef.current ?? filterPuestoIdRef.current;
      if (puesto != null) {
        fetchChecklistsRef.current({ filterPuestoId: puesto });
      }
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  // Cuando cambia la división seleccionada, cargar evaluación (solo si no estamos editando)
  useEffect(() => {
    if (skipHierarchySideEffectsRef.current || draftFormContentLockRef.current) return;
    // No cargar secciones predefinidas si estamos editando un registro existente
    if (editing) return;

    if (selectedDivisionId && isCreating) {
      // Buscar la división seleccionada por nombre (usar divisiones del useMemo)
      const selectedDivision = divisiones.find((d: any) => d.id === selectedDivisionId);
      if (selectedDivision) {
        const divisionName = (selectedDivision.nombre || '').toLowerCase();
        if (divisionName.includes('aseo') || divisionName.includes('limpieza')) {
          setEvaluation(normalizeEvaluationSections(JSON.parse(JSON.stringify(ASEO_LIMPIEZA_SECTIONS))));
        } else if (divisionName.includes('seguridad')) {
          setEvaluation(normalizeEvaluationSections(JSON.parse(JSON.stringify(SEGURIDAD_SECTIONS))));
        } else {
          setEvaluation([]);
        }
      } else {
        setEvaluation([]);
      }
    } else if (!selectedDivisionId && isCreating) {
      setEvaluation([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDivisionId, isCreating, editing]);

  // Cargar artículos del puesto cuando se selecciona un puesto (solo si no estamos editando)
  useEffect(() => {
    if (skipHierarchySideEffectsRef.current || draftFormContentLockRef.current) return;
    // No cargar artículos si estamos editando un registro existente
    if (editing) return;

    if (selectedPuestoId && isCreating && selectedDivisionId) {
      (async () => {
        const sourceArticulos = await loadPuestoArticulosForTable(Number(selectedPuestoId));
        if (!Array.isArray(sourceArticulos) || sourceArticulos.length === 0) {
          setArticulos([]);
          return;
        }
        const articulosForm: ArticuloForm[] = prioritizePlanByArticuloNomencladorId(
          sourceArticulos,
        ).map((art: any, index: number) => {
          const aid = Number(art?.id ?? art?.estructura_id);
          const ultimo = art?.ultimo_mantenimiento ?? null;
          const estadoUltimo = ultimo?.estado;
          const estado =
            estadoUltimo === 'Bueno' || estadoUltimo === 'Malo' || estadoUltimo === 'No está'
              ? (estadoUltimo as ArticuloForm['estado'])
              : ('Bueno' as const);

          const cantidadRealRaw =
            typeof ultimo?.cantidad_real === 'number'
              ? ultimo.cantidad_real
              : typeof art?.cantidad === 'number'
                ? art.cantidad
                : Number(art?.cantidad) || 0;

          const cantidad_real = estado === 'No está' ? 0 : Math.max(0, Number(cantidadRealRaw) || 0);
          const tipo = String(art?.tipo ?? '').trim();
          const rowKey =
            String(art?.key ?? '').trim() ||
            articuloListKey({ id: aid, tipo, rowKey: undefined }, index);

          return {
            id: aid,
            rowKey,
            nombre: art.nombre || art.articulo_nombre || 'Desconocido',
            tipo,
            cantidad_requerida: normalizeCantidadNecesaria(
              typeof art?.cantidad_necesaria === 'number' ? art.cantidad_necesaria : Number(art?.cantidad)
            ),
            cantidad_real,
            estado,
            observaciones: art.observaciones || '',
            ultimo_mantenimiento_id:
              ultimo?.id != null && Number(ultimo.id) > 0 ? Number(ultimo.id) : null,
            mantenimiento_files: [],
          };
        });
        setArticulos(articulosForm);
      })().catch(() => setArticulos([]));
    } else if (!selectedPuestoId && isCreating) {
      setArticulos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPuestoId, selectedCorpoId, selectedDivisionId, isCreating, editing]);

  // Funciones para manejar evaluación dinámica
  const addSection = () => {
    const newSection: EvaluationSection = {
      id: `section-${Date.now()}`,
      title: 'Nueva Sección',
      isPredefined: false,
      subsections: [],
    };
    setEvaluation([...evaluation, newSection]);
  };

  const deleteSection = (sectionId: string) => {
    const section = evaluation.find((s) => s.id === sectionId);
    if (section?.isPredefined) {
      Alert.alert('Error', 'No se pueden eliminar secciones predefinidas');
      return;
    }
    setEvaluation(evaluation.filter((s) => s.id !== sectionId));
  };

  const openAddSubsectionModal = (sectionId: string) => {
    setAddSubsectionSectionId(sectionId);
    setNewSubsectionTitle('');
    setNewSubsectionInputs([]);
    setIsAddSubsectionModalVisible(true);
  };

  const closeAddSubsectionModal = () => {
    setIsAddSubsectionModalVisible(false);
    setAddSubsectionSectionId(null);
    setNewSubsectionTitle('');
    setNewSubsectionInputs([]);
  };

  const addInputToNewSubsection = (type: 'text' | 'textarea' | 'select' | 'date' | 'photo' | 'checkbox') => {
    const newInput: Omit<EvaluationInput, 'id' | 'value'> = {
      type,
      title: type === 'photo' ? 'Fotos' : '',
      options: type === 'select' ? ['Opción 1', 'Opción 2'] : undefined,
      photos: type === 'photo' ? [] : undefined,
    };
    setNewSubsectionInputs([...newSubsectionInputs, newInput]);
  };

  const updateNewSubsectionInput = (index: number, field: 'title' | 'options', value: string | string[]) => {
    const updated = [...newSubsectionInputs];
    updated[index] = { ...updated[index], [field]: value };
    setNewSubsectionInputs(updated);
  };

  const removeNewSubsectionInput = (index: number) => {
    setNewSubsectionInputs(newSubsectionInputs.filter((_, i) => i !== index));
  };

  const saveNewSubsection = () => {
    if (!addSubsectionSectionId) return;

    const newSubsection: EvaluationSubsection = {
      id: `subsection-${Date.now()}`,
      title: newSubsectionTitle.trim() || 'Nueva Subsección',
      detalle: '',
      isPredefined: false,
      inputs: newSubsectionInputs.map((input, idx) => ({
        id: `input-${Date.now()}-${idx}`,
        ...input,
        value: input.type === 'checkbox' ? 'true' : '',
        photos: input.type === 'photo' ? (Array.isArray(input.photos) ? input.photos : []) : undefined,
      })),
    };

    setEvaluation(
      evaluation.map((s) =>
        s.id === addSubsectionSectionId ? { ...s, subsections: [...s.subsections, newSubsection] } : s
      )
    );

    closeAddSubsectionModal();
  };

  const addSubsection = (sectionId: string) => {
    openAddSubsectionModal(sectionId);
  };

  const openInputTypeModal = (
    target:
      | { mode: 'existing'; sectionId: string; subsectionId: string }
      | { mode: 'new-subsection' },
  ) => {
    setInputTypeModalTarget(target);
    setIsInputTypeModalVisible(true);
  };

  const closeInputTypeModal = () => {
    setIsInputTypeModalVisible(false);
    setInputTypeModalTarget(null);
  };

  const handleSelectInputType = (type: EvaluationInputType) => {
    const target = inputTypeModalTarget;
    closeInputTypeModal();
    if (!target) return;
    if (target.mode === 'new-subsection') {
      addInputToNewSubsection(type);
      return;
    }
    addInput(target.sectionId, target.subsectionId, type);
  };

  const deleteSubsection = (sectionId: string, subsectionId: string) => {
    const section = evaluation.find((s) => s.id === sectionId);
    const subsection = section?.subsections.find((sub) => sub.id === subsectionId);
    if (!section || !subsection) return;
    if (!isUserAddedSubsection(section, subsection)) {
      Alert.alert('Error', 'No se pueden eliminar subsecciones predefinidas');
      return;
    }
    Alert.alert(
      'Eliminar subsección',
      'Se eliminará esta subsección y las fotos/archivos locales asociados. El resto del formulario se conserva.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const fileNames = [
                ...new Set([
                  ...collectLocalFileNamesFromSubsection(subsection),
                  ...collectChecklistFormDraftLocalFileNames(
                    [{ ...section, subsections: [subsection] }],
                    [],
                  ),
                ]),
              ];
              if (fileNames.length > 0) {
                await deleteChecklistSupervisionFormDraftFiles(fileNames);
                // Mantener el borrador coherente: quitar nombres borrados de localFileNames.
                try {
                  const ownerId = resolveOwnerEmpleadoId();
                  const draft = ownerId > 0 ? await loadChecklistSupervisionFormDraft(ownerId) : null;
                  if (draft) {
                    const removed = new Set(fileNames);
                    const nextNames = (draft.localFileNames || []).filter((n) => !removed.has(n));
                    const nextEval = Array.isArray(draft.evaluation)
                      ? (draft.evaluation as EvaluationSection[]).map((s) =>
                          s.id !== sectionId
                            ? s
                            : {
                                ...s,
                                subsections: (s.subsections || []).filter((sub) => sub.id !== subsectionId),
                              },
                        )
                      : draft.evaluation;
                    await saveChecklistSupervisionFormDraft({
                      ...draft,
                      evaluation: nextEval,
                      localFileNames: nextNames,
                    });
                    setHasFormDraft(true);
                    setFormDraftSavedAt(draft.savedAt);
                  }
                } catch (e) {
                  console.warn('[ChecklistSupervision] No se pudo actualizar borrador tras borrar subsección:', e);
                }
              }
              setEvaluation((prev) =>
                prev.map((s) =>
                  s.id === sectionId
                    ? { ...s, subsections: s.subsections.filter((sub) => sub.id !== subsectionId) }
                    : s,
                ),
              );
            })();
          },
        },
      ],
    );
  };

  const addInput = (sectionId: string, subsectionId: string, type: 'text' | 'textarea' | 'select' | 'date' | 'photo' | 'checkbox') => {
    const newInput: EvaluationInput = {
      id: `input-${Date.now()}`,
      type,
      title: type === 'photo' ? 'Fotos' : '',
      value: type === 'checkbox' ? 'true' : '',
      options: type === 'select' ? ['Opción 1', 'Opción 2'] : undefined,
      photos: type === 'photo' ? [] : undefined,
    };
    setEvaluation(
      evaluation.map((s) =>
        s.id === sectionId
          ? {
            ...s,
            subsections: s.subsections.map((sub) =>
              sub.id === subsectionId ? { ...sub, inputs: [...sub.inputs, newInput] } : sub
            ),
          }
          : s
      )
    );
  };

  const updateInput = (sectionId: string, subsectionId: string, inputId: string, updates: Partial<EvaluationInput>) => {
    setEvaluation((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              subsections: s.subsections.map((sub) =>
                sub.id === subsectionId
                  ? {
                      ...sub,
                      inputs: sub.inputs.map((inp) =>
                        inp.id === inputId ? { ...inp, ...updates } : inp
                      ),
                    }
                  : sub
              ),
            }
          : s
      )
    );
  };

  const updateSubsectionDetalle = (sectionId: string, subsectionId: string, detalle: string) => {
    setEvaluation((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              subsections: s.subsections.map((sub) =>
                sub.id === subsectionId ? { ...sub, detalle } : sub
              ),
            }
          : s
      )
    );
  };

  const removePhotoFromInput = (
    sectionId: string,
    subsectionId: string,
    inputId: string,
    photoId: string,
  ) => {
    setEvaluation((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          subsections: s.subsections.map((sub) => {
            if (sub.id !== subsectionId) return sub;
            return {
              ...sub,
              inputs: sub.inputs.map((inp) => {
                if (inp.id !== inputId || inp.type !== 'photo') return inp;
                const photos = normalizePhotoInput(inp).filter((p) => p.id !== photoId);
                const removed = normalizePhotoInput(inp).find((p) => p.id === photoId);
                if (removed?.localFileName) {
                  void deleteFile(String(removed.localFileName).trim());
                }
                return { ...inp, photos, value: '', localFileName: undefined, file_name: undefined };
              }),
            };
          }),
        };
      }),
    );
  };

  const deleteInput = (sectionId: string, subsectionId: string, inputId: string) => {
    const section = evaluation.find((s) => s.id === sectionId);
    const subsection = section?.subsections.find((sub) => sub.id === subsectionId);
    if (!section || !subsection || !isUserAddedSubsection(section, subsection)) {
      Alert.alert('Error', 'No se pueden eliminar inputs predefinidos');
      return;
    }
    const input = subsection.inputs.find((inp) => inp.id === inputId);
    if (input) {
      const fileNames = collectLocalFileNamesFromSubsection({
        ...subsection,
        inputs: [input],
      });
      if (fileNames.length > 0) {
        void deleteChecklistSupervisionFormDraftFiles(fileNames);
      }
    }
    setEvaluation(
      evaluation.map((s) =>
        s.id === sectionId
          ? {
            ...s,
            subsections: s.subsections.map((sub) =>
              sub.id === subsectionId ? { ...sub, inputs: sub.inputs.filter((inp) => inp.id !== inputId) } : sub
            ),
          }
          : s
      )
    );
  };

  // Función similar a updateQuestionField de StaffEvaluationsScreen
  const updateInputField = (
    sectionId: string,
    subsectionId: string,
    inputId: string,
    field: 'value' | 'title' | 'imageOrientation',
    value: string | null
  ) => {
    console.log('[ChecklistSupervision] updateInputField called with:', {
      sectionId,
      subsectionId,
      inputId,
      field,
      valuePreview: typeof value === 'string' ? value.substring(0, 60) : value,
    });
    setEvaluation((prev) => {
      const copy = prev.map((s) => ({
        ...s,
        subsections: s.subsections.map((sub) => ({
          ...sub,
          inputs: sub.inputs.map((input) => ({ ...input })),
        })),
      }));
      const section = copy.find((s) => s.id === sectionId);
      if (!section) {
        console.warn('[ChecklistSupervision] updateInputField: section not found for id', sectionId);
        return prev;
      }
      let subsection = section.subsections.find((sub) => sub.id === subsectionId);
      if (!subsection) {
        console.warn(
          '[ChecklistSupervision] updateInputField: subsection not found for id',
          subsectionId,
          'trying to locate by inputId...'
        );
        // Fallback: localizar la subsección por el inputId (más robusto para datos antiguos)
        subsection = section.subsections.find((sub) =>
          sub.inputs?.some((inp) => inp.id === inputId)
        );
        if (!subsection) {
          console.warn(
            '[ChecklistSupervision] updateInputField: no subsection contains inputId',
            inputId,
            'available subsection ids:',
            section.subsections.map((s) => s.id)
          );
          return prev;
        }
      }
      const input = subsection.inputs.find((inp) => inp.id === inputId);
      if (!input) {
        console.warn(
          '[ChecklistSupervision] updateInputField: input not found for id',
          inputId,
          'available ids:',
          subsection.inputs.map((i) => i.id)
        );
        return prev;
      }
      const before = (input as any)[field];
      (input as any)[field] = value;
      console.log('[ChecklistSupervision] updateInputField updated input field:', {
        inputId,
        field,
        beforePreview: typeof before === 'string' ? before.substring(0, 60) : before,
        afterPreview: typeof value === 'string' ? value.substring(0, 60) : value,
      });
      return copy;
    });
  };

  const isNumericRatingSelect = (input: EvaluationInput): boolean => {
    const opts = input.options || [];
    const normalized = opts.map(o => String(o || '').trim());
    // ['No aplica', '1', '2', '3', '4', '5']
    if (normalized.length === 6 && normalized[0].toLowerCase() === 'no aplica') {
      return normalized.slice(1).every(v => /^[1-5]$/.test(v));
    }
    // ['1', '2', '3', '4', '5']
    if (normalized.length === 5) {
      return normalized.every(v => /^[1-5]$/.test(v));
    }
    return false;
  };

  // Funciones para firma supervisor (dibujo)
  const openSignatureModal = () => {
    setSignatureModalListTarget(null);
    savingSupervisorFirmaRef.current = false;
    setIsSavingSupervisorFirma(false);
    setIsSignatureModalVisible(true);
    setSignatureKey((prev) => prev + 1);
  };

  const openListSupervisorSignatureModal = (row: ChecklistSupervisionUI) => {
    setSignatureModalListTarget(row);
    savingSupervisorFirmaRef.current = false;
    setIsSavingSupervisorFirma(false);
    setSignatureKey((prev) => prev + 1);
    setIsSignatureModalVisible(true);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setSignatureModalListTarget(null);
    savingSupervisorFirmaRef.current = false;
    setIsSavingSupervisorFirma(false);
  };

  const rowMatchesSignatureTarget = (c: ChecklistSupervisionUI, row: ChecklistSupervisionUI) => {
    if (row.id && Number(row.id) > 0) return Number(c.id) === Number(row.id);
    return String(c.id_local || '') === String(row.id_local || '');
  };

  const persistListSupervisorSignature = async (row: ChecklistSupervisionUI, formattedSignature: string): Promise<boolean> => {
    const matchesRow = (c: ChecklistSupervisionUI) => rowMatchesSignatureTarget(c, row);
    const isLocalOnly = !row.id || Number(row.id) === 0;

    if (isLocalOnly && row.id_local) {
      const puestoId = resolveChecklistRowPuestoId(row, filterPuestoIdRef.current);
      const bucket = await loadChecklistSupervisionCacheForPuesto(puestoId);
      const next = bucket.map((c) =>
        matchesRow(c as ChecklistSupervisionUI) ? { ...c, firma_supervisor: formattedSignature } : c,
      );
      const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      const idx = actions.findIndex((a: any) => a.type === 'create' && String(a.id_local) === String(row.id_local));
      if (idx !== -1) {
        actions[idx] = {
          ...actions[idx],
          requestData: { ...actions[idx].requestData, firma_supervisor: formattedSignature },
        };
        await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(actions));
      }
      await saveChecklistSupervisionCacheForPuesto(puestoId, next);
      await syncChecklistsFromCache(puestoId);
      return true;
    }

    const isConnected = await getConnectionStatus();
    if (Number(row.id) > 0 && isConnected) {
      const result = await updateChecklistSupervisionFirmaSupervisor({
        id: Number(row.id),
        firma_supervisor: formattedSignature,
        refreshAccessToken,
        logout,
      });
      if (!result.status) {
        Alert.alert('Error', result.message || 'No se pudo guardar la firma del supervisor');
        return false;
      }
      const sr = (result as any).data;
      const puestoId = resolveChecklistRowPuestoId(row, filterPuestoIdRef.current);
      const bucket = await loadChecklistSupervisionCacheForPuesto(puestoId);
      const next = bucket.map((c) =>
        Number(c.id) === Number(row.id)
          ? applyServerPayloadToCachedChecklistRow(c, {
              ...(sr && typeof sr === 'object' ? sr : {}),
              firma_supervisor: sr?.firma_supervisor ?? formattedSignature,
            })
          : c,
      );
      await saveChecklistSupervisionCacheForPuesto(puestoId, next);
      await syncChecklistsFromCache(puestoId);
      return true;
    }

    if (Number(row.id) > 0 && !isConnected) {
      const puestoId = resolveChecklistRowPuestoId(row, filterPuestoIdRef.current);
      const bucket = await loadChecklistSupervisionCacheForPuesto(puestoId);
      const next = bucket.map((c) =>
        matchesRow(c as ChecklistSupervisionUI) ? { ...c, firma_supervisor: formattedSignature } : c,
      );
      const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      const uidx = actions.findIndex((a: any) => a.type === 'update' && Number(a.id) === Number(row.id));
      if (uidx !== -1) {
        actions[uidx] = {
          ...actions[uidx],
          requestData: { ...actions[uidx].requestData, firma_supervisor: formattedSignature },
        };
      } else {
        const fidx = actions.findIndex(
          (a: any) => a.type === 'update_supervisor_firma' && Number(a.id) === Number(row.id)
        );
        const entry = {
          type: 'update_supervisor_firma' as const,
          id: row.id,
          id_local: row.id_local || '',
          firma_supervisor: formattedSignature,
        };
        if (fidx !== -1) actions[fidx] = entry;
        else actions.push(entry);
      }
      await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(actions));
      await saveChecklistSupervisionCacheForPuesto(puestoId, next);
      await syncChecklistsFromCache(puestoId);
      return true;
    }

    return true;
  };

  const handleSignatureRead = (signature: string) => {
    if (signature) {
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        formattedSignature = `data:image/png;base64,${signature}`;
      }
      if (signatureModalListTarget) {
        if (savingSupervisorFirmaRef.current) return;
        savingSupervisorFirmaRef.current = true;
        const target = signatureModalListTarget;
        void (async () => {
          try {
            const ok = await persistListSupervisorSignature(target, formattedSignature);
            if (ok) closeSignatureModal();
          } finally {
            savingSupervisorFirmaRef.current = false;
            setIsSavingSupervisorFirma(false);
          }
        })();
        return;
      }
      setFirmaSupervisor(formattedSignature);
      closeSignatureModal();
    }
  };

  const clearSignature = () => {
    setSignatureKey((prev) => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  // Funciones para firma responsable (generar/QR)
  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setFirmaResponsable(hash);
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  // Funciones para manejar artículos del puesto (similar a EntregaPuestosScreen)
  const handleArticuloEstadoChange = (index: number, estado: 'Bueno' | 'Malo' | 'No está') => {
    const newArticulos = [...articulos];
    newArticulos[index].estado = estado;
    if (estado === 'No está') {
      newArticulos[index].cantidad_real = 0;
    }
    setArticulos(newArticulos);
  };

  const handleArticuloCantidadChange = (index: number, cantidad: number) => {
    const newArticulos = [...articulos];
    newArticulos[index].cantidad_real = cantidad;
    if (cantidad === 0) {
      newArticulos[index].estado = 'No está';
    }
    setArticulos(newArticulos);
  };

  const handleArticuloObservacionesChange = (index: number, observaciones: string) => {
    const newArticulos = [...articulos];
    newArticulos[index].observaciones = observaciones;
    setArticulos(newArticulos);
  };

  const handleArticuloMantenimientoFilesChange = (
    index: number,
    files: ArticuloMantenimientoPendingFile[]
  ) => {
    setArticulos((prev) =>
      prev.map((a, i) => (i === index ? { ...a, mantenimiento_files: files } : a))
    );
  };

  const refreshPuestoArticulosCacheAfterSave = useCallback(async () => {
    if (!selectedPuestoId) return;
    await refreshPuestoArticulosFromServer({
      puestoId: Number(selectedPuestoId),
      refreshAccessToken,
      logout,
    });
  }, [selectedPuestoId, refreshAccessToken, logout]);

  // Funciones para cámara (siguiendo patrón de VehiclesScreen)
  const openCamera = async (target: string) => {
    console.log('[ChecklistSupervision] openCamera called with target:', target);
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setCameraTarget(target);
    console.log('[ChecklistSupervision] Camera permission granted. Setting cameraTarget and showing camera.');
    setIsCameraVisible(true);
  };

  // Función para obtener la URI de la imagen (como StaffEvaluationsScreen)
  const getPhotoItemUri = (photo: EvaluationPhotoItem, input: EvaluationInput): string => {
    if (photo.localFileName && String(photo.localFileName).trim() !== '') {
      const u = getLocalFileDisplayUri(String(photo.localFileName).trim());
      if (u) return u;
    }

    const draftEditing = editing != null && checklistRowShowsOfflineBadge(editing);

    if (draftEditing) {
      if (photo.value && typeof photo.value === 'string') {
        if (photo.value.startsWith('data:image/')) return photo.value;
        if (photo.value.length > 100 && !photo.value.startsWith('http')) {
          return `data:image/jpeg;base64,${photo.value}`;
        }
      }
      return '';
    }

    if (photo.value && typeof photo.value === 'string') {
      if (photo.value.startsWith('data:image/')) return photo.value;
      if (photo.value.length > 100 && !photo.value.startsWith('http')) {
        return `data:image/jpeg;base64,${photo.value}`;
      }
    }

    const serverId = editing?.id != null ? Number(editing.id) : 0;
    if (Number.isFinite(serverId) && serverId > 0 && photo.file_name) {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        return appendTokenToUrl(
          `${apiUrl}/api/checklist-supervision/${serverId}/get-image/${encodeURIComponent(photo.file_name)}?t=${Date.now()}`,
        );
      }
    }

    return (photo.value && typeof photo.value === 'string') ? photo.value : '';
  };

  const getImageUri = (input: EvaluationInput): string => {
    const photos = normalizePhotoInput(input);
    if (photos.length > 0) return getPhotoItemUri(photos[0], input);
    return '';
  };

  const handleAddPhoto = async (target: string) => {
    console.log('[ChecklistSupervision] handleAddPhoto called with target:', target);
    // Solo permitir tomar fotos con la cámara (como StaffEvaluationsScreen)
    await openCamera(target);
  };

  const takePicture = async () => {
    console.log('[ChecklistSupervision] takePicture called. cameraTarget:', cameraTarget);
    if (!cameraRef.current || !cameraTarget) {
      console.warn('[ChecklistSupervision] takePicture abort: no cameraRef or cameraTarget');
      setIsCameraVisible(false);
      return;
    }
    try {
      const photo: any = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.7,
        skipProcessing: false,
      });
      console.log('[ChecklistSupervision] takePicture received photo:', {
        hasUri: !!photo?.uri,
        width: photo?.width,
        height: photo?.height,
      });
      setIsCameraVisible(false);
      if (!photo?.uri) {
        Alert.alert('Error', 'No se pudo capturar la imagen');
        return;
      }

      let storedFileName: string;
      try {
        storedFileName = await saveFile({
          uri: photo.uri,
          originalName: 'foto',
          extension: 'jpg',
          type: 'image',
          prefix: CHECKLIST_SUPERVISION_PHOTO_PREFIX,
        });
      } catch (saveErr) {
        console.error('[ChecklistSupervision] saveFile failed:', saveErr);
        Alert.alert('Error', 'No se pudo guardar la foto en el dispositivo');
        return;
      }

      let sectionId: string | undefined;
      let subsectionId: string | undefined;
      let inputId: string | undefined;

      if (cameraTarget.includes('|')) {
        const parts = cameraTarget.split('|');
        [sectionId, subsectionId, inputId] = parts;
        console.log('[ChecklistSupervision] takePicture target parsed from |:', { sectionId, subsectionId, inputId });
      } else {
        const parts = cameraTarget.split('-');
        if (parts.length >= 3) {
          sectionId = parts[0];
          subsectionId = parts[1];
          inputId = parts.slice(2).join('-');
          console.log('[ChecklistSupervision] takePicture target parsed from - (legacy):', {
            sectionId,
            subsectionId,
            inputId,
          });
        }
      }

      if (sectionId && subsectionId && inputId) {
        const sec = evaluation.find((s) => s.id === sectionId);
        const sub = sec?.subsections.find((ss) => ss.id === subsectionId);
        const prevInp = sub?.inputs.find((i) => i.id === inputId);

        console.log('[ChecklistSupervision] Appending photo to input (local file reference).');
        const orientation: 'horizontal' | 'vertical' | undefined =
          photo.width && photo.height
            ? photo.width >= photo.height
              ? 'horizontal'
              : 'vertical'
            : undefined;
        const existingPhotos = prevInp ? normalizePhotoInput(prevInp) : [];
        const newPhoto: EvaluationPhotoItem = {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          localFileName: storedFileName,
          ...(orientation ? { imageOrientation: orientation } : {}),
        };
        updateInput(sectionId, subsectionId, inputId, {
          photos: [...existingPhotos, newPhoto],
          value: '',
          localFileName: undefined,
          file_name: undefined,
          imageOrientation: undefined,
        });
      } else {
        console.error('[ChecklistSupervision] takePicture: cameraTarget no tiene el formato correcto:', cameraTarget);
        Alert.alert('Error', 'Error al procesar la imagen capturada');
      }
      setCameraTarget(null);
    } catch (error) {
      console.error('Error capturing image:', error);
      setIsCameraVisible(false);
      Alert.alert('Error', 'No se pudo capturar la imagen');
    }
  };

  const syncProcessTimesFromHoraAccion = useCallback(async () => {
    const horaAccion = await getHoraAccion();
    const src = horaAccion ? new Date(horaAccion) : new Date();
    const horaAccionTime = timeDateFromHoraAccion(src);
    setHoraInicio(horaAccionTime);
    setHoraFin(horaAccionTime);
    return horaAccionTime;
  }, []);

  // Al abrir formulario de creación, cargar hora inicio/fin desde hora de acción.
  useEffect(() => {
    if (!isCreating || editing) return;
    void syncProcessTimesFromHoraAccion();
  }, [isCreating, editing, syncProcessTimesFromHoraAccion]);

  // Funciones para CRUD
  const buildFormDraftSnapshot = useCallback(async (): Promise<ChecklistSupervisionFormDraft | null> => {
    const ownerEmpleadoId = resolveOwnerEmpleadoId();
    if (ownerEmpleadoId <= 0) return null;

    const evalRaw = normalizeEvaluationSections(JSON.parse(JSON.stringify(evaluation)) as EvaluationSection[]);
    const articulosSnapshot = JSON.parse(JSON.stringify(articulos)) as ArticuloForm[];
    const persisted = await persistEvaluationPhotosForDraft(evalRaw as unknown[]);
    const evalSnapshot = normalizeEvaluationSections(persisted.evaluation as EvaluationSection[]);
    const localFileNames = [
      ...new Set([
        ...persisted.localFileNames,
        ...collectChecklistFormDraftLocalFileNames(evalSnapshot, articulosSnapshot),
      ]),
    ];

    // Usar hora de acción (servidor/CR) para que cambios de hora se reflejen en el borrador.
    const horaAccion = await getHoraAccion();
    const savedAt = Number.isFinite(horaAccion)
      ? new Date(horaAccion).toISOString()
      : new Date().toISOString();

    return {
      version: 1,
      savedAt,
      ownerEmpleadoId,
      mode: editing ? 'edit' : 'create',
      editingRef: editing
        ? {
            id: Number(editing.id ?? 0),
            id_local: String((editing as ChecklistSupervisionUI).id_local ?? '').trim() || undefined,
          }
        : null,
      fechaIso: fecha.toISOString(),
      horaInicioIso: horaInicio.toISOString(),
      horaFinIso: horaFin.toISOString(),
      selectedEmpleado: selectedEmpleado
        ? {
            id: selectedEmpleado.id,
            nombre: selectedEmpleado.nombre,
            codigo: selectedEmpleado.codigo,
          }
        : null,
      ejecutivoCuenta,
      evaluation: evalSnapshot,
      firmaSupervisor,
      firmaResponsable,
      hierarchy: {
        empresaId: selectedEmpresaId,
        clienteId: selectedClienteId,
        divisionId: selectedDivisionId,
        contratoId: selectedContratoId,
        sucursalId: selectedCorpoId,
        puestoId: selectedPuestoId,
      },
      articulos: articulosSnapshot,
      localFileNames,
      isHierarchyHintVisible,
    };
  }, [
    resolveOwnerEmpleadoId,
    editing,
    fecha,
    horaInicio,
    horaFin,
    selectedEmpleado,
    ejecutivoCuenta,
    evaluation,
    firmaSupervisor,
    firmaResponsable,
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedCorpoId,
    selectedPuestoId,
    articulos,
    isHierarchyHintVisible,
  ]);

  const applyInitialFormHierarchy = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      const currentMarca = currentMarcaStr ? JSON.parse(currentMarcaStr) : null;
      const hierarchy = buildHierarchyFromCurrentMarca(currentMarca, structure);
      applyFormHierarchyPath(hierarchy);

      if (filterPuestoId != null) {
        setSelectedEmpresaId(filterEmpresaId);
        setSelectedClienteId(filterClienteId);
        setSelectedDivisionId(filterDivisionId);
        setSelectedContratoId(filterContratoId);
        setSelectedCorpoId(filterCorpoId);
        setSelectedPuestoId(filterPuestoId);
      }
    } catch {
      // ignore
    }
  }, [
    structure,
    buildHierarchyFromCurrentMarca,
    applyFormHierarchyPath,
    filterPuestoId,
    filterEmpresaId,
    filterClienteId,
    filterDivisionId,
    filterContratoId,
    filterCorpoId,
  ]);

  const applyFormDraftSnapshot = useCallback(async (draft: ChecklistSupervisionFormDraft) => {
    skipHierarchySideEffectsRef.current = true;
    draftFormContentLockRef.current = true;
    try {
      setDraftStatusMessage(null);
      setIsCreating(true);

      if (draft.mode === 'edit' && draft.editingRef) {
        const cachedRows = await loadChecklistSupervisionCacheForPuesto(Number(draft.hierarchy.puestoId ?? 0));
        const match = cachedRows.find((row) => {
          const idLocal = String((row as any).id_local ?? '').trim();
          if (draft.editingRef?.id_local && idLocal === draft.editingRef.id_local) return true;
          return Number(row.id) > 0 && Number(row.id) === Number(draft.editingRef?.id ?? 0);
        });
        setEditing((match as ChecklistSupervisionUI) ?? ({
          id: Number(draft.editingRef.id ?? 0),
          id_local: draft.editingRef.id_local,
        } as ChecklistSupervisionUI));
      } else {
        setEditing(null);
      }

      // Jerarquía primero; el lock evita que los useEffect pisen evaluación/artículos.
      applyFormHierarchyPath(draft.hierarchy);
      setIsHierarchyHintVisible(Boolean(draft.isHierarchyHintVisible));

      setFecha(draft.fechaIso ? new Date(draft.fechaIso) : new Date());
      setHoraInicio(draft.horaInicioIso ? new Date(draft.horaInicioIso) : new Date());
      setHoraFin(draft.horaFinIso ? new Date(draft.horaFinIso) : new Date());
      setSelectedEmpleado(draft.selectedEmpleado);
      setEjecutivoCuenta(draft.ejecutivoCuenta ?? '');

      const restoredEvaluation = Array.isArray(draft.evaluation)
        ? normalizeEvaluationSections(JSON.parse(JSON.stringify(draft.evaluation)) as EvaluationSection[])
        : [];
      setEvaluation(restoredEvaluation);
      setFirmaSupervisor(draft.firmaSupervisor ?? '');
      setFirmaResponsable(draft.firmaResponsable ?? '');

      const restoredArticulos = Array.isArray(draft.articulos)
        ? (draft.articulos as ArticuloForm[]).map((art, index) => ({
            ...art,
            id: Number(art?.id ?? 0),
            rowKey: art.rowKey ?? articuloListKey(art, index),
            cantidad_requerida: normalizeCantidadNecesaria(art?.cantidad_requerida ?? 0),
            observaciones: art.observaciones ?? '',
          }))
        : [];
      setArticulos(restoredArticulos);

      // Reaplicar tras el ciclo de efectos por si hubo carrera residual.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      setEvaluation(restoredEvaluation);
      setArticulos(restoredArticulos);

      const photoNames = collectChecklistFormDraftLocalFileNames(restoredEvaluation, restoredArticulos);
      const missingPhotos = photoNames.filter((name) => !getLocalFileDisplayUri(name)).length;

      setDraftStatusMessage({
        type: missingPhotos > 0 ? 'error' : 'success',
        text:
          missingPhotos > 0
            ? `Borrador restaurado, pero ${missingPhotos} imagen(es) local(es) no se encontraron en el dispositivo.`
            : `Borrador restaurado (${convertDateTimestampToLocalString(draft.savedAt, true)}).`,
      });
    } finally {
      skipHierarchySideEffectsRef.current = false;
      // draftFormContentLockRef permanece true hasta cambio manual de jerarquía o reestablecer.
    }
  }, [applyFormHierarchyPath]);

  const saveFormDraft = useCallback(async (options?: { closeForm?: boolean }) => {
    setIsSavingFormDraft(true);
    setDraftStatusMessage(null);
    try {
      const snapshot = await buildFormDraftSnapshot();
      if (!snapshot) {
        Alert.alert('Error', 'No se pudo identificar al usuario para guardar el borrador.');
        return;
      }

      await saveChecklistSupervisionFormDraft(snapshot);
      // Mantener el formulario alineado con lo persistido (localFileName, sin base64).
      if (Array.isArray(snapshot.evaluation)) {
        setEvaluation(normalizeEvaluationSections(snapshot.evaluation as EvaluationSection[]));
      }
      setHasFormDraft(true);
      setFormDraftSavedAt(snapshot.savedAt);
      const photoCount = snapshot.localFileNames.length;
      setDraftStatusMessage({
        type: 'success',
        text: `Borrador guardado (${convertDateTimestampToLocalString(snapshot.savedAt, true)})${
          photoCount > 0 ? ` con ${photoCount} archivo(s) local(es)` : ''
        }. Puedes cerrar el formulario y continuar más tarde.`,
      });
      if (options?.closeForm) {
        setIsCreating(false);
        setEditing(null);
      }
    } catch (e) {
      console.error('[ChecklistSupervision] saveFormDraft failed:', e);
      setDraftStatusMessage({
        type: 'error',
        text: 'No se pudo guardar el borrador. Intenta de nuevo.',
      });
      Alert.alert('Error', 'No se pudo guardar el borrador del formulario.');
    } finally {
      setIsSavingFormDraft(false);
    }
  }, [buildFormDraftSnapshot]);

  const handleReportIncident = useCallback(() => {
    if (!showReportIncidentOption) {
      Alert.alert('No disponible', 'El módulo de incidentes no está disponible para su usuario.');
      return;
    }
    if (!isFormHierarchyComplete) {
      Alert.alert(
        'Jerarquía incompleta',
        'Complete la jerarquía (empresa → puesto) antes de reportar un incidente.',
      );
      return;
    }
    if (!selectedInvolucrado) {
      Alert.alert(
        'Empleado requerido',
        'Seleccione un empleado con código y nombre; será el involucrado del incidente.',
      );
      return;
    }

    const linkParams: ChecklistSupervisionIncidentLinkParams = {
      empresaId: Number(selectedEmpresaId),
      clienteId: Number(selectedClienteId),
      divisionId: Number(selectedDivisionId),
      contratoId: Number(selectedContratoId),
      sucursalId: Number(selectedCorpoId),
      puestoId: Number(selectedPuestoId),
      involucrado: {
        codigo: selectedInvolucrado.codigo,
        nombre: selectedInvolucrado.nombre,
      },
    };

    if (!isChecklistSupervisionIncidentLinkComplete(linkParams)) {
      Alert.alert('Datos incompletos', 'La jerarquía o el empleado seleccionado no cumplen los requisitos para reportar un incidente.');
      return;
    }

    Alert.alert(
      'Reportar incidente',
      'Se guardará el borrador del checklist y se abrirá el formulario de incidentes con la jerarquía actual y el empleado seleccionado como involucrado. ¿Desea continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            void (async () => {
              try {
                await saveFormDraft({ closeForm: true });
                navigation.navigate('Incidents', { fromChecklistSupervision: linkParams });
              } catch (e) {
                console.error('[ChecklistSupervision] handleReportIncident failed:', e);
                Alert.alert('Error', 'No se pudo guardar el borrador antes de abrir incidentes.');
              }
            })();
          },
        },
      ],
    );
  }, [
    showReportIncidentOption,
    isFormHierarchyComplete,
    selectedInvolucrado,
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedCorpoId,
    selectedPuestoId,
    saveFormDraft,
    navigation,
  ]);

  const restoreFormDraft = useCallback(async () => {
    const ownerId = resolveOwnerEmpleadoId();
    if (ownerId <= 0) return;

    setIsRestoringFormDraft(true);
    setDraftStatusMessage(null);
    try {
      const draft = await loadChecklistSupervisionFormDraft(ownerId);
      if (!draft) {
        setHasFormDraft(false);
        setFormDraftSavedAt(null);
        Alert.alert('Sin borrador', 'No hay un borrador guardado para continuar.');
        return;
      }
      await applyFormDraftSnapshot(draft);
    } catch (e) {
      console.error('[ChecklistSupervision] restoreFormDraft failed:', e);
      setDraftStatusMessage({
        type: 'error',
        text: 'No se pudo restaurar el borrador.',
      });
      Alert.alert('Error', 'No se pudo restaurar el borrador del formulario.');
    } finally {
      setIsRestoringFormDraft(false);
    }
  }, [resolveOwnerEmpleadoId, applyFormDraftSnapshot]);

  const clearDraftAfterSuccessfulSubmit = useCallback(async () => {
    try {
      // No borrar archivos locales: la cola de sync / hidratación al enviar aún puede necesitarlos.
      await removeChecklistSupervisionFormDraftMeta();
      setHasFormDraft(false);
      setFormDraftSavedAt(null);
      setDraftStatusMessage(null);
      draftFormContentLockRef.current = false;
    } catch (e) {
      console.warn('[ChecklistSupervision] clearDraftAfterSuccessfulSubmit:', e);
    }
  }, []);

  const resetForm = async () => {
    const horaAccion = await getHoraAccion();
    const actionDate = horaAccion ? new Date(horaAccion) : new Date();
    setFecha(actionDate);
    const horaAccionTime = timeDateFromHoraAccion(actionDate);
    setHoraInicio(horaAccionTime);
    setHoraFin(horaAccionTime);
    setSelectedEmpleado(null);
    setEjecutivoCuenta('');
    setEvaluation([]);
    setFirmaSupervisor('');
    setFirmaResponsable('');
    setSelectedEmpresaId(null);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedCorpoId(null);
    setSelectedPuestoId(null);
    setArticulos([]);
  };

  const resetFormWithDraftClear = useCallback(async () => {
    Alert.alert(
      'Reestablecer formulario',
      'Se eliminará el borrador guardado, las fotos/archivos locales del formulario y se cargará un formulario vacío. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reestablecer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsResettingFormDraft(true);
              setDraftStatusMessage(null);
              try {
                const currentFiles = collectChecklistFormDraftLocalFileNames(evaluation, articulos);
                const storedDraft = await loadChecklistSupervisionFormDraft(resolveOwnerEmpleadoId());
                const allFiles = [
                  ...new Set([
                    ...currentFiles,
                    ...(storedDraft?.localFileNames ?? []),
                  ]),
                ];
                await clearChecklistSupervisionFormDraft(allFiles);
                setHasFormDraft(false);
                setFormDraftSavedAt(null);

                draftFormContentLockRef.current = false;
                skipHierarchySideEffectsRef.current = true;
                await resetForm();
                setEditing(null);
                await applyInitialFormHierarchy();
                setTimeout(() => {
                  skipHierarchySideEffectsRef.current = false;
                }, 0);

                setDraftStatusMessage({
                  type: 'info',
                  text: 'Formulario reestablecido. El borrador y los archivos locales asociados fueron eliminados.',
                });
              } catch (e) {
                console.error('[ChecklistSupervision] resetFormWithDraftClear failed:', e);
                Alert.alert('Error', 'No se pudo reestablecer el formulario por completo.');
              } finally {
                setIsResettingFormDraft(false);
              }
            })();
          },
        },
      ],
    );
  }, [
    evaluation,
    articulos,
    resolveOwnerEmpleadoId,
    applyInitialFormHierarchy,
  ]);

  const beginNewForm = async () => {
    draftFormContentLockRef.current = false;
    await resetForm();
    setEditing(null);
    await applyInitialFormHierarchy();
    setIsCreating(true);
    setDraftStatusMessage(null);
  };

  const startCreating = async () => {
    const ownerId = resolveOwnerEmpleadoId();
    if (ownerId > 0) {
      const draft = await loadChecklistSupervisionFormDraft(ownerId);
      if (draft) {
        Alert.alert(
          'Borrador encontrado',
          `Tienes un formulario guardado el ${convertDateTimestampToLocalString(draft.savedAt, true)}. ¿Deseas continuar donde lo dejaste?`,
          [
            { text: 'Nuevo formulario', onPress: () => void beginNewForm() },
            { text: 'Continuar borrador', onPress: () => void restoreFormDraft() },
          ],
        );
        return;
      }
    }
    await beginNewForm();
  };

  const startEditing = async (it: ChecklistSupervisionUI) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    draftFormContentLockRef.current = false;
    // Establecer editing PRIMERO para evitar que useEffect sobrescriba la evaluación
    setEditing(it);
    setIsCreating(true);
    setFecha(it.fecha ? new Date(it.fecha) : new Date(horaAccion));
    setEjecutivoCuenta(it.ejecutivo_cuenta || '');
    setFirmaSupervisor(it.firma_supervisor || '');
    setFirmaResponsable(it.firma_responsable || '');

    const empleadoId = Number((it as any).empleado_id ?? 0);
    if (Number.isFinite(empleadoId) && empleadoId > 0) {
      setSelectedEmpleado({
        id: empleadoId,
        nombre: String((it as any).empleado_nombre ?? '').trim() || `Empleado #${empleadoId}`,
        codigo: String((it as any).empleado_codigo ?? '').trim(),
      });
    } else {
      setSelectedEmpleado(null);
    }

    const hi = normalizeTimeToHHmm((it as any).hora_inicio);
    const hf = normalizeTimeToHHmm((it as any).hora_fin);
    const horaAccionTime = timeDateFromHoraAccion(horaAccion);
    setHoraInicio(hi ? parseTimeHHmm(hi) : horaAccionTime);
    setHoraFin(hf ? parseTimeHHmm(hf) : horaAccionTime);

    // Cargar evaluación INMEDIATAMENTE para preservar los valores
    try {
      const evalData = JSON.parse(it.evaluacion || '[]');
      const parsedEvaluation = Array.isArray(evalData) ? normalizeEvaluationSections(evalData) : [];
      console.log('startEditing: Cargando evaluación:', {
        sections: parsedEvaluation.length,
        firstSection: parsedEvaluation[0]?.title,
        firstInputValue: parsedEvaluation[0]?.subsections?.[0]?.inputs?.[0]?.value,
        sampleInput: parsedEvaluation[0]?.subsections?.[0]?.inputs?.[0]
      });
      // Cargar evaluación inmediatamente
      setEvaluation(parsedEvaluation);
    } catch (error) {
      console.error('startEditing: Error parseando evaluación:', error);
      setEvaluation([]);
    }

    // Cargar artículos del puesto si existen
    try {
      const articulosData = (it as any).articulos_puesto;
      if (articulosData) {
        const parsedArticulos = typeof articulosData === 'string' ? JSON.parse(articulosData) : articulosData;
        if (Array.isArray(parsedArticulos) && parsedArticulos.length > 0) {
          // Asegurar que cada artículo tenga observaciones inicializadas
          const articulosConObservaciones = parsedArticulos.map((art: any, index: number) => ({
            ...art,
            id: Number(art?.id ?? art?.estructura_id),
            rowKey: art.rowKey ?? articuloListKey(art, index),
            cantidad_requerida: normalizeCantidadNecesaria(art?.cantidad_requerida ?? art?.cantidad),
            observaciones: art.observaciones || '',
          }));
          setArticulos(articulosConObservaciones);
        } else {
          setArticulos([]);
        }
      } else {
        setArticulos([]);
      }
    } catch (error) {
      console.error('startEditing: Error parseando artículos:', error);
      setArticulos([]);
    }

    const resolved = resolveHierarchyByPuestoId(structure, it.puesto_id);
    if (resolved) {
      applyFormHierarchyPath(resolved);
    } else {
      // Fallback if puesto_id cannot be resolved in structure.
      const empresa = structure.find((e: any) => e.clientes?.some((cl: any) => cl.id === it.cliente_id));
      if (empresa) setSelectedEmpresaId(empresa.id);
      else if (it.empresa_id != null) setSelectedEmpresaId(Number(it.empresa_id));
      setSelectedClienteId(it.cliente_id || null);
      setSelectedDivisionId(it.division_id || null);
      if (it.contrato_id != null) setSelectedContratoId(Number(it.contrato_id));
      setSelectedCorpoId(it.corpo_id || null);
      setSelectedPuestoId(it.puesto_id || null);
    }
  };

  const cancelCreating = async () => {
    setIsCreating(false);
    setEditing(null);
    await resetForm();
  };

  const validateForm = () => {
    if (!selectedEmpresaId || !selectedClienteId || !selectedDivisionId || !selectedContratoId || !selectedCorpoId || !selectedPuestoId) {
      Alert.alert('Error', 'Debes seleccionar todos los campos requeridos (Empresa, Cliente, División, Contrato, Sucursal y Puesto)');
      return false;
    }
    if (!selectedEmpleado || !(Number(selectedEmpleado.id) > 0) || !String(selectedEmpleado.nombre).trim()) {
      Alert.alert('Error', 'Debes buscar y seleccionar un empleado');
      return false;
    }
    if (!String(selectedEmpleado.codigo).trim()) {
      Alert.alert('Error', 'El empleado debe tener código. Búscalo de nuevo o actualiza la jerarquía.');
      return false;
    }
    const horaInicioStr = formatTimeHHmm(horaInicio);
    const horaFinStr = formatTimeHHmm(horaFin);
    if (!/^\d{2}:\d{2}$/.test(horaInicioStr) || !/^\d{2}:\d{2}$/.test(horaFinStr)) {
      Alert.alert('Error', 'Debes indicar la hora de inicio y fin del proceso');
      return false;
    }
    // firma_supervisor es opcional; solo se requiere la firma responsable.
    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }
    return true;
  };

  const submitSave = async () => {
    if (!validateForm()) return;
    const empleadoSel = selectedEmpleado;
    if (!empleadoSel) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      setIsSubmitting(false);
      return;
    }

    const isConnected = await getConnectionStatus();
    const isCreateFlow = !(editing && editing.id && editing.id !== 0);

    if (isConnected && isCreateFlow) {
      const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(Number(horaAccion));
      if (!hasValidPlanillasToken) {
        pendingPlanillasSubmitRef.current = true;
        return;
      }
    }

    let planillasToken: string | undefined;
    if (isConnected) {
      const planillasTokenCheck = await isStoredPlanillasTokenValid(Number(horaAccion));
      planillasToken = planillasTokenCheck.token ?? undefined;
    } else {
      const storedPlanillas = await readStoredPlanillasToken();
      planillasToken = storedPlanillas?.token ?? undefined;
    }

    try {
      const evalSnapshot = normalizeEvaluationSections(JSON.parse(JSON.stringify(evaluation)) as EvaluationSection[]);
      let hasImages = false;
      let imageCount = 0;
      const checkForImages = (obj: any) => {
        if (Array.isArray(obj)) {
          obj.forEach(item => checkForImages(item));
        } else if (obj && typeof obj === 'object') {
          if (obj.type === 'photo') {
            const photos = Array.isArray(obj.photos) ? obj.photos : [];
            if (photos.length > 0) {
              for (const photo of photos) {
                if (
                  (photo?.value && typeof photo.value === 'string' && photo.value.startsWith('data:image/')) ||
                  (photo?.localFileName && String(photo.localFileName).trim() !== '')
                ) {
                  hasImages = true;
                  imageCount++;
                }
              }
            } else if (
              (obj.value && typeof obj.value === 'string' && obj.value.startsWith('data:image/')) ||
              (obj.localFileName && String(obj.localFileName).trim() !== '')
            ) {
              hasImages = true;
              imageCount++;
            }
          }
          Object.values(obj).forEach(value => checkForImages(value));
        }
      };
      checkForImages(evalSnapshot);
      console.log(`Evaluación a enviar tiene ${imageCount} imagen(es):`, hasImages);

      /** JSON con `localFileName`; la hidratación a base64 ocurre dentro de create/update en checklistSupervisionFunctions (como en la cola de sync). */
      const evaluacionStr = JSON.stringify(evalSnapshot);
      console.log(
        'Tamaño del JSON de evaluación (local):',
        evaluacionStr.length,
        'caracteres; envío API:',
        isConnected
      );

      const horaAccionIso = new Date(horaAccion).toISOString();
      const articulosPuesto =
        articulos && articulos.length > 0
          ? serializeArticulosPuestoForStorage(articulos, horaAccionIso)
          : '[]';
      const requestData = {
        empresa_id: selectedEmpresaId,
        cliente_id: selectedClienteId,
        division_id: selectedDivisionId,
        contrato_id: selectedContratoId,
        corpo_id: selectedCorpoId,
        puesto_id: selectedPuestoId,
        division: selectedDivisionId,
        fecha: fecha.toISOString(),
        ejecutivo_cuenta: ejecutivoCuenta,
        evaluacion: evaluacionStr,
        articulos_puesto: articulosPuesto,
        firma_supervisor: firmaSupervisor,
        firma_responsable: firmaResponsable,
        created_at: horaAccionIso,
        hora_accion: horaAccionIso,
        empleado_id: empleadoSel.id,
        empleado_nombre: empleadoSel.nombre,
        empleado_codigo: empleadoSel.codigo,
        hora_inicio: formatTimeHHmm(horaInicio),
        hora_fin: formatTimeHHmm(horaFin),
        isActive: true,
        ...(planillasToken ? { planillasToken } : {}),
      };

      if (editing && editing.id && editing.id !== 0) {
        // Actualizar (PUT): el servidor aplica la misma lógica que en POST sobre c_articulo_mantenimiento
        if (isConnected) {
          const result = await updateChecklistSupervision({
            id: editing.id,
            requestData,
            planillasToken,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            // Online: actualizar caches sin encolar acciones de mantenimiento (ya se sincronizan por API)
            await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
              horaAccion,
            });
            await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);
            await refreshPuestoArticulosCacheAfterSave();

            Alert.alert('Éxito', result.message || 'Checklist actualizado correctamente');
            await clearDraftAfterSuccessfulSubmit();
            setTimeout(async () => {
              await fetchChecklists();
              cancelCreating();
            }, 2000);
          } else {
            Alert.alert('Error', result.message || 'No se pudo actualizar');
          }
        } else {
          // Offline: una sola acción "update" por id de servidor (reemplazar, no apilar).
          const localId =
            editing.id_local && String(editing.id_local).length > 0
              ? editing.id_local
              : `local-checklist-${Date.now()}-${generateRandomId()}`;
          const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
          const actions = actionsStr ? JSON.parse(actionsStr) : [];
          const entry = {
            type: 'update' as const,
            id: editing.id,
            id_local: localId,
            requestData,
            ...(planillasToken ? { planillasToken } : {}),
          };
          const uidx = actions.findIndex((a: any) => a.type === 'update' && a.id === editing.id);
          if (uidx !== -1) actions[uidx] = entry;
          else actions.push(entry);
          await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(actions));

          // Actualizar cache (lista en estado solo incluye el puesto del filtro)
          const lblUp = resolveChecklistHierarchyLabels(structure, selectedPuestoId);
          const cachePuestoId = Number(selectedPuestoId);
          const bucket = await loadChecklistSupervisionCacheForPuesto(cachePuestoId);
          const nextBucket = bucket.map((c) => {
            if (c.id !== editing.id) return c;
            return normalizeChecklistRowForCache(
              {
                ...c,
                ...requestData,
                id_local: localId,
                cliente: {
                  id: selectedClienteId!,
                  nombre: (c.cliente?.nombre && String(c.cliente.nombre).trim()) || lblUp.cliente || '-',
                },
                corpo: {
                  id: selectedCorpoId!,
                  nombre: (c.corpo?.nombre && String(c.corpo.nombre).trim()) || lblUp.corpo || '-',
                },
                puesto: {
                  id: selectedPuestoId!,
                  nombre: (c.puesto?.nombre && String(c.puesto.nombre).trim()) || lblUp.puesto || '-',
                  codigo: (c.puesto as any)?.codigo || lblUp.codigo || '',
                },
              },
              cachePuestoId,
            );
          });
          await saveChecklistSupervisionCacheForPuesto(cachePuestoId, nextBucket);
          await syncChecklistsFromCache(cachePuestoId);

          // Offline: actualizar solo caches locales (sin encolar acciones de mantenimiento)
          await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
            horaAccion,
          });
          await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);

          Alert.alert('Éxito', 'Checklist guardado localmente. Se sincronizará cuando haya conexión.');
          await clearDraftAfterSuccessfulSubmit();
          setTimeout(() => {
            cancelCreating();
          }, 2000);
        }
      } else {
        // Crear
        if (isConnected) {
          const result = await createChecklistSupervision({
            requestData,
            planillasToken,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const newId = Number((result as any).id ?? (result as any).data?.id ?? 0);
            const payload = (result as any).data;
            if (newId > 0 && selectedPuestoId) {
              const empresaNode = structure.find((e: any) => e.id === selectedEmpresaId);
              const clienteNode = empresaNode?.clientes?.find((c: any) => c.id === selectedClienteId);
              const sucursalNode = sucursales.find((s: any) => s.id === selectedCorpoId);
              const puestoNode = puestos.find((p: any) => p.id === selectedPuestoId);
              const serverRow: ChecklistSupervisionUI =
                payload && typeof payload === 'object' && Number((payload as any).id) === newId
                  ? ({ ...(payload as ChecklistSupervisionUI), id_local: '' } as ChecklistSupervisionUI)
                  : {
                      id: newId,
                      empresa_id: selectedEmpresaId!,
                      cliente_id: selectedClienteId!,
                      division_id: selectedDivisionId!,
                      contrato_id: selectedContratoId!,
                      corpo_id: selectedCorpoId!,
                      puesto_id: selectedPuestoId!,
                      isActive: true,
                      fecha: fecha.toISOString(),
                      ejecutivo_cuenta: ejecutivoCuenta,
                      evaluacion: evaluacionStr,
                      articulos_puesto: articulosPuesto as any,
                      firma_supervisor: firmaSupervisor,
                      firma_responsable: firmaResponsable,
                      created_by: typeof employee?.id === 'number' ? employee.id : Number(employee?.id ?? 0),
                      created_at: horaAccionIso,
                      empleado_id: empleadoSel.id,
                      empleado_nombre: empleadoSel.nombre,
                      empleado_codigo: empleadoSel.codigo,
                      hora_inicio: formatTimeHHmm(horaInicio),
                      hora_fin: formatTimeHHmm(horaFin),
                      cliente: clienteNode ? { id: clienteNode.id, nombre: clienteNode.nombre } : undefined,
                      corpo: sucursalNode ? { id: sucursalNode.id, nombre: sucursalNode.nombre } : undefined,
                      puesto: puestoNode
                        ? {
                            id: puestoNode.id,
                            nombre: puestoNode.nombre,
                            codigo: String((puestoNode as any).codigo ?? ''),
                          }
                        : undefined,
                    };
              const row = normalizeChecklistRowForCache(
                serverRow,
                selectedPuestoId,
              ) as ChecklistSupervisionUI;
              const bucket = await loadChecklistSupervisionCacheForPuesto(selectedPuestoId);
              const nextBucket = [row, ...bucket.filter((x) => Number(x.id) !== newId)];
              await saveChecklistSupervisionCacheForPuesto(selectedPuestoId, nextBucket);
              await syncChecklistsFromCache(selectedPuestoId);
            }
            // Online: actualizar caches sin encolar acciones de mantenimiento
            await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
              horaAccion,
            });
            await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);
            await refreshPuestoArticulosCacheAfterSave();

            Alert.alert('Éxito', result.message || 'Checklist creado correctamente');
            await clearDraftAfterSuccessfulSubmit();
            setTimeout(async () => {
              await fetchChecklists();
              cancelCreating();
            }, 2000);
          } else {
            Alert.alert('Error', result.message || 'No se pudo crear');
          }
        } else {
          // Offline: crear o re-guardar borrador local (id 0 / solo id_local) sin duplicar la cola
          const localId =
            editing?.id_local && String(editing.id_local).length > 0
              ? editing.id_local
              : `local-checklist-${Date.now()}-${generateRandomId()}`;
          const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
          const actions = actionsStr ? JSON.parse(actionsStr) : [];
          const entry = {
            type: 'create' as const,
            id_local: localId,
            requestData,
            ...(planillasToken ? { planillasToken } : {}),
          };
          const existingIdx = actions.findIndex((a: any) => a.type === 'create' && a.id_local === localId);
          if (existingIdx !== -1) actions[existingIdx] = entry;
          else actions.push(entry);
          await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(actions));

          // Agregar a cache
          if (!selectedClienteId || !selectedDivisionId || !selectedCorpoId || !selectedPuestoId) {
            Alert.alert('Error', 'Debes completar todos los campos requeridos');
            setIsSubmitting(false);
            return;
          }
          const lblNew = resolveChecklistHierarchyLabels(structure, selectedPuestoId);
          const newItem: ChecklistSupervisionUI = {
            id: 0,
            id_local: localId,
            empresa_id: selectedEmpresaId!,
            cliente_id: selectedClienteId,
            division_id: selectedDivisionId,
            contrato_id: selectedContratoId!,
            corpo_id: selectedCorpoId,
            puesto_id: selectedPuestoId,
            isActive: true,
            fecha: fecha.toISOString(),
            ejecutivo_cuenta: ejecutivoCuenta,
            evaluacion: evaluacionStr,
            articulos_puesto: articulosPuesto,
            firma_supervisor: firmaSupervisor,
            firma_responsable: firmaResponsable,
            created_by: typeof employee?.id === 'number' ? employee.id : (employee?.id ? Number(employee.id) : 0),
            created_at: new Date(horaAccion).toISOString(),
            empleado_id: empleadoSel.id,
            empleado_nombre: empleadoSel.nombre,
            empleado_codigo: empleadoSel.codigo,
            hora_inicio: formatTimeHHmm(horaInicio),
            hora_fin: formatTimeHHmm(horaFin),
            cliente: { id: selectedClienteId, nombre: lblNew.cliente || '-' },
            corpo: { id: selectedCorpoId, nombre: lblNew.corpo || '-' },
            puesto: { id: selectedPuestoId, nombre: lblNew.puesto || '-', codigo: lblNew.codigo || '' },
          };
          const cachePuestoId = Number(selectedPuestoId);
          const normalizedNew = normalizeChecklistRowForCache(newItem, cachePuestoId) as ChecklistSupervisionItem;
          const bucket = await loadChecklistSupervisionCacheForPuesto(cachePuestoId);
          const nextBucket =
            editing?.id_local && String(editing.id_local).length > 0
              ? bucket.map((c) =>
                  String((c as ChecklistSupervisionUI).id_local) === String(editing.id_local) ? normalizedNew : c,
                )
              : [...bucket, normalizedNew];
          await saveChecklistSupervisionCacheForPuesto(cachePuestoId, nextBucket);
          await syncChecklistsFromCache(cachePuestoId);

          // Offline: actualizar solo caches locales (sin encolar acciones de mantenimiento)
          await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
            horaAccion,
          });
          await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);

          Alert.alert('Éxito', 'Checklist guardado localmente. Se sincronizará cuando haya conexión.');
          await clearDraftAfterSuccessfulSubmit();
          setTimeout(() => {
            cancelCreating();
          }, 2000);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar');
    } finally {
      setIsSubmitting(false);
    }
  };
  submitSaveRef.current = submitSave;

  const handleSave = () => {
    Alert.alert(
      'Confirmar',
      editing ? '¿Deseas actualizar este checklist?' : '¿Deseas crear este checklist?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: () => {
            submitSave();
          },
        },
      ]
    );
  };

  const handleDelete = async (it: ChecklistSupervisionUI) => {
    Alert.alert('Confirmar', '¿Eliminar este checklist?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const deleteKey = it.id_local || it.id;
          setDeletingChecklistId(deleteKey);
          try {
            const isConnected = await getConnectionStatus();
            if (it.id && it.id !== 0 && isConnected) {
              const result = await deleteChecklistSupervision({
                id: it.id,
                refreshAccessToken,
                logout,
              });
              if (result.status) {
                Alert.alert('Éxito', 'Checklist eliminado correctamente');
                await fetchChecklists();
              } else {
                Alert.alert('Error', result.message || 'No se pudo eliminar');
              }
            } else if (it.id && it.id !== 0 && !isConnected) {
              const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const cleaned = actions.filter((a: any) => {
                if (a.type === 'update_supervisor_firma' && Number(a.id) === Number(it.id)) return false;
                if (a.type === 'update' && Number(a.id) === Number(it.id)) return false;
                return true;
              });
              cleaned.push({
                type: 'delete',
                id: it.id,
                id_local: it.id_local,
              });
              await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(cleaned));

              const puestoId = resolveChecklistRowPuestoId(it, filterPuestoIdRef.current);
              const bucket = await loadChecklistSupervisionCacheForPuesto(puestoId);
              const nextBucket = bucket.filter((c) => Number(c.id) !== Number(it.id));
              await saveChecklistSupervisionCacheForPuesto(puestoId, nextBucket);
              await syncChecklistsFromCache(puestoId);

              Alert.alert('Modo Offline', 'Checklist eliminado localmente. Se sincronizará cuando haya conexión.');
            } else if (it.id_local) {
              const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const updatedActions = actions.filter((a: any) => {
                if (a.type === 'create' && a.id_local === it.id_local) return false;
                if (a.type === 'update' && a.id_local === it.id_local) return false;
                return true;
              });
              await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(updatedActions));

              const puestoId = resolveChecklistRowPuestoId(it, filterPuestoIdRef.current);
              const bucket = await loadChecklistSupervisionCacheForPuesto(puestoId);
              const nextBucket = bucket.filter(
                (c) => String((c as ChecklistSupervisionUI).id_local || '') !== String(it.id_local),
              );
              await saveChecklistSupervisionCacheForPuesto(puestoId, nextBucket);
              await syncChecklistsFromCache(puestoId);

              Alert.alert('Éxito', 'Registro pendiente eliminado (no requiere sincronizar borrado en servidor).');
            }
          } finally {
            setDeletingChecklistId((prev) => (prev === deleteKey ? null : prev));
          }
        },
      },
    ]);
  };

  const resetAllFilters = () => {
    setFilterSearch('');
    setFilterEmpresaId(null);
    setFilterClienteId(null);
    setFilterDivisionId(null);
    setFilterContratoId(null);
    setFilterCorpoId(null);
    setFilterPuestoId(null);
    setChecklists([]);
  };

  /** `checklists` ya está acotado al puesto activo; aquí solo aplica búsqueda por texto. */
  const filteredChecklists = useMemo(() => {
    const unique = dedupeChecklistRows(checklists as ChecklistSupervisionItem[]) as ChecklistSupervisionUI[];
    if (!filterSearch.trim()) return unique;
    const searchLower = filterSearch.toLowerCase();
    return unique.filter((c) => {
      if ((c as any).isActive === false) return false;
      const lbl = resolveChecklistHierarchyLabels(structure, c.puesto_id);
      const nc = (c.cliente?.nombre && String(c.cliente.nombre).trim()) || lbl.cliente || '';
      const ns = (c.corpo?.nombre && String(c.corpo.nombre).trim()) || lbl.corpo || '';
      const np = (c.puesto?.nombre && String(c.puesto.nombre).trim()) || lbl.puesto || '';
      return (
        c.ejecutivo_cuenta?.toLowerCase().includes(searchLower) ||
        nc.toLowerCase().includes(searchLower) ||
        ns.toLowerCase().includes(searchLower) ||
        np.toLowerCase().includes(searchLower)
      );
    });
  }, [checklists, filterSearch, structure]);

  // Renderizar evaluación dinámica (como StaffEvaluationsScreen)
  const renderEvaluationInput = (input: EvaluationInput, sectionId: string, subsectionId: string) => {
    switch (input.type) {
      case 'text':
        return (
          <TextInput
            style={styles.formInput}
            placeholder={input.title || 'Texto'}
            placeholderTextColor="#999"
            value={input.value}
            onChangeText={(text) => updateInput(sectionId, subsectionId, input.id, { value: text })}
          />
        );
      case 'textarea':
        return (
          <TextInput
            style={[styles.formInput, styles.textArea]}
            multiline
            placeholder={input.title || 'Texto largo'}
            placeholderTextColor="#999"
            value={input.value}
            onChangeText={(text) => updateInput(sectionId, subsectionId, input.id, { value: text })}
          />
        );
      case 'select':
        if (isNumericRatingSelect(input)) {
          const currentValue = String(input.value || '').trim();
          const currentScore = /^[1-5]$/.test(currentValue) ? Number(currentValue) : 0;
          return (
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => {
                const starValue = i + 1;
                const filled = starValue <= currentScore;
                return (
                  <TouchableOpacity
                    key={starValue}
                    onPress={() => {
                      updateInput(sectionId, subsectionId, input.id, { value: String(starValue) });
                    }}
                  >
                    <Ionicons
                      name={filled ? 'star' : 'star-outline'}
                      size={20}
                      color={filled ? '#FFD700' : '#C7C7CC'}
                      style={styles.starIcon}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        }
        return (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={input.value || ''}
              onValueChange={(value) => {
                updateInput(sectionId, subsectionId, input.id, { value });
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar opción..." value="" color="#000000" />
              {(input.options || []).map((opt) => (
                <Picker.Item key={opt} label={opt} value={opt} color="#000000" />
              ))}
            </Picker>
          </View>
        );
      case 'date':
        const dateValue = input.value ? new Date(input.value) : new Date();
        return (
          <View>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setDatePickerValue(dateValue);
                setDatePickerInput({ sectionId, subsectionId, inputId: input.id });
              }}
            >
              <ThemedText style={styles.dateButtonText}>
                {input.value ? convertDateTimestampToLocalString(new Date(input.value).toISOString(), false) : 'Seleccionar fecha'}
              </ThemedText>
              <Ionicons name="calendar-outline" size={18} color="#007AFF" />
            </TouchableOpacity>
            {datePickerInput?.sectionId === sectionId && datePickerInput?.subsectionId === subsectionId && datePickerInput?.inputId === input.id && (
              <DateTimePicker
                value={datePickerValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setDatePickerInput(null);
                  }
                  if (selectedDate) {
                    setDatePickerValue(selectedDate);
                    const isoDate = selectedDate.toISOString();
                    updateInput(sectionId, subsectionId, input.id, { value: isoDate });
                    if (Platform.OS === 'ios') {
                      setDatePickerInput(null);
                    }
                  }
                }}
              />
            )}
          </View>
        );
      case 'photo':
        return null; // Las fotos se manejan fuera de renderEvaluationInput
      case 'checkbox':
        const isChecked = input.value === 'true';
        return (
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[
                styles.checkbox,
                isChecked ? styles.checkboxChecked : styles.checkboxUnchecked
              ]}
              onPress={() => updateInput(sectionId, subsectionId, input.id, { value: isChecked ? 'false' : 'true' })}
              activeOpacity={0.8}
            >
              {isChecked && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </TouchableOpacity>
            {input.title && (
              <ThemedText style={styles.checkboxLabel}>Cumplido</ThemedText>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  // Función para toggle de expansión (como StaffEvaluationsScreen)
  const toggleChecklistExpanded = (key: string) => {
    setExpandedChecklists((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleChecklistFirmasExpanded = (key: string) => {
    setExpandedChecklistFirmas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Función para parsear evaluación desde JSON
  const parseEvaluation = (evaluacionStr: string | null): EvaluationSection[] => {
    if (!evaluacionStr) return [];
    try {
      const parsed = JSON.parse(evaluacionStr);
      const result = Array.isArray(parsed) ? parsed : [];
      return normalizeEvaluationSections(result);
    } catch (error) {
      console.error('parseEvaluation: Error parsing evaluation:', error);
      return [];
    }
  };

  // Función para obtener URI de imagen en lista
  const getPhotoItemUriForList = (
    photo: EvaluationPhotoItem,
    input: EvaluationInput,
    row: ChecklistSupervisionUI,
  ): string => {
    if (photo.localFileName && String(photo.localFileName).trim() !== '') {
      const u = getLocalFileDisplayUri(String(photo.localFileName).trim());
      if (u) return u;
    }
    if (photo.value && typeof photo.value === 'string' && photo.value.startsWith('data:image/')) {
      return photo.value;
    }
    if (photo.value && typeof photo.value === 'string' && photo.value.length > 100 && !photo.value.startsWith('http')) {
      return `data:image/jpeg;base64,${photo.value}`;
    }
    if (checklistRowShowsOfflineBadge(row) && !photo.localFileName) {
      return '';
    }
    const checklistId = row.id != null ? Number(row.id) : 0;
    if (photo.file_name && Number.isFinite(checklistId) && checklistId > 0) {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        return appendTokenToUrl(
          `${apiUrl}/api/checklist-supervision/${checklistId}/get-image/${encodeURIComponent(photo.file_name)}?t=${Date.now()}`,
        );
      }
    }
    return '';
  };

  const getImageUriForList = (input: EvaluationInput, row: ChecklistSupervisionUI): string => {
    const photos = normalizePhotoInput(input);
    if (photos.length > 0) return getPhotoItemUriForList(photos[0], input, row);
    return '';
  };

  const renderItem = (it: ChecklistSupervisionUI, index: number) => {
    const key = checklistListKey(it, index);
    const isExpanded = expandedChecklists.has(key);
    const firmasExpanded = expandedChecklistFirmas.has(key);
    const fechaStr = it.fecha ? new Date(it.fecha).toLocaleDateString() : '-';
    const horaInicioStr = normalizeTimeToHHmm((it as any).hora_inicio) || '—';
    const horaFinStr = normalizeTimeToHHmm((it as any).hora_fin) || '—';
    const empleadoNombre = String((it as any).empleado_nombre ?? '').trim();
    const empleadoCodigo = String((it as any).empleado_codigo ?? '').trim();
    const evaluationSections = parseEvaluation(it.evaluacion);

    const lbl = resolveChecklistHierarchyLabels(structure, it.puesto_id);
    const nombreCliente = (it.cliente?.nombre && String(it.cliente.nombre).trim()) || lbl.cliente || '-';
    const nombreCorpo = (it.corpo?.nombre && String(it.corpo.nombre).trim()) || lbl.corpo || '-';
    const nombrePuesto = (it.puesto?.nombre && String(it.puesto.nombre).trim()) || lbl.puesto || '-';

    return (
      <ThemedView key={key} style={styles.bitacoraCard}>
        <ThemedText style={styles.bitTitle}>
          {nombreCliente} - {nombreCorpo} - {nombrePuesto}
          {checklistRowShowsOfflineBadge(it) ? ' (offline)' : ''}
        </ThemedText>
        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
          <ThemedText style={styles.bitValue}>{fechaStr}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Empleado: </ThemedText>
          <ThemedText style={styles.bitValue}>
            {empleadoNombre || empleadoCodigo
              ? `${empleadoNombre || '—'}${empleadoCodigo ? ` (${empleadoCodigo})` : ''}`
              : '—'}
          </ThemedText>
        </ThemedText>
        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Horario: </ThemedText>
          <ThemedText style={styles.bitValue}>{horaInicioStr} – {horaFinStr}</ThemedText>
        </ThemedText>

        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => toggleChecklistFirmasExpanded(key)}
        >
          <ThemedText style={styles.collapseButtonText}>
            {firmasExpanded ? 'Ocultar firmas' : 'Ver firmas'}
          </ThemedText>
          <Ionicons
            name={firmasExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#007AFF"
          />
        </TouchableOpacity>

        {firmasExpanded && (
          <ThemedView style={styles.collapsableContent}>
            <ThemedView style={styles.listSignaturesStack}>
              <ThemedView style={styles.listSignatureBlock}>
                <ThemedText style={styles.bitLabel}>Firma supervisor</ThemedText>
                {it.firma_supervisor && String(it.firma_supervisor).trim() !== '' ? (
                  <>
                    <Image
                      source={{ uri: formatSignatureForDisplay(it.firma_supervisor) }}
                      style={styles.listSignatureImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity onPress={() => openListSupervisorSignatureModal(it)} activeOpacity={0.7}>
                      <ThemedText style={styles.listSignatureLink}>Cambiar firma</ThemedText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.listAddSupervisorSigButton}
                    onPress={() => openListSupervisorSignatureModal(it)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={20} color="#007AFF" />
                    <ThemedText style={styles.listAddSupervisorSigButtonText}>Añadir firma supervisor</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
              <ThemedView style={styles.listSignatureBlock}>
                <ThemedText style={styles.bitLabel}>Firma responsable</ThemedText>
                {it.firma_responsable && String(it.firma_responsable).trim() !== '' ? (
                  <ThemedView style={styles.listFirmaResponsableBox}>
                    {(() => {
                      const info = decodeFirmaHash(it.firma_responsable);
                      if (!info) {
                        return (
                          <ThemedText style={styles.listFirmaMeta}>Registrada (detalle no disponible)</ThemedText>
                        );
                      }
                      return (
                        <>
                          <ThemedText style={styles.listFirmaMeta}>
                            Sesión: {info.sessionId || 'N/A'} · Empleado: {info.empleadoId || 'N/A'}
                          </ThemedText>
                          <ThemedText style={styles.listFirmaMeta}>
                            Ubicación: {info.latitud || '-'}, {info.longitud || '-'}
                          </ThemedText>
                          <ThemedText style={styles.listFirmaMeta}>
                            Hora:{' '}
                            {info.timestamp
                              ? convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'
                              : 'N/A'}
                          </ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                ) : (
                  <ThemedText style={styles.listFirmaPending}>Sin firma</ThemedText>
                )}
              </ThemedView>
            </ThemedView>
          </ThemedView>
        )}

        {/* Botón para expandir/colapsar evaluación */}
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => toggleChecklistExpanded(key)}
        >
          <ThemedText style={styles.collapseButtonText}>
            {isExpanded ? 'Ocultar evaluación detallada' : 'Ver evaluación detallada'}
          </ThemedText>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#007AFF"
          />
        </TouchableOpacity>

        {/* Contenido colapsable con evaluación */}
        {isExpanded && (
          <ThemedView style={styles.collapsableContent}>
            {evaluationSections.length === 0 ? (
              <ThemedText style={styles.emptyText}>No hay detalles de evaluación</ThemedText>
            ) : (
              evaluationSections.map((section) => (
                <ThemedView key={section.id} style={styles.sectionCardList}>
                  <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                  {section.subsections.map((subsection) => {
                    const listOtherInputs = subsection.inputs.filter((inp) => !isEvaluationPhotoInput(inp));
                    const listPhotoInputs = subsection.inputs.filter((inp) => isEvaluationPhotoInput(inp));
                    const listDetalle =
                      subsection.detalle && String(subsection.detalle).trim() !== '' ? (
                        <ThemedText style={styles.evalLine}>
                          <ThemedText style={styles.evalLabel}>Detalle: </ThemedText>
                          <ThemedText style={styles.evalValue}>{subsection.detalle}</ThemedText>
                        </ThemedText>
                      ) : null;
                    const renderListInput = (input: EvaluationInput) => {
                        const photoItems = input.type === 'photo' ? normalizePhotoInput(input) : [];
                        const listPhotoUri = getImageUriForList(input, it);
                        const displayValue =
                          input.type === 'photo'
                            ? (photoItems.length > 0 ? `${photoItems.length} imagen(es)` : '-')
                            : input.type === 'checkbox'
                              ? (input.value === 'true' ? 'Marcado' : 'No marcado')
                              : (input.value || '-');
                        return (
                          <ThemedView key={evaluationInputKey(section.id, subsection.id, input.id)}>
                            <ThemedText style={styles.evalLine}>
                              {shouldShowInputTitle(input.title, subsection.title) ? (
                                <>
                                  <ThemedText style={styles.evalLabel}>{input.title}: </ThemedText>
                                  <ThemedText style={styles.evalValue}>{displayValue}</ThemedText>
                                </>
                              ) : (
                                <ThemedText style={styles.evalValue}>{displayValue}</ThemedText>
                              )}
                            </ThemedText>
                            {input.type === 'photo' && photoItems.length > 0 ? (
                              <View style={styles.photoGridList}>
                                {photoItems.map((photo) => {
                                  const uri = getPhotoItemUriForList(photo, input, it);
                                  if (!uri) return null;
                                  return (
                                    <Image
                                      key={photo.id}
                                      source={{ uri }}
                                      style={[
                                        styles.questionImagePreviewList,
                                        photo.imageOrientation === 'vertical'
                                          ? styles.questionImagePreviewListVertical
                                          : styles.questionImagePreviewListHorizontal,
                                      ]}
                                      resizeMode="contain"
                                    />
                                  );
                                })}
                              </View>
                            ) : null}
                            {input.type === 'photo' &&
                              photoItems.length === 0 &&
                              listPhotoUri.length > 0 && (
                              <Image
                                source={{ uri: listPhotoUri }}
                                style={[
                                  styles.questionImagePreviewList,
                                  input.imageOrientation === 'vertical'
                                    ? styles.questionImagePreviewListVertical
                                    : styles.questionImagePreviewListHorizontal,
                                ]}
                                resizeMode="contain"
                              />
                            )}
                          </ThemedView>
                        );
                    };
                    return (
                      <ThemedView key={subsection.id} style={styles.questionRow}>
                        {subsection.title && subsection.title.trim() !== '' && (
                          <ThemedText style={styles.questionTitleList}>{subsection.title}</ThemedText>
                        )}
                        {listOtherInputs.map(renderListInput)}
                        {listDetalle}
                        {listPhotoInputs.map(renderListInput)}
                      </ThemedView>
                    );
                  })}
                </ThemedView>
              ))
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.listItemButtons}>
          {false && (
            <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startEditing(it)}>
              <Ionicons name="pencil" size={18} color="#FFFFFF" />
              <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
            </TouchableOpacity>
          )}
          {false && !checklistRowShowsOfflineBadge(it) && (
            <TouchableOpacity
              style={[styles.listItemButton, styles.changesButton]}
              onPress={() => {
                setCambiosTitle(`Cambios - Checklist #${it.id}`);
                fetchCambios('c_checklist_supervision', it.id);
              }}
            >
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.listItemButton, styles.deleteButton, deletingChecklistId === (it.id_local || it.id) && styles.buttonDisabled]}
            onPress={() => handleDelete(it)}
            disabled={deletingChecklistId === (it.id_local || it.id)}
          >
            {deletingChecklistId === (it.id_local || it.id) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash" size={18} color="#FFFFFF" />
                <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Checklist de Supervisión" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="clipboard" size={22} color="#000000" />{' '}
              <ThemedText style={styles.title}>Checklist de Supervisión</ThemedText>

            </ThemedText>
            <ThemedText style={styles.subtitle}>Gestiona los checklists de supervisión</ThemedText>
          </ThemedView>

          {/* Filtros */}
          {!isCreating && !isLoading && (
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                >
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons
                    name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#007AFF"
                  />
                </TouchableOpacity>
                {isFiltersExpanded && (
                  <TouchableOpacity style={styles.resetFiltersButton} onPress={resetAllFilters}>
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
              {isFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Buscar:</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterSearch}
                      onChangeText={setFilterSearch}
                      placeholder="Texto en registro (ejecutivo, cliente, sucursal…)"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  {/* Jerarquía para filtros (puesto = alcance del listado) */}
                  {isStructureLoading ? (
                    <ThemedText style={styles.emptyText}>Cargando jerarquía…</ThemedText>
                  ) : structure.length === 0 ? (
                    <ThemedText style={styles.emptyText}>Sin estructura en caché.</ThemedText>
                  ) : (
                    <HierarchyPickerFields
                      structure={structure}
                      isLoading={isStructureLoading}
                      levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                      emptyPickerValue={0}
                      values={{
                        empresaId: filterEmpresaId,
                        clienteId: filterClienteId,
                        divisionId: filterDivisionId,
                        contratoId: filterContratoId,
                        sucursalId: filterCorpoId,
                        puestoId: filterPuestoId,
                      }}
                      onChange={handleFilterHierarchyChange}
                      labels={{ sucursal: 'Sucursal (corpo)' }}
                      renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                      pickerStyle={styles.picker}
                      fieldGroupStyle={styles.filterGroupSearch}
                    />
                  )}
                  <ThemedText style={styles.filterHintMuted}>
                    Elija un puesto para ver y sincronizar los registros de ese puesto.
                  </ThemedText>
                </ThemedView>
              )}
            </ThemedView>
          )}

          {!isCreating && !isLoading && hasFormDraft && (
            <ThemedView style={[styles.draftBannerBox, styles.hierarchyHintBoxColumn]}>
              <ThemedView style={styles.draftBannerTopRow}>
                <Ionicons name="document-text-outline" size={22} color="#FF9500" style={{ marginRight: 10 }} />
                <ThemedView style={{ flex: 1 }}>
                  <ThemedText style={styles.draftBannerTitle}>Borrador guardado</ThemedText>
                  <ThemedText style={styles.draftBannerText}>
                    {formDraftSavedAt
                      ? `Último guardado: ${convertDateTimestampToLocalString(formDraftSavedAt, true)}. Puedes continuar donde lo dejaste.`
                      : 'Tienes un formulario sin terminar. Puedes continuar donde lo dejaste.'}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
              <TouchableOpacity
                style={styles.draftContinueButton}
                onPress={() => void restoreFormDraft()}
                disabled={isRestoringFormDraft}
                activeOpacity={0.85}
              >
                {isRestoringFormDraft ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.draftContinueButtonText}>Continuar borrador</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </ThemedView>
          )}

          {!isCreating && !isLoading && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>
                <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
              </ThemedText>
            </TouchableOpacity>
          )}

          {!isCreating && !isLoading && isHierarchyHintVisible && (
            <ThemedView style={[styles.hierarchyHintBox, styles.hierarchyHintBoxColumn]}>
              <ThemedView style={styles.hierarchyHintTopRow}>
                <Ionicons name="information-circle-outline" size={22} color="#007AFF" style={{ marginRight: 10 }} />
                <ThemedView style={styles.hierarchyHintTextRow}>
                  <ThemedText style={[styles.hierarchyHintText, { flex: 1 }]}>
                    Algunos datos podrían estar desactualizados. Para mayor precisión, vaya a la sección de jerarquía y actualice la información.
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setIsHierarchyHintVisible(false)}
                    style={styles.hierarchyHintClose}
                    accessibilityLabel="Cerrar aviso"
                  >
                    <ThemedText style={styles.hierarchyHintCloseText}>Cerrar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
              <TouchableOpacity
                style={[styles.goEntregaButton, styles.hierarchyHintGoButton]}
                onPress={() => navigation.navigate('Jerarquia')}
                activeOpacity={0.85}
                accessibilityLabel="Abrir Jerarquía para actualizar"
              >
                <Ionicons name="open-outline" size={16} color="#007AFF" />
                <ThemedText style={styles.goEntregaButtonText}>
                  Actualiza los datos en Jerarquía
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>{editing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

              {draftStatusMessage ? (
                <ThemedView
                  style={[
                    styles.draftStatusBox,
                    draftStatusMessage.type === 'success'
                      ? styles.responseSuccess
                      : draftStatusMessage.type === 'error'
                        ? styles.responseError
                        : styles.draftStatusInfo,
                  ]}
                >
                  <ThemedText style={styles.draftStatusText}>{draftStatusMessage.text}</ThemedText>
                </ThemedView>
              ) : null}

              {/* Jerarquía para formulario (incluye puesto) */}
              <HierarchyPickerFields
                structure={structure}
                isLoading={isStructureLoading}
                levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                emptyPickerValue={0}
                values={{
                  empresaId: selectedEmpresaId,
                  clienteId: selectedClienteId,
                  divisionId: selectedDivisionId,
                  contratoId: selectedContratoId,
                  sucursalId: selectedCorpoId,
                  puestoId: selectedPuestoId,
                }}
                onChange={handleFormHierarchyChange}
                labels={{ sucursal: 'Sucursal (corpo)' }}
                renderLabel={(text) => <ThemedText style={styles.label}>{text} *</ThemedText>}
                pickerStyle={styles.picker}
                fieldGroupStyle={styles.filterGroup}
              />

              <ThemedText style={styles.label}>Fecha *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaPicker(true)}>
                <ThemedText style={styles.dateButtonText}>
                  {convertDateTimestampToLocalString(new Date(fecha).toISOString(), false)}
                </ThemedText>
                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
              </TouchableOpacity>

              <ThemedText style={styles.label}>Empleado *</ThemedText>
              {selectedEmpleado ? (
                <ThemedView style={styles.selectedEmpleadoBox}>
                  <ThemedView style={{ flex: 1 }}>
                    <ThemedText style={styles.selectedEmpleadoName}>{selectedEmpleado.nombre}</ThemedText>
                    {selectedEmpleado.codigo ? (
                      <ThemedText style={styles.selectedEmpleadoMeta}>Código: {selectedEmpleado.codigo}</ThemedText>
                    ) : null}
                  </ThemedView>
                  <TouchableOpacity
                    onPress={() => setSelectedEmpleado(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={22} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ) : null}
              <TouchableOpacity
                style={styles.cameraSmallButton}
                onPress={() => setIsEmployeeSearchVisible(true)}
              >
                <Ionicons name="person-add-outline" size={16} color="#007AFF" />
                <ThemedText style={[styles.cameraSmallButtonText, { color: '#007AFF' }]}>
                  {selectedEmpleado ? 'Cambiar empleado' : 'Buscar empleado'}
                </ThemedText>
              </TouchableOpacity>

              <ThemedText style={styles.label}>Horario del proceso *</ThemedText>

              <ThemedText style={styles.label}>Hora inicio *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePickerInicio(true)}>
                <ThemedText style={styles.dateButtonText}>{formatTimeHHmm(horaInicio)}</ThemedText>
                <Ionicons name="time-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
              {showTimePickerInicio && (
                <DateTimePicker
                  value={horaInicio}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={(_event, selectedDate) => {
                    if (Platform.OS === 'android') setShowTimePickerInicio(false);
                    if (selectedDate) {
                      setHoraInicio(timeDateFromPicker(selectedDate));
                    }
                  }}
                />
              )}

              <ThemedText style={styles.label}>Hora fin *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePickerFin(true)}>
                <ThemedText style={styles.dateButtonText}>{formatTimeHHmm(horaFin)}</ThemedText>
                <Ionicons name="time-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
              {showTimePickerFin && (
                <DateTimePicker
                  value={horaFin}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={(_event, selectedDate) => {
                    if (Platform.OS === 'android') setShowTimePickerFin(false);
                    if (selectedDate) {
                      setHoraFin(timeDateFromPicker(selectedDate));
                    }
                  }}
                />
              )}

              {showReportIncidentOption ? (
                <ThemedView style={styles.reportIncidentBox}>
                  <ThemedText style={styles.reportIncidentHint}>
                    {canReportIncidentFromChecklist
                      ? 'Puede reportar un incidente vinculado a este checklist. Se usará la jerarquía actual y el empleado seleccionado como involucrado.'
                      : 'Para reportar un incidente complete la jerarquía (empresa → puesto) y seleccione un empleado con código y nombre.'}
                  </ThemedText>
                  <TouchableOpacity
                    style={[
                      styles.reportIncidentButton,
                      (!canReportIncidentFromChecklist || isSavingFormDraft || isSubmitting) && styles.buttonDisabled,
                    ]}
                    onPress={handleReportIncident}
                    disabled={isSavingFormDraft || isSubmitting}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="warning-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.reportIncidentButtonText}>Reportar incidente</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ) : null}

              {/* Evaluación dinámica */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Evaluación</ThemedText>
                {evaluation.length === 0 && selectedDivisionId && (
                  <ThemedText style={styles.errorText}>
                    Selecciona una división válida (Aseo y limpieza o Seguridad) para cargar el formulario
                  </ThemedText>
                )}

                {evaluation.map((section) => {
                  const isLicenciasSection = isLicenciasEvaluationSection(section);
                  const sectionInner = (
                    <>
                    {!isLicenciasSection ? (
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                      {!section.isPredefined && (
                        <TouchableOpacity onPress={() => deleteSection(section.id)}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      )}
                    </ThemedView>
                    ) : null}
                    {section.subsections.map((subsection) => {
                      const formOtherInputs = subsection.inputs.filter((inp) => !isEvaluationPhotoInput(inp));
                      const formPhotoInputs = subsection.inputs.filter((inp) => isEvaluationPhotoInput(inp));
                      const formDetalle = (
                        <>
                          <TextInput
                            style={[styles.formInput, styles.textAreaInput]}
                            value={subsection.detalle ?? ''}
                            onChangeText={(text) => updateSubsectionDetalle(section.id, subsection.id, text)}
                            placeholder="Detalle del punto evaluado"
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        </>
                      );
                      const renderFormInputCard = (input: EvaluationInput) => {
                        const formPhotoItems = isEvaluationPhotoInput(input) ? normalizePhotoInput(input) : [];
                        return (
                          <ThemedView
                            key={evaluationInputKey(section.id, subsection.id, input.id)}
                            style={styles.inputCard}
                          >
                            {shouldShowInputTitle(input.title, subsection.title) && (
                              <ThemedText style={styles.questionTitleList}>
                                {input.title}
                              </ThemedText>
                            )}
                            {isEvaluationPhotoInput(input) ? (
                              <View>
                                {formPhotoItems.length > 0 ? (
                                  <View style={styles.photoGridForm}>
                                    {formPhotoItems.map((photo) => {
                                      const uri = getPhotoItemUri(photo, input);
                                      if (!uri) {
                                        return (
                                          <View key={photo.id} style={styles.photoThumbWrap}>
                                            <View style={[styles.photoThumb, styles.photoThumbHorizontal, styles.photoThumbMissing]}>
                                              <Ionicons name="image-outline" size={22} color="#999" />
                                              <ThemedText style={styles.photoThumbMissingText}>Sin archivo</ThemedText>
                                            </View>
                                            <TouchableOpacity
                                              style={styles.photoDeleteBtn}
                                              onPress={() =>
                                                removePhotoFromInput(section.id, subsection.id, input.id, photo.id)
                                              }
                                            >
                                              <Ionicons name="trash" size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                          </View>
                                        );
                                      }
                                      return (
                                        <View key={photo.id} style={styles.photoThumbWrap}>
                                          <Image
                                            source={{ uri }}
                                            style={[
                                              styles.photoThumb,
                                              photo.imageOrientation === 'vertical'
                                                ? styles.photoThumbVertical
                                                : styles.photoThumbHorizontal,
                                            ]}
                                            resizeMode="cover"
                                          />
                                          <TouchableOpacity
                                            style={styles.photoDeleteBtn}
                                            onPress={() =>
                                              removePhotoFromInput(section.id, subsection.id, input.id, photo.id)
                                            }
                                          >
                                            <Ionicons name="trash" size={16} color="#FFFFFF" />
                                          </TouchableOpacity>
                                        </View>
                                      );
                                    })}
                                  </View>
                                ) : null}
                                <TouchableOpacity
                                  style={styles.cameraSmallButton}
                                  onPress={() => handleAddPhoto(`${section.id}|${subsection.id}|${input.id}`)}
                                >
                                  <Ionicons name="camera" size={16} color="#000000" />
                                  <ThemedText style={styles.cameraSmallButtonText}>
                                    {formPhotoItems.length > 0 ? 'Agregar otra foto' : 'Tomar foto'}
                                  </ThemedText>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View>
                                {renderEvaluationInput(input, section.id, subsection.id)}
                                {isUserAddedSubsection(section, subsection) && (
                                  <TouchableOpacity
                                    style={styles.deleteInputButtonSmall}
                                    onPress={() => deleteInput(section.id, subsection.id, input.id)}
                                  >
                                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </ThemedView>
                        );
                      };
                      return (
                      <ThemedView key={subsection.id} style={styles.questionCard}>
                        {subsection.title && subsection.title.trim() !== '' && (
                          <ThemedText style={styles.questionTitleList}>
                            {subsection.title}
                          </ThemedText>
                        )}
                        {formOtherInputs.map(renderFormInputCard)}
                        {formDetalle}
                        {formPhotoInputs.map(renderFormInputCard)}
                        {isUserAddedSubsection(section, subsection) && (
                          <TouchableOpacity
                            style={styles.cameraSmallButton}
                            onPress={() =>
                              openInputTypeModal({
                                mode: 'existing',
                                sectionId: section.id,
                                subsectionId: subsection.id,
                              })
                            }
                          >
                            <Ionicons name="add" size={16} color="#007AFF" />
                            <ThemedText style={styles.cameraSmallButtonText}>Agregar input</ThemedText>
                          </TouchableOpacity>
                        )}
                        {isUserAddedSubsection(section, subsection) && (
                          <TouchableOpacity
                            style={[styles.cameraSmallButton, { backgroundColor: '#FFECEC', borderColor: '#FF3B30' }]}
                            onPress={() => deleteSubsection(section.id, subsection.id)}
                          >
                            <Ionicons name="trash" size={16} color="#FF3B30" />
                            <ThemedText style={[styles.cameraSmallButtonText, { color: '#FF3B30' }]}>Eliminar subsección</ThemedText>
                          </TouchableOpacity>
                        )}
                      </ThemedView>
                      );
                    })}

                    {/* Botón para agregar nueva subsección - debe estar fuera del map pero dentro de sectionCard */}
                    <TouchableOpacity
                      style={styles.cameraSmallButton}
                      onPress={() => addSubsection(section.id)}
                    >
                      <Ionicons name="add" size={16} color="#007AFF" />
                      <ThemedText style={styles.cameraSmallButtonText}>Agregar subsección</ThemedText>
                    </TouchableOpacity>
                    </>
                  );

                  return (
                    <ThemedView key={section.id} style={styles.sectionCard}>
                      {isLicenciasSection ? (
                        <Collapsible title={section.title || 'Licencias'}>{sectionInner}</Collapsible>
                      ) : (
                        sectionInner
                      )}
                    </ThemedView>
                  );
                })}

                {!selectedDivisionId && (
                  <TouchableOpacity style={styles.cameraSmallButton} onPress={addSection}>
                    <Ionicons name="add" size={16} color="#007AFF" />
                    <ThemedText style={styles.cameraSmallButtonText}>Agregar sección</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>

              {/* Sección de artículos */}
              {selectedDivisionId && selectedPuestoId && (
                <ThemedView style={styles.infoSection}>
                  <ThemedText style={styles.sectionTitle}>Artículos</ThemedText>
                  {articulos.length > 0 ? (
                    <View style={styles.tableWrapper}>
                      {/* Columna fija: Artículo */}
                      <View style={styles.tableFixedColumn}>
                        {/* Encabezado fijo */}
                        <View style={styles.tableHeaderFixed}>
                          <View style={styles.tableHeaderCellFirst}>
                            <ThemedText style={styles.tableHeaderText}>Artículo</ThemedText>
                          </View>
                        </View>
                        {/* Filas fijas */}
                        {articulos.map((articulo, index) => (
                          <View key={articuloListKey(articulo, index)} style={styles.tableRowFixed}>
                            <View style={styles.tableCellFirst}>
                              <ThemedText style={styles.tableCellFirstText}>
                                {articulo.nombre}
                              </ThemedText>
                            </View>
                          </View>
                        ))}
                      </View>
                      {/* Columnas con scroll horizontal */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={true}
                        contentContainerStyle={styles.tableScrollContent}
                        style={styles.tableScrollView}
                      >
                        <View style={styles.tableScrollableContainer}>
                          {/* Encabezados de la tabla */}
                          <View style={styles.tableHeader}>
                            <View style={styles.tableHeaderCell}>
                              <ThemedText style={styles.tableHeaderText}>Estado</ThemedText>
                            </View>
                            <View style={styles.tableHeaderCell}>
                              <ThemedText style={styles.tableHeaderText}>Cant. Requerida</ThemedText>
                            </View>
                            <View style={styles.tableHeaderCell}>
                              <ThemedText style={styles.tableHeaderText}>Cant. Real</ThemedText>
                            </View>
                            <View style={styles.tableHeaderCell}>
                              <ThemedText style={styles.tableHeaderText}>Observaciones</ThemedText>
                            </View>
                            <View style={styles.tableHeaderCellArchivos}>
                              <ThemedText style={styles.tableHeaderText}>Archivos</ThemedText>
                            </View>
                          </View>
                          {/* Filas de datos */}
                          {articulos.map((articulo, index) => (
                            <View key={articuloListKey(articulo, index)} style={styles.tableRow}>
                              <View style={styles.tableCell}>
                                <View style={styles.pickerContainerTable}>
                                  <Picker
                                    selectedValue={articulo.estado}
                                    onValueChange={(value) => handleArticuloEstadoChange(index, value)}
                                    style={styles.pickerTable}
                                    itemStyle={styles.pickerItemStyle}
                                  >
                                    <Picker.Item label="Bueno" value="Bueno" color="#000000" />
                                    <Picker.Item label="Malo" value="Malo" color="#000000" />
                                    <Picker.Item label="No está" value="No está" color="#000000" />
                                  </Picker>
                                </View>
                              </View>
                              <View style={styles.tableCell}>
                                <ThemedText style={styles.tableCellText}>
                                  {String(articulo.cantidad_requerida)}
                                </ThemedText>
                              </View>
                              <View style={styles.tableCell}>
                                <TextInput
                                  style={styles.inputTable}
                                  value={String(articulo.cantidad_real)}
                                  onChangeText={(text) => {
                                    const num = parseInt(text) || 0;
                                    handleArticuloCantidadChange(index, num);
                                  }}
                                  keyboardType="numeric"
                                  placeholderTextColor="#999"
                                />
                              </View>
                              <View style={styles.tableCell}>
                                <TextInput
                                  style={[styles.inputTable, styles.textAreaTable]}
                                  value={articulo.observaciones || ''}
                                  onChangeText={(text) => handleArticuloObservacionesChange(index, text)}
                                  placeholder="Observaciones..."
                                  placeholderTextColor="#999"
                                  multiline
                                  numberOfLines={3}
                                />
                              </View>
                              <View style={styles.tableCellArchivos}>
                                <TouchableOpacity
                                  style={styles.archivosBtn}
                                  onPress={() => setArchivosModalIndex(index)}
                                >
                                  <Ionicons name="attach" size={20} color="#007AFF" />
                                  {(articulo.mantenimiento_files?.length ?? 0) > 0 ? (
                                    <ThemedText style={styles.archivosBadge}>
                                      {articulo.mantenimiento_files!.length}
                                    </ThemedText>
                                  ) : null}
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  ) : (
                    <ThemedText style={styles.errorText}>No hay artículos disponibles para este puesto</ThemedText>
                  )}
                </ThemedView>
              )}

              {/* Firma supervisor */}
              <ThemedText style={styles.sectionTitle}>Firma supervisor (Opcional)</ThemedText>
              {firmaSupervisor ? (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image source={{ uri: firmaSupervisor }} style={styles.signaturePreview} resizeMode="contain" />
                  <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setFirmaSupervisor('')}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              ) : null}
              <TouchableOpacity style={styles.openSignatureButton} onPress={openSignatureModal}>
                <Ionicons name="create-outline" size={20} color="#000000" />
                <ThemedText style={styles.openSignatureButtonText}>
                  {firmaSupervisor ? 'Modificar firma' : 'Agregar firma'}
                </ThemedText>
              </TouchableOpacity>

              {/* Firma responsable */}
              <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
              <ThemedView style={styles.signatureButtons}>
                <TouchableOpacity
                  style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                  onPress={handleGenerateFirmaResponsable}
                  disabled={isGeneratingFirma}
                >
                  {isGeneratingFirma ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaResponsable}>
                  <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {!firmaResponsable ? (
                <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
              ) : (
                <ThemedView style={styles.firmaInfoBox}>
                  <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                    <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                    {(() => {
                      const info = decodeFirmaHash(firmaResponsable);
                      if (!info) {
                        return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                      }
                      return (
                        <>
                          <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>
                            Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                          </ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                  <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              )}

              {submitResponse && (
                <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                  <ThemedText style={styles.responseText}>
                    {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                    {submitResponse.message}
                  </ThemedText>
                </ThemedView>
              )}

              <ThemedView style={styles.draftActionsRow}>
                <TouchableOpacity
                  style={[styles.draftActionButton, (isSavingFormDraft || isSubmitting) && styles.buttonDisabled]}
                  onPress={() => void saveFormDraft()}
                  disabled={isSavingFormDraft || isSubmitting || isRestoringFormDraft || isResettingFormDraft}
                >
                  {isSavingFormDraft ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <>
                      <Ionicons name="bookmark-outline" size={16} color="#007AFF" />
                      <ThemedText style={styles.draftActionButtonText}>Guardar borrador</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.draftActionButton, (isSavingFormDraft || isSubmitting) && styles.buttonDisabled]}
                  onPress={() => void saveFormDraft({ closeForm: true })}
                  disabled={isSavingFormDraft || isSubmitting || isRestoringFormDraft || isResettingFormDraft}
                >
                  <Ionicons name="exit-outline" size={16} color="#007AFF" />
                  <ThemedText style={styles.draftActionButtonText}>Guardar y cerrar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.draftActionButton, styles.draftActionReset, (isResettingFormDraft || isSubmitting) && styles.buttonDisabled]}
                  onPress={() => void resetFormWithDraftClear()}
                  disabled={isSavingFormDraft || isSubmitting || isRestoringFormDraft || isResettingFormDraft}
                >
                  {isResettingFormDraft ? (
                    <ActivityIndicator size="small" color="#FF3B30" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={16} color="#FF3B30" />
                      <ThemedText style={styles.draftActionResetText}>Reestablecer</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formActionCancel]}
                  onPress={cancelCreating}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={18} color="#000" />
                  <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formActionSave, isSubmitting && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save" size={18} color="#fff" />
                      <ThemedText style={styles.formActionSaveText}>Aceptar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {!isCreating && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : filteredChecklists.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    {filterPuestoId == null && listPuestoScopeRef.current == null
                      ? 'Seleccione un puesto en los filtros (o use la marca actual al entrar) para ver registros.'
                      : 'No hay registros para este puesto'}
                  </ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {filteredChecklists.map((item, index) => (
                    <React.Fragment key={checklistListKey(item, index)}>
                      {renderItem(item, index)}
                    </React.Fragment>
                  ))}
                </ThemedView>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>

      {showFechaPicker && (
        <DateTimePicker
          value={fecha}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFechaPicker(false);
            if (date) setFecha(date);
          }}
        />
      )}

            <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />


      {/* Modal de firma dibujada (formulario o firma supervisor desde lista) */}
      <Modal
        visible={isSignatureModalVisible}
        transparent={!!signatureModalListTarget}
        animationType={signatureModalListTarget ? 'fade' : 'slide'}
        presentationStyle={signatureModalListTarget ? 'overFullScreen' : 'pageSheet'}
        onRequestClose={() => {
          if (!isSavingSupervisorFirma) closeSignatureModal();
        }}
      >
        {signatureModalListTarget ? (
          <ThemedView style={styles.overlay}>
            <ThemedView style={styles.floatListSignatureCard}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Firma del supervisor</ThemedText>
                <TouchableOpacity onPress={closeSignatureModal} disabled={isSavingSupervisorFirma} style={isSavingSupervisorFirma ? { opacity: 0.4 } : undefined}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </ThemedView>
              <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>
              <View style={[styles.signaturePadBoxListFloat, isSavingSupervisorFirma && { opacity: 0.55 }]}>
                <SignatureScreen
                  ref={signatureRef}
                  onOK={handleSignatureRead}
                  onEmpty={() => {
                    setIsSavingSupervisorFirma(false);
                    savingSupervisorFirmaRef.current = false;
                    Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
                  }}
                  descriptionText=""
                  clearText=""
                  confirmText=""
                  webStyle={signatureWebStyle}
                  key={signatureKey}
                />
              </View>
              <ThemedView style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalClearButton, isSavingSupervisorFirma && styles.buttonDisabled]}
                  onPress={clearSignature}
                  disabled={isSavingSupervisorFirma}
                >
                  <Ionicons name="refresh" size={18} color="#000" />
                  <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAcceptButton, isSavingSupervisorFirma && styles.buttonDisabled]}
                  onPress={() => {
                    if (isSavingSupervisorFirma) return;
                    if (signatureRef.current) {
                      setIsSavingSupervisorFirma(true);
                      signatureRef.current.readSignature();
                    } else {
                      Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
                    }
                  }}
                  disabled={isSavingSupervisorFirma}
                >
                  {isSavingSupervisorFirma ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Ionicons name="checkmark" size={18} color="#000" />
                  )}
                  <ThemedText style={styles.modalAcceptButtonText}>
                    {isSavingSupervisorFirma ? 'Guardando…' : 'Aceptar'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        ) : (
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Dibujar firma</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>
            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                onEmpty={() => {
                  Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
                }}
                descriptionText=""
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignature}>
                <Ionicons name="refresh" size={18} color="#000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAcceptButton}
                onPress={() => {
                  if (signatureRef.current) {
                    signatureRef.current.readSignature();
                  } else {
                    Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
                  }
                }}
              >
                <Ionicons name="checkmark" size={18} color="#000" />
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}
      </Modal>

      {/* Modal archivos de mantenimiento por artículo */}
      {archivosModalIndex != null && selectedPuestoId && articulos[archivosModalIndex] ? (
        <ArticuloMantenimientoArchivosModal
          visible
          onClose={() => setArchivosModalIndex(null)}
          puestoId={Number(selectedPuestoId)}
          articuloId={articulos[archivosModalIndex].id}
          articuloNombre={articulos[archivosModalIndex].nombre}
          formEstado={articulos[archivosModalIndex].estado}
          ultimoMantenimientoId={articulos[archivosModalIndex].ultimo_mantenimiento_id ?? null}
          pendingFiles={articulos[archivosModalIndex].mantenimiento_files ?? []}
          onPendingFilesChange={(files) =>
            handleArticuloMantenimientoFilesChange(archivosModalIndex, files)
          }
          accessToken={accessToken || queryAccessToken}
        />
      ) : null}

      {/* Modal de cámara (siguiendo patrón de VehiclesScreen) */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          {permission?.granted && (
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
            >
              <TouchableOpacity
                style={styles.cameraCloseButton}
                onPress={() => setIsCameraVisible(false)}
              >
                <Ionicons name="close" size={30} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraCaptureButton}
                onPress={takePicture}
              >
                <ThemedView style={styles.cameraCaptureButtonInner} />
              </TouchableOpacity>
            </CameraView>
          )}
        </ThemedView>
      </Modal>

      {/* Modal para agregar subsección */}
      <Modal
        transparent
        visible={isAddSubsectionModalVisible}
        animationType="fade"
        onRequestClose={closeAddSubsectionModal}
      >
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Agregar Subsección</ThemedText>
              <TouchableOpacity onPress={closeAddSubsectionModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              <ThemedView style={styles.filterGroup}>
                <ThemedText style={styles.label}>Título de la subsección (opcional)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Título de la subsección"
                  placeholderTextColor="#999"
                  value={newSubsectionTitle}
                  onChangeText={setNewSubsectionTitle}
                />
              </ThemedView>

              <ThemedText style={styles.sectionTitle}>Inputs</ThemedText>
              {newSubsectionInputs.map((input, idx) => (
                <ThemedView key={idx} style={styles.modalFormCard}>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.label}>Tipo</ThemedText>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={input.type}
                        onValueChange={(value) => {
                          const updated = [...newSubsectionInputs];
                          updated[idx] = {
                            ...updated[idx],
                            type: value,
                            options: value === 'select' ? ['Opción 1', 'Opción 2'] : undefined,
                            photos: value === 'photo' ? [] : undefined,
                            title: value === 'photo' && !String(updated[idx].title ?? '').trim()
                              ? 'Fotos'
                              : updated[idx].title,
                          };
                          setNewSubsectionInputs(updated);
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Texto" value="text" color="#000000" />
                        <Picker.Item label="Texto largo" value="textarea" color="#000000" />
                        <Picker.Item label="Select" value="select" color="#000000" />
                        <Picker.Item label="Fecha" value="date" color="#000000" />
                        <Picker.Item label="Multifoto" value="photo" color="#000000" />
                        <Picker.Item label="Checkbox" value="checkbox" color="#000000" />
                      </Picker>
                    </View>
                    {input.type === 'photo' ? (
                      <ThemedText style={styles.filterHintMuted}>
                        Permite adjuntar varias fotos. Se conservan en el borrador local.
                      </ThemedText>
                    ) : null}
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.label}>Título del input (opcional)</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Título del input"
                      placeholderTextColor="#999"
                      value={input.title || ''}
                      onChangeText={(text) => updateNewSubsectionInput(idx, 'title', text)}
                    />
                  </ThemedView>

                  {input.type === 'select' && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.label}>Opciones (separadas por comas)</ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder="Opción 1, Opción 2, Opción 3"
                        placeholderTextColor="#999"
                        value={input.options?.join(', ') || ''}
                        onChangeText={(text) => {
                          const options = text.split(',').map(o => o.trim()).filter(o => o.length > 0);
                          updateNewSubsectionInput(idx, 'options', options);
                        }}
                      />
                    </ThemedView>
                  )}

                  <TouchableOpacity
                    style={styles.cameraSmallButton}
                    onPress={() => removeNewSubsectionInput(idx)}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={[styles.cameraSmallButtonText, { color: '#FF3B30' }]}>Eliminar input</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ))}

              <TouchableOpacity
                style={styles.cameraSmallButton}
                onPress={() => openInputTypeModal({ mode: 'new-subsection' })}
              >
                <Ionicons name="add" size={16} color="#007AFF" />
                <ThemedText style={styles.cameraSmallButtonText}>Agregar input</ThemedText>
              </TouchableOpacity>
            </ScrollView>

            <ThemedView style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={saveNewSubsection}>
                <ThemedText style={styles.modalPrimaryBtnText}>Guardar subsección</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: '#6c757d' }]} onPress={closeAddSubsectionModal}>
                <ThemedText style={styles.modalPrimaryBtnText}>Cancelar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <Modal
        transparent
        visible={isInputTypeModalVisible}
        animationType="fade"
        onRequestClose={closeInputTypeModal}
      >
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={[styles.modalCard, { maxWidth: 420 }]}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Tipo de input</ThemedText>
              <TouchableOpacity onPress={closeInputTypeModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </ThemedView>
            <ThemedView style={styles.inputTypeModalBody}>
              <ThemedText style={styles.inputTypeModalHint}>Selecciona el tipo de campo a agregar</ThemedText>
              {EVALUATION_INPUT_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={styles.inputTypeOptionBtn}
                  onPress={() => handleSelectInputType(opt.type)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={opt.icon} size={20} color="#007AFF" />
                  <ThemedText style={styles.inputTypeOptionText}>{opt.label}</ThemedText>
                  <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: '#6c757d', marginTop: 8 }]}
                onPress={closeInputTypeModal}
              >
                <ThemedText style={styles.modalPrimaryBtnText}>Cancelar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <Modal
        visible={isSavingFormDraft || isRestoringFormDraft || isResettingFormDraft}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.draftLoadingOverlay}>
          <ThemedView style={styles.draftLoadingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.draftLoadingText}>
              {isSavingFormDraft
                ? 'Guardando borrador…'
                : isRestoringFormDraft
                  ? 'Restaurando borrador…'
                  : 'Reestableciendo formulario…'}
            </ThemedText>
            <ThemedText style={styles.draftLoadingSubtext}>
              {isSavingFormDraft
                ? 'Se están guardando los datos, evaluación, anotaciones e imágenes locales.'
                : isRestoringFormDraft
                  ? 'Cargando jerarquía, checks, artículos y archivos del borrador.'
                  : 'Eliminando borrador y archivos locales asociados.'}
            </ThemedText>
          </ThemedView>
        </View>
      </Modal>

      <EmployeeSearchModal
        visible={isEmployeeSearchVisible}
        structure={structure}
        onClose={() => setIsEmployeeSearchVisible(false)}
        onSelect={(hit) => {
          const emp = empleadoFromSearchHit(hit, structure);
          setSelectedEmpleado(emp);
          void applyEmpleadoDocumentosToForm(emp.id);
        }}
      />

      <PlanillasPasswordRevalidationModal
        visible={showPlanillasRevalidationModal}
        refreshAccessToken={refreshAccessToken}
        logout={logout}
        onSuccess={handlePlanillasRevalidationSuccess}
        onDismiss={handlePlanillasRevalidationDismiss}
      />

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="ChecklistSupervision"
      />
      {QRScannerComponent}
    </ThemedView>
  );
}

// Estilos (alineados con StaffEvaluationsScreen: header y fondo)
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  contentContainer: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  errorText: { color: '#FF3B30', fontSize: 14, marginBottom: 12 },
  filtersMain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleText: { fontSize: 16, fontWeight: '700', color: '#007AFF' },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetFiltersText: { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
  filterContent: { padding: 12 },
  filterGroupSearch: { marginBottom: 12 },
  filterGroup: { marginBottom: 12 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  filterHintMuted: { fontSize: 12, color: '#666', marginTop: 8, lineHeight: 18 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: { height: 50 },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  draftBannerBox: {
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#FFD699',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  draftBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 10,
  },
  draftBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8A5500',
    marginBottom: 4,
  },
  draftBannerText: {
    fontSize: 13,
    color: '#664400',
    lineHeight: 18,
  },
  draftContinueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  draftContinueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  draftStatusBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  draftStatusInfo: {
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#B8DAF8',
  },
  draftStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    lineHeight: 18,
  },
  draftActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  draftActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
    minWidth: '30%',
    flexGrow: 1,
  },
  draftActionButtonText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
  },
  draftActionReset: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  draftActionResetText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '700',
  },
  draftLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  draftLoadingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  draftLoadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  draftLoadingSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  reportIncidentBox: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFB84D',
    backgroundColor: '#FFF8EE',
  },
  reportIncidentHint: {
    fontSize: 13,
    color: '#664400',
    lineHeight: 18,
    marginBottom: 10,
  },
  reportIncidentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  reportIncidentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hierarchyHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#B8DAF8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  hierarchyHintBoxColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  hierarchyHintTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    backgroundColor: '#E8F4FF',
  },
  hierarchyHintTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
    backgroundColor: '#E8F4FF',
  },
  hierarchyHintGoButton: {
    width: '100%',
    marginTop: 10,
    marginBottom: 0,
  },
  hierarchyHintText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
    backgroundColor: '#E8F4FF',
  },
  hierarchyHintClose: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  hierarchyHintCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  /** Misma apariencia que el acceso a Entrega de puestos en ActivitiesScreen */
  goEntregaButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F9FF',
    marginTop: 10,
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  goEntregaButtonText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  hierarchyHintActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
    justifyContent: 'flex-end',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  formTitle: { fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    marginBottom: 12,
  },
  inputReadOnly: { backgroundColor: '#F0F0F0' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  dateButtonText: { fontSize: 15, color: '#000' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginTop: 16, marginBottom: 12 },
  infoSection: {
    marginTop: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  signatureButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  signatureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  signatureButtonDisabled: { opacity: 0.5 },
  signatureButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  signatureHintMuted: { fontSize: 13, color: '#999', fontStyle: 'italic', marginTop: 8 },
  firmaInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  firmaInfoTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  firmaInfoValue: { fontSize: 12, color: '#666', marginBottom: 2 },
  firmaClearButtonTiny: {
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  formActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  formActionCancel: {
    backgroundColor: '#EDEDED',
  },
  formActionSave: {
    backgroundColor: '#34C759',
  },
  formActionCancelText: { color: '#000', fontSize: 14, fontWeight: '700' },
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
  formActionSaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  listContainer: { gap: 12 },
  bitacoraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  bitTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  bitLine: { marginBottom: 4 },
  bitLabel: { fontSize: 14, fontWeight: '600', color: '#666' },
  bitValue: { fontSize: 14, color: '#000' },
  listItemButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  listItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6' },
  deleteButton: { backgroundColor: '#FF3B30' },
  listItemButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  listSignaturesStack: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  listSignatureBlock: {
    width: '100%',
  },
  listSignatureImage: {
    height: 72,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  listSignatureLink: {
    marginTop: 6,
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  listAddSupervisorSigButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  listAddSupervisorSigButtonText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
  listFirmaResponsableBox: {
    marginTop: 6,
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  listFirmaMeta: { fontSize: 12, color: '#333', marginBottom: 2 },
  listFirmaPending: { marginTop: 6, fontSize: 14, color: '#999' },
  floatListSignatureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  signaturePadBoxListFloat: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescriptionContainer: { marginBottom: 8 },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666' },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
  // Estilos para componente collapsable (como StaffEvaluationsScreen)
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
  collapseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  sectionCardList: {
    marginBottom: 10,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  questionRow: {
    marginTop: 4,
    paddingVertical: 4,
  },
  questionImagePreviewList: {
    marginTop: 4,
    width: '100%',
    borderRadius: 6,
  },
  questionImagePreviewListHorizontal: {
    height: 160,
  },
  questionImagePreviewListVertical: {
    height: 260,
  },
  evalLine: {
    marginBottom: 4,
  },
  evalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  evalValue: {
    fontSize: 14,
    color: '#000',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  inputCard: {
    marginBottom: 8,
    position: 'relative',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkboxUnchecked: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#000',
    marginLeft: 12,
    flex: 1,
  },
  questionTitleList: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#000000',
  },
  cameraSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 6,
    backgroundColor: '#F5F5F5',
  },
  cameraSmallButtonText: {
    fontSize: 12,
    color: '#000000',
  },
  deleteInputButtonSmall: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  questionImagePreview: {
    marginTop: 8,
    width: '100%',
    borderRadius: 6,
  },
  questionImagePreviewHorizontal: {
    height: 160,
  },
  questionImagePreviewVertical: {
    height: 260,
  },
  textAreaInput: {
    minHeight: 72,
    marginTop: 4,
    marginBottom: 8,
  },
  selectedEmpleadoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F9F9F9',
    marginBottom: 6,
  },
  selectedEmpleadoName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  selectedEmpleadoMeta: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  photoGridForm: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  photoGridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  photoThumbWrap: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  photoThumb: {
    width: 120,
    borderRadius: 8,
  },
  photoThumbHorizontal: {
    height: 90,
  },
  photoThumbVertical: {
    height: 150,
  },
  photoThumbMissing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    gap: 4,
    padding: 8,
  },
  photoThumbMissingText: {
    fontSize: 11,
    color: '#999',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  signaturePreviewContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
  },
  signaturePreview: { width: '100%', height: '100%' },
  removeSignatureButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSignatureButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    gap: 10,
  },
  openSignatureButtonText: { fontWeight: '800', color: '#000' },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  signatureModalHint: { paddingHorizontal: 16, paddingTop: 12, color: '#666', fontSize: 13 },
  signaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EDEDED',
    gap: 8,
  },
  modalClearButtonText: { fontWeight: '800', color: '#000' },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D7F5E5',
    gap: 8,
  },
  modalAcceptButtonText: { fontWeight: '800', color: '#000' },
  // Estilos de cámara (siguiendo patrón de VehiclesScreen)
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cameraCaptureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraCaptureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  // Estilos para modal de agregar subsección (bootstrap style)
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 820, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  modalCloseBtn: { padding: 6, borderRadius: 18, backgroundColor: '#F2F2F2' },
  modalBody: { maxHeight: 520 },
  modalBodyContent: { padding: 14, paddingBottom: 18 },
  modalFooter: { padding: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: '#FAFAFA', gap: 8 },
  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12 },
  modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  inputTypeModalBody: {
    padding: 16,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  inputTypeModalHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  inputTypeOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8FBFF',
  },
  inputTypeOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  modalFormCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 14 },
  // Estilos de tabla (replicados de EntregaPuestosScreen)
  tableWrapper: {
    flexDirection: 'row',
    marginTop: 10,
  },
  tableFixedColumn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRightWidth: 0,
  },
  tableHeaderFixed: {
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 50,
  },
  tableRowFixed: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 70,
  },
  tableScrollView: {
    flex: 1,
  },
  tableScrollContent: {
    paddingRight: 16,
  },
  tableScrollableContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderLeftWidth: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 50,
  },
  tableHeaderCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 150,
    justifyContent: 'center',
    height: 50,
  },
  tableHeaderCellFirst: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 100,
    justifyContent: 'center',
    height: 50,
  },
  tableHeaderText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 70,
  },
  tableCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 150,
    justifyContent: 'center',
    height: 70,
  },
  tableHeaderCellArchivos: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 80,
    justifyContent: 'center',
    height: 50,
  },
  tableCellArchivos: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    height: 70,
  },
  archivosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  archivosBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
  tableCellFirst: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 100,
    justifyContent: 'center',
    height: 70,
  },
  tableCellFirstText: {
    color: '#000',
    fontSize: 10,
    textAlign: 'center',
    flexShrink: 1,
  },
  tableCellText: {
    color: '#000',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  pickerContainerTable: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  pickerTable: {
    height: 50,
    color: '#000',
  },
  pickerItemStyle: {
    color: '#000',
    fontSize: 13,
  },
  inputTable: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    minHeight: 35,
    textAlign: 'center',
  },
  textAreaTable: {
    minHeight: 50,
    textAlignVertical: 'top',
    textAlign: 'left',
  },
});

