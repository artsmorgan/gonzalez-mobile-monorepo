import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { writeMainStructureCacheString } from '@/hooks/mainStructureCacheStorage';
import {
  loadMainStructureFragmentsObject,
  writeMainStructureFragmentPatch,
} from '@/hooks/mainStructureFragmentsStorage';

export type PuestoArticuloEstado = 'Bueno' | 'Malo' | 'No está' | string;

export type PuestoArticuloFormInput = {
  id: number;
  tipo?: string;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: PuestoArticuloEstado;
  observaciones?: string;
  created_at?: string | number | Date;
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
      marca: null,
      modelo: null,
      serie_placa: null,
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
    let nextMantenimientos: any[];

    if (!hasServerLast) {
      nextUltimo = { ...newBasic };
      nextMantenimientos = mergeMantenimientosWithUpdatedUltimo(existingMaints, null, nextUltimo);
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
      nextMantenimientos = mergeMantenimientosWithUpdatedUltimo(existingMaints, existingUltimo, nextUltimo);
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
      nextMantenimientos = mergeMantenimientosWithUpdatedUltimo(existingMaints, existingUltimo, nextUltimo);
    } else if (lastEst === 'Bueno' && newEst !== 'Bueno') {
      nextUltimo = { ...newBasic };
      nextMantenimientos = [nextUltimo, ...existingMaints];
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
      nextMantenimientos = mergeMantenimientosWithUpdatedUltimo(existingMaints, existingUltimo, nextUltimo);
    }

    if (enqueueUpdate && hasServerLast && !(lastEst === 'Bueno' && newEst !== 'Bueno') && puestoId) {
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

    return {
      ...art,
      mantenimientos: nextMantenimientos,
      ultimo_mantenimiento: nextUltimo,
      ultimo_registro_mantenimiento: nextUltimo,
    };
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
      const patched = patchPuestoArticulosWithForms(baseArticulos, formsById, {
        origin,
        horaAccionMs,
        puestoId: pid,
        enqueueUpdate,
      });
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
                          articulos: patchPuestoArticulosWithForms(puesto.articulos, formsById, {
                            origin,
                            horaAccionMs,
                            puestoId: pid,
                            enqueueUpdate,
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
    if (Array.isArray(pick)) return pick;
  }
  const merged = await loadMainStructureTreeMerged();
  const fromTree = extractArticulosForPuestoFromTree(merged, pid);
  return Array.isArray(fromTree) ? fromTree : [];
}
