import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  View,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import DateTimePicker from "@react-native-community/datetimepicker";
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
import SignatureScreen from "react-native-signature-canvas";
import getHoraAccion from '@/hooks/getHoraAccion';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import { useQRScanner } from '@/hooks/useQRScanner';
import * as Network from 'expo-network';
import { createSurvey as createSurveyAPI, updateSurveySignature, updateSurvey as updateSurveyAPI, deleteSurvey as deleteSurveyAPI } from '@/hooks/surveysFunctions';
import { eventBus } from '@/hooks/eventBus';
import authedFetch from '@/hooks/authedFetch';
import {
  filterSurveysCacheByPuesto,
  filterSurveysCacheByCorpo,
  mergeSurveysCacheForPuesto,
  mergeSurveysCacheForCorpo,
  upsertSurveyCacheRowForPuesto,
} from '@/hooks/satisfactionSurveysCacheHelpers';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';

type SatisfactionSurveysScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SatisfactionSurveys'>;

interface Puesto {
  id: number;
  nombre: string;
}

interface Survey {
  id: number;
  id_local: string;
  persona_evaluada: string;
  empresa_evaluada: string;
  cedula_persona_evaluada: string;
  telefono_persona_evaluada: string;
  email_persona_evaluada: string;
  firma_persona_evaluada: string;
  empresa: {
    id: number;
    nombre: string;
  };
  /** Presente en la respuesta del API aunque no siempre tipado en cliente antiguo */
  cliente?: {
    id: number;
    nombre: string;
  };
  sucursal: {
    id: number;
    nombre: string;
  };
  puesto: {
    id: number;
    nombre: string;
  };
  division: {
    id: number;
    nombre: string;
  };
  responsable_id: number;
  responsable: {
    nombre: string;
    cedula: string;
  };
  firma_responsable: string;
  nombre_firma: string;
  fecha: string;
  evaluaciones: string; // JSON: objeto { form, know_process } o legado [{ question, value }]
  observations: string;
  contrato_id?: number;
}

/** Quita updates pendientes del mismo id de servidor (un solo update encolado). */
function stripQueuedSurveyUpdatesForServerId(actions: any[], surveyId: number): any[] {
  const sid = Number(surveyId);
  if (!Number.isFinite(sid)) return actions;
  return actions.filter(
    (a: any) =>
      !(
        (a?.type === 'update' && Number(a?.surveyId) === sid) ||
        (a?.type === 'patchFirmaPersona' && Number(a?.surveyId) === sid)
      )
  );
}

/** Limpia update/delete pendientes del mismo id antes de encolar delete offline. */
function stripQueuedSurveyUpdatesAndDeletesForServerId(actions: any[], surveyId: number): any[] {
  const sid = Number(surveyId);
  if (!Number.isFinite(sid)) return actions;
  return actions.filter(
    (a: any) =>
      !(
        (a?.type === 'update' && Number(a?.surveyId) === sid) ||
        (a?.type === 'delete' && Number(a?.surveyId) === sid) ||
        (a?.type === 'patchFirmaPersona' && Number(a?.surveyId) === sid)
      )
  );
}

/** Quitar solo `update` erróneos que apunten al id_local del borrador (no toca el pending `create`). */
function stripErroneousSurveyUpdatesForDraftId(actions: any[], idLocal: string): any[] {
  if (!idLocal) return actions;
  const k = String(idLocal);
  return actions.filter(
    (a: any) => !(a?.type === 'update' && a.surveyId != null && String(a.surveyId) === k)
  );
}

/** Borrador local eliminado: quita `create` y updates erróneos asociados. */
function stripQueuedSurveyDraftActions(actions: any[], idLocal: string): any[] {
  if (!idLocal) return actions;
  const k = String(idLocal);
  return actions.filter(
    (a: any) =>
      !(
        (a?.type === 'create' && String(a?.id) === k) ||
        (a?.type === 'update' && a.surveyId != null && String(a.surveyId) === k)
      )
  );
}

/** Actualiza `firma_persona_evaluada` en `surveys_cache` (id servidor o borrador `id_local`). */
async function persistFirmaPersonaInSurveyCache(survey: Survey, sig: string): Promise<void> {
  const cacheStr = await AsyncStorage.getItem('surveys_cache');
  if (!cacheStr) return;
  const cache = JSON.parse(cacheStr);
  if (!Array.isArray(cache)) return;
  const next = cache.map((s: Survey) => {
    if (Number(survey.id) > 0 && s.id === survey.id) {
      return { ...s, firma_persona_evaluada: sig };
    }
    if (Number(survey.id) <= 0 && survey.id_local && s.id_local === survey.id_local) {
      return { ...s, firma_persona_evaluada: sig };
    }
    return s;
  });
  await AsyncStorage.setItem('surveys_cache', JSON.stringify(next));
}

/**
 * Encola firma: borrador → merge en `create.requestData`;
 * con id servidor y sin `update` → `patchFirmaPersona`; con `update` → merge en `requestData`.
 */
async function persistFirmaPersonaInSurveyActionsQueue(survey: Survey, sig: string): Promise<void> {
  const actionsStr = await AsyncStorage.getItem('surveys_actions');
  let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
  if (!Array.isArray(actions)) actions = [];

  if (!Number(survey.id) || Number(survey.id) <= 0) {
    if (!survey.id_local) return;
    const idx = actions.findIndex(
      (a: any) => a.type === 'create' && String(a.id) === String(survey.id_local)
    );
    if (idx < 0) return;
    actions[idx] = {
      ...actions[idx],
      requestData: {
        ...actions[idx].requestData,
        firma_persona_evaluada: sig,
      },
    };
    await AsyncStorage.setItem('surveys_actions', JSON.stringify(actions));
    return;
  }

  const sid = Number(survey.id);
  const updIdx = actions.findIndex(
    (a: any) => a.type === 'update' && Number(a.surveyId) === sid
  );
  if (updIdx >= 0) {
    actions[updIdx] = {
      ...actions[updIdx],
      requestData: {
        ...actions[updIdx].requestData,
        firma_persona_evaluada: sig,
      },
    };
  } else {
    const withoutOldPatch = actions.filter(
      (a: any) => !(a.type === 'patchFirmaPersona' && Number(a.surveyId) === sid)
    );
    withoutOldPatch.push({ type: 'patchFirmaPersona', surveyId: sid, value: sig });
    actions = withoutOldPatch;
  }
  await AsyncStorage.setItem('surveys_actions', JSON.stringify(actions));
}

/** Fila legada en `evaluaciones` (JSON array) antes del formulario estructurado. */
interface SurveyFormQuestionRow {
  apply: boolean;
  question: string;
  value: number;
}

interface SurveyFormSectionRow {
  section_title: string;
  questions: SurveyFormQuestionRow[];
  observations: string;
}

interface SurveyEvaluationFormPayload {
  form: SurveyFormSectionRow[];
  know_process: boolean;
}

interface Answer {
  question: string;
  value: string | number;
}

function cloneEvaluationForm(src: SurveyEvaluationFormPayload): SurveyEvaluationFormPayload {
  return JSON.parse(JSON.stringify(src)) as SurveyEvaluationFormPayload;
}

function defaultQuestionRow(text: string): SurveyFormQuestionRow {
  return { apply: true, question: text, value: 5 };
}

function defaultSection(title: string, questionTexts: string[]): SurveyFormSectionRow {
  return {
    section_title: title,
    questions: questionTexts.map(defaultQuestionRow),
    observations: '',
  };
}

function createDefaultEvaluationFormAseo(): SurveyEvaluationFormPayload {
  return {
    form: [
      defaultSection('Califique la calidad del servicio en cuanto a los siguientes aspectos', [
        '¿Cómo es el trato del personal al público?',
        '¿El personal es respetuoso con los funcionarios?',
        'Domina el personal los lineamientos del puesto de trabajo',
        '¿El personal siempre lleva su uniforme completo y bien presentado?',
        '¿El equipo de trabajo diario se encuentra en optimas condiciones?',
        '¿El personal utiliza un vocabulario respetuoso durante su jornada laboral?',
      ]),
      defaultSection(
        '¿Cómo califica el servicio recibido por el personal (Marque solo para aquellos con los que tiene contacto)',
        ['Gerencia de Operaciones', 'Asistentes de Operaciones', 'Supervisores', 'Misceláneos'],
      ),
      defaultSection('¿Cómo califica la calidad del servicio de Aseo y Limpieza en cuanto a nuestro trabajo?', [
        '¿Cumple el servicio lo estipulado en el contrato?',
        '¿Los productos de limpieza utilizados en el servicio son de la calidad esperada?',
        '¿El plazo de entregas de productos de limpieza cumple con sus necesidades?',
        '¿Son atendidas sus quejas en el plazo acordado con la empresa?',
        '¿Considera que la empresa ha mejorado el servicio con respecto al año anterior?',
      ]),
      defaultSection('¿Cómo califica la comunicación con la empresa?', [
        '¿Cómo califica la comunicación entre la compañía y usted como cliente?',
        '¿Esa comunicación está generando los resultados esperados?',
      ]),
      defaultSection('APRECIACIONES GLOBALES', [
        '¿Cuál es su nivel de satisfacción global respecto al servicio que le brindamos?',
      ]),
    ],
    know_process: false,
  };
}

function createDefaultEvaluationFormSeguridad(): SurveyEvaluationFormPayload {
  return {
    form: [
      defaultSection('Califique la calidad del servicio en cuanto a los siguientes aspectos', [
        '¿Cómo es el trato del personal al público?',
        '¿El personal es respetuoso con los funcionarios?',
        'Domina el personal los lineamientos del puesto de trabajo',
        '¿El personal siempre lleva su uniforme completo y bien presentado?',
        '¿El equipo de trabajo diario se encuentra en optimas condiciones?',
        '¿El personal utiliza un vocabulario respetuoso durante su jornada laboral?',
      ]),
      defaultSection(
        '¿Cómo califica el servicio recibido por el personal (Marque solo para aquellos con los que tiene contacto)',
        ['Gerencia de Operaciones', 'Asistentes de Operaciones', 'Supervisores', 'Misceláneos'],
      ),
      defaultSection('¿Cómo califica la calidad del servicio de Seguridad en cuanto a nuestro trabajo?', [
        '¿Cumple el servicio lo estipulado en el contrato?',
        '¿Son atendidas sus quejas en el plazo acordado con la empresa?',
        '¿Considera que la empresa ha mejorado el servicio con respecto al año anterior?',
      ]),
      defaultSection('¿Cómo califica la comunicación con la empresa?', [
        '¿Cómo califica la comunicación entre la compañía y usted como cliente?',
        '¿Esa comunicación está generando los resultados esperados?',
      ]),
      defaultSection('APRECIACIONES GLOBALES', [
        '¿Cuál es su nivel de satisfacción global respecto al servicio que le brindamos?',
      ]),
    ],
    know_process: false,
  };
}

function getDefaultEvaluationFormForDivision(division: string): SurveyEvaluationFormPayload | null {
  if (division === 'Seguridad') return createDefaultEvaluationFormSeguridad();
  if (division === 'Aseo & Limpieza') return createDefaultEvaluationFormAseo();
  return null;
}

function normalizeEvaluationFormPayload(raw: unknown): SurveyEvaluationFormPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.form)) return null;
  const know_process = typeof o.know_process === 'boolean' ? o.know_process : false;
  const form: SurveyFormSectionRow[] = [];
  for (const sec of o.form as any[]) {
    if (!sec || typeof sec !== 'object') continue;
    const section_title = String((sec as any).section_title ?? '').trim() || 'Sección';
    const observations = String((sec as any).observations ?? '');
    const questions: SurveyFormQuestionRow[] = [];
    const qArr = Array.isArray((sec as any).questions) ? (sec as any).questions : [];
    for (const q of qArr) {
      if (!q || typeof q !== 'object') continue;
      const applyRaw = (q as any).apply;
      const apply = applyRaw === undefined || applyRaw === null ? true : Boolean(applyRaw);
      const question = String((q as any).question ?? '').trim() || 'Pregunta';
      let value = Number((q as any).value);
      if (!Number.isFinite(value)) value = apply ? 5 : 0;
      if (value < 0) value = 0;
      if (value > 5) value = 5;
      if (!apply) value = 0;
      else if (value < 1) value = 1;
      questions.push({ apply, question, value });
    }
    form.push({ section_title, questions, observations });
  }
  if (!form.length) return null;
  return { form, know_process };
}

/** Migra formato antiguo `[{ question, value }]` al nuevo payload según plantilla de división. */
function migrateLegacyEvaluacionesToForm(
  legacy: Answer[],
  division: string,
): SurveyEvaluationFormPayload {
  const base = getDefaultEvaluationFormForDivision(division) || createDefaultEvaluationFormSeguridad();
  const next = cloneEvaluationForm(base);
  const flat: SurveyFormQuestionRow[] = [];
  next.form.forEach((s) => s.questions.forEach((q) => flat.push(q)));
  legacy.forEach((row, i) => {
    if (i >= flat.length) return;
    const v = row.value;
    const num = typeof v === 'number' ? v : parseInt(String(v), 10);
    flat[i].apply = true;
    if (Number.isFinite(num) && num >= 1 && num <= 5) flat[i].value = num;
    else flat[i].value = 5;
    const qt = String(row.question || '').trim();
    if (qt) flat[i].question = qt;
  });
  return next;
}

function parseEvaluacionesStored(jsonStr: string | undefined | null, divisionFallback: string): SurveyEvaluationFormPayload {
  const empty = getDefaultEvaluationFormForDivision(divisionFallback) || createDefaultEvaluationFormSeguridad();
  if (!jsonStr || !String(jsonStr).trim()) return cloneEvaluationForm(empty);
  try {
    const parsed = JSON.parse(jsonStr);
    const asObj = normalizeEvaluationFormPayload(parsed);
    if (asObj) return asObj;
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === 'object' && 'question' in parsed[0]) {
      return migrateLegacyEvaluacionesToForm(parsed as Answer[], divisionFallback);
    }
  } catch {
    /* ignore */
  }
  return cloneEvaluationForm(empty);
}

function sanitizeEvaluationForPersist(form: SurveyEvaluationFormPayload): SurveyEvaluationFormPayload {
  const next = cloneEvaluationForm(form);
  next.form.forEach((sec) => {
    sec.questions.forEach((q) => {
      if (!q.apply) q.value = 0;
      else if (q.value < 1 || q.value > 5) q.value = 5;
    });
  });
  if (typeof next.know_process !== 'boolean') next.know_process = false;
  return next;
}

function tryParseEvaluacionesForDisplay(
  jsonStr: string | undefined | null,
): { kind: 'new'; payload: SurveyEvaluationFormPayload } | { kind: 'legacy'; rows: Answer[] } | { kind: 'empty' } {
  if (!jsonStr || !String(jsonStr).trim()) return { kind: 'empty' };
  try {
    const parsed = JSON.parse(jsonStr);
    const obj = normalizeEvaluationFormPayload(parsed);
    if (obj) return { kind: 'new', payload: obj };
    if (Array.isArray(parsed) && parsed.length > 0) {
      const ok = parsed.every((x: any) => x && typeof x === 'object' && 'question' in x);
      if (ok) return { kind: 'legacy', rows: parsed as Answer[] };
    }
  } catch {
    /* ignore */
  }
  return { kind: 'empty' };
}

interface FirmaData {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
  empleadoDetalle?: {
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
  };
}

/** Normaliza `firma_responsable` (trim, sin espacios internos, quita prefijo data URL si viene). */
function normalizeFirmaResponsableInput(value: unknown): string {
  if (value == null) return '';
  let s = String(value).trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  const b64 = lower.indexOf('base64,');
  if (b64 !== -1 && lower.startsWith('data:')) {
    s = s.slice(b64 + 7).trim();
  }
  return s.replace(/\s/g, '');
}

/** Parseo solo para mostrar datos de firma (sin red); si `decodeFirmaFromStoredValue` no devuelve nada. */
function tryParseFirmaResponsableSync(normalized: string): FirmaData | null {
  if (!normalized) return null;
  let inner = normalized;
  try {
    inner = atob(normalized);
  } catch {
    inner = normalized;
  }
  const parts = inner.split(':');
  if (parts.length !== 5) return null;
  return {
    sessionId: parts[0],
    empleadoId: parts[1],
    latitud: parts[2],
    longitud: parts[3],
    timestamp: parts[4],
  };
}

const formatSurveySignatureForDisplay = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
};

function safeFirmaTimestampLabelSurvey(raw: string | undefined): string {
  if (raw == null || raw === '') return 'N/A';
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return 'N/A';
  let ms = n;
  if (n > 0 && n < 1e12) ms = n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'N/A';
  try {
    return convertDateTimestampToLocalString(d.toISOString()) || 'N/A';
  } catch {
    return 'N/A';
  }
}

function decodeFirmaHashSurvey(hash: string): Pick<
  FirmaData,
  'sessionId' | 'empleadoId' | 'latitud' | 'longitud' | 'timestamp'
> | null {
  try {
    if (!hash || String(hash).trim().length === 0) return null;
    const decoded = atob(String(hash));
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;
    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
    return { sessionId, empleadoId, latitud, longitud, timestamp };
  } catch {
    return null;
  }
}

