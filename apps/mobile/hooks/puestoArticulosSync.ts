import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { writeMainStructureCacheString } from '@/hooks/mainStructureCacheStorage';
import {
  loadMainStructureFragmentsObject,
  writeMainStructureFragmentPatch,
} from '@/hooks/mainStructureFragmentsStorage';
import Constants from 'expo-constants';
import authedFetch from '@/hooks/authedFetch';
import { syncPuestoArticulosFragmentFromReportesList } from '@/hooks/mantenimientoEquipoMainStructureSync';
import type { ArticuloMantenimientoPendingFile } from '@/utils/articuloMantenimientoFiles';
import {
  pendingFileToArchivoAdjuntoRef,
  sanitizeArchivosAdjuntosForCache,
  sanitizeArticuloNodeForCache,
  sanitizeArticulosArrayForCache,
  sanitizeMantenimientoForCache,
} from '@/utils/articuloMantenimientoFiles';

export type PuestoArticuloEstado = 'Bueno' | 'Malo' | 'No está' | string;

export type PuestoArticuloFormInput = {
  id: number;
  tipo?: string;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: PuestoArticuloEstado;
  observaciones?: string;
  created_at?: string | number | Date;
  mantenimiento_files?: ArticuloMantenimientoPendingFile[];
};

type EnqueueUpdatePayload = {
  id: number;
  requestData: Record<string, unknown>;
  meta: { puestoId: number; source: 'plan' | 'asignado'; estructuraId: number | null };
};

type PatchOpts = {
  origin: 'activities' | 'checklist_supervision' | 'entrega_puestos' | string;
  horaAccionMs: number;
  puestoId?: number;
  enqueueUpdate?: (payload: EnqueueUpdatePayload) => void;
};

function normalizeCantidadNecesaria(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function generateRandomMaintenanceId(): number {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000000);
  return Number(`${ts}${rand}`);
}

function isPlanTipo(formTipo: any, artTipo: any): boolean {
  const s = String(formTipo ?? artTipo ?? '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'plan' || s.includes('plan de')) return true;
  if (s === 'asignado' || s.includes('asignado')) return false;
  return s === 'plan';
}

function incomingTimestampMs(form: PuestoArticuloFormInput, fallbackMs: number): number {
  if (form.created_at == null) return fallbackMs;
  const d = new Date(form.created_at);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : fallbackMs;
}

/** Hereda marca/modelo/serie del artículo vinculado en jerarquía (no del último mantenimiento). */
function resolveMarcaModeloSerieFromArticuloNode(art: any): {
  marca: string | null;
  modelo: string | null;
  serie_placa: string | null;
} {
  const pick = (...values: unknown[]): string | null => {
    for (const v of values) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s !== '') return s;
    }
    return null;
  };
  return {
    marca: pick(art?.marca),
    modelo: pick(art?.modelo),
    serie_placa: pick(art?.serie, art?.serie_placa),
  };
}

function mergePendingArchivosIntoUltimo(
  nextUltimo: any,
  existingUltimo: any | null,
  pendingFiles: ArticuloMantenimientoPendingFile[] | undefined,
  options?: { inheritPreviousArchivos?: boolean },
): any {
  const inherit = options?.inheritPreviousArchivos !== false;

  const baseArchivos = inherit
    ? sanitizeArchivosAdjuntosForCache(
        nextUltimo?.c_archivos_adjuntos_articulo_mantenimiento ??
          nextUltimo?.archivos ??
          existingUltimo?.c_archivos_adjuntos_articulo_mantenimiento ??
          existingUltimo?.archivos,
      )
    : sanitizeArchivosAdjuntosForCache(
        nextUltimo?.c_archivos_adjuntos_articulo_mantenimiento ?? nextUltimo?.archivos,
      );

  if (!Array.isArray(pendingFiles) || pendingFiles.length === 0) {
    if (baseArchivos.length === 0) {
      return sanitizeMantenimientoForCache(nextUltimo);
    }
    return sanitizeMantenimientoForCache({
      ...nextUltimo,
      c_archivos_adjuntos_articulo_mantenimiento: baseArchivos,
    });
  }

  const seen = new Set<string>();
  const merged: ReturnType<typeof pendingFileToArchivoAdjuntoRef>[] = [];

  for (const ref of baseArchivos) {
    const key = ref.id_local || `${ref.id}-${ref.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ref);
  }
  for (const f of pendingFiles) {
    const ref = pendingFileToArchivoAdjuntoRef(f);
    const key = ref.id_local || `${ref.id}-${ref.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ref);
  }

  return sanitizeMantenimientoForCache({
    ...nextUltimo,
    c_archivos_adjuntos_articulo_mantenimiento: merged,
  });
}

