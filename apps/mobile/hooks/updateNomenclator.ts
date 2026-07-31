import Constants from 'expo-constants';
import authedFetch from '@/hooks/authedFetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeJobManualsCacheForPuesto } from '@/hooks/jobManualsCacheHelpers';
import { persistMainStructurePayload } from '@/hooks/mainStructureApi';
import { mergeLlaverosCacheForCorpo } from '@/hooks/llaverosCacheHelpers';
import { mergeLlavesCacheForCorpo } from '@/hooks/llavesCacheHelpers';
import * as Network from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import {
  mergeNotesBase64FromCache,
  mergeNotesCacheForPuesto,
  parseNotesCache,
} from '@/hooks/notesCacheHelpers';
import { getIncidentsCache, mergeIncidentsCacheForCorpo, setIncidentsCache } from '@/hooks/incidentsStorage';

/** Payload `marca.nomencladores` devuelto por `GET /api/attendance/user/[id]`. */
export type AttendanceMarcaNomencladores = {
  categoriasMantenimiento?: unknown[];
  tiposProductoNoConforme?: unknown[];
  tipoDocumento?: unknown[];
  clasificacionIncidentes?: unknown[];
  categoriasNovedades?: unknown[];
  tipoActivosVisitas?: unknown[];
  tipoQuejasClientes?: unknown[];
  tipoQuejas?: unknown[];
};

function asPersistableNomenclatorArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value;
}

/** Persiste en AsyncStorage los nomencladores embebidos en la marca de asistencia. */
export async function applyNomenclatorsFromAttendanceMarca(marca: unknown): Promise<void> {
  if (!marca || typeof marca !== 'object') return;
  const nom = (marca as { nomencladores?: AttendanceMarcaNomencladores }).nomencladores;
  if (!nom || typeof nom !== 'object') return;

  const writes: Promise<void>[] = [];

  const categoriasMantenimiento = asPersistableNomenclatorArray(nom.categoriasMantenimiento);
  if (categoriasMantenimiento) {
    writes.push(AsyncStorage.setItem('categoria_mantenimiento_cache', JSON.stringify(categoriasMantenimiento)));
  }

  const tiposProductoNoConforme = asPersistableNomenclatorArray(nom.tiposProductoNoConforme);
  if (tiposProductoNoConforme) {
    writes.push(AsyncStorage.setItem('tipos_producto_no_conforme_cache', JSON.stringify(tiposProductoNoConforme)));
  }

  const tipoDocumento = asPersistableNomenclatorArray(nom.tipoDocumento);
  if (tipoDocumento) {
    writes.push(AsyncStorage.setItem('document_types_cache', JSON.stringify(tipoDocumento)));
  }

  const clasificacionIncidentes = asPersistableNomenclatorArray(nom.clasificacionIncidentes);
  if (clasificacionIncidentes) {
    writes.push(AsyncStorage.setItem('incidents_classifications_cache', JSON.stringify(clasificacionIncidentes)));
  }

  const categoriasNovedades = asPersistableNomenclatorArray(nom.categoriasNovedades);
  if (categoriasNovedades) {
    writes.push(AsyncStorage.setItem('categories_cache', JSON.stringify(categoriasNovedades)));
  }

  const tipoActivosVisitas = asPersistableNomenclatorArray(nom.tipoActivosVisitas);
  if (tipoActivosVisitas) {
    writes.push(AsyncStorage.setItem('tipo_activos_cache', JSON.stringify(tipoActivosVisitas)));
  }

  const tipoQuejasClientes = asPersistableNomenclatorArray(nom.tipoQuejasClientes);
  if (tipoQuejasClientes) {
    writes.push(AsyncStorage.setItem('tipo_clientes_quejas_cache', JSON.stringify(tipoQuejasClientes)));
  }

  const tipoQuejas = asPersistableNomenclatorArray(nom.tipoQuejas);
  if (tipoQuejas) {
    writes.push(AsyncStorage.setItem('tipo_quejas_cache', JSON.stringify(tipoQuejas)));
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }
}

