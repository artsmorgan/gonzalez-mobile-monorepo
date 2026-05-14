import { loadMainStructureTreeMerged } from './bitacoraMainStructureCache';
import { writeMainStructureCacheString } from './mainStructureCacheStorage';
import { writeMainStructureFragmentPatch } from './mainStructureFragmentsStorage';

export type HierarchyCorpoIds = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
};

export type HierarchyPuestoIds = HierarchyCorpoIds & { puestoId: number };

/**
 * Árbol mergeado: fragmentos (`sucursal_*_llaves`, etc.) + cache legado vía
 * `loadMainStructureTreeMerged` (alineado con bitácora, vehículos, Jerarquía).
 */
export async function readMainStructureTree(): Promise<any[]> {
  try {
    const tree = await loadMainStructureTreeMerged();
    return Array.isArray(tree) ? tree : [];
  } catch {
    return [];
  }
}

export type WriteMainStructureTreeOpts = {
  /** Si se pasa, solo se actualizan fragmentos de llaves/llaveros de esas sucursales; si no, todas las sucursales del árbol. */
  syncLlavesLlaverosForCorpos?: number[];
};

/**
 * Persiste el árbol (JSON mergeado) y sincroniza fragmentos `sucursal_{id}_llaves` / `sucursal_{id}_llaveros`
 * que usa `mergeMainStructureFragments` — ya no se usa solo `AsyncStorage.getItem('main_structure_cache')` sin merge.
 */
export async function writeMainStructureTree(
  tree: any[],
  opts?: WriteMainStructureTreeOpts
): Promise<void> {
  await writeMainStructureCacheString(JSON.stringify(tree));
  const ids = opts?.syncLlavesLlaverosForCorpos;
  if (Array.isArray(ids) && ids.length > 0) {
    const uniq = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
    await syncSucursalLlavesLlaverosFragmentsFromTree(tree, uniq);
  } else {
    await syncSucursalLlavesLlaverosFragmentsFromTree(tree);
  }
}

/**
 * Escribe en disco los fragmentos de llaves/llaveros por sucursal (ids de e_estructura_sucursal = corpo).
 */
export async function syncSucursalLlavesLlaverosFragmentsFromTree(
  tree: any[],
  corpoIdsFilter?: number[]
): Promise<void> {
  const set =
    corpoIdsFilter && corpoIdsFilter.length > 0
      ? new Set(corpoIdsFilter.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))
      : null;
  for (const empresa of tree || []) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const suc of contrato?.sucursales || []) {
            const sid = Number(suc?.id);
            if (!Number.isFinite(sid) || sid <= 0) continue;
            if (set && !set.has(sid)) continue;
            const ll = Array.isArray(suc.llaves) ? suc.llaves : [];
            const lla = Array.isArray(suc.llaveros) ? suc.llaveros : [];
            await writeMainStructureFragmentPatch(`sucursal_${sid}_llaves`, ll);
            await writeMainStructureFragmentPatch(`sucursal_${sid}_llaveros`, lla);
          }
        }
      }
    }
  }
}

export function findHierarchyByCorpoIn(structureArr: any[], corpoId: number): HierarchyCorpoIds | null {
  const cid = Number(corpoId);
  for (const empresa of structureArr || []) {
    for (const cliente of empresa.clientes || []) {
      const divisiones = cliente.division || cliente.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              return {
                empresaId: empresa.id,
                clienteId: cliente.id,
                divisionId: division.id,
                contratoId: contrato.id,
                corpoId: sucursal.id,
              };
            }
          }
        }
      }
    }
  }
  return null;
}

/** Cadena completa hasta puesto (ids de `e_estructura_*`), alineada con fragmentos main-structure. */
export function findHierarchyByPuestoIn(structureArr: any[], puestoId: number): HierarchyPuestoIds | null {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  for (const empresa of structureArr || []) {
    for (const cliente of empresa.clientes || []) {
      const divisiones = cliente.division || cliente.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            for (const puesto of sucursal.puestos || []) {
              if (Number(puesto.id) === pid) {
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

export function getSucursalDataFromTree(tree: any[], corpoId: number): { llaves: any[]; llaveros: any[] } {
  const cid = Number(corpoId);
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      const divisiones = cliente.division || cliente.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              return {
                llaves: Array.isArray(sucursal.llaves) ? sucursal.llaves : [],
                llaveros: Array.isArray(sucursal.llaveros) ? sucursal.llaveros : [],
              };
            }
          }
        }
      }
    }
  }
  return { llaves: [], llaveros: [] };
}

