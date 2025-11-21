import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { Picker } from '@react-native-picker/picker';
import {
  createCleaningWorkPlan,
  updateCleaningWorkPlan,
  deleteCleaningWorkPlan,
  listCleaningWorkPlanByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type CleaningWorkPlanScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CleaningWorkPlan'>;

export interface SeccionElement {
  tipo: 'titulo' | 'descripcion' | 'lista' | 'seccion';
  contenido?: string;
  elementos?: string[];
  secciones?: SeccionElement[];
}

const SECCIONES_PRINCIPALES = [
  { key: 'objetivo', label: 'Objetivo' },
  { key: 'metodologia_trabajo_ambitos_accion', label: 'Metodología de trabajo por ámbitos de acción' },
  { key: 'rol_horario_trabajo', label: 'Rol y horario de trabajo' },
  { key: 'uniformes', label: 'Uniformes' },
  { key: 'equipos', label: 'Equipos' },
  { key: 'accesorios_varios', label: 'Accesorios varios' },
  { key: 'tiempo_respuesta_disposicion_imprevistos', label: 'Tiempo de respuesta y disposición de imprevistos' },
  { key: 'distribucion_diaria_labores_personal', label: 'Distribución diaria de labores del personal' },
  { key: 'frecuencia_minima_limpieza_areas', label: 'Frecuencia mínima de limpieza de áreas' },
  { key: 'supervision_metodo_rol_visitas', label: 'Supervisión, método y rol de visitas' },
  { key: 'estrategia_adecuado_continuo_servicio', label: 'Estrategia para el adecuado y continuo servicio' },
  { key: 'responsable_general_contrato', label: 'Responsable general del contrato' },
  { key: 'formularios_registro_control_puestos_equipos', label: 'Formularios y registro de control de puestos y equipos' },
  { key: 'plan_capacitacion', label: 'Plan de capacitación' },
];

const TIPO_ELEMENTO_OPTIONS = [
  { label: 'Seleccionar tipo', value: '' },
  { label: 'Título', value: 'titulo' },
  { label: 'Descripción', value: 'descripcion' },
  { label: 'Lista de elementos', value: 'lista' },
  { label: 'Nueva sección interna', value: 'seccion' },
];

interface CleaningWorkPlan {
  id: string;
  id_local: string;
  ubicacion: string | null;
  objetivo: string | null;
  metodologia_trabajo_ambitos_accion: string | null;
  rol_horario_trabajo: string | null;
  uniformes: string | null;
  equipos: string | null;
  accesorios_varios: string | null;
  tiempo_respuesta_disposicion_imprevistos: string | null;
  distribucion_diaria_labores_personal: string | null;
  frecuencia_minima_limpieza_areas: string | null;
  supervision_metodo_rol_visitas: string | null;
  estrategia_adecuado_continuo_servicio: string | null;
  responsable_general_contrato: string | null;
  formularios_registro_control_puestos_equipos: string | null;
  plan_capacitacion: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingCleaningWorkPlan {
  id: string | null;
  id_local: string;
  ubicacion: string;
  objetivo: SeccionElement[];
  metodologia_trabajo_ambitos_accion: SeccionElement[];
  rol_horario_trabajo: SeccionElement[];
  uniformes: SeccionElement[];
  equipos: SeccionElement[];
  accesorios_varios: SeccionElement[];
  tiempo_respuesta_disposicion_imprevistos: SeccionElement[];
  distribucion_diaria_labores_personal: SeccionElement[];
  frecuencia_minima_limpieza_areas: SeccionElement[];
  supervision_metodo_rol_visitas: SeccionElement[];
  estrategia_adecuado_continuo_servicio: SeccionElement[];
  responsable_general_contrato: SeccionElement[];
  formularios_registro_control_puestos_equipos: SeccionElement[];
  plan_capacitacion: SeccionElement[];
}

// Componente recursivo para renderizar elementos de sección
const SeccionElementComponent: React.FC<{
  element: SeccionElement;
  index: number;
  path: string;
  onUpdate: (path: string, element: SeccionElement) => void;
  onDelete: (path: string) => void;
  onAddToList?: (path: string) => void;
  onRemoveFromList?: (path: string, itemIndex: number) => void;
  nivel?: number;
}> = ({ element, index, path, onUpdate, onDelete, onAddToList, onRemoveFromList, nivel = 0 }) => {
  const elementPath = `${path}.${index}`;
  const isNested = nivel > 0;

  // Función helper para actualizar el elemento actual
  const updateCurrentElement = (updatedElement: SeccionElement) => {
    onUpdate(elementPath, updatedElement);
  };

  if (element.tipo === 'titulo') {
    return (
      <ThemedView style={[styles.elementContainer, isNested && styles.nestedElement]}>
        <ThemedView style={styles.elementHeader}>
          <ThemedText style={styles.elementTypeLabel}>Título</ThemedText>
          <TouchableOpacity onPress={() => onDelete(elementPath)}>
            <Ionicons name="trash" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </ThemedView>
        <TextInput
          style={styles.elementInput}
          placeholder="Título"
          placeholderTextColor="#999"
          value={element.contenido || ''}
          onChangeText={(text) => updateCurrentElement({ ...element, contenido: text })}
        />
      </ThemedView>
    );
  }

  if (element.tipo === 'descripcion') {
    return (
      <ThemedView style={[styles.elementContainer, isNested && styles.nestedElement]}>
        <ThemedView style={styles.elementHeader}>
          <ThemedText style={styles.elementTypeLabel}>Descripción</ThemedText>
          <TouchableOpacity onPress={() => onDelete(elementPath)}>
            <Ionicons name="trash" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </ThemedView>
        <TextInput
          style={[styles.elementInput, styles.textArea]}
          placeholder="Descripción"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={element.contenido || ''}
          onChangeText={(text) => updateCurrentElement({ ...element, contenido: text })}
        />
      </ThemedView>
    );
  }

  if (element.tipo === 'lista') {
    return (
      <ThemedView style={[styles.elementContainer, isNested && styles.nestedElement]}>
        <ThemedView style={styles.elementHeader}>
          <ThemedText style={styles.elementTypeLabel}>Lista de elementos</ThemedText>
          <TouchableOpacity onPress={() => onDelete(elementPath)}>
            <Ionicons name="trash" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </ThemedView>
        {(element.elementos || []).map((item, itemIndex) => (
          <ThemedView key={itemIndex} style={styles.listItemContainer}>
            <TextInput
              style={styles.listItemInput}
              placeholder={`Elemento ${itemIndex + 1}`}
              placeholderTextColor="#999"
              value={item}
              onChangeText={(text) => {
                const newElementos = [...(element.elementos || [])];
                newElementos[itemIndex] = text;
                updateCurrentElement({ ...element, elementos: newElementos });
              }}
            />
            <TouchableOpacity
              onPress={() => {
                const newElementos = (element.elementos || []).filter((_, i) => i !== itemIndex);
                updateCurrentElement({ ...element, elementos: newElementos });
              }}
              style={styles.removeListItemButton}
            >
              <Ionicons name="close-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </ThemedView>
        ))}
        <TouchableOpacity
          style={styles.addListItemButton}
          onPress={() => {
            const newElementos = [...(element.elementos || []), ''];
            updateCurrentElement({ ...element, elementos: newElementos });
          }}
        >
          <Ionicons name="add-circle" size={20} color="#4CAF50" />
          <ThemedText style={styles.addListItemButtonText}>Agregar elemento</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (element.tipo === 'seccion') {
    return (
      <ThemedView style={[styles.seccionInternaContainer, isNested && styles.nestedSeccion]}>
        <ThemedView style={styles.seccionInternaHeader}>
          <ThemedText style={styles.seccionInternaTitle}>Sección Interna</ThemedText>
          <TouchableOpacity onPress={() => onDelete(elementPath)}>
            <Ionicons name="trash" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </ThemedView>
        <SeccionBuilder
          elementos={element.secciones || []}
          path={elementPath}
          onUpdate={(seccionPath, nuevosElementos) => {
            onUpdate(elementPath, { ...element, secciones: nuevosElementos });
          }}
          onDelete={(seccionPath, seccionIndex) => {
            const newSecciones = (element.secciones || []).filter((_, i) => i !== seccionIndex);
            onUpdate(elementPath, { ...element, secciones: newSecciones });
          }}
          onAddToList={(elementPath) => {
            // Manejar agregar a lista dentro de secciones internas
            const pathParts = elementPath.split('.');
            // El primer elemento es el índice relativo a la sección interna actual
            const rootIdx = parseInt(pathParts[0]);
            
            if (pathParts.length === 1) {
              // Elemento raíz de la sección interna
              const newSecciones = [...(element.secciones || [])];
              const elem = newSecciones[rootIdx];
              if (elem && elem.tipo === 'lista') {
                newSecciones[rootIdx] = {
                  ...elem,
                  elementos: [...(elem.elementos || []), ''],
                };
                onUpdate(elementPath, { ...element, secciones: newSecciones });
              }
            } else {
              // Elemento anidado dentro de la sección interna
              const addToListNested = (elems: SeccionElement[], pathArray: string[]): SeccionElement[] => {
                if (pathArray.length === 1) {
                  const idx = parseInt(pathArray[0]);
                  const newElems = [...elems];
                  const elem = newElems[idx];
                  if (elem && elem.tipo === 'lista') {
                    newElems[idx] = {
                      ...elem,
                      elementos: [...(elem.elementos || []), ''],
                    };
                  }
                  return newElems;
                }
                const idx = parseInt(pathArray[0]);
                const newElems = [...elems];
                if (newElems[idx] && newElems[idx].tipo === 'seccion') {
                  newElems[idx] = {
                    ...newElems[idx],
                    secciones: addToListNested(newElems[idx].secciones || [], pathArray.slice(1)),
                  };
                }
                return newElems;
              };
              
              const newSecciones = [...(element.secciones || [])];
              if (newSecciones[rootIdx] && newSecciones[rootIdx].tipo === 'seccion') {
                newSecciones[rootIdx] = {
                  ...newSecciones[rootIdx],
                  secciones: addToListNested(newSecciones[rootIdx].secciones || [], pathParts.slice(1)),
                };
                onUpdate(elementPath, { ...element, secciones: newSecciones });
              }
            }
          }}
          onRemoveFromList={(elementPath, itemIndex) => {
            // Esta función ya no se usa porque onRemoveFromList se maneja directamente en SeccionElementComponent
            // Pero la mantenemos para compatibilidad con elementos anidados
            // Manejar remover de lista dentro de secciones internas
            const pathParts = elementPath.split('.');
            const rootIdx = parseInt(pathParts[0]);
            
            if (pathParts.length === 1) {
              // Elemento raíz de la sección interna
              const newSecciones = [...(element.secciones || [])];
              const elem = newSecciones[rootIdx];
              if (elem && elem.tipo === 'lista') {
                newSecciones[rootIdx] = {
                  ...elem,
                  elementos: (elem.elementos || []).filter((_, i) => i !== itemIndex),
                };
                onUpdate(elementPath, { ...element, secciones: newSecciones });
              }
            } else {
              // Elemento anidado dentro de la sección interna
              const removeFromListNested = (elems: SeccionElement[], pathArray: string[], itemIdx: number): SeccionElement[] => {
                if (pathArray.length === 1) {
                  const idx = parseInt(pathArray[0]);
                  const newElems = [...elems];
                  const elem = newElems[idx];
                  if (elem && elem.tipo === 'lista') {
                    newElems[idx] = {
                      ...elem,
                      elementos: (elem.elementos || []).filter((_, i) => i !== itemIdx),
                    };
                  }
                  return newElems;
                }
                const idx = parseInt(pathArray[0]);
                const newElems = [...elems];
                if (newElems[idx] && newElems[idx].tipo === 'seccion') {
                  newElems[idx] = {
                    ...newElems[idx],
                    secciones: removeFromListNested(newElems[idx].secciones || [], pathArray.slice(1), itemIdx),
                  };
                }
                return newElems;
              };
              
              const newSecciones = [...(element.secciones || [])];
              if (newSecciones[rootIdx] && newSecciones[rootIdx].tipo === 'seccion') {
                newSecciones[rootIdx] = {
                  ...newSecciones[rootIdx],
                  secciones: removeFromListNested(newSecciones[rootIdx].secciones || [], pathParts.slice(1), itemIndex),
                };
                onUpdate(elementPath, { ...element, secciones: newSecciones });
              }
            }
          }}
          nivel={nivel + 1}
        />
      </ThemedView>
    );
  }

  return null;
};

// Componente para construir secciones con elementos
const SeccionBuilder: React.FC<{
  elementos: SeccionElement[];
  path: string;
  onUpdate: (path: string, elementos: SeccionElement[]) => void;
  onDelete: (path: string, index: number) => void;
  onAddToList?: (path: string, index: number) => void;
  onRemoveFromList?: (path: string, index: number, itemIndex: number) => void;
  nivel?: number;
}> = ({ elementos, path, onUpdate, onDelete, onAddToList, onRemoveFromList, nivel = 0 }) => {
  const [selectedTipo, setSelectedTipo] = useState('');

  const addElement = (tipo: string) => {
    let newElement: SeccionElement;
    if (tipo === 'titulo') {
      newElement = { tipo: 'titulo', contenido: '' };
    } else if (tipo === 'descripcion') {
      newElement = { tipo: 'descripcion', contenido: '' };
    } else if (tipo === 'lista') {
      newElement = { tipo: 'lista', elementos: [] };
    } else if (tipo === 'seccion') {
      newElement = { tipo: 'seccion', secciones: [] };
    } else {
      return;
    }

    const newElementos = [...elementos, newElement];
    onUpdate(path, newElementos);
    setSelectedTipo('');
  };

  return (
    <ThemedView style={styles.seccionBuilderContainer}>
      {elementos.map((element, index) => (
        <SeccionElementComponent
          key={index}
          element={element}
          index={index}
          path={path}
          onUpdate={(elementPath, updatedElement) => {
            const newElementos = [...elementos];
            const pathParts = elementPath.split('.');
            
            // El path viene como "path.index" donde path es el path del nivel actual
            // Si el path comienza con el path del nivel actual, extraemos el índice
            if (elementPath.startsWith(path + '.')) {
              // El índice está después del path base
              const pathBase = path + '.';
              const indexStr = elementPath.substring(pathBase.length);
              const indexParts = indexStr.split('.');
              const rootIdx = parseInt(indexParts[0]);
              
              if (!isNaN(rootIdx) && rootIdx >= 0 && rootIdx < newElementos.length) {
                if (indexParts.length === 1) {
                  // Elemento raíz de este nivel - actualizar directamente
                  newElementos[rootIdx] = updatedElement;
                } else {
                  // Elemento anidado - recursión
                  if (newElementos[rootIdx].tipo === 'seccion') {
                    const updateNested = (elems: SeccionElement[], pathArray: string[]): SeccionElement[] => {
                      if (pathArray.length === 0) {
                        return elems;
                      }
                      if (pathArray.length === 1) {
                        const idx = parseInt(pathArray[0]);
                        const newElems = [...elems];
                        if (!isNaN(idx) && idx >= 0 && idx < newElems.length) {
                          newElems[idx] = updatedElement;
                        }
                        return newElems;
                      }
                      const idx = parseInt(pathArray[0]);
                      const newElems = [...elems];
                      if (!isNaN(idx) && idx >= 0 && idx < newElems.length && newElems[idx].tipo === 'seccion') {
                        newElems[idx] = {
                          ...newElems[idx],
                          secciones: updateNested(newElems[idx].secciones || [], pathArray.slice(1)),
                        };
                      }
                      return newElems;
                    };
                    
                    newElementos[rootIdx] = {
                      ...newElementos[rootIdx],
                      secciones: updateNested(newElementos[rootIdx].secciones || [], indexParts.slice(1)),
                    };
                  }
                }
              }
            }
            onUpdate(path, newElementos);
          }}
          onDelete={(elementPath) => {
            // El path viene como "path.index" donde path es el path del nivel actual
            if (elementPath.startsWith(path + '.')) {
              // El índice está después del path base
              const pathBase = path + '.';
              const indexStr = elementPath.substring(pathBase.length);
              const pathParts = indexStr.split('.');
              const rootIdx = parseInt(pathParts[0]);
              
              if (!isNaN(rootIdx) && rootIdx >= 0 && rootIdx < elementos.length) {
                if (pathParts.length === 1) {
                  // Elemento raíz de este nivel - eliminar directamente
                  onDelete(path, rootIdx);
                } else {
                  // Elemento anidado - recursión
                  const deleteNested = (elems: SeccionElement[], pathArray: string[]): SeccionElement[] => {
                    if (pathArray.length === 0) {
                      return elems;
                    }
                    if (pathArray.length === 1) {
                      const idx = parseInt(pathArray[0]);
                      if (!isNaN(idx) && idx >= 0 && idx < elems.length) {
                        return elems.filter((_, i) => i !== idx);
                      }
                      return elems;
                    }
                    const idx = parseInt(pathArray[0]);
                    const newElems = [...elems];
                    if (!isNaN(idx) && idx >= 0 && idx < newElems.length && newElems[idx].tipo === 'seccion') {
                      newElems[idx] = {
                        ...newElems[idx],
                        secciones: deleteNested(newElems[idx].secciones || [], pathArray.slice(1)),
                      };
                    }
                    return newElems;
                  };
                  
                  const newElementos = [...elementos];
                  if (newElementos[rootIdx] && newElementos[rootIdx].tipo === 'seccion') {
                    newElementos[rootIdx] = {
                      ...newElementos[rootIdx],
                      secciones: deleteNested(newElementos[rootIdx].secciones || [], pathParts.slice(1)),
                    };
                    onUpdate(path, newElementos);
                  }
                }
              }
            }
          }}
          onAddToList={(elementPath) => {
            // Esta función ya no se usa porque onAddToList se maneja directamente en SeccionElementComponent
            // Pero la mantenemos para compatibilidad con elementos anidados
            const pathParts = elementPath.split('.');
            const rootIdx = parseInt(pathParts[0]);
            
            if (pathParts.length === 1) {
              // Elemento raíz - actualizar directamente
              const newElementos = [...elementos];
              const elem = newElementos[rootIdx];
              if (elem && elem.tipo === 'lista') {
                newElementos[rootIdx] = {
                  ...elem,
                  elementos: [...(elem.elementos || []), ''],
                };
                onUpdate(path, newElementos);
              }
            } else {
              // Elemento anidado - recursión
              const addToListNested = (elems: SeccionElement[], pathArray: string[]): SeccionElement[] => {
                if (pathArray.length === 1) {
                  const idx = parseInt(pathArray[0]);
                  const newElems = [...elems];
                  const elem = newElems[idx];
                  if (elem && elem.tipo === 'lista') {
                    newElems[idx] = {
                      ...elem,
                      elementos: [...(elem.elementos || []), ''],
                    };
                  }
                  return newElems;
                }
                const idx = parseInt(pathArray[0]);
                const newElems = [...elems];
                if (newElems[idx] && newElems[idx].tipo === 'seccion') {
                  newElems[idx] = {
                    ...newElems[idx],
                    secciones: addToListNested(newElems[idx].secciones || [], pathArray.slice(1)),
                  };
                }
                return newElems;
              };
              
              const newElementos = [...elementos];
              if (newElementos[rootIdx] && newElementos[rootIdx].tipo === 'seccion') {
                newElementos[rootIdx] = {
                  ...newElementos[rootIdx],
                  secciones: addToListNested(newElementos[rootIdx].secciones || [], pathParts.slice(1)),
                };
                onUpdate(path, newElementos);
              }
            }
          }}
          onRemoveFromList={(elementPath, itemIndex) => {
            // Esta función ya no se usa porque onRemoveFromList se maneja directamente en SeccionElementComponent
            // Pero la mantenemos para compatibilidad con elementos anidados
            // El path viene como "path.index" donde path es el path del nivel actual
            if (elementPath.startsWith(path + '.')) {
              const pathBase = path + '.';
              const indexStr = elementPath.substring(pathBase.length);
              const pathParts = indexStr.split('.');
              const rootIdx = parseInt(pathParts[0]);
              
              if (!isNaN(rootIdx) && rootIdx >= 0 && rootIdx < elementos.length) {
                if (pathParts.length === 1) {
                  // Elemento raíz de este nivel
                  const newElementos = [...elementos];
                  const elem = newElementos[rootIdx];
                  if (elem && elem.tipo === 'lista') {
                    newElementos[rootIdx] = {
                      ...elem,
                      elementos: (elem.elementos || []).filter((_, i) => i !== itemIndex),
                    };
                    onUpdate(path, newElementos);
                  }
                } else {
                  // Elemento anidado - recursión
                  const removeFromListNested = (elems: SeccionElement[], pathArray: string[], itemIdx: number): SeccionElement[] => {
                    if (pathArray.length === 0) {
                      return elems;
                    }
                    if (pathArray.length === 1) {
                      const idx = parseInt(pathArray[0]);
                      const newElems = [...elems];
                      const elem = newElems[idx];
                      if (elem && elem.tipo === 'lista') {
                        newElems[idx] = {
                          ...elem,
                          elementos: (elem.elementos || []).filter((_, i) => i !== itemIdx),
                        };
                      }
                      return newElems;
                    }
                    const idx = parseInt(pathArray[0]);
                    const newElems = [...elems];
                    if (!isNaN(idx) && idx >= 0 && idx < newElems.length && newElems[idx].tipo === 'seccion') {
                      newElems[idx] = {
                        ...newElems[idx],
                        secciones: removeFromListNested(newElems[idx].secciones || [], pathArray.slice(1), itemIdx),
                      };
                    }
                    return newElems;
                  };
                  
                  const newElementos = [...elementos];
                  if (newElementos[rootIdx] && newElementos[rootIdx].tipo === 'seccion') {
                    newElementos[rootIdx] = {
                      ...newElementos[rootIdx],
                      secciones: removeFromListNested(newElementos[rootIdx].secciones || [], pathParts.slice(1), itemIndex),
                    };
                    onUpdate(path, newElementos);
                  }
                }
              }
            }
          }}
          nivel={nivel}
        />
      ))}
      <ThemedView style={styles.addElementContainer}>
        <ThemedView style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedTipo}
            onValueChange={setSelectedTipo}
            style={styles.picker}
          >
            {TIPO_ELEMENTO_OPTIONS.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </ThemedView>
        <TouchableOpacity
          style={styles.addElementButton}
          onPress={() => selectedTipo && addElement(selectedTipo)}
          disabled={!selectedTipo}
        >
          <Ionicons name="add-circle" size={20} color={selectedTipo ? "#4CAF50" : "#CCCCCC"} />
          <ThemedText style={[styles.addElementButtonText, !selectedTipo && styles.addElementButtonTextDisabled]}>
            Añadir
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
};

export default function CleaningWorkPlanScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<CleaningWorkPlanScreenNavigationProp>();

  // Data states
  const [plans, setPlans] = useState<CleaningWorkPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingCleaningWorkPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [ubicacion, setUbicacion] = useState<string>('');

  // Form states
  const [secciones, setSecciones] = useState<{ [key: string]: SeccionElement[] }>(() => {
    const initial: { [key: string]: SeccionElement[] } = {};
    SECCIONES_PRINCIPALES.forEach(sec => {
      initial[sec.key] = [];
    });
    return initial;
  });

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const parseSeccion = (jsonString: string | null): SeccionElement[] => {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const fetchPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      setHasCurrentMarca(true);
      const currentMarcaData = JSON.parse(currentMarca);
      const corpoId = currentMarcaData.corpo?.id?.toString();

      if (!corpoId) {
        setError('No se encontró el ID del corpo');
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listCleaningWorkPlanByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPlans(result.data as CleaningWorkPlan[]);
        } else {
          setPlans([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'cleaning_work_plan');
          setPlans(plansCache);
        } else {
          setPlans([]);
        }
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Error al cargar los planes de trabajo - Personal Aseo y limpieza');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'cleaning_work_plan');
          setPlans(plansCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchPlans();
      eventBus.on('connectionRestored', fetchPlans);
      return () => {
        eventBus.off('connectionRestored', fetchPlans);
      };
    }, [fetchPlans])
  );

  const resetForm = () => {
    const initial: { [key: string]: SeccionElement[] } = {};
    SECCIONES_PRINCIPALES.forEach(sec => {
      initial[sec.key] = [];
    });
    setSecciones(initial);
    setUbicacion('');
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingRecord(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (record: CleaningWorkPlan) => {
    setIsCreating(false);
    const parsedSecciones: { [key: string]: SeccionElement[] } = {};
    SECCIONES_PRINCIPALES.forEach(sec => {
      parsedSecciones[sec.key] = parseSeccion(record[sec.key as keyof CleaningWorkPlan] as string | null);
    });

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      ubicacion: record.ubicacion || '',
      objetivo: parsedSecciones.objetivo,
      metodologia_trabajo_ambitos_accion: parsedSecciones.metodologia_trabajo_ambitos_accion,
      rol_horario_trabajo: parsedSecciones.rol_horario_trabajo,
      uniformes: parsedSecciones.uniformes,
      equipos: parsedSecciones.equipos,
      accesorios_varios: parsedSecciones.accesorios_varios,
      tiempo_respuesta_disposicion_imprevistos: parsedSecciones.tiempo_respuesta_disposicion_imprevistos,
      distribucion_diaria_labores_personal: parsedSecciones.distribucion_diaria_labores_personal,
      frecuencia_minima_limpieza_areas: parsedSecciones.frecuencia_minima_limpieza_areas,
      supervision_metodo_rol_visitas: parsedSecciones.supervision_metodo_rol_visitas,
      estrategia_adecuado_continuo_servicio: parsedSecciones.estrategia_adecuado_continuo_servicio,
      responsable_general_contrato: parsedSecciones.responsable_general_contrato,
      formularios_registro_control_puestos_equipos: parsedSecciones.formularios_registro_control_puestos_equipos,
      plan_capacitacion: parsedSecciones.plan_capacitacion,
    });

    setSecciones(parsedSecciones);
    setUbicacion(record.ubicacion || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };


  const savePlanHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este plan de trabajo - Personal Aseo y limpieza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                ubicacion: ubicacion || null,
                objetivo: secciones.objetivo.length > 0 ? JSON.stringify(secciones.objetivo) : null,
                metodologia_trabajo_ambitos_accion: secciones.metodologia_trabajo_ambitos_accion.length > 0 ? JSON.stringify(secciones.metodologia_trabajo_ambitos_accion) : null,
                rol_horario_trabajo: secciones.rol_horario_trabajo.length > 0 ? JSON.stringify(secciones.rol_horario_trabajo) : null,
                uniformes: secciones.uniformes.length > 0 ? JSON.stringify(secciones.uniformes) : null,
                equipos: secciones.equipos.length > 0 ? JSON.stringify(secciones.equipos) : null,
                accesorios_varios: secciones.accesorios_varios.length > 0 ? JSON.stringify(secciones.accesorios_varios) : null,
                tiempo_respuesta_disposicion_imprevistos: secciones.tiempo_respuesta_disposicion_imprevistos.length > 0 ? JSON.stringify(secciones.tiempo_respuesta_disposicion_imprevistos) : null,
                distribucion_diaria_labores_personal: secciones.distribucion_diaria_labores_personal.length > 0 ? JSON.stringify(secciones.distribucion_diaria_labores_personal) : null,
                frecuencia_minima_limpieza_areas: secciones.frecuencia_minima_limpieza_areas.length > 0 ? JSON.stringify(secciones.frecuencia_minima_limpieza_areas) : null,
                supervision_metodo_rol_visitas: secciones.supervision_metodo_rol_visitas.length > 0 ? JSON.stringify(secciones.supervision_metodo_rol_visitas) : null,
                estrategia_adecuado_continuo_servicio: secciones.estrategia_adecuado_continuo_servicio.length > 0 ? JSON.stringify(secciones.estrategia_adecuado_continuo_servicio) : null,
                responsable_general_contrato: secciones.responsable_general_contrato.length > 0 ? JSON.stringify(secciones.responsable_general_contrato) : null,
                formularios_registro_control_puestos_equipos: secciones.formularios_registro_control_puestos_equipos.length > 0 ? JSON.stringify(secciones.formularios_registro_control_puestos_equipos) : null,
                plan_capacitacion: secciones.plan_capacitacion.length > 0 ? JSON.stringify(secciones.plan_capacitacion) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createCleaningWorkPlan({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan de trabajo - Personal Aseo y limpieza guardado correctamente');
                  cancelCreating();
                  fetchPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el plan de trabajo - Personal Aseo y limpieza');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'cleaning_work_plan',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: CleaningWorkPlan = {
                  id: '',
                  id_local: localId,
                  ubicacion: ubicacion || null,
                  objetivo: secciones.objetivo.length > 0 ? JSON.stringify(secciones.objetivo) : null,
                  metodologia_trabajo_ambitos_accion: secciones.metodologia_trabajo_ambitos_accion.length > 0 ? JSON.stringify(secciones.metodologia_trabajo_ambitos_accion) : null,
                  rol_horario_trabajo: secciones.rol_horario_trabajo.length > 0 ? JSON.stringify(secciones.rol_horario_trabajo) : null,
                  uniformes: secciones.uniformes.length > 0 ? JSON.stringify(secciones.uniformes) : null,
                  equipos: secciones.equipos.length > 0 ? JSON.stringify(secciones.equipos) : null,
                  accesorios_varios: secciones.accesorios_varios.length > 0 ? JSON.stringify(secciones.accesorios_varios) : null,
                  tiempo_respuesta_disposicion_imprevistos: secciones.tiempo_respuesta_disposicion_imprevistos.length > 0 ? JSON.stringify(secciones.tiempo_respuesta_disposicion_imprevistos) : null,
                  distribucion_diaria_labores_personal: secciones.distribucion_diaria_labores_personal.length > 0 ? JSON.stringify(secciones.distribucion_diaria_labores_personal) : null,
                  frecuencia_minima_limpieza_areas: secciones.frecuencia_minima_limpieza_areas.length > 0 ? JSON.stringify(secciones.frecuencia_minima_limpieza_areas) : null,
                  supervision_metodo_rol_visitas: secciones.supervision_metodo_rol_visitas.length > 0 ? JSON.stringify(secciones.supervision_metodo_rol_visitas) : null,
                  estrategia_adecuado_continuo_servicio: secciones.estrategia_adecuado_continuo_servicio.length > 0 ? JSON.stringify(secciones.estrategia_adecuado_continuo_servicio) : null,
                  responsable_general_contrato: secciones.responsable_general_contrato.length > 0 ? JSON.stringify(secciones.responsable_general_contrato) : null,
                  formularios_registro_control_puestos_equipos: secciones.formularios_registro_control_puestos_equipos.length > 0 ? JSON.stringify(secciones.formularios_registro_control_puestos_equipos) : null,
                  plan_capacitacion: secciones.plan_capacitacion.length > 0 ? JSON.stringify(secciones.plan_capacitacion) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'cleaning_work_plan' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Plan de trabajo - Personal Aseo y limpieza registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchPlans();
              }
            } catch (err) {
              console.error('Error saving plan:', err);
              Alert.alert('Error', 'No se pudo guardar el plan de trabajo - Personal Aseo y limpieza');
            }
          },
        },
      ]
    );
  };

  const updatePlanHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este plan de trabajo - Personal Aseo y limpieza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                ubicacion: ubicacion || null,
                objetivo: secciones.objetivo.length > 0 ? JSON.stringify(secciones.objetivo) : null,
                metodologia_trabajo_ambitos_accion: secciones.metodologia_trabajo_ambitos_accion.length > 0 ? JSON.stringify(secciones.metodologia_trabajo_ambitos_accion) : null,
                rol_horario_trabajo: secciones.rol_horario_trabajo.length > 0 ? JSON.stringify(secciones.rol_horario_trabajo) : null,
                uniformes: secciones.uniformes.length > 0 ? JSON.stringify(secciones.uniformes) : null,
                equipos: secciones.equipos.length > 0 ? JSON.stringify(secciones.equipos) : null,
                accesorios_varios: secciones.accesorios_varios.length > 0 ? JSON.stringify(secciones.accesorios_varios) : null,
                tiempo_respuesta_disposicion_imprevistos: secciones.tiempo_respuesta_disposicion_imprevistos.length > 0 ? JSON.stringify(secciones.tiempo_respuesta_disposicion_imprevistos) : null,
                distribucion_diaria_labores_personal: secciones.distribucion_diaria_labores_personal.length > 0 ? JSON.stringify(secciones.distribucion_diaria_labores_personal) : null,
                frecuencia_minima_limpieza_areas: secciones.frecuencia_minima_limpieza_areas.length > 0 ? JSON.stringify(secciones.frecuencia_minima_limpieza_areas) : null,
                supervision_metodo_rol_visitas: secciones.supervision_metodo_rol_visitas.length > 0 ? JSON.stringify(secciones.supervision_metodo_rol_visitas) : null,
                estrategia_adecuado_continuo_servicio: secciones.estrategia_adecuado_continuo_servicio.length > 0 ? JSON.stringify(secciones.estrategia_adecuado_continuo_servicio) : null,
                responsable_general_contrato: secciones.responsable_general_contrato.length > 0 ? JSON.stringify(secciones.responsable_general_contrato) : null,
                formularios_registro_control_puestos_equipos: secciones.formularios_registro_control_puestos_equipos.length > 0 ? JSON.stringify(secciones.formularios_registro_control_puestos_equipos) : null,
                plan_capacitacion: secciones.plan_capacitacion.length > 0 ? JSON.stringify(secciones.plan_capacitacion) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateCleaningWorkPlan({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan de trabajo - Personal Aseo y limpieza actualizado correctamente');
                  cancelEditing();
                  fetchPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el plan de trabajo - Personal Aseo y limpieza');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'cleaning_work_plan',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'cleaning_work_plan') {
                      return {
                        ...item,
                        ubicacion: requestData.ubicacion,
                        objetivo: requestData.objetivo,
                        metodologia_trabajo_ambitos_accion: requestData.metodologia_trabajo_ambitos_accion,
                        rol_horario_trabajo: requestData.rol_horario_trabajo,
                        uniformes: requestData.uniformes,
                        equipos: requestData.equipos,
                        accesorios_varios: requestData.accesorios_varios,
                        tiempo_respuesta_disposicion_imprevistos: requestData.tiempo_respuesta_disposicion_imprevistos,
                        distribucion_diaria_labores_personal: requestData.distribucion_diaria_labores_personal,
                        frecuencia_minima_limpieza_areas: requestData.frecuencia_minima_limpieza_areas,
                        supervision_metodo_rol_visitas: requestData.supervision_metodo_rol_visitas,
                        estrategia_adecuado_continuo_servicio: requestData.estrategia_adecuado_continuo_servicio,
                        responsable_general_contrato: requestData.responsable_general_contrato,
                        formularios_registro_control_puestos_equipos: requestData.formularios_registro_control_puestos_equipos,
                        plan_capacitacion: requestData.plan_capacitacion,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Plan de trabajo - Personal Aseo y limpieza actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchPlans();
              }
            } catch (err) {
              console.error('Error updating plan:', err);
              Alert.alert('Error', 'No se pudo actualizar el plan de trabajo - Personal Aseo y limpieza');
            }
          },
        },
      ]
    );
  };

  const deletePlanHandler = async (record: CleaningWorkPlan) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este plan de trabajo - Personal Aseo y limpieza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteCleaningWorkPlan({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan de trabajo - Personal Aseo y limpieza eliminado correctamente');
                  fetchPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el plan de trabajo - Personal Aseo y limpieza');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'cleaning_work_plan',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'cleaning_work_plan'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Plan de trabajo - Personal Aseo y limpieza marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchPlans();
              }
            } catch (err) {
              console.error('Error deleting plan:', err);
              Alert.alert('Error', 'No se pudo eliminar el plan de trabajo - Personal Aseo y limpieza');
            }
          },
        },
      ]
    );
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

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'plan': return <Ionicons name="water" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="water" size={24} color='#000000' />;
    }
  };

  const renderPlanList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando planes de trabajo - Personal Aseo y limpieza...</ThemedText>
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

    if (plans.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay planes de trabajo - Personal Aseo y limpieza registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {plans.map((record) => (
          <ThemedView key={record.id || record.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Plan de trabajo - Personal Aseo y limpieza
                </ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Fecha: {new Date(record.created_at).toLocaleDateString('es-CR')}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                {!record.synced && (
                  <ThemedView style={styles.offlineBadge}>
                    <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.listItemDetails}>
              <ThemedText style={styles.detailText}>
                <ThemedText style={styles.detailLabel}>Fecha de registro: </ThemedText>
                {new Date(record.created_at).toLocaleDateString('es-CR')}
              </ThemedText>

              <ThemedView style={styles.listItemButtons}>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.editButton]}
                  onPress={() => startEditing(record)}
                >
                  {getActionIcon('edit')}
                  <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.deleteButton]}
                  onPress={() => deletePlanHandler(record)}
                >
                  {getActionIcon('delete')}
                  <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        ))}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Plan de Trabajo - Personal Aseo y Limpieza" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('plan')} Plan de Trabajo - Personal Aseo y Limpieza
          </ThemedText>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {isCreating || editingRecord ? (
            <ThemedView style={styles.formContainer}>
              {/* Campo Ubicación */}
              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Ubicación</ThemedText>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ingrese la ubicación"
                  placeholderTextColor="#999"
                  value={ubicacion}
                  onChangeText={setUbicacion}
                />
              </ThemedView>

              {/* Secciones principales */}
              {SECCIONES_PRINCIPALES.map((seccion) => (
                <ThemedView key={seccion.key} style={styles.seccionPrincipalContainer}>
                  <ThemedText style={styles.seccionPrincipalTitle}>{seccion.label}</ThemedText>
                  <SeccionBuilder
                    elementos={secciones[seccion.key]}
                    path={seccion.key}
                    onUpdate={(path, nuevosElementos) => {
                      setSecciones({ ...secciones, [seccion.key]: nuevosElementos });
                    }}
                    onDelete={(path, index) => {
                      if (path === seccion.key && index >= 0 && index < secciones[seccion.key].length) {
                        const newSecciones = secciones[seccion.key].filter((_, i) => i !== index);
                        setSecciones({ ...secciones, [seccion.key]: newSecciones });
                      }
                    }}
                    onAddToList={(elementPath) => {
                      // Manejar agregar a lista en secciones principales
                      // El path viene como "seccion.key.index" o "seccion.key.index.subindex..."
                      if (elementPath.startsWith(seccion.key + '.')) {
                        const pathBase = seccion.key + '.';
                        const indexStr = elementPath.substring(pathBase.length);
                        const pathParts = indexStr.split('.');
                        const rootIdx = parseInt(pathParts[0]);
                        
                        if (!isNaN(rootIdx) && rootIdx >= 0 && rootIdx < secciones[seccion.key].length) {
                          if (pathParts.length === 1) {
                            // Elemento raíz
                            const newSecciones = [...secciones[seccion.key]];
                            const elem = newSecciones[rootIdx];
                            if (elem && elem.tipo === 'lista') {
                              newSecciones[rootIdx] = {
                                ...elem,
                                elementos: [...(elem.elementos || []), ''],
                              };
                              setSecciones({ ...secciones, [seccion.key]: newSecciones });
                            }
                          } else {
                            // Elemento anidado - recursión
                            const addToListNested = (elems: SeccionElement[], pathArray: string[]): SeccionElement[] => {
                              if (pathArray.length === 1) {
                                const idx = parseInt(pathArray[0]);
                                const newElems = [...elems];
                                const elem = newElems[idx];
                                if (elem && elem.tipo === 'lista') {
                                  newElems[idx] = {
                                    ...elem,
                                    elementos: [...(elem.elementos || []), ''],
                                  };
                                }
                                return newElems;
                              }
                              const idx = parseInt(pathArray[0]);
                              const newElems = [...elems];
                              if (newElems[idx] && newElems[idx].tipo === 'seccion') {
                                newElems[idx] = {
                                  ...newElems[idx],
                                  secciones: addToListNested(newElems[idx].secciones || [], pathArray.slice(1)),
                                };
                              }
                              return newElems;
                            };
                            
                            const newSecciones = [...secciones[seccion.key]];
                            if (newSecciones[rootIdx] && newSecciones[rootIdx].tipo === 'seccion') {
                              newSecciones[rootIdx] = {
                                ...newSecciones[rootIdx],
                                secciones: addToListNested(newSecciones[rootIdx].secciones || [], pathParts.slice(1)),
                              };
                              setSecciones({ ...secciones, [seccion.key]: newSecciones });
                            }
                          }
                        }
                      }
                    }}
                    onRemoveFromList={(elementPath, itemIndex) => {
                      // Manejar remover de lista en secciones principales
                      // El path viene como "seccion.key.index" o "seccion.key.index.subindex..."
                      if (elementPath.startsWith(seccion.key + '.')) {
                        const pathBase = seccion.key + '.';
                        const indexStr = elementPath.substring(pathBase.length);
                        const pathParts = indexStr.split('.');
                        const rootIdx = parseInt(pathParts[0]);
                        
                        if (!isNaN(rootIdx) && rootIdx >= 0 && rootIdx < secciones[seccion.key].length) {
                          if (pathParts.length === 1) {
                            // Elemento raíz
                            const newSecciones = [...secciones[seccion.key]];
                            const elem = newSecciones[rootIdx];
                            if (elem && elem.tipo === 'lista') {
                              newSecciones[rootIdx] = {
                                ...elem,
                                elementos: (elem.elementos || []).filter((_, i) => i !== itemIndex),
                              };
                              setSecciones({ ...secciones, [seccion.key]: newSecciones });
                            }
                          } else {
                            // Elemento anidado - recursión
                            const removeFromListNested = (elems: SeccionElement[], pathArray: string[], itemIdx: number): SeccionElement[] => {
                              if (pathArray.length === 1) {
                                const idx = parseInt(pathArray[0]);
                                const newElems = [...elems];
                                const elem = newElems[idx];
                                if (elem && elem.tipo === 'lista') {
                                  newElems[idx] = {
                                    ...elem,
                                    elementos: (elem.elementos || []).filter((_, i) => i !== itemIdx),
                                  };
                                }
                                return newElems;
                              }
                              const idx = parseInt(pathArray[0]);
                              const newElems = [...elems];
                              if (newElems[idx] && newElems[idx].tipo === 'seccion') {
                                newElems[idx] = {
                                  ...newElems[idx],
                                  secciones: removeFromListNested(newElems[idx].secciones || [], pathArray.slice(1), itemIdx),
                                };
                              }
                              return newElems;
                            };
                            
                            const newSecciones = [...secciones[seccion.key]];
                            if (newSecciones[rootIdx] && newSecciones[rootIdx].tipo === 'seccion') {
                              newSecciones[rootIdx] = {
                                ...newSecciones[rootIdx],
                                secciones: removeFromListNested(newSecciones[rootIdx].secciones || [], pathParts.slice(1), itemIndex),
                              };
                              setSecciones({ ...secciones, [seccion.key]: newSecciones });
                            }
                          }
                        }
                      }
                    }}
                  />
                </ThemedView>
              ))}

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                >
                  {getActionIcon('cancel')}
                  <ThemedText style={styles.actionButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={editingRecord ? updatePlanHandler : savePlanHandler}
                >
                  {getActionIcon('confirm')}
                  <ThemedText style={styles.actionButtonText}>
                    {editingRecord ? 'Actualizar' : 'Guardar'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <ThemedText style={styles.createButtonText}>Crear Nuevo Plan de Trabajo - Personal Aseo y Limpieza</ThemedText>
              </TouchableOpacity>
              {renderPlanList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="CleaningWorkPlan"
      />
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
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noMarcaContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF5350',
    alignItems: 'center',
    marginBottom: 20,
  },
  noMarcaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 10,
  },
  noMarcaMessage: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
    width: '100%',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#000000',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  seccionPrincipalContainer: {
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  seccionPrincipalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#000000',
  },
  seccionBuilderContainer: {
    marginTop: 10,
  },
  addElementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#000000',
  },
  addElementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
    minWidth: 100,
  },
  addElementButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  addElementButtonTextDisabled: {
    color: '#CCCCCC',
  },
  elementContainer: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  nestedElement: {
    backgroundColor: '#F5F5F5',
  },
  elementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  elementTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  elementInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F9F9F9',
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  listItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F9F9F9',
  },
  removeListItemButton: {
    padding: 4,
  },
  addListItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  addListItemButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  seccionInternaContainer: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  nestedSeccion: {
    backgroundColor: '#BBDEFB',
  },
  seccionInternaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seccionInternaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#CCCCCC',
  },
  saveButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listSection: {
    width: '100%',
  },
  listContainer: {
    width: '100%',
    marginTop: 10,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F0F0F0',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  offlineBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  listItemDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  detailText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: '600',
  },
  listItemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  listItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  listItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#000000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    marginTop: 20,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
  },
});