export default async function updateNomenclator(updatedMarca: any, refreshAccessToken: any, logout: any) {

    await Promise.all([
        //getNotes(Number(updatedMarca.puesto?.id) || 0, updatedMarca.puesto),
        getCategories(refreshAccessToken, logout),
        getTiposProductoNoConforme(refreshAccessToken, logout),
        getTipoActivo(refreshAccessToken, logout),
        //getEmployeesCorpo(updatedMarca.corpo.id),
        //getIncidents(updatedMarca.corpo.id),
        getIncidentsClassifications(refreshAccessToken, logout),
        getDocumentTypes(refreshAccessToken, logout),
        getExecutives(refreshAccessToken, logout),
        getPuestosCorpo(updatedMarca.corpo.id, refreshAccessToken, logout),
        //getCorporateVehicles(updatedMarca.corpo.id),
        /*(async () => {
          const mid = Number(updatedMarca.id);
          const cid = Number(updatedMarca.corpo?.id ?? updatedMarca.corpo_id ?? 0);
          if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(cid) || cid <= 0) return;
          if (!(await evaluateInternetConnection())) return;
          await syncVehiclesVisitasCacheFromNetwork({
            marcaId: mid,
            corpoId: cid,
            refreshAccessToken,
            logout,
          });
        })(),
        (async () => {
          const mid = Number(updatedMarca.id);
          const cid = Number(updatedMarca.corpo?.id ?? updatedMarca.corpo_id ?? 0);
          if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(cid) || cid <= 0) return;
          if (!(await evaluateInternetConnection())) return;
          await syncVisitorsCacheFromNetwork({
            marcaId: mid,
            corpoId: cid,
            refreshAccessToken,
            logout,
          });
        })(),*/
        //getVoiceNotes(updatedMarca),
        //getArticulos(),
        //getJobManuals(updatedMarca.puesto?.id),
        //getLlaves(Number(updatedMarca.corpo?.id) || 0),
        //getLlaveros(Number(updatedMarca.corpo?.id) || 0),
        getCategoriesMantenimiento(refreshAccessToken, logout),
        getTipoQuejas(refreshAccessToken, logout),
        getTipoClientesQuejas(refreshAccessToken, logout),
      ]);
}

/** Evalúa conexión a internet con el mismo criterio en toda esta pantalla. */
async function evaluateInternetConnection(): Promise<boolean> {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  }

const getJobManuals = async (puestoId: number | null | undefined, refreshAccessToken: any, logout: any) => {
    const pid =
      puestoId != null && Number.isFinite(Number(puestoId)) && Number(puestoId) > 0 ? Number(puestoId) : null;
    if (!pid) return;

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/job-manuals?puesto_id=${pid}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken, 
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getJobManuals`);
    }
    const data = await response.json();
    if (data.status && Array.isArray(data.manuals)) {
      const prevStr = await AsyncStorage.getItem('job_manuals_cache');
      const prev = prevStr ? JSON.parse(prevStr) : [];
      const merged = mergeJobManualsCacheForPuesto(Array.isArray(prev) ? prev : [], data.manuals, pid);
      await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(merged));
    }
  }

const getMainStructure = async (refreshAccessToken: any, logout: any) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/main-structure`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getMainStructure`);
    }
    const data = await response.json();
    if (!data.status) return;

    await persistMainStructurePayload(data);

    if (data.created_at !== undefined && data.created_at !== null) {
      await AsyncStorage.setItem('main_structure_created_at', String(data.created_at));
    }
  }

const shouldUpdateMainStructureCache = async (refreshAccessToken: any, logout: any): Promise<boolean> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return false;

      if (!(await evaluateInternetConnection())) return false;

      const response = await authedFetch({
        url: `${apiUrl}/api/main-structure/last?created_at=0`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });

      if (!response || !response.ok) return false;

      const data = await response.json();
      const lastCreatedAt = Number(data?.created_at ?? 0);
      if (!Number.isFinite(lastCreatedAt) || lastCreatedAt <= 0) return false;

      const localCreatedAtStr = await AsyncStorage.getItem('main_structure_created_at');
      const localCreatedAt = Number(localCreatedAtStr ?? 0);
      const normalizedLocal = Number.isFinite(localCreatedAt) ? localCreatedAt : 0;

      return lastCreatedAt !== normalizedLocal;
    } catch (error) {
      console.error('Error validating main structure cache update:', error);
      return false;
    }
  };

const getBitacoraVehiculoDetenido = async (marcaId: number, refreshAccessToken: any, logout: any) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/bitacora-vehiculo-detenido?m=${marcaId}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getBitacoraVehiculoDetenido`);
    }
    const data = await response.json();
    if (!data.status) return;
    const rows = Array.isArray(data.data) ? data.data : [];
    let sid = Number(rows[0]?.sucursal_id ?? rows[0]?.corpo_id ?? 0);
    if (!sid) {
      try {
        const cm = await AsyncStorage.getItem('current_marca');
        if (cm) {
          const parsed = JSON.parse(cm);
          sid = Number(parsed.corpo?.id ?? parsed.corpo_id ?? 0);
        }
      } catch {
        /* ignore */
      }
    }
    if (sid > 0) {
      const { mergeBitacorasDetenidosForSucursalFromServer } = await import('@/hooks/bitacoraMainStructureCache');
      await mergeBitacorasDetenidosForSucursalFromServer({ sucursalId: sid, serverRows: rows });
    }
  };