export function getFirstPuestoIdFromSucursalInTree(tree: any[], corpoId: number): number | null {
  const cid = Number(corpoId);
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      const divisiones = cliente.division || cliente.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              const p = (sucursal.puestos || [])[0];
              return p?.id != null ? Number(p.id) : null;
            }
          }
        }
      }
    }
  }
  return null;
}

function mapDivisionesForSucursalFieldReplace(
  divisionList: any[],
  corpoId: number,
  fields: { llaves?: any[]; llaveros?: any[] }
): any[] {
  const cid = Number(corpoId);
  return (divisionList || []).map((division: any) => ({
    ...division,
    contratos: (division.contratos || []).map((contrato: any) => ({
      ...contrato,
      sucursales: (contrato.sucursales || []).map((sucursal: any) => {
        if (Number(sucursal.id) !== cid) return sucursal;
        const next = { ...sucursal };
        if (fields.llaves !== undefined) next.llaves = fields.llaves;
        if (fields.llaveros !== undefined) next.llaveros = fields.llaveros;
        return next;
      }),
    })),
  }));
}

function replaceSucursalFields(
  tree: any[],
  corpoId: number,
  fields: { llaves?: any[]; llaveros?: any[] }
): any[] {
  return (tree || []).map((empresa: any) => ({
    ...empresa,
    clientes: (empresa.clientes || []).map((cliente: any) => {
      const mapD = (divs: any[]) => mapDivisionesForSucursalFieldReplace(divs, corpoId, fields);
      if (Array.isArray(cliente.division) && cliente.division.length) {
        return { ...cliente, division: mapD(cliente.division) };
      }
      if (Array.isArray(cliente.divisiones) && cliente.divisiones.length) {
        return { ...cliente, divisiones: mapD(cliente.divisiones) };
      }
      return { ...cliente, division: mapD(cliente.division || []) };
    }),
  }));
}

export async function persistCorpoLlavesInMainStructure(corpoId: number, llaves: any[]): Promise<void> {
  const tree = await readMainStructureTree();
  const next = replaceSucursalFields(tree, corpoId, { llaves });
  await writeMainStructureTree(next);
}

export async function persistCorpoLlaverosInMainStructure(corpoId: number, llaveros: any[]): Promise<void> {
  const tree = await readMainStructureTree();
  const next = replaceSucursalFields(tree, corpoId, { llaveros });
  await writeMainStructureTree(next);
}

/** Para main_structure: ids de vínculo + llave_id_local si aún no sincronizada. */
export function normalizeLlaveroLinksForStructure(llaveros: any[]): any[] {
  return llaveros.map((r) => ({
    ...r,
    llaves: (r.llaves || []).map((l: any) => {
      const o: any = {
        id: l.id,
        llave_id: l.llave_id,
        llavero_id: l.llavero_id,
      };
      if (l.llave_id_local) o.llave_id_local = l.llave_id_local;
      return o;
    }),
  }));
}

function mapSucursales(tree: any[], fn: (suc: any) => any): any[] {
  const mapDivs = (divs: any[]) =>
    (divs || []).map((division: any) => ({
      ...division,
      contratos: (division.contratos || []).map((contrato: any) => ({
        ...contrato,
        sucursales: (contrato.sucursales || []).map(fn),
      })),
    }));
  return (tree || []).map((empresa: any) => ({
    ...empresa,
    clientes: (empresa.clientes || []).map((cliente: any) => {
      if (Array.isArray(cliente.division) && cliente.division.length) {
        return { ...cliente, division: mapDivs(cliente.division) };
      }
      if (Array.isArray(cliente.divisiones) && cliente.divisiones.length) {
        return { ...cliente, divisiones: mapDivs(cliente.divisiones) };
      }
      return { ...cliente, division: mapDivs(cliente.division || []) };
    }),
  }));
}

