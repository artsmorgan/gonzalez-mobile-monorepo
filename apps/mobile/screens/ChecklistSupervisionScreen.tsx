import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform, Modal, View, Image, Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { jwtDecode } from 'jwt-decode';
import Ionicons from '@expo/vector-icons/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';

import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { eventBus } from '../hooks/eventBus';
import getHoraAccion from '../hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import authedFetch from '../hooks/authedFetch';
import {
  createChecklistSupervision,
  deleteChecklistSupervision,
  listChecklistSupervision,
  ChecklistSupervisionItem,
  updateChecklistSupervision,
} from '../hooks/checklistSupervisionFunctions';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import Constants from 'expo-constants';

type ChecklistSupervisionUI = ChecklistSupervisionItem & { id_local?: string };

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

// Tipos para evaluación dinámica
type EvaluationInput = {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'photo' | 'checkbox';
  title?: string;
  value: string;
  options?: string[]; // Para select
  imageOrientation?: 'horizontal' | 'vertical'; // Para fotos (como StaffEvaluationsScreen)
  file_name?: string; // Solo para registros sincronizados (se establece en backend)
};

type EvaluationSubsection = {
  id: string;
  title: string;
  inputs: EvaluationInput[];
};

type EvaluationSection = {
  id: string;
  title: string;
  subsections: EvaluationSubsection[];
  isPredefined: boolean; // Si es true, no se puede eliminar
};

// Tipos para artículos del puesto (similar a EntregaPuestosScreen)
interface ArticuloForm {
  id: number;
  nombre: string;
  tipo?: string;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: 'Bueno' | 'Malo' | 'No está';
  observaciones?: string;
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
          title: 'Respuesta',
          value: '5',
          options: ['No aplica', '1', '2', '3', '4', '5'],
        },
        {
          id: `lg-${idx}-obs`,
          type: 'text' as const,
          title: 'Observaciones',
          value: '',
        }
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
          title: 'Respuesta',
          value: '5',
          options: ['No aplica', '1', '2', '3', '4', '5'],
        },
        {
          id: `ca-${idx}-obs`,
          type: 'text' as const,
          title: 'Observaciones',
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
          title: 'Respuesta',
          value: '5',
          options: ['No aplica', '1', '2', '3', '4', '5'],
        },
        {
          id: `ss-${idx}-obs`,
          type: 'text' as const,
          title: 'Observaciones',
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
            title: 'Respuesta',
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No aplica'],
          },
          {
            id: 'up-0-estado',
            type: 'select' as const,
            title: 'Estado',
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'Requiere cambio'],
          },
          {
            id: 'up-0-obs',
            type: 'text' as const,
            title: 'Observaciones',
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
            title: 'Respuesta',
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No aplica'],
          },
          {
            id: 'up-1-estado',
            type: 'select' as const,
            title: 'Estado',
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'Requiere cambio'],
          }
        ]
      }
    ]
  },
  {
    id: 'estado-equipos',
    title: 'Estado de los equipos',
    isPredefined: true,
    subsections: [
      'Cepillo', 'Aspiradora', 'Hidrolavadora'
    ].map((item, idx) => ({
      id: `ee-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `ee-${idx}-cal`,
          type: 'select' as const,
          title: 'Respuesta',
          value: 'Bueno',
          options: ['Bueno', 'Malo', 'No aplica'],
        },
        {
          id: `ee-${idx}-estado`,
          type: 'select' as const,
          title: 'Estado',
          value: 'Bueno',
          options: ['Bueno', 'Malo', 'Requiere cambio'],
        },
        {
          id: `ee-${idx}-obs`,
          type: 'text' as const,
          title: 'Observaciones',
          value: '',
        }
      ]
    }))
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
            title: 'Respuesta',
            value: '5',
            options: ['1', '2', '3', '4', '5'],
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
        inputs: [
          {
            id: 'car-0-cal',
            type: 'select' as const,
            title: 'Respuesta',
            value: 'Vigente',
            options: ['Vencido', 'Vigente'],
          },
          {
            id: 'car-0-fecha-vencimiento',
            type: 'date' as const,
            title: 'Fecha de vencimiento',
            value: '',
          },
          {
            id: 'car-0-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
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
            title: 'Respuesta',
            value: 'Vigente',
            options: ['Vencido', 'Vigente'],
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
          }
        ]
      },
      {
        id: 'car-sub-2',
        title: 'Carne de Agente de Seguridad',
        inputs: [
          {
            id: 'car-2-cal',
            type: 'select' as const,
            title: 'Respuesta',
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No existe'],
          },
          {
            id: 'car-2-photo',
            type: 'text' as const,
            title: 'Foto',
            value: '',
          }
        ]
      },
      {
        id: 'car-sub-3',
        title: 'Licencia de conducción',
        inputs: [
          {
            id: 'car-3-cal',
            type: 'select' as const,
            title: 'Respuesta',
            value: 'Vigente',
            options: ['Vencido', 'Vigente'],
          },
          {
            id: 'car-3-fecha-vencimiento',
            type: 'date' as const,
            title: 'Fecha de vencimiento',
            value: '',
          },
          {
            id: 'car-3-photo',
            type: 'photo' as const,
            title: 'Foto',
            value: '',
          }
        ]
      }
    ]
  },
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
            title: 'Respuesta',
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No existe'],
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
            title: 'Respuesta',
            value: 'Bueno',
            options: ['Bueno', 'Malo', 'No existe'],
          }
        ]
      }
    ]
  },
  {
    id: 'equipo-seguridad',
    title: 'Equipo de seguridad',
    isPredefined: true,
    subsections: [
      'Cinturón de seguridad', 'Esposas y porta esposas', 'Porta tiros/ Porta Cargadores',
      'Arma de fuego (serie y documento de matricula) / funda/ Munición', 'Bastón telescópico',
      'Radio de comunicación', 'Porta gas pimienta y Gas pimienta', 'Chaleco antibalas',
      'Linterna', 'Detector de metales', 'Marcador electrónico', 'Casco dielectrico',
      'Revisión del estado de los vehículos (bicicleta y motocicletas)', 'Cargado y adaptador de radio'
    ].map((item, idx) => ({
      id: `es-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `es-${idx}-cal`,
          type: 'select' as const,
          title: 'Respuesta',
          value: 'Bueno',
          options: ['Bueno', 'Malo', 'No existe'],
        }
      ]
    }))
  },
  {
    id: 'mobiliario-menaje',
    title: 'Mobiliario y menaje',
    isPredefined: true,
    subsections: [
      'Silla', 'Mesa', 'Microondas', 'Coffee maker',
      'Articulos de oficina (Grapadora, pilot, lapicero, bitácoras, gabinetes)', 'Gabinetes'
    ].map((item, idx) => ({
      id: `mm-sub-${idx}`,
      title: item,
      inputs: [
        {
          id: `mm-${idx}-cal`,
          type: 'select' as const,
          title: 'Respuesta',
          value: 'Bueno',
          options: ['Bueno', 'Malo', 'No existe'],
        }
      ]
    }))
  },
  {
    id: 'bitacora',
    title: 'Bitácora',
    isPredefined: true,
    subsections: [
      {
        id: 'bit-sub-0',
        title: 'Revisión de bitácora',
        inputs: [
          {
            id: 'bit-0-1',
            type: 'checkbox' as const,
            title: 'Anotaciones legibles, sin manchones ni tachaduras',
            value: 'true',
          },
          {
            id: 'bit-0-2',
            type: 'checkbox' as const,
            title: 'Nombre completo y firma en entrega y recibo de puesto',
            value: 'true',
          },
          {
            id: 'bit-0-3',
            type: 'checkbox' as const,
            title: 'No deben existir espacios en blanco',
            value: 'true',
          },
          {
            id: 'bit-0-4',
            type: 'checkbox' as const,
            title: 'Folios completos',
            value: 'true',
          },
          {
            id: 'bit-0-5',
            type: 'checkbox' as const,
            title: 'Escritura sólo con tinta azul (si aplica según el cliente)',
            value: 'true',
          }
        ]
      }
    ]
  },
  {
    id: 'marcas',
    title: 'Marcas',
    isPredefined: true,
    subsections: [
      {
        id: 'mar-sub-0',
        title: 'Recorrido de marcas',
        inputs: [
          {
            id: 'mar-0-1',
            type: 'checkbox' as const,
            title: 'Dispositivos (marcas y bastón) en buen estado',
            value: 'true',
          },
          {
            id: 'mar-0-2',
            type: 'checkbox' as const,
            title: 'SEG-F-038-Control de recorrido y marcas Electronicas (Completo, sin manchones ni tachaduras, y no debe estar completo antes de tiempo)',
            value: 'true',
          },
          {
            id: 'mar-0-3',
            type: 'checkbox' as const,
            title: 'Verificación del estado de las pastillas',
            value: 'true',
          }
        ]
      }
    ]
  },
  {
    id: 'perimetro',
    title: 'Perímetro',
    isPredefined: true,
    subsections: [
      {
        id: 'per-sub-0',
        title: 'Revisión de perímetro',
        inputs: [
          {
            id: 'per-0-1',
            type: 'checkbox' as const,
            title: 'Rerrido por el perimetro revisando barreras perimetrales',
            value: 'true',
          },
          {
            id: 'per-0-2',
            type: 'checkbox' as const,
            title: 'Revisar que no exitan activos cerca de las barreras perimetrales',
            value: 'true',
          }
        ]
      }
    ]
  },
  {
    id: 'vehiculos',
    title: 'Vehículos',
    isPredefined: true,
    subsections: [
      {
        id: 'veh-sub-0',
        title: 'Revisión de vehículos',
        inputs: [
          {
            id: 'veh-0-1',
            type: 'checkbox' as const,
            title: 'Revisar aleatoriamente el/los vehículos custodiados en el puesto',
            value: 'true',
          }
        ]
      }
    ]
  },
  {
    id: 'capacitacion-iso',
    title: 'Capacitación ISO',
    isPredefined: true,
    subsections: [
      {
        id: 'cap-sub-0',
        title: 'Política de Calidad',
        inputs: [
          {
            id: 'cap-0-1',
            type: 'text' as const,
            title: '¿Cual es?',
            value: '',
          },
          {
            id: 'cap-0-2',
            type: 'text' as const,
            title: '¿Como aporta?',
            value: '',
          }
        ]
      },
      {
        id: 'cap-sub-1',
        title: 'Objetivos de Calidad',
        inputs: [
          {
            id: 'cap-1-1',
            type: 'text' as const,
            title: '¿Cual es?',
            value: '',
          },
          {
            id: 'cap-1-2',
            type: 'text' as const,
            title: '¿Como aporta?',
            value: '',
          }
        ]
      }
    ]
  },
  {
    id: 'papeleria',
    title: 'Papelería',
    isPredefined: true,
    subsections: [
      {
        id: 'pap-sub-0',
        title: 'Papelería completa, y sin manchones o tachones/ Información verídica (Cuando aplique el registro, de utilizarse la papelería del cliente si el contrato lo indica)',
        inputs: [
          {
            id: 'pap-0-1',
            type: 'checkbox' as const,
            title: 'SEG-F-016-Pernocte de vehículos',
            value: 'true',
          },
          {
            id: 'pap-0-2',
            type: 'checkbox' as const,
            title: 'SEG-F-017-Bitácora de revisión bicicletas detenidas y SEG-F-007-Bitácora de revisión motos detenidas',
            value: 'true',
          },
          {
            id: 'pap-0-3',
            type: 'checkbox' as const,
            title: 'SEG-F-018-Control de ingreso y salida de visitas y vehículos particulares',
            value: 'true',
          },
          {
            id: 'pap-0-4',
            type: 'checkbox' as const,
            title: 'SEG-F-019-Entradas y salida de materiales activos del cliente',
            value: 'true',
          },
          {
            id: 'pap-0-5',
            type: 'checkbox' as const,
            title: 'SEG-F-020-Control de ingreso y salida de vehículos Institucionales',
            value: 'true',
          },
          {
            id: 'pap-0-6',
            type: 'checkbox' as const,
            title: 'SEG-F-021-Registro de llaves',
            value: 'true',
          },
          {
            id: 'pap-0-7',
            type: 'checkbox' as const,
            title: 'SEG-F-022-Boleta de salida de vehículos',
            value: 'true',
          },
          {
            id: 'pap-0-8',
            type: 'checkbox' as const,
            title: 'SEG-F-023-Control de entrega de puesto',
            value: 'true',
          },
          {
            id: 'pap-0-9',
            type: 'checkbox' as const,
            title: 'SEG-F-024-Control de activos visitantes',
            value: 'true',
          },
          {
            id: 'pap-0-10',
            type: 'text' as const,
            title: 'Número de Serie del arma vrs documento de matrícula',
            value: '',
          }
        ]
      }
    ]
  },
  {
    id: 'funcion',
    title: 'Función',
    isPredefined: true,
    subsections: [
      {
        id: 'fun-sub-0',
        title: 'Revisión Funciones',
        inputs: [
          {
            id: 'fun-0-1',
            type: 'checkbox' as const,
            title: 'Revisar aleatoriamente 3 puntos de la SEG-F-038-Guia de Funciones del puesto de cada lugar y anotar en las observaciones los hallazgos de todos los corpos visitados',
            value: 'true',
          }
        ]
      }
    ]
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

function generateRandomMaintenanceId(): number {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000000);
  return Number(`${ts}${rand}`);
}