const getDocumentosEntregados = async (corpoId: number, refreshAccessToken: any, logout: any) => {
    await AsyncStorage.removeItem('documentos_entregados_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/documentos-entregados?corpo_id=${encodeURIComponent(String(corpoId))}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getDocumentosEntregados`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(data.data));
    }
  }

const getLlaves = async (corpoId: number, refreshAccessToken: any, logout: any) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const cid = Number(corpoId);
    if (!Number.isFinite(cid) || cid <= 0) {
      return;
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/llaves?corpo_id=${encodeURIComponent(String(cid))}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getLlaves`);
    }
    const data = await response.json();
    if (data.status && Array.isArray(data.data)) {
      const cacheStr = await AsyncStorage.getItem('llaves_cache');
      const existing = cacheStr ? JSON.parse(cacheStr) : [];
      const merged = mergeLlavesCacheForCorpo(existing, data.data, cid);
      await AsyncStorage.setItem('llaves_cache', JSON.stringify(merged));
    }
  };
  
const getLlaveros = async (corpoId: number, refreshAccessToken: any, logout: any) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const cid = Number(corpoId);
    if (!Number.isFinite(cid) || cid <= 0) {
      return;
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/llaveros?corpo_id=${encodeURIComponent(String(cid))}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getLlaveros`);
    }
    const data = await response.json();
    if (data.status && Array.isArray(data.data)) {
      const cacheStr = await AsyncStorage.getItem('llaveros_cache');
      const existing = cacheStr ? JSON.parse(cacheStr) : [];
      const merged = mergeLlaverosCacheForCorpo(existing, data.data, cid);
      await AsyncStorage.setItem('llaveros_cache', JSON.stringify(merged));
    }
  };

const getTrainings = async (marcaId: number, refreshAccessToken: any, logout: any) => {
    await AsyncStorage.removeItem('trainings_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/training?m=${marcaId}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getTrainings`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('trainings_cache', JSON.stringify(data.capacitaciones));
    }
  }