/** Inserta o sustituye una llave en la sucursal (por id o id_local). */
export function upsertLlaveInCorpoTree(tree: any[], corpoId: number, row: any): any[] {
  const cid = Number(corpoId);
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== cid) return suc;
    const list = [...(suc.llaves || [])];
    const idx = list.findIndex(
      (L: any) =>
        (row.id && Number(L.id) === Number(row.id) && Number(row.id) > 0) ||
        (row.id_local && String(L.id_local) === String(row.id_local))
    );
    const merged = { ...row, movimientos: row.movimientos ?? (idx >= 0 ? list[idx].movimientos : []) };
    if (idx >= 0) list[idx] = { ...list[idx], ...merged };
    else list.unshift(merged);
    return { ...suc, llaves: list };
  });
}

/** Inserta o sustituye un llavero en la sucursal. */
export function upsertLlaveroInCorpoTree(tree: any[], corpoId: number, row: any): any[] {
  const cid = Number(corpoId);
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== cid) return suc;
    const list = [...(suc.llaveros || [])];
    const idx = list.findIndex(
      (L: any) =>
        (row.id && Number(L.id) === Number(row.id) && Number(row.id) > 0) ||
        (row.id_local && String(L.id_local) === String(row.id_local))
    );
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.unshift(row);
    return { ...suc, llaveros: list };
  });
}

/** Quita la llave y elimina vínculos e_llave_en_llavero en llaveros de esa sucursal. */
export function removeLlaveFromCorpoTreeAndStripLlaveroLinks(
  tree: any[],
  corpoId: number,
  opts: { id?: number; id_local?: string }
): any[] {
  const matchLlave = (L: any) => {
    if (opts.id != null && Number(opts.id) > 0 && Number(L.id) === Number(opts.id)) return true;
    if (opts.id_local != null && String(L.id_local) === String(opts.id_local)) return true;
    return false;
  };
  const matchLink = (link: any) => {
    if (opts.id != null && Number(opts.id) > 0 && Number(link.llave_id) === Number(opts.id)) return true;
    if (opts.id_local != null && String(link.llave_id_local) === String(opts.id_local)) return true;
    return false;
  };
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== Number(corpoId)) return suc;
    const llaves = (suc.llaves || []).filter((L: any) => !matchLlave(L));
    const llaveros = (suc.llaveros || []).map((ll: any) => ({
      ...ll,
      llaves: (ll.llaves || []).filter((link: any) => !matchLink(link)),
    }));
    return { ...suc, llaves, llaveros };
  });
}

/** Traslada una llave entre sucursales en el árbol (quita de origen con limpieza de vínculos; añade en destino). */
export function moveLlaveBetweenCorposInTree(tree: any[], fromCorpo: number, toCorpo: number, row: any): any[] {
  const rm = removeLlaveFromCorpoTreeAndStripLlaveroLinks(tree, fromCorpo, {
    id: row.id && row.id > 0 ? row.id : undefined,
    id_local: row.id_local || undefined,
  });
  return upsertLlaveInCorpoTree(rm, toCorpo, { ...row, corpo_id: toCorpo });
}

/** Elimina un llavero de la sucursal (sin tocar llaves sueltas). */
export function removeLlaveroFromCorpoTree(
  tree: any[],
  corpoId: number,
  opts: { id?: number; id_local?: string }
): any[] {
  const match = (L: any) => {
    if (opts.id != null && Number(opts.id) > 0 && Number(L.id) === Number(opts.id)) return true;
    if (opts.id_local != null && String(L.id_local) === String(opts.id_local)) return true;
    return false;
  };
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== Number(corpoId)) return suc;
    return { ...suc, llaveros: (suc.llaveros || []).filter((L: any) => !match(L)) };
  });
}

/** Vacía vínculos llave–llavero de un llavero en una sucursal (p. ej. al cambiar de corpo). */
export function clearLlaveroLinksInCorpoTree(tree: any[], corpoId: number, opts: { id?: number; id_local?: string }): any[] {
  const match = (L: any) => {
    if (opts.id != null && Number(opts.id) > 0 && Number(L.id) === Number(opts.id)) return true;
    if (opts.id_local != null && String(L.id_local) === String(opts.id_local)) return true;
    return false;
  };
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== Number(corpoId)) return suc;
    const llaveros = (suc.llaveros || []).map((ll: any) => (match(ll) ? { ...ll, llaves: [] } : ll));
    return { ...suc, llaveros };
  });
}