type FormHierarchyIds = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
  puestoId: number;
};

type MainStructureTree = any[];

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
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

function getClienteDivisionArray(cliente: any): any[] {
  if (!cliente) return [];
  if (Array.isArray(cliente.division)) return cliente.division;
  if (Array.isArray(cliente.divisiones)) return cliente.divisiones;
  return [];
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
  const divisions = getClienteDivisionArray(cliente);
  for (const div of divisions) {
    const contratos: any[] = Array.isArray(div?.contratos) ? div.contratos : [];
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
  const divisions = getClienteDivisionArray(cliente);
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

function findHierarchyByPuestoIn(structureArr: any[], puestoId: number): FormHierarchyIds | null {
  for (const empresa of structureArr || []) {
    for (const cliente of empresa.clientes || []) {
      for (const division of getClienteDivisionArray(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            for (const puesto of sucursal.puestos || []) {
              if (Number(puesto?.id) === Number(puestoId)) {
                return {
                  empresaId: empresa.id,
                  clienteId: cliente.id,
                  divisionId: division.id,
                  contratoId: contrato.id,
                  corpoId: sucursal.id,
                  puestoId: puesto.id,
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

function findContratoForSucursalIn(structureArr: any[], sucursalId: number): number | null {
  for (const empresa of structureArr || []) {
    for (const cliente of empresa.clientes || []) {
      for (const division of getClienteDivisionArray(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === Number(sucursalId)) {
              return contrato.id;
            }
          }
        }
      }
    }
  }
  return null;
}

/** Si el árbol por puesto_id falla, acota por empresa/división/sucursal/puesto que vienen en la encuesta. */
function findHierarchyFromSurveySnapshot(structureArr: any[], survey: Survey): FormHierarchyIds | null {
  const wantEmp = survey.empresa?.id;
  const wantDiv = survey.division?.id;
  const wantCorpo = survey.sucursal?.id;
  const wantPuesto = survey.puesto?.id;
  const wantCliente = survey.cliente?.id;
  if (!wantPuesto || !Array.isArray(structureArr) || structureArr.length === 0) {
    return null;
  }
  for (const empresa of structureArr) {
    if (wantEmp != null && Number(empresa.id) !== Number(wantEmp)) continue;
    for (const cliente of empresa.clientes || []) {
      if (wantCliente != null && Number(cliente.id) !== Number(wantCliente)) continue;
      for (const division of getClienteDivisionArray(cliente)) {
        if (wantDiv != null && Number(division.id) !== Number(wantDiv)) continue;
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (wantCorpo != null && Number(sucursal.id) !== Number(wantCorpo)) continue;
            for (const puesto of sucursal.puestos || []) {
              if (Number(puesto?.id) === Number(wantPuesto)) {
                return {
                  empresaId: empresa.id,
                  clienteId: cliente.id,
                  divisionId: division.id,
                  contratoId: contrato.id,
                  corpoId: sucursal.id,
                  puestoId: puesto.id,
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

function mapTreePuestosToPicker(raw: any[]): Puesto[] {
  return (raw || []).map((p: any) => ({
    id: Number(p.id),
    nombre:
      p.nombre != null && String(p.nombre).trim() !== ''
        ? String(p.nombre)
        : p.codigo != null
          ? String(p.codigo)
          : `Puesto ${p.id}`,
  }));
}

function resolveHierarchyNamesFromStructure(
  structureArr: any[],
  ids: {
    empresaId: number;
    clienteId: number;
    divisionId: number;
    contratoId: number | null;
    corpoId: number;
    puestoId: number;
  },
  puestosList: Puesto[]
): {
  empresa: { id: number; nombre: string };
  cliente: { id: number; nombre: string };
  division: { id: number; nombre: string };
  sucursal: { id: number; nombre: string };
  puesto: { id: number; nombre: string };
} {
  const e = structureArr.find((x: any) => Number(x.id) === Number(ids.empresaId));
  const c = e?.clientes?.find((x: any) => Number(x.id) === Number(ids.clienteId));
  const d = getClienteDivisionArray(c).find((x: any) => Number(x.id) === Number(ids.divisionId));
  const ct = ids.contratoId != null ? d?.contratos?.find((x: any) => Number(x.id) === Number(ids.contratoId)) : null;
  const s = ct?.sucursales?.find((x: any) => Number(x.id) === Number(ids.corpoId)) ?? null;
  let puestoNombre = '';
  const fromList = puestosList.find((x) => x.id === ids.puestoId);
  if (fromList) puestoNombre = fromList.nombre;
  else if (s?.puestos) {
    const po = s.puestos.find((x: any) => Number(x.id) === Number(ids.puestoId));
    if (po) puestoNombre = String(po.nombre ?? '');
  }
  return {
    empresa: { id: ids.empresaId, nombre: e?.nombre != null ? String(e.nombre) : '' },
    cliente: { id: ids.clienteId, nombre: c?.nombre != null ? String(c.nombre) : '' },
    division: { id: ids.divisionId, nombre: d?.nombre != null ? String(d.nombre) : '' },
    sucursal: { id: ids.corpoId, nombre: s?.nombre != null ? String(s.nombre) : '' },
    puesto: { id: ids.puestoId, nombre: puestoNombre },
  };
}

export default function SatisfactionSurveysScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<SatisfactionSurveysScreenNavigationProp>();

  // Data state
  const [surveys, setSurveys] = useState<Survey[]>([]);
  /** Puestos por `corpo_id` (API/caché), para filtro y formulario sin pisarse. */
  const [puestosByCorpo, setPuestosByCorpo] = useState<Record<string, Puesto[]>>({});
  const puestosByCorpoRef = useRef<Record<string, Puesto[]>>({});
  const [isListLoading, setIsListLoading] = useState(false);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  const [isCheckingMarca, setIsCheckingMarca] = useState<boolean>(true);

  // Estados para filtros jerárquicos
  const structureRef = useRef<MainStructureTree>([]);
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);
  const filterPuestoIdRef = useRef<number | null>(null);
  const filterCorpoIdRef = useRef<number | null>(null);

  const surveyExpandKey = (s: Survey) => (s.id > 0 ? `i:${s.id}` : `l:${s.id_local || '0'}`);

  // IDs de current_marca para inicialización
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);

  // Estados para jerarquía seleccionada en el formulario
  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);
  const [formPuestoId, setFormPuestoId] = useState<number | null>(null);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  /** Valor normalizado de firma_responsable del registro en edición (para UI y guardado sin regenerar). */
  const [editingResponsableFirmaStored, setEditingResponsableFirmaStored] = useState<string | null>(null);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [deletingSurveyKey, setDeletingSurveyKey] = useState<string | null>(null);

  // Form refs
  const empresaEvaluadaRef = useRef<string>('');
  const personaNombreRef = useRef<string>('');
  const personaCedulaRef = useRef<string>('');
  const personaTelefonoRef = useRef<string>('');
  const personaEmailRef = useRef<string>('');
  const puestoIdRef = useRef<number>(0);
  const fechaEncuestaRef = useRef<string>('');
  const divisionRef = useRef<string>('Seguridad');
  const observacionesRef = useRef<string>('');
  const responsableNombreRef = useRef<string>('');
  const responsableCedulaRef = useRef<string>('');

  // Controlled states
  const [selectedPuesto, setSelectedPuesto] = useState<number>(0);
  const [fechaEncuesta, setFechaEncuesta] = useState<Date>(new Date());
  const [showFechaEncuestaPicker, setShowFechaEncuestaPicker] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<string>('Seguridad');

  const [evaluationForm, setEvaluationForm] = useState<SurveyEvaluationFormPayload | null>(null);
  const evaluationFormRef = useRef<SurveyEvaluationFormPayload | null>(null);

  const patchEvaluationForm = useCallback((updater: (draft: SurveyEvaluationFormPayload) => void) => {
    const base = evaluationFormRef.current;
    if (!base) return;
    const draft = cloneEvaluationForm(base);
    updater(draft);
    evaluationFormRef.current = draft;
    setEvaluationForm(draft);
  }, []);

  const getEvaluationJsonForSave = useCallback((): string | null => {
    const raw = evaluationFormRef.current;
    if (!raw || !raw.form.length) return null;
    return JSON.stringify(sanitizeEvaluationForPersist(raw));
  }, []);

  const [addQuestionModalVisible, setAddQuestionModalVisible] = useState(false);
  const [addQuestionSectionIndex, setAddQuestionSectionIndex] = useState<number | null>(null);
  const [addQuestionDraft, setAddQuestionDraft] = useState('');

  const closeAddQuestionModal = useCallback(() => {
    setAddQuestionModalVisible(false);
    setAddQuestionSectionIndex(null);
    setAddQuestionDraft('');
  }, []);

  const openAddQuestionModal = useCallback((sectionIndex: number) => {
    setAddQuestionSectionIndex(sectionIndex);
    setAddQuestionDraft('');
    setAddQuestionModalVisible(true);
  }, []);

  const requestAddQuestionSubmit = useCallback(() => {
    const text = addQuestionDraft.trim();
    if (addQuestionSectionIndex == null) return;
    if (!text) {
      Alert.alert('Error', 'Escriba el texto de la pregunta.');
      return;
    }
    const sectionIdx = addQuestionSectionIndex;
    Alert.alert('Confirmar', '¿Está seguro de que desea agregar esta pregunta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sí',
        onPress: () => {
          patchEvaluationForm((d) => {
            if (sectionIdx != null && d.form[sectionIdx]) {
              d.form[sectionIdx].questions.push(defaultQuestionRow(text));
            }
          });
          closeAddQuestionModal();
        },
      },
    ]);
  }, [addQuestionDraft, addQuestionSectionIndex, patchEvaluationForm, closeAddQuestionModal]);

  // Signature states
  const [personSignature, setPersonSignature] = useState<string | null>(null);
  const personSignatureRef = useRef<string | null>(null);
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  /** En edición: firma_responsable tal como viene del servidor/cache (sin regenerar). */
  const editingFirmaResponsableOriginalRef = useRef<string | null>(null);
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [tempSignature, setTempSignature] = useState<string | null>(null);

  // Form key for forcing re-render
  const [formKey, setFormKey] = useState(0);

  // Collapsable states
  const [expandedSurveys, setExpandedSurveys] = useState<Set<string>>(new Set());
  const [decodedFirmas, setDecodedFirmas] = useState<Map<string, { responsable: FirmaData | null; persona: string | null }>>(new Map());

  // Filters state
  const [filterFecha, setFilterFecha] = useState('');
  const [filterPersonaEvaluada, setFilterPersonaEvaluada] = useState('');
  const [filterCedulaPersonaEvaluada, setFilterCedulaPersonaEvaluada] = useState('');
  const [filterTelefonoPersonaEvaluada, setFilterTelefonoPersonaEvaluada] = useState('');
  const [filterEmailPersonaEvaluada, setFilterEmailPersonaEvaluada] = useState('');
  const [filterResponsableNombre, setFilterResponsableNombre] = useState('');
  const [filterResponsableCedula, setFilterResponsableCedula] = useState('');
  const [filterObservations, setFilterObservations] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  // Modal: añadir firma persona evaluada (en lista, cuando falta)
  const [addSignatureModalVisible, setAddSignatureModalVisible] = useState(false);
  const [addSignatureSurvey, setAddSignatureSurvey] = useState<Survey | null>(null);
  const addSignatureManualRef = useRef<any>(null);
  const [addSignatureManualKey, setAddSignatureManualKey] = useState(0);
  const [isAddSignatureSubmitting, setIsAddSignatureSubmitting] = useState(false);

  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState('Cambios');
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

  // Input refs
  const empresaEvaluadaInputRef = useRef<TextInput>(null);
  const personaNombreInputRef = useRef<TextInput>(null);
  const personaCedulaInputRef = useRef<TextInput>(null);
  const personaTelefonoInputRef = useRef<TextInput>(null);
  const personaEmailInputRef = useRef<TextInput>(null);
  const observacionesInputRef = useRef<TextInput>(null);
  const responsableNombreInputRef = useRef<TextInput>(null);
  const responsableCedulaInputRef = useRef<TextInput>(null);


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

  const fetchCambios = useCallback(
    async (tabla: string, registroId: number) => {
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
            headers: { 'Content-Type': 'application/json' },
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
    },
    [refreshAccessToken, logout]
  );

  const syncMarcaFromStorage = useCallback(async (opts?: { applyFiltersFromMarca?: boolean }) => {
    const applyFiltersFromMarca = opts?.applyFiltersFromMarca !== false;
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setMarcaEmpresaId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      if (applyFiltersFromMarca) {
        setFilterEmpresaId(null);
        setFilterClienteId(null);
        setFilterDivisionId(null);
        setFilterContratoId(null);
        setFilterCorpoId(null);
        filterCorpoIdRef.current = null;
        setFilterPuestoId(null);
        filterPuestoIdRef.current = null;
      }
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current?.id) {
        setHasCurrentMarca(false);
        setMarcaClienteId(null);
        setMarcaCorpoId(null);
        setMarcaPuestoId(null);
        setMarcaEmpresaId(null);
        setMarcaDivisionId(null);
        setMarcaContratoId(null);
        return current;
      }
      setHasCurrentMarca(true);

      const empresaId = numOrNull(current?.empresa?.id ?? current?.empresa_id);
      const clienteId = numOrNull(current?.cliente?.id ?? current?.cliente_id);
      const corpoId = numOrNull(current?.corpo?.id ?? current?.corpo_id);
      const puestoId = numOrNull(current?.puesto?.id ?? current?.puesto_id);
      const divisionId = getDivisionIdFromMarcaJson(current);
      const contratoId = numOrNull(current?.contrato?.id ?? current?.contrato_id);

      setMarcaEmpresaId(empresaId);
      setMarcaClienteId(clienteId);
      setMarcaCorpoId(corpoId);
      setMarcaPuestoId(puestoId);
      setMarcaDivisionId(divisionId);
      setMarcaContratoId(contratoId);

      if (applyFiltersFromMarca) {
        setFilterEmpresaId(empresaId);
        setFilterClienteId(clienteId);
        setFilterDivisionId(divisionId);
        setFilterContratoId(contratoId);
        setFilterCorpoId(corpoId);
        filterCorpoIdRef.current = corpoId;
        setFilterPuestoId(puestoId);
        filterPuestoIdRef.current = puestoId;
      }

      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setMarcaEmpresaId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      return null;
    }
  }, []);

  const applyFormHierarchySideEffects = useCallback(
    (v: HierarchyPickerValues, prevClienteId: number | null, prevDivisionId: number | null) => {
      if (v.clienteId !== prevClienteId) {
        if (v.clienteId && v.empresaId) {
          const empresa = structure.find((e: any) => Number(e.id) === Number(v.empresaId));
          const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(v.clienteId));
          if (cliente) {
            empresaEvaluadaRef.current = cliente.nombre;
            empresaEvaluadaInputRef.current?.setNativeProps({ text: cliente.nombre });
          }
        } else {
          empresaEvaluadaRef.current = '';
          empresaEvaluadaInputRef.current?.setNativeProps({ text: '' });
        }
      }

      if (v.divisionId !== prevDivisionId) {
        if (v.divisionId && v.empresaId && v.clienteId) {
          const empresa = structure.find((e: any) => Number(e.id) === Number(v.empresaId));
          const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(v.clienteId));
          const division = getClienteDivisionArray(cliente).find((d: any) => Number(d.id) === Number(v.divisionId));
          if (division) {
            const divisionName = division.nombre;
            if (divisionName === 'Seguridad' || divisionName.toLowerCase().includes('seguridad')) {
              setSelectedDivision('Seguridad');
              divisionRef.current = 'Seguridad';
            } else if (
              divisionName === 'Aseo & Limpieza' ||
              divisionName === 'Aseo y limpieza' ||
              divisionName.toLowerCase().includes('aseo') ||
              divisionName.toLowerCase().includes('limpieza')
            ) {
              setSelectedDivision('Aseo & Limpieza');
              divisionRef.current = 'Aseo & Limpieza';
            } else {
              setSelectedDivision('');
              divisionRef.current = '';
            }
            const tmpl = getDefaultEvaluationFormForDivision(divisionRef.current);
            if (tmpl) {
              const cloned = cloneEvaluationForm(tmpl);
              evaluationFormRef.current = cloned;
              setEvaluationForm(cloned);
            } else {
              evaluationFormRef.current = null;
              setEvaluationForm(null);
            }
            setFormKey((prev) => prev + 1);
          }
        } else {
          setSelectedDivision('Seguridad');
          divisionRef.current = 'Seguridad';
          const tmplElse = getDefaultEvaluationFormForDivision('Seguridad');
          if (tmplElse) {
            const c2 = cloneEvaluationForm(tmplElse);
            evaluationFormRef.current = c2;
            setEvaluationForm(c2);
          }
        }
      }

      const pid = v.puestoId != null && Number(v.puestoId) > 0 ? Number(v.puestoId) : 0;
      puestoIdRef.current = pid;
      setSelectedPuesto(pid);
    },
    [structure]
  );

  const handleFilterHierarchyChange = (v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    setFilterCorpoId(v.sucursalId);
    filterCorpoIdRef.current = v.sucursalId;
    setFilterPuestoId(null);
    filterPuestoIdRef.current = null;
    if (v.sucursalId == null) {
      setSurveys([]);
    }
  };

  const handleFormHierarchyChange = useCallback(
    (v: HierarchyPickerValues) => {
      const prevClienteId = formClienteId;
      const prevDivisionId = formDivisionId;
      setFormEmpresaId(v.empresaId);
      setFormClienteId(v.clienteId);
      setFormDivisionId(v.divisionId);
      setFormContratoId(v.contratoId);
      setFormCorpoId(v.sucursalId);
      setFormPuestoId(v.puestoId ?? null);
      applyFormHierarchySideEffects(v, prevClienteId, prevDivisionId);
    },
    [formClienteId, formDivisionId, applyFormHierarchySideEffects]
  );

  const loadMainStructureCache = useCallback(async (): Promise<MainStructureTree> => {
    if (structureRef.current.length > 0) {
      return structureRef.current;
    }
    setIsStructureLoading(true);
    try {
      const tree = await loadMainStructureTreeMerged();
      const arr = Array.isArray(tree) ? tree : [];
      structureRef.current = arr;
      setStructure(arr);
      return arr;
    } catch (e) {
      console.error('Error fetching main structure for satisfaction surveys:', e);
      structureRef.current = [];
      setStructure([]);
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  // Nodos computados para estructura jerárquica de filtros
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => Number(e.id) === Number(filterEmpresaId));
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    const cliente = filterClientes.find((c: any) => Number(c.id) === Number(filterClienteId));
    return getClienteDivisionArray(cliente);
  }, [filterClientes, filterClienteId]);

  const filterContratos = useMemo(() => {
    const division = filterDivisiones.find((d: any) => Number(d.id) === Number(filterDivisionId));
    return division?.contratos || [];
  }, [filterDivisiones, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    const contrato = filterContratos.find((c: any) => Number(c.id) === Number(filterContratoId));
    return contrato?.sucursales || [];
  }, [filterContratos, filterContratoId]);

  const filterPuestos = useMemo(() => {
    const sucursal = filterSucursales.find((s: any) => Number(s.id) === Number(filterCorpoId));
    return sucursal?.puestos || [];
  }, [filterSucursales, filterCorpoId]);

  /** Filtro: API/caché por sucursal si existen; si no, puestos embebidos en el árbol. */
  const filterPuestoOptions = useMemo((): Puesto[] => {
    if (filterCorpoId == null) return [];
    const key = String(filterCorpoId);
    if (Object.prototype.hasOwnProperty.call(puestosByCorpo, key)) {
      return puestosByCorpo[key]!;
    }
    return mapTreePuestosToPicker(filterPuestos);
  }, [filterCorpoId, puestosByCorpo, filterPuestos]);

  // Nodos computados para estructura jerárquica del formulario
  const formEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const formClientes = useMemo(() => {
    const empresa = formEmpresas.find((e: any) => Number(e.id) === Number(formEmpresaId));
    return empresa?.clientes || [];
  }, [formEmpresas, formEmpresaId]);

  const formDivisiones = useMemo(() => {
    const cliente = formClientes.find((c: any) => Number(c.id) === Number(formClienteId));
    return getClienteDivisionArray(cliente);
  }, [formClientes, formClienteId]);

  const formContratos = useMemo(() => {
    const division = formDivisiones.find((d: any) => Number(d.id) === Number(formDivisionId));
    return division?.contratos || [];
  }, [formDivisiones, formDivisionId]);

  const formSucursales = useMemo(() => {
    const contrato = formContratos.find((c: any) => Number(c.id) === Number(formContratoId));
    return contrato?.sucursales || [];
  }, [formContratos, formContratoId]);

  const formPuestosList = useMemo(() => {
    const sucursal = formSucursales.find((s: any) => Number(s.id) === Number(formCorpoId));
    return sucursal?.puestos || [];
  }, [formSucursales, formCorpoId]);

  /** Formulario: API/caché por sucursal o puestos del árbol. */
  const formPuestoOptions = useMemo((): Puesto[] => {
    if (formCorpoId == null) return [];
    const key = String(formCorpoId);
    if (Object.prototype.hasOwnProperty.call(puestosByCorpo, key)) {
      return puestosByCorpo[key]!;
    }
    return mapTreePuestosToPicker(formPuestosList);
  }, [formCorpoId, puestosByCorpo, formPuestosList]);

  useEffect(() => {
    puestosByCorpoRef.current = puestosByCorpo;
  }, [puestosByCorpo]);

  const generateRandomId = (): string => {
    return `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  };

  // Ref para evitar cargar puestos múltiples veces para el mismo corpo
  const lastLoadedCorpoIdRef = useRef<number | null>(null);

  const cacheKeyPuestos = (corpoId: number) => `surveys_puestos_cache_${corpoId}`;

  const fetchPuestosForCorpo = useCallback(
    async (corpoId: number, forceReload: boolean = false): Promise<Puesto[] | null> => {
      if (!Number.isFinite(corpoId) || corpoId <= 0) return null;
      const key = String(corpoId);
      if (
        !forceReload &&
        lastLoadedCorpoIdRef.current === corpoId &&
        Object.prototype.hasOwnProperty.call(puestosByCorpoRef.current, key)
      ) {
        return puestosByCorpoRef.current[key]!;
      }

      const applyPuestos = (list: Puesto[]) => {
        setPuestosByCorpo((prev) => ({ ...prev, [key]: list }));
        lastLoadedCorpoIdRef.current = corpoId;
        return list;
      };

      try {
        const isConnected = await getConnectionStatus();
        if (!isConnected) {
          const puestosCache = await AsyncStorage.getItem(cacheKeyPuestos(corpoId));
          if (puestosCache) {
            try {
              const parsed = JSON.parse(puestosCache);
              if (Array.isArray(parsed)) {
                return applyPuestos(mapTreePuestosToPicker(parsed));
              }
            } catch {
              /* ignore */
            }
          }
          return null;
        }

        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return null;
        const puestosResponse = await authedFetch({
          url: `${apiUrl}/api/puestos/corpo/${corpoId}`,
          init: { method: 'GET' },
          refreshAccessToken,
          logout,
        });
        if (!puestosResponse) return null;

        if (puestosResponse.ok) {
          const puestosData = await puestosResponse.json();
          if (puestosData?.status && Array.isArray(puestosData.puestos)) {
            const list = mapTreePuestosToPicker(puestosData.puestos);
            await AsyncStorage.setItem(cacheKeyPuestos(corpoId), JSON.stringify(puestosData.puestos));
            return applyPuestos(list);
          }
        }
      } catch (err) {
        console.error('Error fetching puestos for corpo:', err);
      }
      return null;
    },
    [refreshAccessToken, logout]
  );

  // Ref para controlar si ya se mostró el alert de modo offline
  const hasShownOfflineAlertRef = useRef(false);
  const surveysListInitialFocusRef = useRef(true);

  /** `puestoId` afinado, o toda la sucursal con `corpoId` (p. ej. filtro por sucursal / current_marca). */
  const fetchSurveysList = useCallback(
    async (
      scope: { puestoId: number | null; corpoId: number | null },
      showOfflineAlert: boolean = true
    ) => {
      const rawP = scope.puestoId;
      const rawC = scope.corpoId;
      const pid =
        rawP != null && Number.isFinite(Number(rawP)) && Number(rawP) > 0 ? Number(rawP) : null;
      const cid =
        rawC != null && Number.isFinite(Number(rawC)) && Number(rawC) > 0 ? Number(rawC) : null;

      if (pid == null && cid == null) {
        setSurveys([]);
        setIsListLoading(false);
        return;
      }

      const parseSurveysCache = async (): Promise<any[]> => {
        const surveysCache = await AsyncStorage.getItem('surveys_cache');
        if (!surveysCache) return [];
        try {
          const parsed = JSON.parse(surveysCache);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      const mapRow = (s: Survey) => ({ ...s, id_local: s.id_local || '' });

      try {
        setIsListLoading(true);

        const isConnected = await getConnectionStatus();

        if (isConnected) {
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          if (!apiUrl) {
            throw new Error('Server URL not configured');
          }

          const params = new URLSearchParams();
          if (pid != null) {
            params.append('puesto_id', String(pid));
          } else if (cid != null) {
            params.append('corpo_id', String(cid));
          }

          const surveysResponse = await authedFetch({
            url: `${apiUrl}/api/encuesta-nps?${params.toString()}`,
            init: {
              method: 'GET',
            },
            refreshAccessToken,
            logout,
          });
          const fullCache = await parseSurveysCache();
          if (!surveysResponse) {
            const forList = (
              pid != null
                ? filterSurveysCacheByPuesto(fullCache, pid)
                : filterSurveysCacheByCorpo(fullCache, cid)
            ).map(mapRow);
            setSurveys(forList);
            return;
          }

          const surveysData = await surveysResponse.json();

          if (surveysData.status && Array.isArray(surveysData.encuestas)) {
            let merged: any[];
            if (pid != null) {
              merged = mergeSurveysCacheForPuesto(fullCache, surveysData.encuestas, pid);
            } else {
              merged = mergeSurveysCacheForCorpo(fullCache, surveysData.encuestas, cid!);
            }
            await AsyncStorage.setItem('surveys_cache', JSON.stringify(merged));
            const forList = (
              pid != null
                ? filterSurveysCacheByPuesto(merged, pid)
                : filterSurveysCacheByCorpo(merged, cid)
            ).map(mapRow);
            setSurveys(forList);
          } else {
            const forList = (
              pid != null
                ? filterSurveysCacheByPuesto(fullCache, pid)
                : filterSurveysCacheByCorpo(fullCache, cid)
            ).map(mapRow);
            setSurveys(forList);
          }
          hasShownOfflineAlertRef.current = false;
        } else {
          const fullCache = await parseSurveysCache();
          const forList = (
            pid != null
              ? filterSurveysCacheByPuesto(fullCache, pid)
              : filterSurveysCacheByCorpo(fullCache, cid)
          ).map(mapRow);
          setSurveys(forList);

          if (showOfflineAlert && !hasShownOfflineAlertRef.current) {
            Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
            hasShownOfflineAlertRef.current = true;
          }
        }
      } catch (err) {
        console.error('Error fetching surveys:', err);
        try {
          const fullCache = await parseSurveysCache();
          const forList = (
            pid != null
              ? filterSurveysCacheByPuesto(fullCache, pid)
              : filterSurveysCacheByCorpo(fullCache, cid)
          ).map(mapRow);
          setSurveys(forList);
          if (forList.length > 0 && showOfflineAlert && !hasShownOfflineAlertRef.current) {
            Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
            hasShownOfflineAlertRef.current = true;
          } else if (forList.length === 0 && showOfflineAlert) {
            Alert.alert('Error', 'No se pudieron cargar las encuestas');
          }
        } catch {
          if (showOfflineAlert) {
            Alert.alert('Error', 'No se pudieron cargar las encuestas');
          }
        }
      } finally {
        setIsListLoading(false);
      }
    },
    [refreshAccessToken, logout]
  );

  const getListScopeForRefresh = useCallback((): { puestoId: number | null; corpoId: number | null } => {
    const puesto =
      filterPuestoIdRef.current ?? filterPuestoId ?? formPuestoId ?? puestoIdRef.current;
    if (puesto != null && Number(puesto) > 0) return { puestoId: Number(puesto), corpoId: null };
    const corpo = filterCorpoIdRef.current ?? filterCorpoId ?? formCorpoId ?? marcaCorpoId;
    if (corpo != null && Number(corpo) > 0) return { puestoId: null, corpoId: Number(corpo) };
    return { puestoId: null, corpoId: null };
  }, [filterPuestoId, filterCorpoId, formPuestoId, formCorpoId, marcaCorpoId]);

  useEffect(() => {
    filterPuestoIdRef.current = filterPuestoId;
  }, [filterPuestoId]);

  useEffect(() => {
    filterCorpoIdRef.current = filterCorpoId;
  }, [filterCorpoId]);

  /** Cargar puestos de API/caché al elegir sucursal en filtro o en el formulario (cualquiera de los dos). */
  useEffect(() => {
    const ids = new Set<number>();
    if (filterCorpoId != null && Number.isFinite(Number(filterCorpoId)) && Number(filterCorpoId) > 0) {
      ids.add(Number(filterCorpoId));
    }
    if (formCorpoId != null && Number.isFinite(Number(formCorpoId)) && Number(formCorpoId) > 0) {
      ids.add(Number(formCorpoId));
    }
    ids.forEach((id) => {
      void fetchPuestosForCorpo(id, true);
    });
  }, [filterCorpoId, formCorpoId, fetchPuestosForCorpo]);

  useEffect(() => {
    if (filterPuestoId != null) {
      const pid = Number(filterPuestoId);
      if (Number.isFinite(pid) && pid > 0) {
        void fetchSurveysList({ puestoId: pid, corpoId: null }, false);
        return;
      }
    }
    const cid = filterCorpoId ?? marcaCorpoId;
    if (cid != null) {
      const c = Number(cid);
      if (Number.isFinite(c) && c > 0) {
        void fetchSurveysList({ puestoId: null, corpoId: c }, false);
        return;
      }
    }
    setSurveys([]);
  }, [filterPuestoId, filterCorpoId, marcaCorpoId, fetchSurveysList]);

  // Cargar estructura, alinear filtros jerárquicos al puesto de current_marca cuando exista en el árbol, y lista solo con puesto_id
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsCheckingMarca(true);
      const current = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
      const tree = await loadMainStructureCache();
      if (!isMounted) return;
      setIsCheckingMarca(false);

      if (current?.id) {
        const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
        const effDiv = tree.length > 0 ? resolveMarcaDivisionForTree(current, tree) : null;

        const applyHierarchyPath = (path: FormHierarchyIds) => {
          setFilterEmpresaId(path.empresaId);
          setFilterClienteId(path.clienteId);
          setFilterDivisionId(path.divisionId);
          setFilterContratoId(path.contratoId);
          setFilterCorpoId(path.corpoId);
          setFilterPuestoId(path.puestoId);
          filterPuestoIdRef.current = path.puestoId;
          filterCorpoIdRef.current = path.corpoId;
          setFormEmpresaId(path.empresaId);
          setFormClienteId(path.clienteId);
          setFormDivisionId(path.divisionId);
          setFormContratoId(path.contratoId);
          setFormCorpoId(path.corpoId);
          setFormPuestoId(path.puestoId);
        };

        if (puestoIdRaw !== undefined && puestoIdRaw !== null) {
          const pidNum = Number(puestoIdRaw);
          if (Number.isFinite(pidNum) && pidNum > 0) {
            const pathByPuesto = findHierarchyByPuestoIn(tree, pidNum);
            if (pathByPuesto) {
              applyHierarchyPath(pathByPuesto);
            } else {
              const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
              const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
              const divisionIdRaw =
                current?.roleDivision?.division?.id ?? current?.division?.id ?? current?.division_id;
              const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
              const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
              if (empresaIdRaw !== undefined && empresaIdRaw !== null) {
                const n = Number(empresaIdRaw);
                setFilterEmpresaId(n);
                setFormEmpresaId(n);
              }
              if (clienteIdRaw !== undefined && clienteIdRaw !== null) {
                const n = Number(clienteIdRaw);
                setFilterClienteId(n);
                setFormClienteId(n);
              }
              const divSet =
                divisionIdRaw !== undefined && divisionIdRaw !== null
                  ? effDiv ?? Number(divisionIdRaw)
                  : effDiv;
              if (divSet != null) {
                setFilterDivisionId(divSet);
                setFormDivisionId(divSet);
                setMarcaDivisionId(divSet);
              }
              if (contratoIdRaw !== undefined && contratoIdRaw !== null) {
                const n = Number(contratoIdRaw);
                setFilterContratoId(n);
                setFormContratoId(n);
              }
              if (corpoIdRaw !== undefined && corpoIdRaw !== null) {
                const n = Number(corpoIdRaw);
                setFilterCorpoId(n);
                filterCorpoIdRef.current = n;
                setFormCorpoId(n);
              }
              setFilterPuestoId(pidNum);
              filterPuestoIdRef.current = pidNum;
              setFormPuestoId(pidNum);
            }
          }
        } else {
          const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
          const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
          const divisionIdRaw =
            current?.roleDivision?.division?.id ?? current?.division?.id ?? current?.division_id;
          const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
          const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
          if (empresaIdRaw !== undefined && empresaIdRaw !== null) {
            const n = Number(empresaIdRaw);
            setFilterEmpresaId(n);
            setFormEmpresaId(n);
          }
          if (clienteIdRaw !== undefined && clienteIdRaw !== null) {
            const n = Number(clienteIdRaw);
            setFilterClienteId(n);
            setFormClienteId(n);
          }
          const divSet =
            divisionIdRaw !== undefined && divisionIdRaw !== null
              ? effDiv ?? Number(divisionIdRaw)
              : effDiv;
          if (divSet != null) {
            setFilterDivisionId(divSet);
            setFormDivisionId(divSet);
            setMarcaDivisionId(divSet);
          }
          if (contratoIdRaw !== undefined && contratoIdRaw !== null) {
            const n = Number(contratoIdRaw);
            setFilterContratoId(n);
            setFormContratoId(n);
          }
          if (corpoIdRaw !== undefined && corpoIdRaw !== null) {
            const n = Number(corpoIdRaw);
            setFilterCorpoId(n);
            filterCorpoIdRef.current = n;
            setFormCorpoId(n);
          }
        }
      }
    })();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => {
      hasShownOfflineAlertRef.current = false;
      void loadMainStructureCache();
      void fetchSurveysList(getListScopeForRefresh(), true);
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [fetchSurveysList, getListScopeForRefresh, loadMainStructureCache]);

  useEffect(() => {
    const onSurveysCacheUpdated = () => {
      hasShownOfflineAlertRef.current = false;
      const scope = getListScopeForRefresh();
      if (scope.puestoId == null && scope.corpoId == null) return;
      void fetchSurveysList(scope, false);
    };
    eventBus.on('surveysCacheUpdated', onSurveysCacheUpdated);
    return () => {
      eventBus.off('surveysCacheUpdated', onSurveysCacheUpdated);
    };
  }, [fetchSurveysList, getListScopeForRefresh]);

  useFocusEffect(
    useCallback(() => {
      if (surveysListInitialFocusRef.current) {
        surveysListInitialFocusRef.current = false;
        return;
      }
      void loadMainStructureCache();
      const scope = getListScopeForRefresh();
      if (scope.puestoId == null && scope.corpoId == null) return;
      hasShownOfflineAlertRef.current = false;
      void fetchSurveysList(scope, false);
    }, [fetchSurveysList, getListScopeForRefresh, loadMainStructureCache])
  );

  // Función para rastrear el contrato de una sucursal
  const findContratoForSucursal = useCallback((sucursalId: number): number | null => {
    for (const empresa of structure) {
      for (const cliente of empresa.clientes || []) {
        for (const division of getClienteDivisionArray(cliente)) {
          for (const contrato of division.contratos || []) {
            for (const sucursal of contrato.sucursales || []) {
              if (Number(sucursal.id) === Number(sucursalId)) {
                return contrato.id;
              }
            }
          }
        }
      }
    }
    return null;
  }, [structure]);

  const fetchEmpleadoDetalle = async (empleadoId: number) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return null;
      const response = await authedFetch({
        url: `${apiUrl}/api/empleados/${empleadoId}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return null;

      if (!response.ok) return null;

      const data = await response.json();

      return {
        nombre: data.nombre || '',
        primer_apellido: data.primer_apellido || '',
        segundo_apellido: data.segundo_apellido || '',
      };
    } catch (error) {
      console.error('Error fetching empleado detalle:', error);
      return null;
    }
  };

  const decodeFirma = async (firmaBase64: string): Promise<FirmaData | null> => {
    try {
      const decoded = atob(firmaBase64);
      const parts = decoded.split(':');

      if (parts.length !== 5) {
        return null;
      }

      const firmaData: FirmaData = {
        sessionId: parts[0],
        empleadoId: parts[1],
        latitud: parts[2],
        longitud: parts[3],
        timestamp: parts[4],
      };

      // Fetch employee details
      const empleadoDetalle = await fetchEmpleadoDetalle(parseInt(parts[1]));
      if (empleadoDetalle) {
        firmaData.empleadoDetalle = empleadoDetalle;
      }

      return firmaData;
    } catch (error) {
      console.error('Error decoding firma:', error);
      return null;
    }
  };

  /** Interpreta firma guardada: base64 estándar o cadena `sesión:empleado:lat:lng:timestamp` en claro. */
  const decodeFirmaFromStoredValue = async (normalized: string): Promise<FirmaData | null> => {
    if (!normalized) return null;
    const fromB64 = await decodeFirma(normalized);
    if (fromB64) return fromB64;
    let inner = normalized;
    try {
      inner = atob(normalized);
    } catch {
      inner = normalized;
    }
    const parts = inner.split(':');
    if (parts.length !== 5) return null;
    const firmaData: FirmaData = {
      sessionId: parts[0],
      empleadoId: parts[1],
      latitud: parts[2],
      longitud: parts[3],
      timestamp: parts[4],
    };
    try {
      const empleadoDetalle = await fetchEmpleadoDetalle(parseInt(parts[1], 10));
      if (empleadoDetalle) firmaData.empleadoDetalle = empleadoDetalle;
    } catch {
      /* ignore */
    }
    return firmaData;
  };

  const clearResponsableFirma = () => {
    setFirmaResponsable(null);
    setEditingResponsableFirmaStored(null);
    editingFirmaResponsableOriginalRef.current = null;
  };

  const generateResponsableSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se encontró la información del empleado');
      return;
    }

    setIsGeneratingFirmaResponsable(true);

    try {
      const firmaBase64 = await getCurrentUserDigitalSignature(employee);
      if (!firmaBase64) return;

      const firmaData = await decodeFirma(firmaBase64);
      if (firmaData) {
        setFirmaResponsable(firmaData);
      }
    } catch (error) {
      console.error('Error generating firma responsable:', error);
      Alert.alert('Error', 'No se pudo generar la firma del responsable');
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHashSurvey(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }
      const firmaData = await decodeFirma(qrData);
      if (firmaData) {
        setFirmaResponsable(firmaData);
      }
    } catch (error) {
      console.error('Error scanning firma responsable:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const formatDateForDisplay = (dateString: string): string => {
    return convertDateTimestampToLocalString(dateString, false);
  };

  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resetAllFilters = () => {
    setFilterFecha('');
    setFilterPersonaEvaluada('');
    setFilterCedulaPersonaEvaluada('');
    setFilterTelefonoPersonaEvaluada('');
    setFilterEmailPersonaEvaluada('');
    setFilterResponsableNombre('');
    setFilterResponsableCedula('');
    setFilterObservations('');
    setFilterEmpresaId(null);
    setFilterClienteId(null);
    setFilterDivisionId(null);
    setFilterContratoId(null);
    setFilterCorpoId(null);
    setFilterPuestoId(null);
    filterPuestoIdRef.current = null;
    setPuestosByCorpo({});
    lastLoadedCorpoIdRef.current = null;
    setSurveys([]);
  };

  const handleFilterFechaChange = (event: any, selectedDate?: Date) => {
    setShowFilterFechaPicker(false);
    if (selectedDate) {
      const dateString = dateToLocalString(selectedDate);
      setFilterFecha(dateString);
    }
  };

  // Filter surveys
  const filteredSurveys = surveys.filter((survey: Survey) => {
    const matchesFecha =
      !filterFecha.trim() ||
      survey.fecha?.split('T')[0] === filterFecha;

    const matchesPersonaEvaluada =
      !filterPersonaEvaluada.trim() ||
      survey.persona_evaluada?.toLowerCase().includes(filterPersonaEvaluada.toLowerCase());

    const matchesCedulaPersonaEvaluada =
      !filterCedulaPersonaEvaluada.trim() ||
      survey.cedula_persona_evaluada?.toLowerCase().includes(filterCedulaPersonaEvaluada.toLowerCase());

    const matchesTelefonoPersonaEvaluada =
      !filterTelefonoPersonaEvaluada.trim() ||
      survey.telefono_persona_evaluada?.toLowerCase().includes(filterTelefonoPersonaEvaluada.toLowerCase());

    const matchesEmailPersonaEvaluada =
      !filterEmailPersonaEvaluada.trim() ||
      survey.email_persona_evaluada?.toLowerCase().includes(filterEmailPersonaEvaluada.toLowerCase());

    const matchesResponsableNombre =
      !filterResponsableNombre.trim() ||
      survey.responsable?.nombre?.toLowerCase().includes(filterResponsableNombre.toLowerCase());

    const matchesResponsableCedula =
      !filterResponsableCedula.trim() ||
      survey.responsable?.cedula?.toLowerCase().includes(filterResponsableCedula.toLowerCase());

    const matchesObservations =
      !filterObservations.trim() ||
      (survey.observations && survey.observations.toLowerCase().includes(filterObservations.toLowerCase()));

    return matchesFecha &&
      matchesPersonaEvaluada &&
      matchesCedulaPersonaEvaluada &&
      matchesTelefonoPersonaEvaluada &&
      matchesEmailPersonaEvaluada &&
      matchesResponsableNombre &&
      matchesResponsableCedula &&
      matchesObservations;
  });

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00.000Z`;
  };

  const startCreating = async () => {
    setEditingSurvey(null);
    setIsCreating(true);
    setFormKey(prev => prev + 1);
    resetForm();

    await syncMarcaFromStorage({ applyFiltersFromMarca: false });
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    const current = currentMarcaStr ? JSON.parse(currentMarcaStr) : null;

    const tree = await loadMainStructureCache();

    if (!current?.id) {
      const horaAccionOnly = await getHoraAccion();
      if (!horaAccionOnly) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        setIsCreating(false);
        return;
      }
      const todayOnly = new Date(horaAccionOnly);
      setFechaEncuesta(todayOnly);
      fechaEncuestaRef.current = formatDateToISO(todayOnly);
      if (employee) {
        responsableNombreRef.current = employee.name || '';
        responsableCedulaRef.current = employee.cedula || '';
      }
      setSelectedDivision('Seguridad');
      divisionRef.current = 'Seguridad';
      const evalTmplOnly = getDefaultEvaluationFormForDivision('Seguridad');
      if (evalTmplOnly) {
        const clonedOnly = cloneEvaluationForm(evalTmplOnly);
        evaluationFormRef.current = clonedOnly;
        setEvaluationForm(clonedOnly);
      }
      return;
    }

    const clienteIdMarca =
      current?.cliente?.id ?? current?.cliente_id;
    const divisionIdMarca =
      current?.roleDivision?.division?.id ?? current?.division?.id ?? current?.division_id;
    const corpoIdMarca = current?.corpo?.id ?? current?.corpo_id;
    const puestoIdMarca = current?.puesto?.id ?? current?.puesto_id;

    const clienteIdNum =
      clienteIdMarca !== undefined && clienteIdMarca !== null && clienteIdMarca !== ''
        ? Number(clienteIdMarca)
        : null;
    const divisionIdNum =
      divisionIdMarca !== undefined && divisionIdMarca !== null && divisionIdMarca !== ''
        ? Number(divisionIdMarca)
        : null;
    const effDivCreate = tree.length > 0 ? resolveMarcaDivisionForTree(current, tree) : null;
    const divisionIdForLookup =
      effDivCreate != null ? effDivCreate : divisionIdNum;

    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }

    if (clienteIdNum != null && Number.isFinite(clienteIdNum) && clienteIdNum > 0) {
      for (const empresa of tree) {
        const cliente = empresa.clientes?.find((c: any) => Number(c.id) === Number(clienteIdNum));
        if (cliente) {
          empresaEvaluadaRef.current = cliente.nombre;
          break;
        }
      }
    }

    if (divisionIdForLookup != null && Number.isFinite(divisionIdForLookup) && divisionIdForLookup > 0) {
      for (const empresa of tree) {
        for (const cliente of empresa.clientes || []) {
          const division = getClienteDivisionArray(cliente).find(
            (d: any) => Number(d.id) === Number(divisionIdForLookup)
          );
          if (division) {
            const divisionName = division.nombre;
            // Establecer selectedDivision basado en el nombre
            if (divisionName === 'Seguridad' || divisionName.toLowerCase().includes('seguridad')) {
              setSelectedDivision('Seguridad');
              divisionRef.current = 'Seguridad';
            } else if (divisionName === 'Aseo & Limpieza' || divisionName === 'Aseo y limpieza' || divisionName.toLowerCase().includes('aseo') || divisionName.toLowerCase().includes('limpieza')) {
              setSelectedDivision('Aseo & Limpieza');
              divisionRef.current = 'Aseo & Limpieza';
            } else {
              setSelectedDivision('');
              divisionRef.current = '';
            }
            break;
          }
        }
        if (divisionRef.current) break;
      }
    } else {
      setSelectedDivision('Seguridad');
      divisionRef.current = 'Seguridad';
    }

    const corpoToFetch =
      corpoIdMarca !== undefined && corpoIdMarca !== null && corpoIdMarca !== ''
        ? Number(corpoIdMarca)
        : null;
    let puestosListForMarca: Puesto[] = [];
    if (corpoToFetch != null && Number.isFinite(corpoToFetch) && corpoToFetch > 0) {
      const loaded = await fetchPuestosForCorpo(corpoToFetch, true);
      puestosListForMarca = loaded ?? puestosByCorpoRef.current[String(corpoToFetch)] ?? [];
    }

    const resolvedPuestoNum =
      puestoIdMarca !== undefined && puestoIdMarca !== null && puestoIdMarca !== ''
        ? Number(puestoIdMarca)
        : null;
    if (resolvedPuestoNum != null && Number.isFinite(resolvedPuestoNum) && resolvedPuestoNum > 0) {
      puestoIdRef.current = resolvedPuestoNum;
      setSelectedPuesto(resolvedPuestoNum);
    } else if (puestosListForMarca.length > 0) {
      const firstId = puestosListForMarca[0].id;
      puestoIdRef.current = firstId;
      setSelectedPuesto(firstId);
      setFormPuestoId(firstId);
    }

    const today = new Date(horaAccion);
    setFechaEncuesta(today);
    fechaEncuestaRef.current = formatDateToISO(today);

    if (employee) {
      responsableNombreRef.current = employee.name || '';
      responsableCedulaRef.current = employee.cedula || '';
    }

    const evalTmpl = getDefaultEvaluationFormForDivision(divisionRef.current);
    if (evalTmpl) {
      const cloned = cloneEvaluationForm(evalTmpl);
      evaluationFormRef.current = cloned;
      setEvaluationForm(cloned);
    } else {
      evaluationFormRef.current = null;
      setEvaluationForm(null);
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditingSurvey(null);
    setEditingResponsableFirmaStored(null);
    resetForm();
  };

  const startEditing = async (survey: Survey) => {
    setIsCreating(false);
    setEditingSurvey(survey);

    const frNorm = normalizeFirmaResponsableInput(
      (survey as any).firma_responsable ?? (survey as any).firmaResponsable
    );
    setEditingResponsableFirmaStored(frNorm.length > 0 ? frNorm : null);
    editingFirmaResponsableOriginalRef.current = frNorm.length > 0 ? frNorm : null;

    /* 1) Refs y estado que no dependen de red: antes de cualquier await para que el primer render no quede vacío. */
    empresaEvaluadaRef.current = survey.empresa_evaluada || '';
    personaNombreRef.current = survey.persona_evaluada || '';
    personaCedulaRef.current = survey.cedula_persona_evaluada || '';
    personaTelefonoRef.current = survey.telefono_persona_evaluada || '';
    personaEmailRef.current = survey.email_persona_evaluada || '';
    observacionesRef.current = survey.observations || '';
    puestoIdRef.current = survey.puesto?.id || 0;
    setSelectedPuesto(survey.puesto?.id || 0);

    const divName = survey.division?.nombre || '';
    if (divName === 'Seguridad' || divName.toLowerCase().includes('seguridad')) {
      setSelectedDivision('Seguridad');
      divisionRef.current = 'Seguridad';
    } else if (
      divName === 'Aseo & Limpieza' ||
      divName === 'Aseo y limpieza' ||
      divName.toLowerCase().includes('aseo') ||
      divName.toLowerCase().includes('limpieza')
    ) {
      setSelectedDivision('Aseo & Limpieza');
      divisionRef.current = 'Aseo & Limpieza';
    } else {
      setSelectedDivision('');
      divisionRef.current = '';
    }

    const parsedForm = parseEvaluacionesStored(survey.evaluaciones, divisionRef.current);
    evaluationFormRef.current = parsedForm;
    setEvaluationForm(parsedForm);

    if (survey.firma_persona_evaluada?.trim()) {
      const f = survey.firma_persona_evaluada.trim();
      const uri = f.startsWith('data:') ? f : `data:image/png;base64,${f}`;
      setPersonSignature(uri);
      personSignatureRef.current = uri;
    } else {
      setPersonSignature(null);
      personSignatureRef.current = null;
    }

    const fd = survey.fecha ? new Date(survey.fecha) : new Date();
    setFechaEncuesta(fd);
    fechaEncuestaRef.current = survey.fecha || formatDateToISO(fd);

    responsableNombreRef.current = survey.responsable?.nombre || '';
    responsableCedulaRef.current = survey.responsable?.cedula || '';

    /* 2) Estructura: estado en memoria o caché (evita jerarquía vacía si el state aún no hidrató). */
    let structureArr: any[] = Array.isArray(structure) && structure.length > 0 ? structure : [];
    if (!structureArr.length) {
      try {
        structureArr = await loadMainStructureCache();
      } catch {
        /* ignore */
      }
    }

    const puestoId = survey.puesto?.id;
    let h: FormHierarchyIds | null =
      puestoId && structureArr.length > 0 ? findHierarchyByPuestoIn(structureArr, puestoId) : null;
    if (!h && structureArr.length > 0) {
      h = findHierarchyFromSurveySnapshot(structureArr, survey);
    }

    if (h) {
      setFormEmpresaId(h.empresaId);
      setFormClienteId(h.clienteId);
      setFormDivisionId(h.divisionId);
      setFormContratoId(h.contratoId);
      setFormCorpoId(h.corpoId);
      setFormPuestoId(h.puestoId);
    } else {
      setFormEmpresaId(survey.empresa?.id ?? null);
      setFormClienteId(survey.cliente?.id ?? null);
      setFormDivisionId(survey.division?.id ?? null);
      const corpoId = survey.sucursal?.id ?? null;
      setFormCorpoId(corpoId);
      setFormPuestoId(survey.puesto?.id ?? null);
      const contratoId =
        corpoId != null ? findContratoForSucursalIn(structureArr, corpoId) : null;
      setFormContratoId(contratoId);
    }

    if (frNorm.length > 0) {
      let fr = await decodeFirmaFromStoredValue(frNorm);
      if (!fr) {
        fr = tryParseFirmaResponsableSync(frNorm);
      }
      setFirmaResponsable(fr);
    } else {
      setFirmaResponsable(null);
    }

    /* 3) Forzar remount de TextInput cuando refs ya tienen el valor correcto (después de awaits). */
    setFormKey((k) => k + 1);

    requestAnimationFrame(() => {
      const e = survey.empresa_evaluada || '';
      const n = survey.persona_evaluada || '';
      const c = survey.cedula_persona_evaluada || '';
      const t = survey.telefono_persona_evaluada || '';
      const em = survey.email_persona_evaluada || '';
      const o = survey.observations || '';
      const rn = survey.responsable?.nombre || '';
      const rc = survey.responsable?.cedula || '';
      empresaEvaluadaInputRef.current?.setNativeProps({ text: e });
      personaNombreInputRef.current?.setNativeProps({ text: n });
      personaCedulaInputRef.current?.setNativeProps({ text: c });
      personaTelefonoInputRef.current?.setNativeProps({ text: t });
      personaEmailInputRef.current?.setNativeProps({ text: em });
      observacionesInputRef.current?.setNativeProps({ text: o });
      responsableNombreInputRef.current?.setNativeProps({ text: rn });
      responsableCedulaInputRef.current?.setNativeProps({ text: rc });
    });
  };

  const resetForm = () => {
    empresaEvaluadaRef.current = '';
    personaNombreRef.current = '';
    personaCedulaRef.current = '';
    personaTelefonoRef.current = '';
    personaEmailRef.current = '';
    puestoIdRef.current = 0;
    fechaEncuestaRef.current = '';
    divisionRef.current = 'Seguridad';
    observacionesRef.current = '';
    responsableNombreRef.current = '';
    responsableCedulaRef.current = '';
    evaluationFormRef.current = null;
    setEvaluationForm(null);
    setAddQuestionModalVisible(false);
    setAddQuestionSectionIndex(null);
    setAddQuestionDraft('');
    setPersonSignature(null);
    personSignatureRef.current = null;
    setFirmaResponsable(null);
    editingFirmaResponsableOriginalRef.current = null;
    setEditingResponsableFirmaStored(null);
    setSignatureKey(prev => prev + 1);
    setIsSignatureModalVisible(false);
    setTempSignature(null);

    // Reset jerarquía del formulario
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormPuestoId(null);
    setSelectedPuesto(0);

    // Clear input refs
    if (empresaEvaluadaInputRef.current) empresaEvaluadaInputRef.current.clear();
    if (personaNombreInputRef.current) personaNombreInputRef.current.clear();
    if (personaCedulaInputRef.current) personaCedulaInputRef.current.clear();
    if (personaTelefonoInputRef.current) personaTelefonoInputRef.current.clear();
    if (personaEmailInputRef.current) personaEmailInputRef.current.clear();
    if (observacionesInputRef.current) observacionesInputRef.current.clear();
    if (responsableNombreInputRef.current) responsableNombreInputRef.current.clear();
    if (responsableCedulaInputRef.current) responsableCedulaInputRef.current.clear();
  };

  const createSurvey = async () => {
    // Validations
    if (!empresaEvaluadaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre de la empresa evaluada');
      return;
    }

    if (!personaNombreRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre de la persona que llena la encuesta');
      return;
    }

    if (!personaCedulaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la cédula de la persona que llena la encuesta');
      return;
    }

    if (!personaTelefonoRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el teléfono de la persona que llena la encuesta');
      return;
    }

    if (!personaEmailRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el email de la persona que llena la encuesta');
      return;
    }

    if (!puestoIdRef.current || puestoIdRef.current === 0) {
      const fromForm = formPuestoId != null && Number(formPuestoId) > 0 ? Number(formPuestoId) : null;
      if (fromForm) puestoIdRef.current = fromForm;
    }
    if (!puestoIdRef.current || puestoIdRef.current === 0) {
      Alert.alert('Error', 'Debe seleccionar un puesto');
      return;
    }

    if (!fechaEncuestaRef.current) {
      Alert.alert('Error', 'Debe seleccionar la fecha de la encuesta');
      return;
    }

    if (selectedDivision !== 'Seguridad' && selectedDivision !== 'Aseo & Limpieza') {
      Alert.alert('Error', 'Debe seleccionar una división con formulario (Seguridad o Aseo & Limpieza).');
      return;
    }
    const formPayloadPre = evaluationFormRef.current;
    if (!formPayloadPre || !formPayloadPre.form.length) {
      Alert.alert('Error', 'No hay formulario de evaluación. Seleccione división y jerarquía correctamente.');
      return;
    }
    for (const sec of formPayloadPre.form) {
      for (const q of sec.questions) {
        if (q.apply && (q.value < 1 || q.value > 5)) {
          Alert.alert('Error', 'Califique con 1 a 5 estrellas todas las preguntas marcadas como "Aplica".');
          return;
        }
      }
    }

    // firma_persona_evaluada es opcional

    if (!responsableNombreRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre del responsable');
      return;
    }

    if (!responsableCedulaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la cédula del responsable');
      return;
    }

    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes generar la firma del responsable');
      return;
    }

    Alert.alert(
      'Confirmar creación',
      '¿Está seguro de que desea crear esta encuesta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setIsCreateSubmitting(true);
            try {
              const currentMarca = await AsyncStorage.getItem('current_marca');
              if (!currentMarca) {
                Alert.alert('Error', 'No se encontró la marca actual');
                return;
              }

              const currentMarcaData = JSON.parse(currentMarca);

              const evaluacionesJson = getEvaluationJsonForSave();
              if (!evaluacionesJson) {
                Alert.alert('Error', 'No se pudo preparar el formulario de evaluación.');
                return;
              }

              // Signature is already in base64 format from SignatureScreen
              const personSignatureBase64 = personSignatureRef.current || personSignature || '';

              // Rebuild firma base64 string
              const firmaResponsableBase64 = btoa(
                `${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`
              );

              // Obtener IDs SOLO de la jerarquía seleccionada en el formulario
              const empresaId = formEmpresaId;
              const clienteId = formClienteId;
              const corpoId = formCorpoId;
              const puestoId = formPuestoId;

              // Obtener division_id de la jerarquía seleccionada
              let divisionId = formDivisionId;

              // Si no hay divisionId pero hay una división seleccionada en la jerarquía, buscarla por nombre
              if (!divisionId && formClienteId) {
                // Buscar la división en la estructura basado en selectedDivision
                const divisionName = selectedDivision;
                if (divisionName === 'Seguridad' || divisionName === 'Aseo & Limpieza') {
                  // Buscar el ID de la división en la estructura
                  for (const empresa of structure) {
                    for (const cliente of empresa.clientes || []) {
                      if (Number(cliente.id) === Number(formClienteId)) {
                        const division = getClienteDivisionArray(cliente).find((d: any) => {
                          const dName = d.nombre;
                          if (divisionName === 'Seguridad') {
                            return dName === 'Seguridad' || dName.toLowerCase().includes('seguridad');
                          } else if (divisionName === 'Aseo & Limpieza') {
                            return dName === 'Aseo & Limpieza' || dName === 'Aseo y limpieza' || dName.toLowerCase().includes('aseo') || dName.toLowerCase().includes('limpieza');
                          }
                          return false;
                        });
                        if (division) {
                          divisionId = division.id;
                          break;
                        }
                      }
                    }
                    if (divisionId) break;
                  }
                }
              }

              // Si hay corpoId pero no contratoId, rastrear el contrato desde la estructura
              let contratoId = formContratoId;
              if (corpoId && !contratoId) {
                contratoId = findContratoForSucursal(corpoId);
              }

              // Validar que todos los IDs estén presentes (SOLO de la jerarquía del formulario)
              if (!empresaId || !clienteId || !divisionId || !corpoId || !puestoId) {
                Alert.alert('Error', 'Faltan datos de la jerarquía. Por favor, complete la selección de Empresa, Cliente, División, Sucursal y Puesto en el formulario.');
                return;
              }

              const requestBody = {
                marca_id: currentMarcaData.id,
                empresa_id: empresaId,
                cliente_id: clienteId,
                division_id: divisionId,
                corpo_id: corpoId,
                puesto_id: puestoId,
                contrato_id:
                  contratoId != null && Number(contratoId) > 0 ? Number(contratoId) : 0,
                fecha: fechaEncuestaRef.current,
                evaluaciones: evaluacionesJson,
                persona_evaluada: personaNombreRef.current,
                cedula_persona_evaluada: personaCedulaRef.current,
                telefono_persona_evaluada: personaTelefonoRef.current,
                email_persona_evaluada: personaEmailRef.current,
                nombre_responsable: responsableNombreRef.current,
                cedula_responsable: responsableCedulaRef.current,
                firma_responsable: firmaResponsableBase64,
                firma_persona_evaluada: personSignatureBase64,
                observaciones: observacionesRef.current.trim() || '-',
                empresa_evaluada: empresaEvaluadaRef.current,
                division: divisionRef.current
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await createSurveyAPI({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  const createdServerId = data.data?.id != null ? Number(data.data.id) : null;
                  if (createdServerId != null && Number.isFinite(createdServerId) && createdServerId > 0) {
                    const cacheStr0 = await AsyncStorage.getItem('surveys_cache');
                    const fullCache0 = cacheStr0 ? JSON.parse(cacheStr0) : [];
                    const list0 = Array.isArray(fullCache0) ? fullCache0 : [];
                    const labels0 = resolveHierarchyNamesFromStructure(
                      structure,
                      {
                        empresaId: empresaId!,
                        clienteId: clienteId!,
                        divisionId: divisionId!,
                        contratoId: contratoId ?? null,
                        corpoId: corpoId!,
                        puestoId: puestoId!,
                      },
                      puestosByCorpo[String(corpoId!)] ?? []
                    );
                    const row0: Survey = {
                      id: createdServerId,
                      id_local: '',
                      persona_evaluada: personaNombreRef.current,
                      empresa_evaluada: empresaEvaluadaRef.current,
                      cedula_persona_evaluada: personaCedulaRef.current,
                      telefono_persona_evaluada: personaTelefonoRef.current,
                      email_persona_evaluada: personaEmailRef.current,
                      firma_persona_evaluada: personSignatureBase64,
                      empresa: labels0.empresa,
                      cliente: labels0.cliente,
                      sucursal: labels0.sucursal,
                      puesto: labels0.puesto,
                      division: labels0.division,
                      contrato_id:
                        contratoId != null && Number(contratoId) > 0 ? Number(contratoId) : 0,
                      responsable_id: parseInt(employee?.id || '0', 10) || 0,
                      responsable: {
                        nombre: responsableNombreRef.current,
                        cedula: responsableCedulaRef.current,
                      },
                      firma_responsable: firmaResponsableBase64,
                      nombre_firma: '',
                      fecha: fechaEncuestaRef.current,
                      evaluaciones: evaluacionesJson,
                      observations: observacionesRef.current.trim() || '-',
                    };
                    const merged0 = upsertSurveyCacheRowForPuesto(list0, row0, puestoId!);
                    await AsyncStorage.setItem('surveys_cache', JSON.stringify(merged0));
                  }
                  Alert.alert('Éxito', data.message || 'Encuesta creada correctamente');
                  setIsCreating(false);
                  const listScopeAfterCreate = getListScopeForRefresh();
                  resetForm();
                  await fetchSurveysList(listScopeAfterCreate, true);
                } else {
                  Alert.alert('Error', data.message || 'Error al crear la encuesta');
                }
              } else {
                // Sin internet: modo offline
                const localId = generateRandomId();
                const horaAccion = await getHoraAccion();

                // Crear entrada en surveys_actions
                const actionsStr = await AsyncStorage.getItem('surveys_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                const nextActions = actions.filter(
                  (a: any) => !(a?.type === 'create' && String(a?.id) === String(localId))
                );
                nextActions.push({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('surveys_actions', JSON.stringify(nextActions));

                const labels = resolveHierarchyNamesFromStructure(
                  structure,
                  {
                    empresaId: empresaId!,
                    clienteId: clienteId!,
                    divisionId: divisionId!,
                    contratoId: contratoId ?? null,
                    corpoId: corpoId!,
                    puestoId: puestoId!,
                  },
                  puestosByCorpo[String(corpoId!)] ?? []
                );

                // Crear encuesta en cache
                const cacheStr = await AsyncStorage.getItem('surveys_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newSurveyCache: Survey = {
                  id: 0,
                  id_local: localId,
                  persona_evaluada: personaNombreRef.current,
                  empresa_evaluada: empresaEvaluadaRef.current,
                  cedula_persona_evaluada: personaCedulaRef.current,
                  telefono_persona_evaluada: personaTelefonoRef.current,
                  email_persona_evaluada: personaEmailRef.current,
                  firma_persona_evaluada: personSignatureBase64,
                  empresa: labels.empresa,
                  cliente: labels.cliente,
                  sucursal: labels.sucursal,
                  puesto: labels.puesto,
                  division: labels.division,
                  contrato_id:
                    contratoId != null && Number(contratoId) > 0 ? Number(contratoId) : 0,
                  responsable_id: parseInt(employee?.id || '0', 10) || 0,
                  responsable: {
                    nombre: responsableNombreRef.current,
                    cedula: responsableCedulaRef.current,
                  },
                  firma_responsable: firmaResponsableBase64,
                  nombre_firma: '',
                  fecha: fechaEncuestaRef.current,
                  evaluaciones: evaluacionesJson,
                  observations: observacionesRef.current.trim() || '-',
                };

                cache.push(newSurveyCache);
                await AsyncStorage.setItem('surveys_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Encuesta registrada localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                const listScopeAfterOfflineCreate = getListScopeForRefresh();
                resetForm();
                await fetchSurveysList(listScopeAfterOfflineCreate, false);
              }
            } catch (err) {
              console.error('Error creating survey:', err);
              Alert.alert('Error', 'No se pudo crear la encuesta');
            } finally {
              setIsCreateSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const getFirmaResponsableBase64ForSave = (): string | null => {
    if (firmaResponsable) {
      return btoa(
        `${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`
      );
    }
    const stored =
      editingResponsableFirmaStored?.trim() || editingFirmaResponsableOriginalRef.current?.trim();
    if (!stored) return null;
    try {
      atob(stored);
      return stored;
    } catch {
      try {
        return btoa(stored);
      } catch {
        return stored;
      }
    }
  };

  const saveSurveyEdit = async () => {
    if (!editingSurvey) return;

    if (!empresaEvaluadaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre de la empresa evaluada');
      return;
    }
    if (!personaNombreRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre de la persona que llena la encuesta');
      return;
    }
    if (!personaCedulaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la cédula de la persona que llena la encuesta');
      return;
    }
    if (!personaTelefonoRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el teléfono de la persona que llena la encuesta');
      return;
    }
    if (!personaEmailRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el email de la persona que llena la encuesta');
      return;
    }
    if (!puestoIdRef.current || puestoIdRef.current === 0) {
      const fromForm = formPuestoId != null && Number(formPuestoId) > 0 ? Number(formPuestoId) : null;
      if (fromForm) puestoIdRef.current = fromForm;
    }
    if (!puestoIdRef.current || puestoIdRef.current === 0) {
      Alert.alert('Error', 'Debe seleccionar un puesto');
      return;
    }
    if (!fechaEncuestaRef.current) {
      Alert.alert('Error', 'Debe seleccionar la fecha de la encuesta');
      return;
    }
    if (selectedDivision !== 'Seguridad' && selectedDivision !== 'Aseo & Limpieza') {
      Alert.alert('Error', 'Debe seleccionar una división con formulario (Seguridad o Aseo & Limpieza).');
      return;
    }
    const formPayloadEdit = evaluationFormRef.current;
    if (!formPayloadEdit || !formPayloadEdit.form.length) {
      Alert.alert('Error', 'No hay formulario de evaluación.');
      return;
    }
    for (const sec of formPayloadEdit.form) {
      for (const q of sec.questions) {
        if (q.apply && (q.value < 1 || q.value > 5)) {
          Alert.alert('Error', 'Califique con 1 a 5 estrellas todas las preguntas marcadas como "Aplica".');
          return;
        }
      }
    }
    if (!responsableNombreRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre del responsable');
      return;
    }
    if (!responsableCedulaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la cédula del responsable');
      return;
    }
    if (!getFirmaResponsableBase64ForSave()) {
      Alert.alert('Error', 'La encuesta no tiene firma del responsable para conservar.');
      return;
    }

    Alert.alert('Confirmar cambios', '¿Está seguro de que desea guardar los cambios de esta encuesta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setIsEditSubmitting(true);
          try {
            const currentMarca = await AsyncStorage.getItem('current_marca');
            if (!currentMarca) {
              Alert.alert('Error', 'No se encontró la marca actual');
              return;
            }
            const currentMarcaData = JSON.parse(currentMarca);

            const evaluacionesJson = getEvaluationJsonForSave();
            if (!evaluacionesJson) {
              Alert.alert('Error', 'No se pudo preparar el formulario de evaluación.');
              return;
            }

            const personSignatureBase64 = personSignatureRef.current || personSignature || '';
            const firmaResponsableBase64 = getFirmaResponsableBase64ForSave();
            if (!firmaResponsableBase64) {
              Alert.alert('Error', 'No hay firma del responsable para enviar.');
              return;
            }

            const empresaId = formEmpresaId;
            const clienteId = formClienteId;
            const corpoId = formCorpoId;
            const puestoId = formPuestoId;
            let divisionId = formDivisionId;

            if (!divisionId && formClienteId) {
              const divisionName = selectedDivision;
              if (divisionName === 'Seguridad' || divisionName === 'Aseo & Limpieza') {
                for (const empresa of structure) {
                  for (const cliente of empresa.clientes || []) {
                    if (Number(cliente.id) === Number(formClienteId)) {
                      const division = getClienteDivisionArray(cliente).find((d: any) => {
                        const dName = d.nombre;
                        if (divisionName === 'Seguridad') {
                          return dName === 'Seguridad' || dName.toLowerCase().includes('seguridad');
                        }
                        if (divisionName === 'Aseo & Limpieza') {
                          return (
                            dName === 'Aseo & Limpieza' ||
                            dName === 'Aseo y limpieza' ||
                            dName.toLowerCase().includes('aseo') ||
                            dName.toLowerCase().includes('limpieza')
                          );
                        }
                        return false;
                      });
                      if (division) {
                        divisionId = division.id;
                        break;
                      }
                    }
                  }
                  if (divisionId) break;
                }
              }
            }

            let contratoId = formContratoId;
            if (corpoId && !contratoId) {
              contratoId = findContratoForSucursal(corpoId);
            }

            if (!empresaId || !clienteId || !divisionId || !corpoId || !puestoId) {
              Alert.alert(
                'Error',
                'Faltan datos de la jerarquía. Por favor, complete la selección de Empresa, Cliente, División, Sucursal y Puesto en el formulario.'
              );
              return;
            }

            const requestBody = {
              empresa_id: empresaId,
              cliente_id: clienteId,
              division_id: divisionId,
              corpo_id: corpoId,
              puesto_id: puestoId,
              contrato_id:
                contratoId != null && Number(contratoId) > 0 ? Number(contratoId) : 0,
              fecha: fechaEncuestaRef.current,
              evaluaciones: evaluacionesJson,
              persona_evaluada: personaNombreRef.current,
              cedula_persona_evaluada: personaCedulaRef.current,
              telefono_persona_evaluada: personaTelefonoRef.current,
              email_persona_evaluada: personaEmailRef.current,
              nombre_responsable: responsableNombreRef.current,
              cedula_responsable: responsableCedulaRef.current,
              firma_responsable: firmaResponsableBase64,
              firma_persona_evaluada: personSignatureBase64,
              observaciones: observacionesRef.current.trim() || '-',
              empresa_evaluada: empresaEvaluadaRef.current,
              division: divisionRef.current,
            };

            const editLabels = resolveHierarchyNamesFromStructure(
              structure,
              {
                empresaId: empresaId!,
                clienteId: clienteId!,
                divisionId: divisionId!,
                contratoId: contratoId ?? null,
                corpoId: corpoId!,
                puestoId: puestoId!,
              },
              puestosByCorpo[String(corpoId!)] ?? []
            );

            const survey = editingSurvey;

            if (survey.id > 0) {
              const isConnected = await getConnectionStatus();
              if (isConnected) {
                const data = await updateSurveyAPI({
                  surveyId: survey.id,
                  requestData: requestBody,
                  refreshAccessToken,
                  logout,
                });
                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Encuesta actualizada correctamente');
                  setEditingSurvey(null);
                  const listScopeAfterEdit = getListScopeForRefresh();
                  resetForm();
                  await fetchSurveysList(listScopeAfterEdit, true);
                } else {
                  Alert.alert('Error', data.message || 'Error al actualizar la encuesta');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('surveys_actions');
                let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
                if (!Array.isArray(actions)) actions = [];
                actions = stripQueuedSurveyUpdatesForServerId(actions, survey.id);
                actions.push({
                  type: 'update',
                  surveyId: survey.id,
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                });
                await AsyncStorage.setItem('surveys_actions', JSON.stringify(actions));
                const cacheStr = await AsyncStorage.getItem('surveys_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updated = cache.map((s: Survey) => {
                    if (s.id !== survey.id) return s;
                    return {
                      ...s,
                      ...{
                        persona_evaluada: personaNombreRef.current,
                        empresa_evaluada: empresaEvaluadaRef.current,
                        cedula_persona_evaluada: personaCedulaRef.current,
                        telefono_persona_evaluada: personaTelefonoRef.current,
                        email_persona_evaluada: personaEmailRef.current,
                        firma_persona_evaluada: personSignatureBase64,
                        firma_responsable: firmaResponsableBase64,
                        fecha: fechaEncuestaRef.current,
                        evaluaciones: evaluacionesJson,
                        observations: observacionesRef.current.trim() || '-',
                        empresa: editLabels.empresa,
                        cliente: editLabels.cliente,
                        division: editLabels.division,
                        sucursal: editLabels.sucursal,
                        puesto: editLabels.puesto,
                        contrato_id:
                          contratoId != null && Number(contratoId) > 0 ? Number(contratoId) : 0,
                        responsable: {
                          nombre: responsableNombreRef.current,
                          cedula: responsableCedulaRef.current,
                        },
                      },
                    };
                  });
                  await AsyncStorage.setItem('surveys_cache', JSON.stringify(updated));
                }
                Alert.alert('Modo Offline', 'Cambios guardados localmente. Se sincronizarán al recuperar conexión.');
                setEditingSurvey(null);
                const listScopeAfterOfflineEdit = getListScopeForRefresh();
                resetForm();
                await fetchSurveysList(listScopeAfterOfflineEdit, false);
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('surveys_actions');
              let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
              if (!Array.isArray(actions)) actions = [];
              actions = stripErroneousSurveyUpdatesForDraftId(actions, survey.id_local);
              const idx = actions.findIndex(
                (a: any) => a.type === 'create' && String(a.id) === String(survey.id_local)
              );
              if (idx < 0) {
                Alert.alert('Error', 'No se encontró el borrador local para actualizar.');
                return;
              }
              const offlineBody = {
                ...requestBody,
                marca_id: currentMarcaData.id,
              };
              actions[idx].requestData = offlineBody;
              await AsyncStorage.setItem('surveys_actions', JSON.stringify(actions));
              const cacheStr = await AsyncStorage.getItem('surveys_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updated = cache.map((s: Survey) => {
                  if (s.id_local !== survey.id_local) return s;
                  return {
                    ...s,
                    persona_evaluada: personaNombreRef.current,
                    empresa_evaluada: empresaEvaluadaRef.current,
                    cedula_persona_evaluada: personaCedulaRef.current,
                    telefono_persona_evaluada: personaTelefonoRef.current,
                    email_persona_evaluada: personaEmailRef.current,
                    firma_persona_evaluada: personSignatureBase64,
                    firma_responsable: firmaResponsableBase64,
                    fecha: fechaEncuestaRef.current,
                    evaluaciones: evaluacionesJson,
                    observations: observacionesRef.current.trim() || '-',
                    empresa: editLabels.empresa,
                    cliente: editLabels.cliente,
                    division: editLabels.division,
                    sucursal: editLabels.sucursal,
                    puesto: editLabels.puesto,
                    contrato_id:
                      contratoId != null && Number(contratoId) > 0 ? Number(contratoId) : 0,
                    responsable: {
                      nombre: responsableNombreRef.current,
                      cedula: responsableCedulaRef.current,
                    },
                  };
                });
                await AsyncStorage.setItem('surveys_cache', JSON.stringify(updated));
              }
              Alert.alert('Éxito', 'Borrador actualizado.');
              setEditingSurvey(null);
              const listScopeAfterDraft = getListScopeForRefresh();
              resetForm();
              await fetchSurveysList(listScopeAfterDraft, false);
            }
          } catch (err) {
            console.error('Error updating survey:', err);
            Alert.alert('Error', 'No se pudo guardar la encuesta');
          } finally {
            setIsEditSubmitting(false);
          }
        },
      },
    ]);
  };

  const confirmDeleteSurvey = (survey: Survey) => {
    const rowKey = surveyExpandKey(survey);
    Alert.alert('Eliminar encuesta', '¿Está seguro de que desea eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setDeletingSurveyKey(rowKey);
          try {
            if (survey.id > 0) {
              const isConnected = await getConnectionStatus();
              if (isConnected) {
                const res = await deleteSurveyAPI({
                  surveyId: survey.id,
                  refreshAccessToken,
                  logout,
                });
                if (res.status) {
                  Alert.alert('Éxito', res.message || 'Encuesta eliminada');
                  await fetchSurveysList(getListScopeForRefresh(), false);
                } else {
                  Alert.alert('Error', res.message || 'No se pudo eliminar');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('surveys_actions');
                let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
                if (!Array.isArray(actions)) actions = [];
                actions = stripQueuedSurveyUpdatesAndDeletesForServerId(actions, survey.id);
                actions.push({ type: 'delete', surveyId: survey.id });
                await AsyncStorage.setItem('surveys_actions', JSON.stringify(actions));
                const cacheStr = await AsyncStorage.getItem('surveys_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  await AsyncStorage.setItem(
                    'surveys_cache',
                    JSON.stringify(cache.filter((s: Survey) => s.id !== survey.id))
                  );
                }
                Alert.alert('Modo Offline', 'Eliminación pendiente de sincronización.');
                await fetchSurveysList(getListScopeForRefresh(), false);
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('surveys_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const filtered = stripQueuedSurveyDraftActions(
                Array.isArray(actions) ? actions : [],
                survey.id_local
              );
              if (filtered.length === 0) await AsyncStorage.removeItem('surveys_actions');
              else await AsyncStorage.setItem('surveys_actions', JSON.stringify(filtered));
              const cacheStr = await AsyncStorage.getItem('surveys_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                await AsyncStorage.setItem(
                  'surveys_cache',
                  JSON.stringify(cache.filter((s: Survey) => s.id_local !== survey.id_local))
                );
              }
              Alert.alert('Éxito', 'Registro local eliminado.');
              await fetchSurveysList(getListScopeForRefresh(), false);
            }
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo eliminar la encuesta');
          } finally {
            setDeletingSurveyKey(null);
          }
        },
      },
    ]);
  };

  const generateDateTime = (timestamp: string) => {
    const empFirmaFecha = new Date(parseInt(timestamp)).toISOString();
    const evalFirmaFecha = new Date(parseInt(timestamp)).toISOString();

    let empFirmaFechaSplit = empFirmaFecha.split('T');
    let evalFirmaFechaSplit = evalFirmaFecha.split('T');

    empFirmaFechaSplit[1] = empFirmaFechaSplit[1].split('.')[0];
    evalFirmaFechaSplit[1] = evalFirmaFechaSplit[1].split('.')[0];

    return empFirmaFechaSplit[0] + ' ' + empFirmaFechaSplit[1];
  };

  const handleSignature = (signature: string) => {
    // Guardar temporalmente cuando se dibuja en el modal
    setTempSignature(signature);
  };

  const openSignatureModal = () => {
    setIsSignatureModalVisible(true);
    setTempSignature(null); // Reset temporal signature
    setSignatureKey(prev => prev + 1); // Reset canvas
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setTempSignature(null);
    setSignatureKey(prev => prev + 1); // Reset canvas
  };

  const clearSignatureInModal = () => {
    setTempSignature(null);
    setSignatureKey(prev => prev + 1); // Force re-render of canvas
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const acceptSignature = () => {
    // Leer la firma actual del canvas
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else if (tempSignature) {
      // Si ya tenemos una firma temporal, usarla
      setPersonSignature(tempSignature);
      personSignatureRef.current = tempSignature;
      setIsSignatureModalVisible(false);
    } else {
      Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
    }
  };

  const handleSignatureRead = (signature: string) => {
    // Esta función se llama cuando readSignature() completa
    if (signature) {
      setPersonSignature(signature);
      personSignatureRef.current = signature;
      setIsSignatureModalVisible(false);
      setTempSignature(null);
    } else {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
    }
  };

  const removeSignature = () => {
    Alert.alert(
      'Confirmar',
      '¿Está seguro de que desea eliminar la firma?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setPersonSignature(null);
            personSignatureRef.current = null;
          }
        }
      ]
    );
  };

  const openAddSignatureModal = (survey: Survey) => {
    setAddSignatureSurvey(survey);
    setAddSignatureManualKey((k) => k + 1);
    setAddSignatureModalVisible(true);
  };

  const closeAddSignatureModal = () => {
    setAddSignatureModalVisible(false);
    setAddSignatureSurvey(null);
  };

  const triggerAddSignatureManualRead = () => {
    try {
      addSignatureManualRef.current?.readSignature?.();
    } catch {
      Alert.alert('Error', 'No se pudo leer la firma. Dibuje primero en el recuadro.');
    }
  };

  const handleAddSignatureManualRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      return;
    }
    const survey = addSignatureSurvey;
    if (!survey) return;
    if (Number(survey.id) <= 0 && String(survey.id_local || '').trim() === '') return;

    Alert.alert(
      'Confirmar',
      '¿Guardar esta firma de la persona evaluada en el registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setIsAddSignatureSubmitting(true);
            try {
              const isConnected = await getConnectionStatus();
              const isServerRow = Number(survey.id) > 0;
              const personaUri = sig.startsWith('data:') ? sig : `data:image/png;base64,${sig}`;

              if (isConnected && isServerRow) {
                const result = await updateSurveySignature({
                  surveyId: survey.id,
                  field: 'firma_persona_evaluada',
                  value: sig,
                  refreshAccessToken,
                  logout,
                });
                if (result.status) {
                  setDecodedFirmas((prev) => {
                    const next = new Map(prev);
                    const ek = surveyExpandKey(survey);
                    const existing = next.get(ek) || { responsable: null, persona: null };
                    next.set(ek, { ...existing, persona: personaUri });
                    return next;
                  });
                  closeAddSignatureModal();
                  await fetchSurveysList(getListScopeForRefresh(), true);
                  Alert.alert('Éxito', result.message || 'Firma actualizada correctamente');
                } else {
                  Alert.alert('Error', result.message || 'No se pudo actualizar la firma.');
                }
                return;
              }

              // Sin conexión o borrador no sincronizado (id local): caché + cola
              await persistFirmaPersonaInSurveyCache(survey, sig);
              await persistFirmaPersonaInSurveyActionsQueue(survey, sig);
              setDecodedFirmas((prev) => {
                const next = new Map(prev);
                const ek = surveyExpandKey(survey);
                const existing = next.get(ek) || { responsable: null, persona: null };
                next.set(ek, { ...existing, persona: personaUri });
                return next;
              });
              closeAddSignatureModal();
              await fetchSurveysList(getListScopeForRefresh(), false);
              const msg =
                isServerRow && !isConnected
                  ? 'Firma guardada localmente. Se enviará al recuperar conexión.'
                  : 'Firma guardada en el borrador. Se sincronizará con el registro al enviar la encuesta.';
              Alert.alert('Éxito', msg);
            } catch (e) {
              Alert.alert('Error', (e instanceof Error ? e.message : 'No se pudo guardar la firma.'));
            } finally {
              setIsAddSignatureSubmitting(false);
            }
          },
        },
      ]
    );
  };

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
      margin: 0;
      padding: 0;
      box-shadow: none;
      border: none;
      background-color: #FFFFFF;
    }
    .m-signature-pad--body {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: none;
      margin: 0;
      padding: 0;
    }
    .m-signature-pad--body canvas {
      width: 100% !important;
      height: 200px !important;
    }
    .m-signature-pad--footer {
      display: none;
    }
  `;

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'files': return <Ionicons name="mail" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#000000' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      default: return <Ionicons name="close" size={24} color='#FFFFFF' />;
    }
  };


  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const toggleSurveyExpansion = async (survey: Survey) => {
    const key = surveyExpandKey(survey);
    const isExpanded = expandedSurveys.has(key);

    if (isExpanded) {
      const newExpanded = new Set(expandedSurveys);
      newExpanded.delete(key);
      setExpandedSurveys(newExpanded);
    } else {
      const newExpanded = new Set(expandedSurveys);
      newExpanded.add(key);
      setExpandedSurveys(newExpanded);

      if (!decodedFirmas.has(key)) {
        try {
          let responsableFirma: FirmaData | null = null;
          if (survey.firma_responsable) {
            responsableFirma = await decodeFirma(survey.firma_responsable);
          }

          let personaFirma: string | null = null;
          if (survey.firma_persona_evaluada) {
            const firma = survey.firma_persona_evaluada.trim();
            personaFirma = firma.startsWith('data:')
              ? firma
              : `data:image/png;base64,${firma}`;
          }

          setDecodedFirmas(prev => {
            const newMap = new Map(prev);
            newMap.set(key, { responsable: responsableFirma, persona: personaFirma });
            return newMap;
          });
        } catch (error) {
          console.error('Error decoding firmas:', error);
        }
      }
    }
  };

  const formatDateTime = (timestamp: string): string => {
    try {
      const date = new Date(parseInt(timestamp));
      return date.toLocaleString();
    } catch (error) {
      return timestamp;
    }
  };


  if (isCheckingMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Encuestas de Satisfacción" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Encuestas de Satisfacción" />

      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.scrollContent}>
          <ThemedView style={styles.contentContainer}>
            <ThemedView style={styles.titleContainer}>
              <ThemedText style={styles.title}>{getActionIcon('files')} Encuestas de Satisfacción</ThemedText>
              <ThemedText style={styles.subtitle}>Gestión de encuestas NPS</ThemedText>
            </ThemedView>

            {!hasCurrentMarca && (
              <ThemedView style={styles.noMarcaContainer}>
                <ThemedText style={styles.noMarcaMessage}>
                  No hay marca activa. Puede seleccionar la jerarquía manualmente en los filtros y el formulario.
                </ThemedText>
              </ThemedView>
            )}

            {!isCreating && !editingSurvey && (
              <>
                {/* Filters */}
                <ThemedView style={styles.filtersContainer}>
                  <ThemedView style={styles.filtersHeader}>
                    <TouchableOpacity
                      style={styles.filterToggleButton}
                      onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    >
                      <ThemedText style={styles.filtersTitle}>
                        Filtros
                      </ThemedText>
                      <Ionicons
                        name={isFiltersExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {isFiltersExpanded && (
                      <TouchableOpacity
                        style={styles.resetFiltersButton}
                        onPress={resetAllFilters}
                      >
                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                      </TouchableOpacity>
                    )}
                  </ThemedView>

                  {/* Filter Content */}
                  {isFiltersExpanded && (
                    <ThemedView style={styles.filtersContent}>
                      <ThemedText style={styles.filterLabel}>
                        Ubicación del listado (empresa → sucursal)
                      </ThemedText>
                      {isStructureLoading && structure.length === 0 ? (
                        <ThemedView style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color="#007AFF" />
                          <ThemedText style={styles.loadingText}>Cargando estructura...</ThemedText>
                        </ThemedView>
                      ) : structure.length === 0 ? (
                        <ThemedText style={styles.noMarcaMessage}>Sin estructura en caché.</ThemedText>
                      ) : (
                        <HierarchyPickerFields
                          structure={structure}
                          levels={['cliente', 'contrato', 'sucursal']}
                          isLoading={isStructureLoading && structure.length === 0}
                          emptyPickerValue={0}
                          values={{
                            empresaId: filterEmpresaId,
                            clienteId: filterClienteId,
                            divisionId: filterDivisionId,
                            contratoId: filterContratoId,
                            sucursalId: filterCorpoId,
                          }}
                          onChange={handleFilterHierarchyChange}
                          labels={{ sucursal: 'Sucursal (corpo)' }}
                          renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                          pickerStyle={styles.picker}
                          fieldGroupStyle={styles.filterGroup}
                        />
                      )}

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowFilterFechaPicker(true)}
                        >
                          <ThemedText style={styles.dateButtonText}>
                            {filterFecha ? formatDateForDisplay(filterFecha) : 'Seleccionar fecha'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                        </TouchableOpacity>
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterPersonaEvaluada}
                          onChangeText={setFilterPersonaEvaluada}
                          placeholder="Buscar por nombre..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Cédula persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterCedulaPersonaEvaluada}
                          onChangeText={setFilterCedulaPersonaEvaluada}
                          placeholder="Buscar por cédula..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Teléfono persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterTelefonoPersonaEvaluada}
                          onChangeText={setFilterTelefonoPersonaEvaluada}
                          placeholder="Buscar por teléfono..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Email persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterEmailPersonaEvaluada}
                          onChangeText={setFilterEmailPersonaEvaluada}
                          placeholder="Buscar por email..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Responsable - Nombre:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterResponsableNombre}
                          onChangeText={setFilterResponsableNombre}
                          placeholder="Buscar por nombre..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Responsable - Cédula:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterResponsableCedula}
                          onChangeText={setFilterResponsableCedula}
                          placeholder="Buscar por cédula..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Observaciones:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterObservations}
                          onChangeText={setFilterObservations}
                          placeholder="Buscar en observaciones..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>
                    </ThemedView>
                  )}
                </ThemedView>

                <TouchableOpacity
                  style={styles.createButton}
                  onPress={startCreating}
                >
                  <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
                </TouchableOpacity>

                {isListLoading && (
                  <ThemedView style={styles.listLoadingRow}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <ThemedText style={styles.listLoadingText}>Cargando encuestas...</ThemedText>
                  </ThemedView>
                )}

                {filteredSurveys.length === 0 ? (
                  <ThemedView style={styles.emptyContainer}>
                    <ThemedText style={styles.emptyText}>
                      {surveys.length === 0 ? 'No hay encuestas registradas' : 'No se encontraron encuestas con los filtros aplicados'}
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.surveysList}>
                    {filteredSurveys.map((survey) => {
                      const rowKey = surveyExpandKey(survey);
                      const isExpanded = expandedSurveys.has(rowKey);
                      const firmasData = decodedFirmas.get(rowKey);

                      const evalParsed = tryParseEvaluacionesForDisplay(survey.evaluaciones);

                      return (
                        <ThemedView key={rowKey} style={styles.surveyCard}>
                          <ThemedView style={styles.surveyHeader}>
                            <ThemedText style={styles.surveyTitle} numberOfLines={3}>
                              {survey.empresa_evaluada}
                            </ThemedText>
                          </ThemedView>

                          {/* Basic info - always visible */}
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>Fecha: </ThemedText>
                            {formatDateForDisplay(survey.fecha)}
                          </ThemedText>
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>Empresa evaluada: </ThemedText>
                            {survey.empresa_evaluada}
                          </ThemedText>
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>Puesto: </ThemedText>
                            {survey.puesto?.nombre || 'N/A'}
                          </ThemedText>

                          {/* Collapsable Button */}
                          <TouchableOpacity
                            style={styles.collapseButton}
                            onPress={() => toggleSurveyExpansion(survey)}
                          >
                            <ThemedText style={styles.collapseButtonText}>
                              {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                            </ThemedText>
                            <Ionicons
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={20}
                              color="#007AFF"
                            />
                          </TouchableOpacity>

                          {/* Collapsable Content */}
                          {isExpanded && (
                            <ThemedView style={styles.collapsableContent}>
                              {/* Persona evaluada */}
                              <ThemedView style={styles.personaContainer}>
                                <ThemedText style={styles.personaTitle}>Persona evaluada:</ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Nombre: </ThemedText>
                                  {survey.persona_evaluada}
                                </ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Cédula: </ThemedText>
                                  {survey.cedula_persona_evaluada}
                                </ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Teléfono: </ThemedText>
                                  {survey.telefono_persona_evaluada}
                                </ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Email: </ThemedText>
                                  {survey.email_persona_evaluada}
                                </ThemedText>
                              </ThemedView>

                              {/* Firmas */}
                              {firmasData ? (
                                <>
                                  {/* Firma responsable */}
                                  {firmasData.responsable && (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma del Responsable:</ThemedText>
                                      {firmasData.responsable.empleadoDetalle ? (
                                        <ThemedText style={styles.firmaText}>
                                          {firmasData.responsable.empleadoDetalle.nombre} {firmasData.responsable.empleadoDetalle.primer_apellido} {firmasData.responsable.empleadoDetalle.segundo_apellido}
                                        </ThemedText>
                                      ) : (
                                        <ThemedText style={styles.firmaText}>
                                          ID: {firmasData.responsable.empleadoId}
                                        </ThemedText>
                                      )}
                                      <ThemedText style={styles.firmaText}>
                                        Ubicación: {parseFloat(firmasData.responsable.latitud).toFixed(6)}, {parseFloat(firmasData.responsable.longitud).toFixed(6)}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Hora y fecha: {convertDateTimestampToLocalString(new Date(Number(firmasData.responsable.timestamp)).toISOString())}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Sesión: {firmasData.responsable.sessionId}
                                      </ThemedText>
                                    </ThemedView>
                                  )}

                                  {/* Firma persona evaluada */}
                                  {firmasData.persona ? (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma de la Persona Evaluada:</ThemedText>
                                      <ThemedView style={styles.signatureImageContainer}>
                                        <Image
                                          source={{ uri: firmasData.persona }}
                                          style={styles.signatureImage}
                                          resizeMode="contain"
                                          onError={(error) => {
                                            console.error('Error loading signature image:', error);
                                          }}
                                        />
                                      </ThemedView>
                                    </ThemedView>
                                  ) : (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma de la Persona Evaluada:</ThemedText>
                                      <ThemedText style={styles.emptyText}>No hay firma de la persona evaluada registrada</ThemedText>
                                      {(Number(survey.id) > 0 || String(survey.id_local || '').trim() !== '') && (
                                        <TouchableOpacity
                                          style={[styles.signatureButton, { marginTop: 8 }]}
                                          onPress={() => openAddSignatureModal(survey)}
                                        >
                                          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                                          <ThemedText style={styles.signatureButtonText}>Añadir firma persona evaluada</ThemedText>
                                        </TouchableOpacity>
                                      )}
                                    </ThemedView>
                                  )}
                                </>
                              ) : (
                                <ThemedText style={styles.loadingText}>Cargando firmas...</ThemedText>
                              )}

                              {/* Responsable */}
                              <ThemedView style={styles.responsableContainer}>
                                <ThemedText style={styles.responsableTitle}>Responsable:</ThemedText>
                                <ThemedText style={styles.responsableText}>
                                  <ThemedText style={styles.responsableLabel}>Nombre: </ThemedText>
                                  {survey.responsable?.nombre || 'N/A'}
                                </ThemedText>
                                <ThemedText style={styles.responsableText}>
                                  <ThemedText style={styles.responsableLabel}>Cédula: </ThemedText>
                                  {survey.responsable?.cedula || 'N/A'}
                                </ThemedText>
                              </ThemedView>

                              {/* Evaluaciones */}
                              {evalParsed.kind === 'legacy' && evalParsed.rows.length > 0 && (
                                <ThemedView style={styles.evaluacionesContainer}>
                                  <ThemedText style={styles.evaluacionesTitle}>Evaluaciones:</ThemedText>
                                  {evalParsed.rows.map((evaluacion, index) => (
                                    <ThemedView key={index} style={styles.evaluacionItem}>
                                      <ThemedText style={styles.evaluacionQuestion}>{evaluacion.question}</ThemedText>
                                      <ThemedText style={styles.evaluacionResult}>Respuesta: {evaluacion.value}</ThemedText>
                                    </ThemedView>
                                  ))}
                                </ThemedView>
                              )}
                              {evalParsed.kind === 'new' && (
                                <ThemedView style={styles.evaluacionesContainer}>
                                  <ThemedText style={styles.evaluacionesTitle}>Evaluaciones:</ThemedText>
                                  {evalParsed.payload.form.map((sec, si) => (
                                    <ThemedView key={`sec-${si}`} style={styles.evalFormSection}>
                                      <ThemedText style={styles.evalFormSectionTitle}>{sec.section_title}</ThemedText>
                                      {sec.questions.map((q, qi) => (
                                        <ThemedView key={`q-${si}-${qi}`} style={styles.evalFormQuestionBlock}>
                                          <ThemedText style={styles.evalFormQuestionText}>{q.question}</ThemedText>
                                          <ThemedText style={styles.evaluacionResult}>
                                            Aplica: {q.apply ? 'Sí' : 'No'}
                                            {q.apply ? ` — Calificación: ${q.value} / 5` : ' — Calificación: N/A (0)'}
                                          </ThemedText>
                                        </ThemedView>
                                      ))}
                                      {sec.observations.trim().length > 0 && (
                                        <>
                                          <ThemedText style={styles.evalFormObsLabel}>Observaciones de la sección</ThemedText>
                                          <ThemedText style={styles.observacionesText}>{sec.observations}</ThemedText>
                                        </>
                                      )}
                                    </ThemedView>
                                  ))}
                                  <ThemedView style={[styles.evalKnowProcessRow, { marginTop: 8 }]}>
                                    <ThemedText style={styles.evaluacionResult}>
                                      ¿Conoce el procedimiento de atención de quejas de la compañía?:{' '}
                                      {evalParsed.payload.know_process ? 'Sí' : 'No'}
                                    </ThemedText>
                                  </ThemedView>
                                </ThemedView>
                              )}

                              {/* Observaciones */}
                              {survey.observations && (
                                <ThemedView style={styles.observacionesContainer}>
                                  <ThemedText style={styles.observacionesLabel}>Observaciones:</ThemedText>
                                  <ThemedText style={styles.observacionesText}>{survey.observations}</ThemedText>
                                </ThemedView>
                              )}
                            </ThemedView>
                          )}

                          <ThemedView style={styles.listItemButtons}>
                            <TouchableOpacity
                              style={[styles.listItemButton, styles.editButton]}
                              onPress={() => startEditing(survey)}
                            >
                              <Ionicons name="pencil" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                            {survey.id > 0 && (
                              <TouchableOpacity
                                style={[styles.listItemButton, styles.changesButton]}
                                onPress={() => {
                                  setCambiosTitle(`Cambios - Encuesta #${survey.id}`);
                                  fetchCambios('c_encuesta_cliente', Number(survey.id));
                                }}
                              >
                                <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={[
                                styles.listItemButton,
                                styles.deleteButton,
                                deletingSurveyKey !== null && styles.buttonDisabled,
                              ]}
                              onPress={() => confirmDeleteSurvey(survey)}
                              disabled={deletingSurveyKey !== null}
                            >
                              {deletingSurveyKey === rowKey ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Ionicons name="trash" size={18} color="#FFFFFF" />
                              )}
                            </TouchableOpacity>
                          </ThemedView>
                        </ThemedView>
                      );
                    })}
                  </ThemedView>
                )}
              </>
            )}

            {(isCreating || editingSurvey) && (
              <ThemedView style={styles.formCard}>
                <ThemedView style={styles.formContainer}>
                  <ThemedText style={styles.formTitle}>
                    {editingSurvey ? 'Modificar encuesta' : 'Nueva Encuesta'}
                  </ThemedText>

                  {/* Jerarquía completa */}
                  <ThemedView style={styles.sectionContainer}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>Jerarquía</ThemedText>
                    </ThemedView>

                    {isStructureLoading && structure.length === 0 ? (
                      <ThemedView style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#007AFF" />
                        <ThemedText style={styles.loadingText}>Cargando estructura...</ThemedText>
                      </ThemedView>
                    ) : structure.length === 0 ? (
                      <ThemedText style={styles.noMarcaMessage}>Sin estructura en caché.</ThemedText>
                    ) : (
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                        isLoading={isStructureLoading && structure.length === 0}
                        emptyPickerValue={0}
                        values={{
                          empresaId: formEmpresaId,
                          clienteId: formClienteId,
                          divisionId: formDivisionId,
                          contratoId: formContratoId,
                          sucursalId: formCorpoId,
                          puestoId: formPuestoId,
                        }}
                        onChange={handleFormHierarchyChange}
                        labels={{
                          empresa: 'Empresa *',
                          cliente: 'Cliente *',
                          division: 'División *',
                          contrato: 'Contrato *',
                          sucursal: 'Sucursal *',
                          puesto: 'Puesto *',
                        }}
                        renderLabel={(text) => <ThemedText style={styles.label}>{text}</ThemedText>}
                        pickerStyle={styles.picker}
                        fieldGroupStyle={styles.formGroup}
                      />
                    )}
                    {formDivisionId && selectedDivision !== 'Seguridad' && selectedDivision !== 'Aseo & Limpieza' && (
                      <ThemedView style={styles.warningBox}>
                        <Ionicons name="warning" size={20} color="#FF9500" />
                        <ThemedText style={styles.warningText}>
                          No existe un formulario para esta división. Solo están disponibles formularios para las divisiones Seguridad y Aseo & Limpieza.
                        </ThemedText>
                      </ThemedView>
                    )}
                  </ThemedView>

                  {/* Empresa Evaluada */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>Nombre de la empresa evaluada:</ThemedText>
                    <TextInput
                      ref={empresaEvaluadaInputRef}
                      style={styles.input}
                      defaultValue={empresaEvaluadaRef.current}
                      onChangeText={(text) => { empresaEvaluadaRef.current = text; }}
                      placeholder="Nombre de la empresa"
                      placeholderTextColor="#999"
                      key={`empresa-${formKey}`}
                    />
                  </ThemedView>

                  {/* Persona que llena la encuesta */}
                  <ThemedView style={styles.sectionContainer}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>Persona que llena la encuesta</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Nombre:</ThemedText>
                      <TextInput
                        ref={personaNombreInputRef}
                        style={styles.input}
                        defaultValue={personaNombreRef.current}
                        onChangeText={(text) => { personaNombreRef.current = text; }}
                        placeholder="Nombre completo"
                        placeholderTextColor="#999"
                        key={`persona-nombre-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Cédula:</ThemedText>
                      <TextInput
                        ref={personaCedulaInputRef}
                        style={styles.input}
                        defaultValue={personaCedulaRef.current}
                        onChangeText={(text) => { personaCedulaRef.current = text; }}
                        placeholder="Cédula"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        key={`persona-cedula-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Teléfono:</ThemedText>
                      <TextInput
                        ref={personaTelefonoInputRef}
                        style={styles.input}
                        defaultValue={personaTelefonoRef.current}
                        onChangeText={(text) => { personaTelefonoRef.current = text; }}
                        placeholder="Teléfono"
                        placeholderTextColor="#999"
                        keyboardType="phone-pad"
                        key={`persona-telefono-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Email:</ThemedText>
                      <TextInput
                        ref={personaEmailInputRef}
                        style={styles.input}
                        defaultValue={personaEmailRef.current}
                        onChangeText={(text) => { personaEmailRef.current = text; }}
                        placeholder="Email"
                        placeholderTextColor="#999"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        key={`persona-email-${formKey}`}
                      />
                    </ThemedView>
                  </ThemedView>

                  {/* Fecha */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>Fecha de la encuesta:</ThemedText>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFechaEncuestaPicker(true)}
                    >
                      <ThemedText style={styles.dateButtonText}>
                        {formatDateForDisplay(fechaEncuestaRef.current) || 'Seleccionar fecha'}
                      </ThemedText>
                    </TouchableOpacity>
                    {showFechaEncuestaPicker && (
                      <DateTimePicker
                        value={fechaEncuesta}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowFechaEncuestaPicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setFechaEncuesta(selectedDate);
                            fechaEncuestaRef.current = formatDateToISO(selectedDate);
                          }
                        }}
                      />
                    )}
                  </ThemedView>

                  {/* Evaluación estructurada */}
                  {formDivisionId && (selectedDivision === 'Seguridad' || selectedDivision === 'Aseo & Limpieza') && evaluationForm && (
                    <ThemedView style={styles.sectionContainer}>
                      <ThemedView style={styles.sectionHeader}>
                        <ThemedText style={styles.sectionTitle}>Evaluación</ThemedText>
                      </ThemedView>
                      {evaluationForm.form.map((sec, sectionIndex) => (
                        <ThemedView key={`eval-sec-${formKey}-${sectionIndex}`} style={styles.evalFormSection}>
                          <ThemedText style={styles.evalFormSectionTitle}>{sec.section_title}</ThemedText>
                          {sec.questions.map((q, qIndex) => (
                            <ThemedView key={`eval-q-${sectionIndex}-${qIndex}`} style={styles.evalFormQuestionBlock}>
                              <TouchableOpacity
                                style={styles.evalFormApplyRow}
                                onPress={() => {
                                  patchEvaluationForm((d) => {
                                    const row = d.form[sectionIndex]?.questions[qIndex];
                                    if (!row) return;
                                    row.apply = !row.apply;
                                    row.value = row.apply ? (row.value >= 1 && row.value <= 5 ? row.value : 5) : 0;
                                  });
                                }}
                              >
                                <Ionicons
                                  name={q.apply ? 'checkbox' : 'square-outline'}
                                  size={22}
                                  color="#007AFF"
                                />
                                <ThemedText style={styles.evalFormApplyLabel}>Aplica</ThemedText>
                              </TouchableOpacity>
                              <ThemedText style={styles.evalFormQuestionText}>{q.question}</ThemedText>
                              {q.apply ? (
                                <ThemedView style={styles.starsContainer}>
                                  {[0, 1, 2, 3, 4].map((starIdx) => (
                                    <TouchableOpacity
                                      key={starIdx}
                                      onPress={() => {
                                        patchEvaluationForm((d) => {
                                          const row = d.form[sectionIndex]?.questions[qIndex];
                                          if (row) row.value = starIdx + 1;
                                        });
                                      }}
                                    >
                                      <Ionicons
                                        name={starIdx < q.value ? 'star' : 'star-outline'}
                                        size={28}
                                        color="#FFD700"
                                      />
                                    </TouchableOpacity>
                                  ))}
                                </ThemedView>
                              ) : null}
                            </ThemedView>
                          ))}
                          <ThemedText style={styles.evalFormObsLabel}>Observaciones</ThemedText>
                          <TextInput
                            style={[styles.input, styles.textArea]}
                            value={sec.observations}
                            onChangeText={(text) => {
                              patchEvaluationForm((d) => {
                                if (d.form[sectionIndex]) d.form[sectionIndex].observations = text;
                              });
                            }}
                            placeholder="Observaciones de esta sección"
                            placeholderTextColor="#999"
                            multiline
                          />
                          <TouchableOpacity
                            style={styles.evalAddQuestionBtn}
                            onPress={() => openAddQuestionModal(sectionIndex)}
                          >
                            <ThemedText style={styles.evalAddQuestionBtnText}>Agregar pregunta</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      ))}
                      <TouchableOpacity
                        style={styles.evalKnowProcessRow}
                        onPress={() => {
                          patchEvaluationForm((d) => {
                            d.know_process = !d.know_process;
                          });
                        }}
                      >
                        <Ionicons
                          name={evaluationForm.know_process ? 'checkbox' : 'square-outline'}
                          size={22}
                          color="#007AFF"
                        />
                        <ThemedText style={styles.evalKnowProcessText}>
                          ¿Conoce el procedimiento de atención de quejas de la compañía?
                        </ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  )}

                  <Modal
                    visible={addQuestionModalVisible}
                    animationType="fade"
                    transparent
                    onRequestClose={closeAddQuestionModal}
                  >
                    <View style={styles.addQuestionModalBackdrop}>
                      <View style={styles.addQuestionModalCard}>
                        <ThemedText style={styles.addQuestionModalTitle}>Nueva pregunta</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={addQuestionDraft}
                          onChangeText={setAddQuestionDraft}
                          placeholder="Texto de la pregunta"
                          placeholderTextColor="#999"
                          multiline
                        />
                        <ThemedView style={styles.evalModalActions}>
                          <TouchableOpacity onPress={closeAddQuestionModal}>
                            <ThemedText style={styles.evalModalCancelText}>Cancelar</ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={requestAddQuestionSubmit}>
                            <ThemedText style={styles.evalModalAcceptText}>Aceptar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      </View>
                    </View>
                  </Modal>

                  {/* Observaciones */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>
                      Agradecemos nos indique si existe algún punto de mejora para nuestro servicio:
                    </ThemedText>
                    <TextInput
                      ref={observacionesInputRef}
                      style={[styles.input, styles.textArea]}
                      defaultValue={observacionesRef.current}
                      onChangeText={(text) => { observacionesRef.current = text; }}
                      placeholder="Observaciones"
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={4}
                      key={`observaciones-${formKey}`}
                    />
                  </ThemedView>

                  {/* Firma persona evaluada (opcional) */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>Firma de la persona que realiza la encuesta (opcional):</ThemedText>

                    {personSignature ? (
                      <ThemedView style={styles.signaturePreviewContainer}>
                        <Image
                          source={{ uri: personSignature }}
                          style={styles.signaturePreview}
                          resizeMode="contain"
                        />
                        <TouchableOpacity style={styles.removeSignatureButton} onPress={removeSignature}>
                          {getActionIcon('delete')}
                        </TouchableOpacity>
                      </ThemedView>
                    ) : null}

                    <TouchableOpacity style={styles.openSignatureButton} onPress={openSignatureModal}>
                      <Ionicons name="create-outline" size={20} color="#000000" />
                      <ThemedText style={styles.openSignatureButtonText}>
                        {personSignature ? 'Modificar firma' : 'Agregar firma'}
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {/* Modal de firma */}
                  <Modal
                    visible={isSignatureModalVisible}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={closeSignatureModal}
                  >
                    <ThemedView style={styles.modalContainer}>
                      <ThemedView style={styles.modalHeader}>
                        <ThemedText style={styles.modalTitle}>Dibujar Firma</ThemedText>
                        <TouchableOpacity onPress={closeSignatureModal}>
                          <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                      </ThemedView>

                      <View style={styles.modalSignatureContainer}>
                        <SignatureScreen
                          ref={signatureRef}
                          onOK={handleSignatureRead}
                          descriptionText="Dibuja tu firma en el área blanca"
                          clearText=""
                          confirmText=""
                          webStyle={signatureWebStyle}
                          key={signatureKey}
                        />
                      </View>

                      <ThemedView style={styles.modalActions}>
                        <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal}>
                          <Ionicons name="trash" size={20} color="#000000" />
                          <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptSignature}>
                          <Ionicons name="checkmark" size={20} color="#000000" />
                          <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                    </ThemedView>
                  </Modal>

                  {/* Responsable */}
                  <ThemedView style={styles.sectionContainer}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>Responsable de la encuesta</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Nombre:</ThemedText>
                      <TextInput
                        ref={responsableNombreInputRef}
                        style={styles.input}
                        defaultValue={responsableNombreRef.current}
                        onChangeText={(text) => { responsableNombreRef.current = text; }}
                        placeholder="Nombre del responsable"
                        placeholderTextColor="#999"
                        key={`responsable-nombre-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Cédula:</ThemedText>
                      <TextInput
                        ref={responsableCedulaInputRef}
                        style={styles.input}
                        defaultValue={responsableCedulaRef.current}
                        onChangeText={(text) => { responsableCedulaRef.current = text; }}
                        placeholder="Cédula del responsable"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        key={`responsable-cedula-${formKey}`}
                      />
                    </ThemedView>

                    {/* Firma responsable: misma UI en creación y edición; en edición se puede borrar para generar otra */}
                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Firma del responsable *:</ThemedText>
                      {!firmaResponsable ? (
                        <ThemedView>
                          {editingSurvey &&
                          !(editingResponsableFirmaStored || editingFirmaResponsableOriginalRef.current) ? (
                            <ThemedText style={[styles.warningText, { marginBottom: 10 }]}>
                              Esta encuesta no tiene firma del responsable registrada.
                            </ThemedText>
                          ) : null}
                          <ThemedView style={styles.firmaButtonsRow}>
                            <TouchableOpacity
                              style={[styles.signatureButton, styles.firmaButtonHalf, isGeneratingFirmaResponsable && styles.signatureButtonDisabled]}
                              onPress={generateResponsableSignature}
                              disabled={isGeneratingFirmaResponsable}
                            >
                              {isGeneratingFirmaResponsable ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <Ionicons name="finger-print" size={20} color="#FFFFFF" />
                                  <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.signatureButton, styles.firmaButtonHalf]}
                              onPress={handleScanFirmaResponsable}
                              disabled={isGeneratingFirmaResponsable}
                            >
                              <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
                              <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                            </TouchableOpacity>
                          </ThemedView>
                        </ThemedView>
                      ) : (
                        <ThemedView style={styles.signatureInfo}>
                          <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            ID de sesión: {firmaResponsable.sessionId}
                          </ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            ID del empleado: {firmaResponsable.empleadoId}
                          </ThemedText>
                          {firmaResponsable.empleadoDetalle && (
                            <ThemedText style={styles.signatureInfoText}>
                              Empleado: {firmaResponsable.empleadoDetalle.nombre}{' '}
                              {firmaResponsable.empleadoDetalle.primer_apellido}{' '}
                              {firmaResponsable.empleadoDetalle.segundo_apellido}
                            </ThemedText>
                          )}
                          <ThemedText style={styles.signatureInfoText}>
                            Latitud: {firmaResponsable.latitud}
                          </ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            Longitud: {firmaResponsable.longitud}
                          </ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            Timestamp:{' '}
                            {convertDateTimestampToLocalString(
                              new Date(Number(firmaResponsable.timestamp)).toISOString()
                            )}
                          </ThemedText>
                          <TouchableOpacity
                            style={styles.removeSignatureButton}
                            onPress={clearResponsableFirma}
                          >
                            {getActionIcon('delete')}
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  </ThemedView>

                  {/* Action buttons */}
                  <ThemedView style={styles.formActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={cancelCreating}
                    >
                      <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        (isCreateSubmitting || isEditSubmitting) && { opacity: 0.7 },
                      ]}
                      onPress={editingSurvey ? saveSurveyEdit : createSurvey}
                      disabled={isCreateSubmitting || isEditSubmitting}
                    >
                      {isCreateSubmitting || isEditSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ThemedText style={styles.saveButtonText}>{getActionIcon('confirm')}</ThemedText>
                      )}
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>

      {/* Filter Date Picker */}
      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFecha ? new Date(filterFecha + 'T12:00:00') : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFilterFechaChange}
        />
      )}

      {/* Modal Añadir firma persona evaluada (en lista, cuando falta) */}
      <Modal
        visible={addSignatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeAddSignatureModal}
      >
        <View style={styles.addSignatureOverlay}>
          <ThemedView style={styles.addSignatureModalCard}>
            <ThemedView style={styles.addSignatureModalHeader}>
              <ThemedText style={styles.modalTitle}>Añadir firma persona evaluada</ThemedText>
              <TouchableOpacity onPress={closeAddSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ThemedText style={styles.addSignatureModalHint}>Dibuje la firma dentro del recuadro.</ThemedText>
            <View style={styles.addSignaturePadBox}>
              <SignatureScreen
                ref={addSignatureManualRef}
                onOK={handleAddSignatureManualRead}
                onEmpty={() => {
                  Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
                }}
                descriptionText=""
                clearText=""
                confirmText=""
                webStyle={`
                  .m-signature-pad--footer {display: none; margin: 0px;}
                  .m-signature-pad {box-shadow: none; border: none;}
                  body,html {width: 100%; height: 100%; background: #ffffff;}
                `}
                key={addSignatureManualKey}
              />
            </View>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={closeAddSignatureModal}>
                <ThemedText style={styles.modalClearButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptButton, isAddSignatureSubmitting && { opacity: 0.6 }]}
                onPress={triggerAddSignatureManualRead}
                disabled={isAddSignatureSubmitting}
              >
                {isAddSignatureSubmitting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#000000" />
                )}
                <ThemedText style={styles.modalAcceptButtonText}>Confirmar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

            <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />


      {QRScannerComponent}
      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 600,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  noMarcaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  noMarcaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  surveysList: {
    width: '100%',
    gap: 16,
  },
  surveyCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  surveyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
    gap: 8,
  },
  surveyTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  listItemButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  listItemButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: {
    backgroundColor: '#5856D6',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteButton: { backgroundColor: '#FF3B30' },
  buttonDisabled: { opacity: 0.6 },
  cambiosOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  floatModalCardMovimientos: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterGroupSearch: { marginBottom: 12 },
  changeDescription: { fontSize: 14, color: '#333', lineHeight: 20 },
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: {
    width: '100%',
    height: 160,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#EEE',
  },
  cambioCollapsableMain: {
    width: '100%',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  cambioCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  listLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  listLoadingText: {
    fontSize: 14,
    opacity: 0.8,
  },
  surveyInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  surveyLabel: {
    fontWeight: '600',
    color: '#333',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  personaContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  personaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  personaText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  personaLabel: {
    fontWeight: '600',
    color: '#333',
  },
  responsableContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  responsableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  responsableText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  responsableLabel: {
    fontWeight: '600',
    color: '#333',
  },
  formCard: {
    marginBottom: 20,
  },
  formContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 50,
    color: '#000',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB74D',
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  hierarchyFiltersContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  hierarchyFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  hierarchyFiltersContent: {
    padding: 12,
    gap: 8,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  filtersContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
    padding: 6,
    borderRadius: 6,
  },
  resetFiltersText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  filtersContent: {
    padding: 16,
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  filterGroup: {
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  searchInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  radioContainerDivision: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 5,
    backgroundColor: '#F8F9FA',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  questionContainer: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  questionTitle: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
    color: '#333',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
  },
  evalFormSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  evalFormSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  evalFormQuestionBlock: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  evalFormApplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  evalFormApplyLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  evalFormQuestionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  evalFormObsLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    color: '#333',
  },
  evalAddQuestionBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  evalAddQuestionBtnText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  evalKnowProcessRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  evalKnowProcessText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  addQuestionModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addQuestionModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
  },
  addQuestionModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
  },
  evalModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  evalModalCancelText: {
    color: '#666',
    fontSize: 15,
  },
  evalModalAcceptText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 15,
  },
  signaturePreviewContainer: {
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  signaturePreview: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  openSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  openSignatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  removeSignatureButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    width: '100%',
  },
  removeSignatureText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSignatureContainer: {
    width: '100%',
    height: 200,
    margin: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalAcceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  firmaButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  firmaButtonHalf: {
    flex: 1,
  },
  signatureButtonDisabled: {
    opacity: 0.6,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  signatureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signatureInfo: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    marginTop: 10,
  },
  signatureInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  signatureInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  firmaSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0F9F4',
    borderRadius: 6,
  },
  firmaSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 4,
  },
  firmaText: {
    fontSize: 12,
    color: '#666',
  },
  signatureImageContainer: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    backgroundColor: '#F8F9FA',
  },
  signatureImage: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  addSignatureOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  addSignatureModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  addSignatureModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  addSignatureModalHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    color: '#666',
    fontSize: 13,
  },
  addSignaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  evaluacionesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  evaluacionesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  evaluacionItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  evaluacionQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  evaluacionResult: {
    fontSize: 12,
    color: '#666',
  },
  observacionesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  observacionesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  observacionesText: {
    fontSize: 13,
    color: '#666',
  },
});