const getVoiceNotes = async (marca: { corpo?: { id?: number }; puesto?: { id?: number } }, refreshAccessToken: any, logout: any) => {
    await AsyncStorage.removeItem('voice_notes_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const corpoId = marca.corpo?.id != null ? Number(marca.corpo.id) : null;
    if (!corpoId || corpoId <= 0) {
      return;
    }
    let url = `${apiUrl}/api/voice-notes?corpo_id=${corpoId}`;
    const mp = marca.puesto?.id != null ? Number(marca.puesto.id) : null;
    if (mp != null && mp > 0) {
      url += `&puesto_id=${mp}`;
    }
    const response = await authedFetch({
      url,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getVoiceNotes`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(data.voiceNotes));
    }
  }

export const getCategories = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('categories_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/categories`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    console.log("getCategories");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getCategories`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('categories_cache', JSON.stringify(data.categories));
    }
  }

const getCategoriesMantenimiento = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('categoria_mantenimiento_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/categoria-mantenimiento`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    console.log("getCategoriesMantenimiento");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getCategoriesMantenimiento`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('categoria_mantenimiento_cache', JSON.stringify(data.categorias));
    }
  }

export const getTipoQuejas = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('tipo_quejas_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/complaints-master/tipo-quejas`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    console.log("getTipoQuejas");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getTipoQuejas`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('tipo_quejas_cache', JSON.stringify(data.tipoQuejas));
    }
  }

const getTipoClientesQuejas = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('tipo_clientes_quejas_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/complaints-master/tipo-clientes`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    console.log("getTipoClientesQuejas");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getTipoClientesQuejas`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('tipo_clientes_quejas_cache', JSON.stringify(data.tipoClientes));
    }
  }

export const getTiposProductoNoConforme = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('tipos_producto_no_conforme_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/non-conforming-product/types`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getTiposProductoNoConforme`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('tipos_producto_no_conforme_cache', JSON.stringify(data.data || []));
    }
  }

const getTipoActivo = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('tipo_activos_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/visitors/categories`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    console.log("getTipoActivo");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getTipoActivo`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('tipo_activos_cache', JSON.stringify(data));
    }
  }

const getNotes = async (
    refreshAccessToken: any,
    logout: any,
    puestoId: number,
    puestoMeta?: { id: number; nombre?: string } | null
  ) => {
    const pid = Number(puestoId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/puestos/0/notas?puesto_id=${encodeURIComponent(String(pid))}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getNotes`);
    }
    const data = await response.json();
    if (data.status && Array.isArray(data.notas)) {
      const cached = parseNotesCache(await AsyncStorage.getItem('notes_cache'));
      const legacyPid = cached.puesto?.id ?? pid;
      const mergedNotas = mergeNotesCacheForPuesto(
        cached.notas || [],
        data.notas,
        pid,
        legacyPid,
        mergeNotesBase64FromCache
      );
      await AsyncStorage.setItem(
        'notes_cache',
        JSON.stringify({
          notas: mergedNotas,
          puesto: puestoMeta ?? cached.puesto ?? { id: pid },
        })
      );
    }
  };

const getEvaluations = async (corpoId: number, refreshAccessToken: any, logout: any) => {
    await AsyncStorage.removeItem('evaluations_staff_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/evaluation/corpo/${corpoId}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getEvaluations`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(data.evaluaciones));
    }
  }

const getEmployeesCorpo = async (corpoId: number, refreshAccessToken: any, logout: any) => {
    await AsyncStorage.removeItem('employees_corpo_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/corpo/${corpoId}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getEmployeesCorpo`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('employees_corpo_cache', JSON.stringify(data.empleados));
    }
  }

const getIncidents = async (corpoId: number, refreshAccessToken: any, logout: any) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/incidents?corpo_id=${corpoId}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getIncidents`);
    }
    const data = await response.json();
    if (data.status && Array.isArray(data.incidents)) {
      const prev = (await getIncidentsCache()) || [];
      const merged = mergeIncidentsCacheForCorpo(prev, data.incidents, corpoId);
      await setIncidentsCache(merged);
    }
  }

export const getIncidentsClassifications = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('incidents_classifications_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/incidents/classification`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getIncidentsClassifications`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('incidents_classifications_cache', JSON.stringify(data.classifications));
    }
  }

export const getDocumentTypes = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('document_types_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/document-types`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getDocumentTypes`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('document_types_cache', JSON.stringify(data.documentTypes));
    }
  }

const getExecutives = async (refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('executives_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/executives`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getExecutives`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('executives_cache', JSON.stringify(data.executives));
    }
  }

const getSurveys = async (marcaId: number, refreshAccessToken: any, logout: any) => {
    await AsyncStorage.removeItem('surveys_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/encuesta-nps?m=${marcaId}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getSurveys`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('surveys_cache', JSON.stringify(data.encuestas));
    }
  }

const getPuestosCorpo = async (corpoId: number, refreshAccessToken: any, logout: any) => {
    const cache = await AsyncStorage.getItem('puestos_corpo_cache');
    if (cache && (cache != '' && cache != '[]')) {
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/puestos/corpo/${corpoId}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getPuestosCorpo`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('puestos_corpo_cache', JSON.stringify(data.puestos));
    }
  }

const getArticulos = async (refreshAccessToken: any, logout: any) => {
    await AsyncStorage.removeItem('articulos_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/articulos`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) return;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getArticulos`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('articulos_cache', JSON.stringify(data.articulos));
    }
  }