export function moveLlaveroBetweenCorposInTree(tree: any[], fromCorpo: number, toCorpo: number, row: any): any[] {
  const cleared = clearLlaveroLinksInCorpoTree(tree, fromCorpo, {
    id: row.id && row.id > 0 ? row.id : undefined,
    id_local: row.id_local || undefined,
  });
  const without = removeLlaveroFromCorpoTree(cleared, fromCorpo, {
    id: row.id && row.id > 0 ? row.id : undefined,
    id_local: row.id_local || undefined,
  });
  return upsertLlaveroInCorpoTree(without, toCorpo, { ...row, corpo_id: toCorpo, llaves: row.llaves ?? [] });
}

/** Tras sync CREATE offline: asigna id servidor y limpia id_local en la llave; actualiza vínculos llavero en todo el árbol. */
export function patchLlaveLocalKeyToServerIdInTree(tree: any[], corpoId: number, idLocal: string, serverId: number): any[] {
  const lid = String(idLocal);
  let next = mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== Number(corpoId)) return suc;
    const llaves = (suc.llaves || []).map((L: any) => {
      if (String(L.id_local) !== lid) return L;
      return { ...L, id: serverId, id_local: '' };
    });
    return { ...suc, llaves };
  });
  next = patchAllLlaveroLinksLlaveIdLocalEverywhere(next, lid, serverId);
  return next;
}

/** Igual para llavero tras sync CREATE. */
export function patchLlaveroLocalKeyToServerIdInTree(tree: any[], corpoId: number, idLocal: string, serverId: number): any[] {
  const lid = String(idLocal);
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== Number(corpoId)) return suc;
    const llaveros = (suc.llaveros || []).map((L: any) => {
      if (String(L.id_local) !== lid) return L;
      const nextLlaves = (L.llaves || []).map((link: any) =>
        link && typeof link === 'object' && (!link.llavero_id || link.llavero_id === 0)
          ? { ...link, llavero_id: serverId }
          : link
      );
      return { ...L, id: serverId, id_local: '', llaves: nextLlaves };
    });
    return { ...suc, llaveros };
  });
}

/** Sustituye llave_id_local por llave_id en todos los llaveros del árbol (por si el id se resolvió en otra sucursal). */
export function patchAllLlaveroLinksLlaveIdLocalEverywhere(tree: any[], idLocal: string, serverId: number): any[] {
  const lid = String(idLocal);
  return mapSucursales(tree, (suc) => ({
    ...suc,
    llaveros: (suc.llaveros || []).map((ll: any) => ({
      ...ll,
      llaves: (ll.llaves || []).map((link: any) => {
        if (String(link.llave_id_local) !== lid) return link;
        const { llave_id_local: _x, ...rest } = link;
        return { ...rest, llave_id: serverId };
      }),
    })),
  }));
}

export async function applyLlaveLocalKeyToServerIdInMainStructure(
  corpoId: number,
  idLocal: string,
  serverId: number
): Promise<void> {
  const tree = await readMainStructureTree();
  const next = patchLlaveLocalKeyToServerIdInTree(tree, corpoId, idLocal, serverId);
  await writeMainStructureTree(next);
}

export async function applyLlaveroLocalKeyToServerIdInMainStructure(
  corpoId: number,
  idLocal: string,
  serverId: number
): Promise<void> {
  const tree = await readMainStructureTree();
  const next = patchLlaveroLocalKeyToServerIdInTree(tree, corpoId, idLocal, serverId);
  await writeMainStructureTree(next);
}