function mergeMantenimientosWithUpdatedUltimo(
  existingMaints: any[],
  existingUltimo: { id?: number } | null,
  nextUltimo: any
): any[] {
  if (existingUltimo?.id != null && Number(existingUltimo.id) > 0) {
    let replaced = false;
    const next = existingMaints.map((m: any) => {
      if (Number(m?.id) !== Number(existingUltimo.id)) return m;
      replaced = true;
      return { ...m, ...nextUltimo };
    });
    return replaced ? next : [nextUltimo, ...existingMaints];
  }
  return [nextUltimo, ...existingMaints];
}

/** Indica si al guardar se creará un nuevo c_articulo_mantenimiento (vs. actualizar el último). */
export function willCreateNewMantenimientoRecord(
  existingUltimo: any | null | undefined,
  formEstado: string,
): boolean {
  const hasServerLast = existingUltimo != null && Number(existingUltimo.id) > 0;
  if (!hasServerLast) return true;
  const lastEst = String(existingUltimo?.estado || 'Bueno').trim();
  const newEst = String(formEstado || '').trim();
  return lastEst === 'Bueno' && newEst !== 'Bueno';
}

/** Registro de mantenimiento al que se adjuntarán archivos según estado actual del formulario. */
export function resolveTargetMantenimientoForForm(
  art: any,
  form: Pick<PuestoArticuloFormInput, 'estado'>,
): {
  target: any | null;
  targetId: number | null;
  isNewRecord: boolean;
} {
  const existingUltimo =
    art?.ultimo_mantenimiento ?? art?.ultimo_registro_mantenimiento ?? null;
  if (willCreateNewMantenimientoRecord(existingUltimo, form.estado)) {
    return { target: null, targetId: null, isNewRecord: true };
  }
  const id = existingUltimo?.id != null ? Number(existingUltimo.id) : 0;
  return {
    target: existingUltimo,
    targetId: Number.isFinite(id) && id > 0 ? id : null,
    isNewRecord: false,
  };
}