function normalizeCantidadNecesaria(value: any): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

/**
 * Actualiza en main_structure_cache el último mantenimiento de los artículos del puesto
 * supervisado usando el estado actual del formulario de checklist.
 * Solo actualiza caché local; no encola acciones de articulo_mantenimiento_actions.
 */
async function updateMainStructureCacheWithChecklist(
  selectedPuestoId: number | null,
  articulos: ArticuloForm[],
  options?: { horaAccion?: number }
) {
  try {
    if (!selectedPuestoId || !Array.isArray(articulos) || articulos.length === 0) return;
    const cacheStr = await AsyncStorage.getItem('main_structure_cache');
    if (!cacheStr) return;
    const parsed: any = JSON.parse(cacheStr);
    if (!Array.isArray(parsed)) return;

    const horaAccionValue = options?.horaAccion ?? Date.now();
    const horaAccionIso = new Date(horaAccionValue).toISOString();

    const articulosById = new Map<number, ArticuloForm>(
      articulos.map((a) => [a.id, a] as [number, ArticuloForm])
    );

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
                          if (!puesto || puesto.id !== selectedPuestoId || !Array.isArray(puesto.articulos)) {
                            return puesto;
                          }

                          const updatedArticulos = puesto.articulos.map((art: any) => {
                            const form = articulosById.get(Number(art.id));
                            if (!form) return art;

                            const existingUltimo =
                              art.ultimo_mantenimiento && typeof art.ultimo_mantenimiento === 'object'
                                ? { ...art.ultimo_mantenimiento }
                                : null;
                            const existingMaints = Array.isArray(art.mantenimientos) ? [...art.mantenimientos] : [];

                            const isPlan = String(form.tipo || art.tipo || '').toLowerCase() === 'plan';
                            const articuloEstructuraId = Number(form.id || art.id || 0) || null;

                            const estadoActual = form.estado;
                            const lastEstado = String(existingUltimo?.estado || 'Bueno');
                            const shouldCreate =
                              estadoActual !== 'Bueno' && (existingUltimo == null || lastEstado === 'Bueno');
                            const shouldUpdate =
                              !shouldCreate &&
                              existingUltimo != null &&
                              ((estadoActual === 'Bueno' && lastEstado !== 'Bueno') || estadoActual !== lastEstado);

                            const newBasic = {
                              id: generateRandomMaintenanceId(),
                              articulo_plan_id: isPlan ? articuloEstructuraId : null,
                              articulo_asignado_id: isPlan ? null : articuloEstructuraId,
                              estado: estadoActual,
                              cantidad_necesaria: normalizeCantidadNecesaria(form.cantidad_requerida),
                              cantidad_real: Number(form.cantidad_real || 0),
                              observaciones: form.observaciones || '',
                              fecha_solucion: null,
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
                              c_archivos_adjuntos_articulo_mantenimiento: [],
                              created_at: horaAccionIso,
                              updated_at: horaAccionIso,
                              /** Opcional: indica que el registro se creó/actualizó desde Checklist de supervisión */
                              evaluacion_mantenimiento_origen: 'checklist_supervision' as const,
                            };

                            let nextUltimo: any = existingUltimo ? { ...existingUltimo } : { ...newBasic };
                            let nextMantenimientos: any[] = [...existingMaints];

                            if (shouldCreate) {
                              nextUltimo = { ...newBasic };
                              nextMantenimientos = [nextUltimo, ...nextMantenimientos];
                            } else {
                              nextUltimo = {
                                ...(existingUltimo ?? newBasic),
                                articulo_plan_id: isPlan ? articuloEstructuraId : null,
                                articulo_asignado_id: isPlan ? null : articuloEstructuraId,
                                estado: estadoActual,
                                cantidad_necesaria:
                                  existingUltimo?.cantidad_necesaria != null
                                    ? existingUltimo.cantidad_necesaria
                                    : normalizeCantidadNecesaria(form.cantidad_requerida),
                                cantidad_real: Number(form.cantidad_real || 0),
                                observaciones: form.observaciones || '',
                                fecha_solucion: estadoActual === 'Bueno' ? horaAccionIso : null,
                                updated_at: horaAccionIso,
                                evaluacion_mantenimiento_origen: 'checklist_supervision' as const,
                              };

                              if (existingUltimo?.id) {
                                let replaced = false;
                                nextMantenimientos = nextMantenimientos.map((m: any) => {
                                  if (Number(m?.id) !== Number(existingUltimo.id)) return m;
                                  replaced = true;
                                  return { ...m, ...nextUltimo };
                                });
                                if (!replaced) nextMantenimientos = [nextUltimo, ...nextMantenimientos];
                              } else {
                                nextMantenimientos = [nextUltimo, ...nextMantenimientos];
                              }

                            }

                            const nuevoUltimo = {
                              ...nextUltimo,
                            };

                            return {
                              ...art,
                              mantenimientos: nextMantenimientos,
                              ultimo_mantenimiento: nuevoUltimo,
                              ultimo_registro_mantenimiento: nuevoUltimo,
                            };
                          });

                          return {
                            ...puesto,
                            articulos: updatedArticulos,
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

    await AsyncStorage.setItem('main_structure_cache', JSON.stringify(updated));
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
  const navigation = useNavigation<any>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<ChecklistSupervisionUI[]>([]);

  // Estados para estructura jerárquica
  const [structure, setStructure] = useState<StructureNode[]>([]);
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
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [ejecutivoCuenta, setEjecutivoCuenta] = useState('-');
  const [evaluation, setEvaluation] = useState<EvaluationSection[]>([]);
  const [firmaSupervisor, setFirmaSupervisor] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Estados para firma dibujada
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

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

  // Estado para items expandidos (como StaffEvaluationsScreen)
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());

  // Estados para artículos del puesto
  const [articulos, setArticulos] = useState<ArticuloForm[]>([]);

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

  // Mismos nodos para filtros
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    return cliente?.division || [];
  }, [filterClientes, filterClienteId]);

  const filterContratos = useMemo(() => {
    const division = filterDivisiones.find((d: any) => d.id === filterDivisionId);
    return division?.contratos || [];
  }, [filterDivisiones, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    const contrato = filterContratos.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales || [];
  }, [filterContratos, filterContratoId]);

  const filterPuestos = useMemo(() => {
    const sucursal = filterSucursales.find((s: any) => s.id === filterCorpoId);
    return sucursal?.puestos || [];
  }, [filterSucursales, filterCorpoId]);

  // Cargar estructura principal
  const fetchMainStructure = useCallback(async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('main_structure_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed)) setStructure(parsed);
      }
      else {
        setStructure([]);
      }
/*
      const isConnected = await getConnectionStatus();
      if (!isConnected) return;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return;
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

      if (response.ok) {
        const data = await response.json();
        if (data.status && Array.isArray(data.structure)) {
          setStructure(data.structure);
          await AsyncStorage.setItem('main_structure_cache', JSON.stringify(data.structure));
        }
      }
      */
    } catch (error) {
      console.error('Error fetching main structure:', error);
    }
  }, [refreshAccessToken, logout]);

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const formatCambioCreatedAt = (value: any) => {
    if (!value) return '-';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(value);
    }
  };

  const formatEvaluacionForDisplay = (evaluacionStr: string): string => {
    try {
      const evalData = JSON.parse(evaluacionStr || '[]');
      if (!Array.isArray(evalData)) return evaluacionStr;

      const lines: string[] = [];
      evalData.forEach((section: any) => {
        if (section.title) {
          lines.push(`\n${section.title}:`);
        }
        if (Array.isArray(section.subsections)) {
          section.subsections.forEach((subsection: any) => {
            if (subsection.title) {
              lines.push(`  - ${subsection.title}`);
            }
            if (Array.isArray(subsection.inputs)) {
              subsection.inputs.forEach((input: any) => {
                const title = input.title || 'Valor';
                let value = input.value || '';
                if (input.type === 'checkbox') {
                  value = value === 'true' ? 'Marcado' : 'No marcado';
                } else if (input.type === 'photo') {
                  value = value || input.file_name ? 'Imagen adjunta' : '-';
                }
                lines.push(`    • ${title}: ${value}`);
              });
            }
          });
        }
      });
      return lines.join('\n') || evaluacionStr;
    } catch {
      return evaluacionStr;
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') {
      // Si parece ser JSON, intentar parsearlo
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.map((item, idx) => {
              if (typeof item === 'object' && item !== null) {
                return `Item ${idx + 1}: ${JSON.stringify(item, null, 2)}`;
              }
              return String(item);
            }).join('\n');
          }
          if (typeof parsed === 'object') {
            return JSON.stringify(parsed, null, 2);
          }
        } catch {
          // No es JSON válido, retornar como string
        }
      }
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
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

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      return loc;
    } catch {
      return null;
    }
  };

  // Cargar checklists
  const fetchChecklists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isConnected = await getConnectionStatus();

      // Cargar desde cache primero
      const cacheStr = await AsyncStorage.getItem('checklist_supervision_cache');
      if (cacheStr) {
        const cached = JSON.parse(cacheStr);
        if (Array.isArray(cached)) setChecklists(cached);
      }

      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      const result = await listChecklistSupervision({
        clienteId: filterClienteId || undefined,
        corpoId: filterCorpoId || undefined,
        puestoId: filterPuestoId || undefined,
        refreshAccessToken,
        logout,
      });

      if (result.status && result.data) {
        setChecklists(result.data);
        await AsyncStorage.setItem('checklist_supervision_cache', JSON.stringify(result.data));
      } else {
        setError(result.message || 'Error al cargar checklists');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar checklists');
    } finally {
      setIsLoading(false);
    }
  }, [filterClienteId, filterCorpoId, filterPuestoId, refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchMainStructure();
      fetchChecklists();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchChecklists();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando cambia la división seleccionada, cargar evaluación (solo si no estamos editando)
  useEffect(() => {
    // No cargar secciones predefinidas si estamos editando un registro existente
    if (editing) return;

    if (selectedDivisionId && isCreating) {
      // Buscar la división seleccionada por nombre (usar divisiones del useMemo)
      const selectedDivision = divisiones.find((d: any) => d.id === selectedDivisionId);
      if (selectedDivision) {
        const divisionName = (selectedDivision.nombre || '').toLowerCase();
        if (divisionName.includes('aseo') || divisionName.includes('limpieza')) {
          setEvaluation(JSON.parse(JSON.stringify(ASEO_LIMPIEZA_SECTIONS)));
        } else if (divisionName.includes('seguridad')) {
          setEvaluation(JSON.parse(JSON.stringify(SEGURIDAD_SECTIONS)));
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
    // No cargar artículos si estamos editando un registro existente
    if (editing) return;

    if (selectedPuestoId && isCreating && selectedDivisionId) {
      // Buscar el puesto en la estructura (usar sucursales del useMemo)
      const sucursal = sucursales.find((s: any) => s.id === selectedCorpoId);
      const puesto = sucursal?.puestos?.find((p: any) => p.id === selectedPuestoId);

      if (puesto && (puesto as any).articulos && Array.isArray((puesto as any).articulos)) {
        // Inicializar artículos: precargar estado + cantidad_real según último mantenimiento (si existe)
        const articulosForm: ArticuloForm[] = (puesto as any).articulos.map((art: any) => {
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

          return {
            id: art.id,
            nombre: art.nombre || 'Desconocido',
            tipo: art.tipo || '',
            cantidad_requerida: normalizeCantidadNecesaria(
              typeof art?.cantidad === 'number' ? art.cantidad : Number(art?.cantidad)
            ),
            cantidad_real,
            estado,
            observaciones: art.observaciones || '',
          };
        });
        setArticulos(articulosForm);
      } else {
        setArticulos([]);
      }
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
      title: '',
      options: type === 'select' ? ['Opción 1', 'Opción 2'] : undefined,
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
      inputs: newSubsectionInputs.map((input, idx) => ({
        id: `input-${Date.now()}-${idx}`,
        ...input,
        value: input.type === 'checkbox' ? 'true' : '',
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

  const deleteSubsection = (sectionId: string, subsectionId: string) => {
    const section = evaluation.find((s) => s.id === sectionId);
    if (section?.isPredefined) {
      Alert.alert('Error', 'No se pueden eliminar subsecciones predefinidas');
      return;
    }
    setEvaluation(
      evaluation.map((s) =>
        s.id === sectionId
          ? { ...s, subsections: s.subsections.filter((sub) => sub.id !== subsectionId) }
          : s
      )
    );
  };

  const addInput = (sectionId: string, subsectionId: string, type: 'text' | 'textarea' | 'select' | 'date' | 'photo' | 'checkbox') => {
    const newInput: EvaluationInput = {
      id: `input-${Date.now()}`,
      type,
      title: '',
      value: type === 'checkbox' ? 'true' : '',
      options: type === 'select' ? ['Opción 1', 'Opción 2'] : undefined,
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

  const deleteInput = (sectionId: string, subsectionId: string, inputId: string) => {
    const section = evaluation.find((s) => s.id === sectionId);
    if (section?.isPredefined) {
      Alert.alert('Error', 'No se pueden eliminar inputs predefinidos');
      return;
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
    setIsSignatureModalVisible(true);
    setSignatureKey((prev) => prev + 1);
  };

  const handleSignatureRead = (signature: string) => {
    if (signature) {
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        formattedSignature = `data:image/png;base64,${signature}`;
      }
      setFirmaSupervisor(formattedSignature);
      setIsSignatureModalVisible(false);
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
      const loc = location ?? (await requestLocation());
      if (!loc || !employee) {
        Alert.alert('Error', 'No se pudo obtener ubicación o usuario');
        return;
      }
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('No authentication token found');
      const decodedToken: any = jwtDecode(token);
      const sessionId = decodedToken.sessionId;
      const horaAccion = await getHoraAccion();
      const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
      setFirmaResponsable(hash);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo generar la firma');
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
  const getImageUri = (input: EvaluationInput): string => {
    console.log('[ChecklistSupervision] getImageUri called for input:', {
      id: input.id,
      hasValue: !!input.value,
      valuePrefix: typeof input.value === 'string' ? input.value.substring(0, 30) : null,
      file_name: input.file_name,
    });
    // Si input.value es un data URI válido, usarlo directamente
    if (input.value && typeof input.value === 'string') {
      if (input.value.startsWith('data:image/')) {
        console.log('[ChecklistSupervision] getImageUri returning data URI for input:', input.id);
        return input.value;
      }
      // Si parece base64 sin encabezado, envolverlo en un data URI (mejora robustez de la vista previa)
      if (input.value.length > 100 && !input.value.startsWith('http')) {
        const wrapped = `data:image/jpeg;base64,${input.value}`;
        console.log('[ChecklistSupervision] getImageUri wrapping base64 without header for input:', input.id);
        return wrapped;
      }
    }

    // Para registros sincronizados, usar la API
    if (editing?.id && editing.id > 0 && input.file_name) {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        const uri = appendTokenToUrl(`${apiUrl}/api/checklist-supervision/${editing.id}/get-image/${encodeURIComponent(input.file_name)}`);
        console.log('[ChecklistSupervision] getImageUri using file_name URL for input:', input.id, 'url:', uri);
        return uri;
      }
    }

    // Si tenemos file_name pero no value, construir la URL (para registros cargados desde backend)
    if (input.file_name && editing?.id && editing.id > 0) {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        const uri = appendTokenToUrl(`${apiUrl}/api/checklist-supervision/${editing.id}/get-image/${encodeURIComponent(input.file_name)}`);
        console.log('[ChecklistSupervision] getImageUri using fallback file_name URL for input:', input.id, 'url:', uri);
        return uri;
      }
    }

    // Fallback: usar input.value si existe
    const fallback = (input.value && typeof input.value === 'string') ? input.value : '';
    console.log('[ChecklistSupervision] getImageUri using fallback for input:', input.id, 'valuePrefix:', fallback.substring(0, 30));
    return fallback;
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
        base64: true,
        quality: 0.7,
        skipProcessing: false,
      });
      console.log('[ChecklistSupervision] takePicture received photo:', {
        hasBase64: !!photo?.base64,
        width: photo?.width,
        height: photo?.height,
      });
      setIsCameraVisible(false);
      if (!photo || !photo.base64) {
        Alert.alert('Error', 'No se pudo capturar la imagen');
        return;
      }
      const formattedBase64 = `data:image/jpeg;base64,${photo.base64}`;
      console.log('[ChecklistSupervision] takePicture formattedBase64 length:', formattedBase64.length);

      let sectionId: string | undefined;
      let subsectionId: string | undefined;
      let inputId: string | undefined;

      if (cameraTarget.includes('|')) {
        // Nuevo formato seguro: sectionId|subsectionId|inputId
        const parts = cameraTarget.split('|');
        [sectionId, subsectionId, inputId] = parts;
        console.log('[ChecklistSupervision] takePicture target parsed from |:', { sectionId, subsectionId, inputId });
      } else {
        // Compatibilidad con formato antiguo basado en guiones
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

        // Actualizar usando updateInputField (como StaffEvaluationsScreen)
        console.log('[ChecklistSupervision] Updating inputField with captured image.');
        updateInputField(sectionId, subsectionId, inputId, 'value', formattedBase64);

        // Calcular orientación a partir de las dimensiones de la foto
        if (photo.width && photo.height) {
          const orientation: 'horizontal' | 'vertical' =
            photo.width >= photo.height ? 'horizontal' : 'vertical';
          console.log('[ChecklistSupervision] Calculated image orientation:', orientation);
          updateInputField(sectionId, subsectionId, inputId, 'imageOrientation', orientation);
        }
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

  // Funciones para CRUD
  const resetForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setFecha(new Date(horaAccion));
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

  const startCreating = async () => {
    await resetForm();
    setEditing(null);
    setIsCreating(true);
  };

  const startEditing = async (it: ChecklistSupervisionUI) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    // Establecer editing PRIMERO para evitar que useEffect sobrescriba la evaluación
    setEditing(it);
    setIsCreating(true);
    setFecha(it.fecha ? new Date(it.fecha) : new Date(horaAccion));
    setEjecutivoCuenta(it.ejecutivo_cuenta || '');
    setFirmaSupervisor(it.firma_supervisor || '');
    setFirmaResponsable(it.firma_responsable || '');

    // Cargar evaluación INMEDIATAMENTE para preservar los valores
    try {
      const evalData = JSON.parse(it.evaluacion || '[]');
      const parsedEvaluation = Array.isArray(evalData) ? evalData : [];
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
          const articulosConObservaciones = parsedArticulos.map((art: any) => ({
            ...art,
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

    // Cargar jerarquía basándose en los IDs del registro (después de cargar evaluación)
    // Buscar empresa que contiene el cliente
    const empresa = structure.find((e: any) => e.clientes?.some((c: any) => c.id === it.cliente_id));
    if (empresa) {
      setSelectedEmpresaId(empresa.id);
    }
    setSelectedClienteId(it.cliente_id);

    // Buscar la división y contrato basándose en el cliente y corpo_id
    const cliente = empresa?.clientes?.find((c: any) => c.id === it.cliente_id);
    if (cliente && cliente.division && cliente.division.length > 0) {
      // Buscar la división que contiene el corpo_id
      for (const div of cliente.division) {
        const contratos = div.contratos || [];
        for (const contrato of contratos) {
          const sucursales = contrato.sucursales || [];
          if (sucursales.some((s: any) => s.id === it.corpo_id)) {
            // Usar setTimeout para asegurar que editing esté establecido antes de cambiar selectedDivisionId
            setTimeout(() => {
              setSelectedDivisionId(div.id);
              setSelectedContratoId(contrato.id);
            }, 100);
            break;
          }
        }
      }
    }
    setSelectedCorpoId(it.corpo_id);
    setSelectedPuestoId(it.puesto_id);
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
    // firma_supervisor es opcional; solo se requiere la firma responsable.
    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }

    try {
      // Verificar que las imágenes estén en la evaluación antes de enviar (como StaffEvaluationsScreen)
      const evaluationWithImages = JSON.parse(JSON.stringify(evaluation));
      let hasImages = false;
      let imageCount = 0;
      const checkForImages = (obj: any) => {
        if (Array.isArray(obj)) {
          obj.forEach(item => checkForImages(item));
        } else if (obj && typeof obj === 'object') {
          // Buscar imágenes en value (data URI) como StaffEvaluationsScreen
          if (obj.type === 'photo' && obj.value && typeof obj.value === 'string' && obj.value.startsWith('data:image/')) {
            hasImages = true;
            imageCount++;
            console.log(`Imagen #${imageCount} encontrada en evaluación:`, {
              id: obj.id,
              hasValue: !!obj.value,
              valueLength: obj.value.length,
              imageOrientation: obj.imageOrientation
            });
          }
          Object.values(obj).forEach(value => checkForImages(value));
        }
      };
      checkForImages(evaluationWithImages);
      console.log(`Evaluación a enviar tiene ${imageCount} imagen(es):`, hasImages);

      // Log del tamaño del JSON para verificar que las imágenes estén incluidas
      const evaluationString = JSON.stringify(evaluationWithImages);
      console.log('Tamaño del JSON de evaluación:', evaluationString.length, 'caracteres');

      const articulosPuesto = articulos && articulos.length > 0 ? JSON.stringify(articulos) : '[]';

      const horaAccionIso = new Date(horaAccion).toISOString();
      const requestData = {
        cliente_id: selectedClienteId,
        division_id: selectedDivisionId,
        corpo_id: selectedCorpoId,
        puesto_id: selectedPuestoId,
        division: selectedDivisionId,
        fecha: fecha.toISOString(),
        ejecutivo_cuenta: ejecutivoCuenta,
        evaluacion: JSON.stringify(evaluationWithImages),
        articulos_puesto: articulosPuesto,
        firma_supervisor: firmaSupervisor,
        firma_responsable: firmaResponsable,
        created_at: horaAccionIso,
        hora_accion: horaAccionIso,
      };

      const isConnected = await getConnectionStatus();

      if (editing && editing.id && editing.id !== 0) {
        // Actualizar
        if (isConnected) {
          const result = await updateChecklistSupervision({
            id: editing.id,
            requestData,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            // Online: actualizar caches sin encolar acciones de mantenimiento (ya se sincronizan por API)
            await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
              horaAccion,
            });
            await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);

            Alert.alert('Éxito', result.message || 'Checklist actualizado correctamente');
            setTimeout(async () => {
              await fetchChecklists();
              cancelCreating();
            }, 2000);
          } else {
            Alert.alert('Error', result.message || 'No se pudo actualizar');
          }
        } else {
          // Offline: guardar acción
          const localId = editing.id_local || generateRandomId();
          const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
          const actions = actionsStr ? JSON.parse(actionsStr) : [];
          actions.push({
            type: 'update',
            id: editing.id,
            id_local: localId,
            requestData,
          });
          await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(actions));

          // Actualizar cache
          const updated: ChecklistSupervisionUI[] = checklists.map((c) =>
            c.id === editing.id ? { ...c, ...requestData, id_local: localId } as ChecklistSupervisionUI : c
          );
          setChecklists(updated);
          await AsyncStorage.setItem('checklist_supervision_cache', JSON.stringify(updated));

          // Offline: actualizar solo caches locales (sin encolar acciones de mantenimiento)
          await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
            horaAccion,
          });
          await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);

          Alert.alert('Éxito', 'Checklist guardado localmente. Se sincronizará cuando haya conexión.');
          setTimeout(() => {
            cancelCreating();
          }, 2000);
        }
        } else {
        // Crear
        if (isConnected) {
          const result = await createChecklistSupervision({
            requestData,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            // Online: actualizar caches sin encolar acciones de mantenimiento
            await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
              horaAccion,
            });
            await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);

            Alert.alert('Éxito', result.message || 'Checklist creado correctamente');
            setTimeout(async () => {
              await fetchChecklists();
              cancelCreating();
            }, 2000);
          } else {
            Alert.alert('Error', result.message || 'No se pudo crear');
          }
        } else {
          // Offline: guardar acción
          const localId = generateRandomId();
          const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
          const actions = actionsStr ? JSON.parse(actionsStr) : [];
          actions.push({
            type: 'create',
            id_local: localId,
            requestData,
          });
          await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(actions));

          // Agregar a cache
          if (!selectedClienteId || !selectedDivisionId || !selectedCorpoId || !selectedPuestoId) {
            Alert.alert('Error', 'Debes completar todos los campos requeridos');
            setIsSubmitting(false);
            return;
          }
          const newItem: ChecklistSupervisionUI = {
            id: 0,
            id_local: localId,
            cliente_id: selectedClienteId,
            division_id: selectedDivisionId,
            corpo_id: selectedCorpoId,
            puesto_id: selectedPuestoId,
            fecha: fecha.toISOString(),
            ejecutivo_cuenta: ejecutivoCuenta,
            evaluacion: JSON.stringify(evaluation),
            firma_supervisor: firmaSupervisor,
            firma_responsable: firmaResponsable,
            created_by: typeof employee?.id === 'number' ? employee.id : (employee?.id ? Number(employee.id) : 0),
            created_at: new Date(horaAccion).toISOString(),
          };
          const updated = [...checklists, newItem];
          setChecklists(updated);
          await AsyncStorage.setItem('checklist_supervision_cache', JSON.stringify(updated));

          // Offline: actualizar solo caches locales (sin encolar acciones de mantenimiento)
          await updateMainStructureCacheWithChecklist(selectedPuestoId || null, articulos, {
            horaAccion,
          });
          await updateActivitiesCacheWithChecklist(selectedPuestoId || null, articulos);

          Alert.alert('Éxito', 'Checklist guardado localmente. Se sincronizará cuando haya conexión.');
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

  const handleDelete = async (it: ChecklistSupervisionUI) => {
    Alert.alert('Confirmar', '¿Eliminar este checklist?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
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
          } else {
            // Offline: guardar acción
            const actionsStr = await AsyncStorage.getItem('checklist_supervision_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            actions.push({
              type: 'delete',
              id: it.id || 0,
              id_local: it.id_local,
            });
            await AsyncStorage.setItem('checklist_supervision_actions', JSON.stringify(actions));

            // Eliminar de cache
            const updated = checklists.filter((c) => {
              if (it.id && it.id !== 0) return c.id !== it.id;
              if (it.id_local) return c.id_local !== it.id_local;
              return false;
            });
            setChecklists(updated);
            await AsyncStorage.setItem('checklist_supervision_cache', JSON.stringify(updated));

            Alert.alert('Modo Offline', 'Checklist eliminado localmente. Se sincronizará cuando haya conexión.');
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
  };

  // Filtrar checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter((c) => {
      if (filterSearch) {
        const searchLower = filterSearch.toLowerCase();
        const matchesSearch =
          c.ejecutivo_cuenta?.toLowerCase().includes(searchLower) ||
          (c.cliente?.nombre || '').toLowerCase().includes(searchLower) ||
          (c.corpo?.nombre || '').toLowerCase().includes(searchLower) ||
          (c.puesto?.nombre || '').toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      if (filterClienteId && c.cliente_id !== filterClienteId) return false;
      if (filterDivisionId && c.division_id !== filterDivisionId) return false;
      if (filterCorpoId && c.corpo_id !== filterCorpoId) return false;
      if (filterPuestoId && c.puesto_id !== filterPuestoId) return false;
      return true;
    });
  }, [checklists, filterSearch, filterClienteId, filterDivisionId, filterCorpoId, filterPuestoId]);

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
                // Si el select es de un carné y cambia a "Vencido", limpiar la fecha de vencimiento
                if (input.id.includes('-cal') && value === 'Vencido') {
                  const prefixMatch = input.id.match(/^(car-\d+)/);
                  if (prefixMatch) {
                    const prefix = prefixMatch[1];
                    const fechaInputId = `${prefix}-fecha-vencimiento`;
                    // Buscar y limpiar el input de fecha correspondiente
                    const section = evaluation.find(s => s.id === sectionId);
                    const subsection = section?.subsections.find(sub => sub.id === subsectionId);
                    const fechaInput = subsection?.inputs.find(inp => inp.id === fechaInputId);
                    if (fechaInput) {
                      updateInput(sectionId, subsectionId, fechaInputId, { value: '' });
                    }
                  }
                }
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar opción..." value="" />
              {(input.options || []).map((opt) => (
                <Picker.Item key={opt} label={opt} value={opt} />
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

  // Función para parsear evaluación desde JSON
  const parseEvaluation = (evaluacionStr: string | null): EvaluationSection[] => {
    if (!evaluacionStr) return [];
    try {
      const parsed = JSON.parse(evaluacionStr);
      const result = Array.isArray(parsed) ? parsed : [];
      console.log('parseEvaluation: Parsed evaluation:', {
        sections: result.length,
        firstSection: result[0]?.title,
        firstSubsection: result[0]?.subsections?.[0]?.title,
        firstInput: result[0]?.subsections?.[0]?.inputs?.[0],
        firstInputValue: result[0]?.subsections?.[0]?.inputs?.[0]?.value
      });
      return result;
    } catch (error) {
      console.error('parseEvaluation: Error parsing evaluation:', error);
      return [];
    }
  };

  // Función para obtener URI de imagen en lista
  const getImageUriForList = (input: EvaluationInput, checklistId: number | string): string => {
    if (input.value && typeof input.value === 'string' && input.value.startsWith('data:image/')) {
      return input.value;
    }
    if (input.file_name && typeof checklistId === 'number' && checklistId > 0) {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        return appendTokenToUrl(`${apiUrl}/api/checklist-supervision/${checklistId}/get-image/${encodeURIComponent(input.file_name)}`);
      }
    }
    return '';
  };

  const renderItem = (it: ChecklistSupervisionUI, index: number) => {
    const key = it.id !== 0 ? `checklist-${it.id}` : it.id_local ? `checklist-${it.id_local}` : `checklist-${index}`;
    const isExpanded = expandedChecklists.has(key);
    const fechaStr = it.fecha ? new Date(it.fecha).toLocaleDateString() : '-';
    const evaluationSections = parseEvaluation(it.evaluacion);
    console.log('renderItem: Evaluation sections for item:', {
      itemId: it.id || it.id_local,
      sectionsCount: evaluationSections.length,
      firstSection: evaluationSections[0],
      firstInputValue: evaluationSections[0]?.subsections?.[0]?.inputs?.[0]?.value
    });

    return (
      <ThemedView key={key} style={styles.bitacoraCard}>
        <ThemedText style={styles.bitTitle}>
          {it.cliente?.nombre || '-'} - {it.corpo?.nombre || '-'} - {it.puesto?.nombre || '-'}
          {it.id_local ? ' (offline)' : ''}
        </ThemedText>
        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
          <ThemedText style={styles.bitValue}>{fechaStr}</ThemedText>
        </ThemedText>

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
                  {section.subsections.map((subsection) => (
                    <ThemedView key={subsection.id} style={styles.questionRow}>
                      {subsection.title && subsection.title.trim() !== '' && (
                        <ThemedText style={styles.questionTitleList}>{subsection.title}</ThemedText>
                      )}
                      {subsection.inputs.map((input) => {
                        console.log('renderItem: Rendering input:', {
                          inputId: input.id,
                          inputType: input.type,
                          inputTitle: input.title,
                          subsectionTitle: subsection.title,
                          inputValue: input.value,
                          hasValue: !!input.value,
                          valueType: typeof input.value
                        });
                        return (
                          <ThemedView key={input.id}>
                            {/* Mostrar título del input si existe y es diferente al título de la subsección */}
                            {input.title && input.title.trim() !== '' && input.title !== subsection.title && (
                              <ThemedText style={styles.evalLine}>
                                <ThemedText style={styles.evalLabel}>{input.title}: </ThemedText>
                                <ThemedText style={styles.evalValue}>
                                  {input.type === 'photo'
                                    ? (input.value || input.file_name ? 'Imagen adjunta' : '-')
                                    : input.type === 'checkbox'
                                      ? (input.value === 'true' ? 'Marcado' : 'No marcado')
                                      : (input.value || '-')}
                                </ThemedText>
                              </ThemedText>
                            )}
                            {/* Si el título del input es igual al de la subsección, mostrar solo el valor */}
                            {input.title && input.title.trim() !== '' && input.title === subsection.title && (
                              <ThemedText style={styles.evalLine}>
                                <ThemedText style={styles.evalLabel}>{input.title}: </ThemedText>
                                <ThemedText style={styles.evalValue}>
                                  {input.type === 'photo'
                                    ? (input.value || input.file_name ? 'Imagen adjunta' : '-')
                                    : input.type === 'checkbox'
                                      ? (input.value === 'true' ? 'Marcado' : 'No marcado')
                                      : (input.value || '-')}
                                </ThemedText>
                              </ThemedText>
                            )}
                            {/* Si no hay título, mostrar "Valor:" */}
                            {(!input.title || input.title.trim() === '') && (
                              <ThemedText style={styles.evalLine}>
                                <ThemedText style={styles.evalLabel}>Valor: </ThemedText>
                                <ThemedText style={styles.evalValue}>
                                  {input.type === 'photo'
                                    ? (input.value || input.file_name ? 'Imagen adjunta' : '-')
                                    : input.type === 'checkbox'
                                      ? (input.value === 'true' ? 'Marcado' : 'No marcado')
                                      : (input.value || '-')}
                                </ThemedText>
                              </ThemedText>
                            )}
                            {/* Mostrar imagen si es tipo photo */}
                            {input.type === 'photo' && (input.value || input.file_name) && (
                              <Image
                                source={{
                                  uri: getImageUriForList(input, it.id || it.id_local || 0),
                                }}
                                style={[
                                  styles.questionImagePreviewList,
                                  input.imageOrientation === 'vertical'
                                    ? styles.questionImagePreviewListVertical
                                    : styles.questionImagePreviewListHorizontal,
                                ]}
                                resizeMode="contain"
                                onError={(e) => {
                                  console.error('Error loading image in list:', e.nativeEvent.error);
                                }}
                              />
                            )}
                          </ThemedView>
                        );
                      })}
                    </ThemedView>
                  ))}
                </ThemedView>
              ))
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startEditing(it)}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
          </TouchableOpacity>
          {!(it.id_local || it.id === 0) && (
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
          <TouchableOpacity style={[styles.listItemButton, styles.deleteButton]} onPress={() => handleDelete(it)}>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
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
                      placeholder="Cliente, Sucursal, Puesto..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  {/* Árbol jerárquico para filtros */}
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={filterEmpresaId || ''}
                        onValueChange={(value) => {
                          setFilterEmpresaId(value && value !== '' ? Number(value) : null);
                          setFilterClienteId(null);
                          setFilterDivisionId(null);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                          setFilterPuestoId(null);
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Seleccionar..." value="" />
                        {filterEmpresas.map((e: any) => (
                          <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>

                  {filterEmpresaId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={filterClienteId || ''}
                          onValueChange={(value) => {
                            setFilterClienteId(value && value !== '' ? Number(value) : null);
                            setFilterDivisionId(null);
                            setFilterContratoId(null);
                            setFilterCorpoId(null);
                            setFilterPuestoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterClientes.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterClienteId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>División:</ThemedText>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={filterDivisionId || ''}
                          onValueChange={(value) => {
                            setFilterDivisionId(value && value !== '' ? Number(value) : null);
                            setFilterContratoId(null);
                            setFilterCorpoId(null);
                            setFilterPuestoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterDivisiones.map((d: any) => (
                            <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterDivisionId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={filterContratoId || ''}
                          onValueChange={(value) => {
                            setFilterContratoId(value && value !== '' ? Number(value) : null);
                            setFilterCorpoId(null);
                            setFilterPuestoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterContratos.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterContratoId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={filterCorpoId || ''}
                          onValueChange={(value) => {
                            setFilterCorpoId(value && value !== '' ? Number(value) : null);
                            setFilterPuestoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterSucursales.map((s: any) => (
                            <Picker.Item key={s.id} label={s.nombre} value={s.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterCorpoId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={filterPuestoId || ''}
                          onValueChange={(value) => setFilterPuestoId(value && value !== '' ? Number(value) : null)}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterPuestos.map((p: any) => (
                            <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}
                </ThemedView>
              )}
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

              {/* Árbol jerárquico para formulario */}
              <ThemedView style={styles.filterGroup}>
                <ThemedText style={styles.label}>Empresa *</ThemedText>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedEmpresaId || ''}
                    onValueChange={(value) => {
                      setSelectedEmpresaId(value && value !== '' ? Number(value) : null);
                      setSelectedClienteId(null);
                      setSelectedDivisionId(null);
                      setSelectedContratoId(null);
                      setSelectedCorpoId(null);
                      setSelectedPuestoId(null);
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar..." value="" />
                    {empresas.map((e: any) => (
                      <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                    ))}
                  </Picker>
                </View>
              </ThemedView>

              {selectedEmpresaId && (
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.label}>Cliente *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedClienteId || ''}
                      onValueChange={(value) => {
                        setSelectedClienteId(value && value !== '' ? Number(value) : null);
                        setSelectedDivisionId(null);
                        setSelectedContratoId(null);
                        setSelectedCorpoId(null);
                        setSelectedPuestoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {clientes.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                  {selectedClienteId && clientes.length === 0 && (
                    <ThemedText style={styles.errorText}>No hay clientes disponibles</ThemedText>
                  )}
                </ThemedView>
              )}

              {selectedClienteId && (
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.label}>División *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedDivisionId || ''}
                      onValueChange={(value) => {
                        setSelectedDivisionId(value && value !== '' ? Number(value) : null);
                        setSelectedContratoId(null);
                        setSelectedCorpoId(null);
                        setSelectedPuestoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {divisiones.map((d: any) => (
                        <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                      ))}
                    </Picker>
                  </View>
                  {selectedDivisionId && divisiones.length === 0 && (
                    <ThemedText style={styles.errorText}>No hay divisiones disponibles</ThemedText>
                  )}
                </ThemedView>
              )}

              {selectedDivisionId && (
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.label}>Contrato *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedContratoId || ''}
                      onValueChange={(value) => {
                        setSelectedContratoId(value && value !== '' ? Number(value) : null);
                        setSelectedCorpoId(null);
                        setSelectedPuestoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {contratos.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                  {selectedContratoId && contratos.length === 0 && (
                    <ThemedText style={styles.errorText}>No hay contratos disponibles</ThemedText>
                  )}
                </ThemedView>
              )}

              {selectedContratoId && (
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.label}>Sucursal *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedCorpoId || ''}
                      onValueChange={(value) => {
                        setSelectedCorpoId(value && value !== '' ? Number(value) : null);
                        setSelectedPuestoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {sucursales.map((s: any) => (
                        <Picker.Item key={s.id} label={s.nombre} value={s.id} />
                      ))}
                    </Picker>
                  </View>
                  {selectedCorpoId && sucursales.length === 0 && (
                    <ThemedText style={styles.errorText}>No hay sucursales disponibles</ThemedText>
                  )}
                </ThemedView>
              )}

              {selectedCorpoId && (
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.label}>Puesto *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedPuestoId || ''}
                      onValueChange={(value) => setSelectedPuestoId(value && value !== '' ? Number(value) : null)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {puestos.map((p: any) => (
                        <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                      ))}
                    </Picker>
                  </View>
                  {selectedPuestoId && puestos.length === 0 && (
                    <ThemedText style={styles.errorText}>No hay puestos disponibles</ThemedText>
                  )}
                </ThemedView>
              )}

              <ThemedText style={styles.label}>Fecha *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaPicker(true)}>
                <ThemedText style={styles.dateButtonText}>
                  {convertDateTimestampToLocalString(new Date(fecha).toISOString(), false)}
                </ThemedText>
                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
              </TouchableOpacity>

              {/* Evaluación dinámica */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Evaluación</ThemedText>
                {evaluation.length === 0 && selectedDivisionId && (
                  <ThemedText style={styles.errorText}>
                    Selecciona una división válida (Aseo y limpieza o Seguridad) para cargar el formulario
                  </ThemedText>
                )}

                {evaluation.map((section) => (
                  <ThemedView key={section.id} style={styles.sectionCard}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                      {!section.isPredefined && (
                        <TouchableOpacity onPress={() => deleteSection(section.id)}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      )}
                    </ThemedView>

                    {section.subsections.map((subsection) => (
                      <ThemedView key={subsection.id} style={styles.questionCard}>
                        {subsection.title && subsection.title.trim() !== '' && (
                          <ThemedText style={styles.questionTitleList}>
                            {subsection.title}
                          </ThemedText>
                        )}
                        {subsection.inputs.map((input) => {
                          // Verificar si este input de fecha debe mostrarse (solo si el select anterior es "Vigente")
                          if (input.type === 'date' && input.id.includes('fecha-vencimiento')) {
                            // Extraer el prefijo del ID (car-0, car-1, car-3)
                            const prefixMatch = input.id.match(/^(car-\d+)/);
                            if (prefixMatch) {
                              const prefix = prefixMatch[1];
                              // Buscar el input select correspondiente en la misma subsección
                              const selectInput = subsection.inputs.find(inp =>
                                inp.type === 'select' && inp.id === `${prefix}-cal`
                              );
                              // Si el select no es "Vigente", no mostrar el input de fecha
                              if (!selectInput || selectInput.value !== 'Vigente') {
                                return null;
                              }
                            }
                          }
                          return (
                            <ThemedView key={input.id} style={styles.inputCard}>
                              {input.title && input.title.trim() !== '' && input.title !== subsection.title && (
                                <ThemedText style={styles.questionTitleList}>
                                  {input.title}
                                </ThemedText>
                              )}
                              {input.type === 'photo' || (input.type === 'text' && input.title?.toLowerCase().includes('foto')) ? (
                                <View>
                                  {((input.value && input.value.startsWith('data:image/')) || input.file_name) ? (
                                    <View>
                                      <Image
                                        source={{ uri: getImageUri(input) }}
                                        style={[
                                          styles.questionImagePreview,
                                          input.imageOrientation === 'vertical'
                                            ? styles.questionImagePreviewVertical
                                            : styles.questionImagePreviewHorizontal,
                                        ]}
                                        resizeMode="contain"
                                        onError={(e) => {
                                          console.error('Error loading image:', e.nativeEvent.error);
                                        }}
                                      />
                                      <TouchableOpacity
                                        style={styles.cameraSmallButton}
                                        onPress={() => {
                                          updateInputField(section.id, subsection.id, input.id, 'value', '');
                                          updateInputField(section.id, subsection.id, input.id, 'imageOrientation', null);
                                          updateInput(section.id, subsection.id, input.id, { file_name: undefined });
                                        }}
                                      >
                                        <Ionicons name="trash" size={16} color="#FF3B30" />
                                        <ThemedText style={styles.cameraSmallButtonText}>Eliminar imagen</ThemedText>
                                      </TouchableOpacity>
                                    </View>
                                  ) : null}
                                  <TouchableOpacity
                                    style={styles.cameraSmallButton}
                                    onPress={() => handleAddPhoto(`${section.id}|${subsection.id}|${input.id}`)}
                                  >
                                    <Ionicons name="camera" size={16} color="#000000" />
                                    <ThemedText style={styles.cameraSmallButtonText}>
                                      {(input.value && input.value.startsWith('data:image/')) || input.file_name ? 'Cambiar imagen' : 'Tomar foto'}
                                    </ThemedText>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View>
                                  {renderEvaluationInput(input, section.id, subsection.id)}
                                  {!section.isPredefined && (
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
                        })}
                        {!section.isPredefined && (
                          <TouchableOpacity
                            style={styles.cameraSmallButton}
                            onPress={() => {
                              Alert.alert(
                                'Tipo de input',
                                'Selecciona el tipo de input',
                                [
                                  { text: 'Texto', onPress: () => addInput(section.id, subsection.id, 'text') },
                                  { text: 'Texto largo', onPress: () => addInput(section.id, subsection.id, 'textarea') },
                                  { text: 'Select', onPress: () => addInput(section.id, subsection.id, 'select') },
                                  { text: 'Fecha', onPress: () => addInput(section.id, subsection.id, 'date') },
                                  { text: 'Foto', onPress: () => addInput(section.id, subsection.id, 'photo') },
                                  { text: 'Checkbox', onPress: () => addInput(section.id, subsection.id, 'checkbox') },
                                  { text: 'Cancelar', style: 'cancel' },
                                ]
                              );
                            }}
                          >
                            <Ionicons name="add" size={16} color="#007AFF" />
                            <ThemedText style={styles.cameraSmallButtonText}>Agregar input</ThemedText>
                          </TouchableOpacity>
                        )}
                        {!section.isPredefined && (
                          <TouchableOpacity
                            style={[styles.cameraSmallButton, { backgroundColor: '#FFECEC', borderColor: '#FF3B30' }]}
                            onPress={() => deleteSubsection(section.id, subsection.id)}
                          >
                            <Ionicons name="trash" size={16} color="#FF3B30" />
                            <ThemedText style={[styles.cameraSmallButtonText, { color: '#FF3B30' }]}>Eliminar subsección</ThemedText>
                          </TouchableOpacity>
                        )}
                      </ThemedView>
                    ))}

                    {/* Botón para agregar nueva subsección - debe estar fuera del map pero dentro de sectionCard */}
                    <TouchableOpacity
                      style={styles.cameraSmallButton}
                      onPress={() => addSubsection(section.id)}
                    >
                      <Ionicons name="add" size={16} color="#007AFF" />
                      <ThemedText style={styles.cameraSmallButtonText}>Agregar subsección</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ))}

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
                          <View key={articulo.id} style={styles.tableRowFixed}>
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
                          </View>
                          {/* Filas de datos */}
                          {articulos.map((articulo, index) => (
                            <View key={articulo.id} style={styles.tableRow}>
                              <View style={styles.tableCell}>
                                <View style={styles.pickerContainerTable}>
                                  <Picker
                                    selectedValue={articulo.estado}
                                    onValueChange={(value) => handleArticuloEstadoChange(index, value)}
                                    style={styles.pickerTable}
                                    itemStyle={styles.pickerItemStyle}
                                  >
                                    <Picker.Item label="Bueno" value="Bueno" />
                                    <Picker.Item label="Malo" value="Malo" />
                                    <Picker.Item label="No está" value="No está" />
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
                      <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
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
                  <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {filteredChecklists.map((item, index) => renderItem(item, index))}
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

      {/* Modal: ver cambios */}
      <Modal
        visible={isCambiosModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeCambiosModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>{cambiosTitle}</ThemedText>
              <TouchableOpacity onPress={closeCambiosModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.75 }} contentContainerStyle={{ padding: 16 }}>
              {(!cambiosItems || cambiosItems.length === 0) ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay cambios registrados</ThemedText>
                </ThemedView>
              ) : (
                cambiosItems.map((row: any) => {
                  let parsed: any[] = [];
                  try {
                    parsed = row?.cambios ? JSON.parse(row.cambios) : [];
                  } catch {
                    parsed = [];
                  }
                  const createdAtLabel = convertDateTimestampToLocalString(new Date(row?.created_at).toISOString());
                  const isOpen = expandedCambioId === row.id;

                  return (
                    <ThemedView key={`chg-${row.id}`} style={styles.cambioCollapsableMain}>
                      <TouchableOpacity
                        style={styles.cambioCollapsableHeader}
                        onPress={() => setExpandedCambioId((prev) => (prev === row.id ? null : row.id))}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.cambioCollapsableTitle}>
                          {createdAtLabel}
                        </ThemedText>
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#007AFF"
                        />
                      </TouchableOpacity>

                      {isOpen && (
                        <ThemedView style={styles.cambioCollapsableContent}>
                          <ThemedView style={styles.filterGroupSearch}>
                            <ThemedText style={styles.filterLabel}>Cambio realizado por:</ThemedText>
                            <ThemedText style={styles.changeDescription}>
                              {row.empleado_nombre || 'Desconocido'}
                              {row.empleado_cedula ? ` - Cédula: ${row.empleado_cedula}` : ''}
                            </ThemedText>
                          </ThemedView>

                          {(Array.isArray(parsed) ? parsed : []).length > 0 && (
                            <ThemedView style={styles.filterGroupSearch}>
                              <ThemedText style={styles.filterLabel}>Cambios:</ThemedText>
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => {
                                const prop = String(c?.prop ?? '-');
                                const value = c?.after;

                                // Caso especial: registro creado (__created__)
                                if (prop === '__created__' && value && typeof value === 'object') {
                                  const created: any = value;
                                  return (
                                    <React.Fragment key={`c-${row.id}-${idx}-created`}>
                                      <ThemedView style={styles.changeDescriptionContainer}>
                                        <ThemedText style={styles.changeDescription}>
                                          <ThemedText style={{ fontWeight: '800' }}>Registro creado</ThemedText>
                                        </ThemedText>
                                      </ThemedView>

                                      {/* Campos no relacionados con firmas ni evaluación */}
                                      {Object.entries(created).map(([k, v]) => {
                                        if (k === 'firma_supervisor' || k === 'firma_responsable' || k === 'evaluacion') return null;
                                        const displayValue = formatChangeValue(k, v);
                                        return (
                                          <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                              {displayValue}
                                            </ThemedText>
                                          </ThemedView>
                                        );
                                      })}

                                      {/* Evaluación completa (formato especial) */}
                                      {typeof created.evaluacion === 'string' && created.evaluacion.trim() && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>evaluacion: </ThemedText>
                                            {formatEvaluacionForDisplay(String(created.evaluacion || ''))}
                                          </ThemedText>
                                        </ThemedView>
                                      )}

                                      {/* Firma supervisor (imagen) */}
                                      {created.firma_supervisor && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>firma_supervisor: </ThemedText>
                                          </ThemedText>
                                          <Image
                                            source={{ uri: formatSignatureForDisplay(created.firma_supervisor) }}
                                            style={styles.cambioSignatureImage}
                                            resizeMode="contain"
                                          />
                                        </ThemedView>
                                      )}

                                      {/* Firma responsable (hash decodificado) */}
                                      {typeof created.firma_responsable === 'string' && created.firma_responsable.trim() && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>firma_responsable: </ThemedText>
                                            {(() => {
                                              const info = decodeFirmaHash(created.firma_responsable);
                                              return info
                                                ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}`
                                                : 'Firma responsable (formato no decodificable)';
                                            })()}
                                          </ThemedText>
                                        </ThemedView>
                                      )}
                                    </React.Fragment>
                                  );
                                }

                                const isResponsableSignatureField = prop === 'firma_responsable';
                                const isSupervisorSignatureField = prop === 'firma_supervisor';

                                let displayValue = formatChangeValue(prop, value);
                                if (prop === 'evaluacion') {
                                  displayValue = formatEvaluacionForDisplay(String(value || ''));
                                }

                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {!isResponsableSignatureField && !isSupervisorSignatureField && displayValue}
                                      {isResponsableSignatureField && (() => {
                                        const info = typeof value === 'string' ? decodeFirmaHash(value) : null;
                                        if (!info) return 'Firma responsable (formato no decodificable)';
                                        return `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}`;
                                      })()}
                                    </ThemedText>
                                    {isSupervisorSignatureField && value && (
                                      <Image
                                        source={{ uri: formatSignatureForDisplay(value) }}
                                        style={styles.cambioSignatureImage}
                                        resizeMode="contain"
                                      />
                                    )}
                                  </ThemedView>
                                );
                              })}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal de firma dibujada */}
      <Modal
        visible={isSignatureModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSignatureModalVisible(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Dibujar firma</ThemedText>
            <TouchableOpacity onPress={() => setIsSignatureModalVisible(false)}>
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
      </Modal>

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
                          updated[idx] = { ...updated[idx], type: value, options: value === 'select' ? ['Opción 1', 'Opción 2'] : undefined };
                          setNewSubsectionInputs(updated);
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Texto" value="text" />
                        <Picker.Item label="Texto largo" value="textarea" />
                        <Picker.Item label="Select" value="select" />
                        <Picker.Item label="Fecha" value="date" />
                        <Picker.Item label="Foto" value="photo" />
                        <Picker.Item label="Checkbox" value="checkbox" />
                      </Picker>
                    </View>
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
                onPress={() => {
                  Alert.alert(
                    'Tipo de input',
                    'Selecciona el tipo de input',
                    [
                      { text: 'Texto', onPress: () => addInputToNewSubsection('text') },
                      { text: 'Texto largo', onPress: () => addInputToNewSubsection('textarea') },
                      { text: 'Select', onPress: () => addInputToNewSubsection('select') },
                      { text: 'Fecha', onPress: () => addInputToNewSubsection('date') },
                      { text: 'Foto', onPress: () => addInputToNewSubsection('photo') },
                      { text: 'Checkbox', onPress: () => addInputToNewSubsection('checkbox') },
                      { text: 'Cancelar', style: 'cancel' },
                    ]
                  );
                }}
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
    marginBottom: 12,
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