export function findCorpoAndLlaveRowInTree(
  tree: any[],
  match: { id?: number; id_local?: string }
): { corpoId: number; row: any } | null {
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      const divisiones = cliente.division || cliente.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division.contratos || []) {
          for (const suc of contrato.sucursales || []) {
            for (const L of suc.llaves || []) {
              if (match.id != null && Number(match.id) > 0 && Number(L.id) === Number(match.id)) {
                return { corpoId: Number(suc.id), row: L };
              }
              if (match.id_local != null && String(L.id_local) === String(match.id_local)) {
                return { corpoId: Number(suc.id), row: L };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

export function findCorpoAndLlaveroRowInTree(
  tree: any[],
  match: { id?: number; id_local?: string }
): { corpoId: number; row: any } | null {
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      const divisiones = cliente.division || cliente.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division.contratos || []) {
          for (const suc of contrato.sucursales || []) {
            for (const L of suc.llaveros || []) {
              if (match.id != null && Number(match.id) > 0 && Number(L.id) === Number(match.id)) {
                return { corpoId: Number(suc.id), row: L };
              }
              if (match.id_local != null && String(L.id_local) === String(match.id_local)) {
                return { corpoId: Number(suc.id), row: L };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/** Aplica campos de actualización a la llave en el árbol; si cambia corpo, traslada. */
export function applyLlaveUpdatePayloadToTree(tree: any[], llaveId: number, rd: any): any[] {
  const hit = findCorpoAndLlaveRowInTree(tree, { id: llaveId });
  if (!hit) return tree;
  const { corpoId: oldCorpo, row } = hit;
  const nextCliente = rd.cliente_id != null ? Number(rd.cliente_id) : row.cliente_id;
  const nextCorpo = rd.corpo_id != null ? Number(rd.corpo_id) : row.corpo_id;
  const nextPuesto = rd.puesto_id != null ? Number(rd.puesto_id) : row.puesto_id;
  const merged = {
    ...row,
    cliente_id: nextCliente,
    corpo_id: nextCorpo,
    puesto_id: nextPuesto,
    empresa_id: rd.empresa_id != null ? Number(rd.empresa_id) : row.empresa_id,
    division_id: rd.division_id != null ? Number(rd.division_id) : row.division_id,
    contrato_id: rd.contrato_id != null ? Number(rd.contrato_id) : row.contrato_id,
    numero_llave: rd.numero_llave != null ? rd.numero_llave : row.numero_llave,
    lugar_abre: rd.lugar_abre != null ? rd.lugar_abre : row.lugar_abre,
    cantidad_copias: rd.cantidad_copias != null ? rd.cantidad_copias : row.cantidad_copias,
    observaciones: rd.observaciones != null ? rd.observaciones : row.observaciones,
    firma_responsable: rd.firma_responsable != null ? rd.firma_responsable : row.firma_responsable,
  };
  if (Number(oldCorpo) !== Number(nextCorpo)) {
    return moveLlaveBetweenCorposInTree(tree, oldCorpo, nextCorpo, merged);
  }
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== Number(oldCorpo)) return suc;
    return {
      ...suc,
      llaves: (suc.llaves || []).map((L: any) => (Number(L.id) === Number(llaveId) ? merged : L)),
    };
  });
}

export function applyLlaveroUpdatePayloadToTree(tree: any[], llaveroId: number, rd: any, llavesNumeric: number[]): any[] {
  const hit = findCorpoAndLlaveroRowInTree(tree, { id: llaveroId });
  if (!hit) return tree;
  const { corpoId: oldCorpo, row } = hit;
  const nextCliente = rd.cliente_id != null ? Number(rd.cliente_id) : row.cliente_id;
  const nextCorpo = rd.corpo_id != null ? Number(rd.corpo_id) : row.corpo_id;
  const nextPuesto = rd.puesto_id != null ? Number(rd.puesto_id) : row.puesto_id;
  let nextLlaves = row.llaves;
  if (Array.isArray(llavesNumeric)) {
    nextLlaves = llavesNumeric.map((lid) => ({
      id: 0,
      llave_id: lid,
      llavero_id: llaveroId,
    }));
  }
  const merged = {
    ...row,
    cliente_id: nextCliente,
    corpo_id: nextCorpo,
    puesto_id: nextPuesto,
    empresa_id: rd.empresa_id != null ? Number(rd.empresa_id) : row.empresa_id,
    division_id: rd.division_id != null ? Number(rd.division_id) : row.division_id,
    contrato_id: rd.contrato_id != null ? Number(rd.contrato_id) : row.contrato_id,
    nombre_llavero: rd.nombre_llavero != null ? rd.nombre_llavero : row.nombre_llavero,
    numero_llavero: rd.numero_llavero != null ? rd.numero_llavero : row.numero_llavero,
    observaciones: rd.observaciones != null ? rd.observaciones : row.observaciones,
    firma_responsable: rd.firma_responsable != null ? rd.firma_responsable : row.firma_responsable,
    llaves: nextLlaves,
  };
  if (Number(oldCorpo) !== Number(nextCorpo)) {
    const cleared = { ...merged, llaves: nextLlaves };
    return moveLlaveroBetweenCorposInTree(tree, oldCorpo, nextCorpo, cleared);
  }
  return mapSucursales(tree, (suc) => {
    if (Number(suc.id) !== Number(oldCorpo)) return suc;
    return {
      ...suc,
      llaveros: (suc.llaveros || []).map((L: any) => (Number(L.id) === Number(llaveroId) ? merged : L)),
    };
  });
}

export function stripLlaveMovimientosByIdLocal(tree: any[], movIdLocal: string): any[] {
  const ml = String(movIdLocal);
  return mapSucursales(tree, (suc) => ({
    ...suc,
    llaves: (suc.llaves || []).map((it: any) => ({
      ...it,
      movimientos: (it.movimientos || []).filter((m: any) => !(m.id_local && String(m.id_local) === ml)),
    })),
  }));
}

export function patchMovimientoLlaveroInTree(tree: any[], llaveroId: number, movIdLocal: string, serverMovId: number): any[] {
  const ml = String(movIdLocal);
  return mapSucursales(tree, (suc) => ({
    ...suc,
    llaveros: (suc.llaveros || []).map((L: any) => {
      if (Number(L.id) !== Number(llaveroId)) return L;
      const movs = (L.movimientos || []).map((m: any) =>
        String(m.id_local) === ml ? { ...m, id: serverMovId, id_local: '' } : m
      );
      return { ...L, movimientos: movs };
    }),
  }));
}

/** Actualiza un movimiento de llave anidado (por id_local → id servidor). */
export function patchMovimientoLlaveInTree(tree: any[], llaveId: number, movIdLocal: string, serverMovId: number): any[] {
  const ml = String(movIdLocal);
  return mapSucursales(tree, (suc) => ({
    ...suc,
    llaves: (suc.llaves || []).map((L: any) => {
      if (Number(L.id) !== Number(llaveId)) return L;
      const movs = (L.movimientos || []).map((m: any) =>
        String(m.id_local) === ml ? { ...m, id: serverMovId, id_local: '' } : m
      );
      return { ...L, movimientos: movs };
    }),
  }));
}

/** Movimiento espejo en llave vinculado a movimiento de llavero (id_local local-mov-llavero-*). */
export function patchShadowMovimientoLlaveFromLlaveroSync(
  tree: any[],
  llaveId: number,
  llaveroMovIdLocal: string,
  payload: any,
  serverMovId: number
): any[] {
  const ml = String(llaveroMovIdLocal);
  return mapSucursales(tree, (suc) => ({
    ...suc,
    llaves: (suc.llaves || []).map((L: any) => {
      if (Number(L.id) !== Number(llaveId)) return L;
      const movs = (L.movimientos || []).filter((m: any) => !(m.id_local && String(m.id_local) === ml));
      const newMov = {
        id: serverMovId,
        id_local: '',
        llave_id: llaveId,
        nombre_persona_recibe: payload.nombre_persona_recibe,
        nombre_persona_entrega: payload.nombre_persona_entrega,
        departamento: payload.departamento,
        telefono: payload.telefono,
        fecha: payload.fecha,
        hora: payload.hora,
        firma_entrega: payload.firma_entrega ?? null,
        firma_recibe: payload.firma_recibe ?? null,
        firma_responsable: payload.firma_responsable,
      };
      return { ...L, movimientos: [newMov, ...movs] };
    }),
  }));
}

/** Enriquecer filas de llavero para UI (lugar_abre) a partir del listado de llaves del mismo corpo. */
export function enrichLlaveroLlavesLinks(llaveros: any[], llavesMaster: any[]): any[] {
  const byId = new Map<number, any>();
  for (const l of llavesMaster || []) {
    const id = Number(l?.id);
    if (Number.isFinite(id) && id > 0) byId.set(id, l);
  }
  return (llaveros || []).map((row) => ({
    ...row,
    llaves: (row.llaves || []).map((link: any) => {
      const lid = Number(link.llave_id);
      const lk = Number.isFinite(lid) ? byId.get(lid) : undefined;
      return {
        ...link,
        llave: lk
          ? { id: lk.id, lugar_abre: lk.lugar_abre, cantidad_copias: lk.cantidad_copias, numero_llave: lk.numero_llave }
          : link.llave ?? null,
      };
    }),
  }));
}