export function extractArticulosForPuestoFromTree(tree: any[], puestoId: number): any[] | null {
  const pid = Number(puestoId);
  if (!Array.isArray(tree) || !Number.isFinite(pid) || pid <= 0) return null;
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of cliente?.division || []) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              if (Number(puesto?.id) === pid && Array.isArray(puesto.articulos)) {
                return puesto.articulos;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

export function patchPuestoArticulosWithForms(
  articulosArray: any[],
  formsById: Map<number, PuestoArticuloFormInput>,
  opts: PatchOpts
): any[] {
  const { origin, horaAccionMs, puestoId, enqueueUpdate } = opts;
  const horaIso = new Date(horaAccionMs).toISOString();

  return articulosArray.map((art: any) => {
    const form = formsById.get(Number(art.id));
    if (!form) return art;

    const existingUltimo =
      art.ultimo_mantenimiento && typeof art.ultimo_mantenimiento === 'object'
        ? { ...art.ultimo_mantenimiento }
        : null;
    const existingMaints = Array.isArray(art.mantenimientos) ? [...art.mantenimientos] : [];

    const hasServerLast = existingUltimo != null && Number(existingUltimo.id) > 0;
    if (hasServerLast && existingUltimo?.updated_at) {
      const incomingMs = incomingTimestampMs(form, horaAccionMs);
      const lastUpMs = new Date(existingUltimo.updated_at).getTime();
      if (Number.isFinite(lastUpMs) && incomingMs < lastUpMs) {
        return art;
      }
    }

    const isPlan = isPlanTipo(form.tipo, art.tipo);
    const articuloEstructuraId = Number(form.id || art.id || 0) || null;
    const newEst = String(form.estado || '').trim();
    const lastEst = String(existingUltimo?.estado || 'Bueno').trim();
    const cantidadNec = normalizeCantidadNecesaria(form.cantidad_requerida);
    const inheritedIdentity = resolveMarcaModeloSerieFromArticuloNode(art);

    const newBasic = {
      id: generateRandomMaintenanceId(),
      articulo_plan_id: isPlan ? articuloEstructuraId : null,
      articulo_asignado_id: isPlan ? null : articuloEstructuraId,
      estado: newEst,
      cantidad_necesaria: cantidadNec,
      cantidad_real: Number(form.cantidad_real || 0),
      observaciones: form.observaciones || '',
      fecha_solucion: null as string | null,
      accion: null,
      fecha_inicio: null,
      numero_boleta_proveeduria: null,
      tipo: null,
      marca: inheritedIdentity.marca,
      modelo: inheritedIdentity.modelo,
      serie_placa: inheritedIdentity.serie_placa,
      marca_nuevo: null,
      modelo_nuevo: null,
      serie_placa_nuevo: null,
      categoria: null,
      tipo_mantenimiento_art: null,
      fecha_salida: null,
      fecha_entrada: null,
      kilometraje: null,
      mant_armas_form: null,
      categoria_mantenimiento: null,
      detalle: null,
      numero_fc: null,
      proveedor: null,
      costo_mo: null,
      costo_i: null,
      iva: null,
      costo_total: null,
      fecha_fin: null,
      reincidencia_treinta_dias: null,
      tipo_mant_art_reincid: null,
      c_archivos_adjuntos_articulo_mantenimiento: [] as any[],
      created_at: horaIso,
      updated_at: horaIso,
      evaluacion_mantenimiento_origen: origin,
    };

    let nextUltimo: any;

    if (!hasServerLast) {
      nextUltimo = { ...newBasic };
    } else if (lastEst !== 'Bueno' && newEst === 'Bueno') {
      nextUltimo = {
        ...existingUltimo,
        articulo_plan_id: isPlan ? articuloEstructuraId : null,
        articulo_asignado_id: isPlan ? null : articuloEstructuraId,
        estado: newEst,
        cantidad_necesaria: cantidadNec,
        cantidad_real: cantidadNec,
        fecha_solucion: horaIso,
        observaciones: form.observaciones || '',
        updated_at: horaIso,
        evaluacion_mantenimiento_origen: origin,
      };
    } else if (lastEst !== 'Bueno' && newEst !== 'Bueno') {
      nextUltimo = {
        ...existingUltimo,
        articulo_plan_id: isPlan ? articuloEstructuraId : null,
        articulo_asignado_id: isPlan ? null : articuloEstructuraId,
        estado: newEst,
        cantidad_necesaria: cantidadNec,
        cantidad_real: Number(form.cantidad_real || 0),
        observaciones: form.observaciones || '',
        updated_at: horaIso,
        evaluacion_mantenimiento_origen: origin,
      };
      if (lastEst !== newEst) nextUltimo.fecha_solucion = null;
      else nextUltimo.fecha_solucion = existingUltimo.fecha_solucion ?? null;
    } else if (lastEst === 'Bueno' && newEst !== 'Bueno') {
      nextUltimo = { ...newBasic };
    } else {
      nextUltimo = {
        ...existingUltimo,
        articulo_plan_id: isPlan ? articuloEstructuraId : null,
        articulo_asignado_id: isPlan ? null : articuloEstructuraId,
        estado: newEst,
        cantidad_necesaria:
          existingUltimo?.cantidad_necesaria != null ? existingUltimo.cantidad_necesaria : cantidadNec,
        cantidad_real: Number(form.cantidad_real || 0),
        observaciones: form.observaciones || '',
        fecha_solucion: existingUltimo.fecha_solucion ?? null,
        updated_at: horaIso,
        evaluacion_mantenimiento_origen: origin,
      };
    }

    const createsNew = !hasServerLast || (lastEst === 'Bueno' && newEst !== 'Bueno');

    if (enqueueUpdate && hasServerLast && !createsNew && puestoId) {
      const rd: Record<string, unknown> = {
        estado: newEst,
        cantidad_necesaria: nextUltimo.cantidad_necesaria,
        cantidad_real: nextUltimo.cantidad_real,
        observaciones: nextUltimo.observaciones ?? '',
        hora_accion: horaAccionMs,
      };
      if (lastEst !== 'Bueno' && newEst === 'Bueno') rd.fecha_solucion = horaIso;
      else if (lastEst !== 'Bueno' && newEst !== 'Bueno' && lastEst !== newEst) rd.fecha_solucion = null;
      enqueueUpdate({
        id: Number(existingUltimo!.id),
        requestData: rd,
        meta: {
          puestoId,
          source: (isPlan ? 'plan' : 'asignado') as 'plan' | 'asignado',
          estructuraId: articuloEstructuraId,
        },
      });
    }

    const ultimoFinal = mergePendingArchivosIntoUltimo(
      nextUltimo,
      existingUltimo,
      form.mantenimiento_files,
      { inheritPreviousArchivos: !createsNew },
    );
    const mantenimientosFinal = createsNew
      ? [ultimoFinal, ...existingMaints]
      : mergeMantenimientosWithUpdatedUltimo(existingMaints, existingUltimo, ultimoFinal);

    return sanitizeArticuloNodeForCache({
      ...art,
      mantenimientos: mantenimientosFinal,
      ultimo_mantenimiento: ultimoFinal,
      ultimo_registro_mantenimiento: ultimoFinal,
    });
  });
}

export async function rewritePuestoArticulosInMainStructure(params: {
  puestoId: number;
  formsById: Map<number, PuestoArticuloFormInput>;
  horaAccionMs: number;
  origin: PatchOpts['origin'];
  enqueueUpdate?: PatchOpts['enqueueUpdate'];
}): Promise<boolean> {
  const { puestoId, formsById, horaAccionMs, origin, enqueueUpdate } = params;
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0 || formsById.size === 0) return false;

  const fr = await loadMainStructureFragmentsObject();
  const fragKey = `puesto_${pid}_articulos`;
  const legacyFragKey = `puestos_${pid}_articulos`;
  if (fr && Object.keys(fr).length > 0) {
    const fromFragment = fr[fragKey] ?? fr[legacyFragKey];
    let baseArticulos: any[] | null = null;
    if (Array.isArray(fromFragment) && fromFragment.length > 0) {
      baseArticulos = fromFragment;
    } else {
      const merged = await loadMainStructureTreeMerged();
      if (Array.isArray(merged) && merged.length > 0) {
        baseArticulos = extractArticulosForPuestoFromTree(merged, pid);
      }
    }
    if (baseArticulos != null && baseArticulos.length > 0) {
      const patched = sanitizeArticulosArrayForCache(
        patchPuestoArticulosWithForms(baseArticulos, formsById, {
          origin,
          horaAccionMs,
          puestoId: pid,
          enqueueUpdate,
        }),
      );
      await writeMainStructureFragmentPatch(fragKey, patched);
      if (fr[legacyFragKey] != null) {
        await writeMainStructureFragmentPatch(legacyFragKey, patched);
      }
      return true;
    }
  }

  const parsed = await loadMainStructureTreeMerged();
  if (!Array.isArray(parsed) || parsed.length === 0) return false;

  const updated = parsed.map((empresa: any) => {
    if (!empresa?.clientes) return empresa;
    return {
      ...empresa,
      clientes: empresa.clientes.map((cliente: any) => {
        if (!cliente?.division) return cliente;
        return {
          ...cliente,
          division: cliente.division.map((division: any) => {
            if (!division?.contratos) return division;
            return {
              ...division,
              contratos: division.contratos.map((contrato: any) => {
                if (!contrato?.sucursales) return contrato;
                return {
                  ...contrato,
                  sucursales: contrato.sucursales.map((sucursal: any) => {
                    if (!sucursal?.puestos) return sucursal;
                    return {
                      ...sucursal,
                      puestos: sucursal.puestos.map((puesto: any) => {
                        if (!puesto || Number(puesto.id) !== pid || !Array.isArray(puesto.articulos)) return puesto;
                        return {
                          ...puesto,
                          articulos: sanitizeArticulosArrayForCache(
                            patchPuestoArticulosWithForms(puesto.articulos, formsById, {
                              origin,
                              horaAccionMs,
                              puestoId: pid,
                              enqueueUpdate,
                            }),
                          ),
                        };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      }),
    };
  });

  await writeMainStructureCacheString(JSON.stringify(updated));
  return true;
}

export async function loadPuestoArticulosForTable(puestoId: number): Promise<any[]> {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return [];
  const fr = await loadMainStructureFragmentsObject();
  if (fr && Object.keys(fr).length > 0) {
    const bySingular = fr[`puesto_${pid}_articulos`];
    const byPlural = fr[`puestos_${pid}_articulos`];
    const pick = Array.isArray(bySingular) && bySingular.length > 0 ? bySingular : byPlural;
    if (Array.isArray(pick)) return sanitizeArticulosArrayForCache(pick);
  }
  const merged = await loadMainStructureTreeMerged();
  const fromTree = extractArticulosForPuestoFromTree(merged, pid);
  return Array.isArray(fromTree) ? sanitizeArticulosArrayForCache(fromTree) : [];
}

/** Refresca el fragmento `puesto_{id}_articulos` desde el API tras guardar online o sync. */
export async function refreshPuestoArticulosFromServer(params: {
  puestoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<void> {
  const { puestoId, refreshAccessToken, logout } = params;
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return;

  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return;

  try {
    const response = await authedFetch({
      url: `${apiUrl}/api/articulo-mantenimiento/puesto/${pid}`,
      init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      refreshAccessToken,
      logout,
    });
    if (!response?.ok) return;
    const data = await response.json();
    if (!data?.status || !Array.isArray(data.data) || data.data.length === 0) return;

    const items = data.data.map((it: any) => ({
      key: it.key,
      source: it.source === 'plan' ? 'plan' : 'asignado',
      estructura_id: it.estructura_id,
      articulo_nomenclador_id: it.articulo_nomenclador_id ?? null,
      articulo_nombre: it.articulo_nombre ?? 'Desconocido',
      tipo: it.tipo,
      marca: it.marca ?? null,
      modelo: it.modelo ?? null,
      serie: it.serie ?? null,
      tipos_mantenimiento: Array.isArray(it.tipos_mantenimiento) ? it.tipos_mantenimiento : [],
      mantenimientos: Array.isArray(it.mantenimientos) ? it.mantenimientos : [],
      movimientos: Array.isArray(it.movimientos) ? it.movimientos : [],
      ultimo_mantenimiento: it.ultimo_mantenimiento ?? it.ultimo_registro_mantenimiento ?? null,
      ultimo_registro_mantenimiento: it.ultimo_registro_mantenimiento ?? it.ultimo_mantenimiento ?? null,
    }));

    await syncPuestoArticulosFragmentFromReportesList(
      pid,
      items.map((it: any) => ({
        ...it,
        mantenimientos: Array.isArray(it.mantenimientos)
          ? it.mantenimientos.map(sanitizeMantenimientoForCache)
          : [],
        ultimo_mantenimiento: it.ultimo_mantenimiento
          ? sanitizeMantenimientoForCache(it.ultimo_mantenimiento)
          : null,
        ultimo_registro_mantenimiento: it.ultimo_registro_mantenimiento
          ? sanitizeMantenimientoForCache(it.ultimo_registro_mantenimiento)
          : it.ultimo_mantenimiento
            ? sanitizeMantenimientoForCache(it.ultimo_mantenimiento)
            : null,
      })),
    );
  } catch (e) {
    console.error('refreshPuestoArticulosFromServer:', e);
  }
}
