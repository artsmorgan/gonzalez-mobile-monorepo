import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, View, Platform } from 'react-native';
import DateTimePicker from "@react-native-community/datetimepicker";
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
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { createNote as createNoteAPI, updateNote as updateNoteAPI } from '@/hooks/notesFunctions';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';

type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notes'>;

interface CurrentMarca {
  id: number;
  hora_entrada_digitada: string | null;
  hora_salida_digitada: string | null;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
  tipo_turno: string;
  horas_duracion: number;
  empresa: {
    id: number;
    nombre: string;
  };
  cliente: {
    id: number;
    nombre: string;
  };
  contrato: {
    id: number;
    nombre: string;
  };
  corpo: {  
    id: number;
    nombre: string;
    ubicacion: {
      lat: number | null;
      lng: number | null;
    }
  };
  puesto: {
    id: number;
    nombre: string;
  };
  plaza: {
    id: number;
    nombre: string;
  };
  horario: {
    id: number;
    nombre: string;
  };
}

interface Note {
  id: number;
  titulo: string;
  description: string;
  division: string | null;
  categoria_id: number | null;
  empleado: string;
  updated_at: string;
  id_local: string;
}

interface EditingNote {
  id: number | null;
  id_local: string;
  titulo: string;
  description: string;
  division: string | null;
  categoria_id: number | null;
}

interface Change {
  titulo: string;
  description: string;
  created_at: string;
  empleado: string;
  categoria: string | null;
}

interface ChangesResponse {
  status: boolean;
  changes?: Change[];
  message?: string;
}

interface Puesto {
  id: number;
  nombre: string;
}

interface Category {
  id: number;
  nombre: string;
}

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function NotesScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NotesScreenNavigationProp>();
  
  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [puesto, setPuesto] = useState<Puesto | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  
  // Expanded notes state
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  // Current marca state
  const [currentMarca, setCurrentMarca] = useState<CurrentMarca | null>(null);
  
  // Editing state
  const [editingNote, setEditingNote] = useState<EditingNote | null>(null);
  
  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [newNote, setNewNote] = useState<EditingNote>({
    id: null,
    id_local: '',
    titulo: '',
    description: '',
    division: null,
    categoria_id: null,
  });
  
  // Form refs for text inputs
  const tituloRef = useRef('');
  const descriptionRef = useRef('');
  
  // Filters state
  const [searchText, setSearchText] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | string>('all');
  const [empleadoFilter, setEmpleadoFilter] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // Changes modal state
  const [isChangesModalVisible, setIsChangesModalVisible] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  
  // Divisions from employee roles
  const [divisions, setDivisions] = useState<string[]>([]);
  
  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);


  useEffect(() => {
    if (employee?.roles) {
      const uniqueDivisions = Array.from(
        new Set(employee.roles.map(role => role.division.name))
      );
      setDivisions(uniqueDivisions);
    }
  }, [employee]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
      fetchCategories();
    }, [])
  );
  
  useEffect(() => {
    const handler = () => {
      Promise.all([
        fetchNotes(),
        fetchCategories(),
      ]);
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  // Función auxiliar para generar ID aleatorio
  const generateRandomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Función para verificar conectividad
  const getConnectionStatus = async () => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable;
  };

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        const response = await fetch(`${apiUrl}/api/categories`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.status === 401 || response.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchCategories();
          } else {
            Alert.alert('Error', 'Sesión expirada. Por favor inicie sesión nuevamente.');
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status) {
          setCategories(data.categories || []);
          // Actualizar categories_cache
          await AsyncStorage.setItem('categories_cache', JSON.stringify(data.categories || []));
        } else {
          console.error('Error loading categories:', data.message);
        }
      } else {
        // Sin internet: cargar desde cache
        const categoriesCache = await AsyncStorage.getItem('categories_cache');
        if (categoriesCache) {
          const cachedCategories = JSON.parse(categoriesCache);
          setCategories(cachedCategories);
        } else {
          setCategories([]);
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const categoriesCache = await AsyncStorage.getItem('categories_cache');
        if (categoriesCache) {
          const cachedCategories = JSON.parse(categoriesCache);
          setCategories(cachedCategories);
        }
      } catch (cacheErr) {
        console.error('Error loading categories from cache:', cacheErr);
      }
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchNotes = async () => {
    // Verificar si existe current_marca
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      setHasCurrentMarca(false);
      setIsLoading(false);
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);
    setCurrentMarca(currentMarcaData);
    setHasCurrentMarca(true);

    try {
      setIsLoading(true);
      setError(null);

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        const response = await fetch(`${apiUrl}/api/puestos/${currentMarcaData.id}/notas`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.status === 401 || response.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchNotes();
          } else {
            Alert.alert('Error', 'Sesión expirada. Por favor inicie sesión nuevamente.');
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status) {
          setNotes(data.notas || []);
          setPuesto(currentMarcaData.puesto || null);
          // Actualizar notes_cache
          await AsyncStorage.setItem('notes_cache', JSON.stringify({
            notas: data.notas || [],
            puesto: currentMarcaData.puesto || null
          }));
        } else {
          setError(data.message || 'Error al cargar las notas');
          Alert.alert('Error', data.message || 'Error al cargar las notas');
        }
      } else {
        // Sin internet: cargar desde cache
        const notesCache = await AsyncStorage.getItem('notes_cache');
        if (notesCache) {
          const cachedData = JSON.parse(notesCache);
          setNotes(cachedData.notas || []);
          setPuesto(currentMarcaData.puesto || null);
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        } else {
          setError('No hay datos guardados y no hay conexión a internet');
          Alert.alert('Sin conexión', 'No hay conexión a internet y no hay datos guardados previamente.');
          setNotes([]);
        }
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const notesCache = await AsyncStorage.getItem('notes_cache');
        if (notesCache) {
          const cachedData = JSON.parse(notesCache);
          setNotes(cachedData.notas || []);
          setPuesto(currentMarcaData.puesto || null);
          Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
        } else {
          setError('Error al cargar las notas');
          Alert.alert('Error', 'No se pudieron cargar las notas');
        }
      } catch (cacheErr) {
        setError('Error al cargar las notas');
        Alert.alert('Error', 'No se pudieron cargar las notas');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createNote = async () => {

    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se pudo cargar la marca');
      return;
    }
    const currentMarcaData = JSON.parse(currentMarca);
    if (!currentMarcaData){
      Alert.alert('Error', 'No se pudo cargar la marca');
      return;
    }

    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return;
    }

    if (!descriptionRef.current.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria');
      return;
    }

    Alert.alert(
      'Confirmar creación',
      '¿Estás seguro de que deseas crear esta nota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Crear',
          onPress: async () => {
            try {
              const requestBody = {
                empleado_id: employee?.id,
                titulo: tituloRef.current,
                description: descriptionRef.current,
                division: newNote.division,
                categoria_id: newNote.categoria_id,
                puesto_id: puesto?.id || 0
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await createNoteAPI({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  puestoId: currentMarcaData.puesto.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Nota creada correctamente');
                  setIsCreating(false);
                  setNewNote({ id: null, id_local: '', titulo: '', description: '', division: null, categoria_id: null });
                  fetchNotes();
                } else {
                  Alert.alert('Error', data.message || 'Error al crear la nota');
                }
              } else {
                // Sin internet: modo offline
                const localId = generateRandomId();
                const horaAccion = await getHoraAccion();

                // Crear entrada en notes_actions
                const actionsStr = await AsyncStorage.getItem('notes_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  puestoId: currentMarcaData.puesto.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('notes_actions', JSON.stringify(actions));

                // Crear nota en cache
                const cacheStr = await AsyncStorage.getItem('notes_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : { notas: [], puesto: null };
                
                const newNoteCache = {
                  id: 0,
                  titulo: tituloRef.current,
                  description: descriptionRef.current,
                  division: newNote.division,
                  categoria_id: newNote.categoria_id,
                  empleado: employee?.name || 'Desconocido',
                  updated_at: new Date(horaAccion).toISOString(),
                  id_local: localId,
                };

                cache.notas.push(newNoteCache);
                await AsyncStorage.setItem('notes_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Nota creada localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                setNewNote({ id: null, id_local: '', titulo: '', description: '', division: null, categoria_id: null });
                fetchNotes();
              }
            } catch (err) {
              console.error('Error creating note:', err);
              Alert.alert('Error', 'No se pudo crear la nota');
            }
          },
        },
      ]
    );
  };

  const updateNote = async (noteId: number) => {
    if (!editingNote) return;

    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return;
    }

    if (!descriptionRef.current.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria');
      return;
    }

    Alert.alert(
      'Confirmar edición',
      '¿Estás seguro de que deseas guardar los cambios?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestBody = {
                empleado_id: employee?.id,
                titulo: tituloRef.current,
                description: descriptionRef.current,
                division: editingNote.division,
                categoria_id: editingNote.categoria_id,
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await updateNoteAPI({
                  requestData: requestBody,
                  noteId: noteId,
                  puestoId: currentMarca?.puesto?.id || 0,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Nota actualizada correctamente');
                  setEditingNote(null);
                  fetchNotes();
                } else {
                  Alert.alert('Error', data.message || 'Error al actualizar la nota');
                }
              } else {
                // Sin internet: modo offline
                const actionsStr = await AsyncStorage.getItem('notes_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (editingNote.id_local !== '') {
                  // Editar acción existente en notes_actions
                  const actionIndex = actions.findIndex((a: any) => a.id === editingNote.id_local);
                  if (actionIndex !== -1) {
                    actions[actionIndex].requestData = requestBody;
                    await AsyncStorage.setItem('notes_actions', JSON.stringify(actions));
                  }
                } else {
                  // Crear nueva acción de update en notes_actions
                  // Eliminar cualquier acción de update previa para este noteId
                  const filteredActions = actions.filter((a: any) => !(a.type === 'update' && a.id === noteId));
                  filteredActions.push({
                    requestData: requestBody,
                    puestoId: currentMarca?.puesto?.id || 0,
                    id: noteId,
                    type: 'update',
                  });
                  await AsyncStorage.setItem('notes_actions', JSON.stringify(filteredActions));
                }

                // Actualizar notes_cache
                const cacheStr = await AsyncStorage.getItem('notes_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : { notas: [], puesto: null };
                
                const noteIndex = cache.notas.findIndex((n: Note) => 
                  editingNote.id_local !== '' ? n.id_local === editingNote.id_local : n.id === noteId
                );

                if (noteIndex !== -1) {
                  cache.notas[noteIndex] = {
                    ...cache.notas[noteIndex],
                    titulo: tituloRef.current,
                    description: descriptionRef.current,
                    division: editingNote.division,
                    categoria_id: editingNote.categoria_id,
                  };
                  await AsyncStorage.setItem('notes_cache', JSON.stringify(cache));
                }

                Alert.alert('Modo Offline', 'Nota actualizada localmente. Se sincronizará cuando haya conexión.');
                setEditingNote(null);
                fetchNotes();
              }
            } catch (err) {
              console.error('Error updating note:', err);
              Alert.alert('Error', 'No se pudo actualizar la nota');
            }
          },
        },
      ]
    );
  };

  const deleteNote = async (noteId: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar esta nota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
              if (!apiUrl) {
                throw new Error('Server URL not configured');
              }

              let token = await AsyncStorage.getItem('access_token');
              if (!token) {
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                  throw new Error('No authentication token found');
                }
                token = await AsyncStorage.getItem('access_token');
              }

              const response = await fetch(`${apiUrl}/api/empleados/${employee?.id}/notas/${noteId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': '69420',
                },
              });

              if (response.status === 401 || response.status === 403) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                  return deleteNote(noteId);
                } else {
                  Alert.alert('Error', 'Sesión expirada. Por favor inicie sesión nuevamente.');
                  await logout();
                  return;
                }
              }

              const data = await response.json();

              if (data.status) {
                Alert.alert('Éxito', data.message || 'Nota eliminada correctamente');
                fetchNotes();
              } else {
                Alert.alert('Error', data.message || 'Error al eliminar la nota');
              }
            } catch (err) {
              console.error('Error deleting note:', err);
              Alert.alert('Error', 'No se pudo eliminar la nota');
            }
          },
        },
      ]
    );
  };
  
const getActionIcon = (action: string) => {
  switch (action.toLowerCase()) {
    case 'add': return <Ionicons name="add-sharp" size={20} color='#FFFFFF' />;
    case 'confirm': return <Ionicons name="checkmark-sharp" size={20} color='#FFFFFF' />;
    case 'cancel': return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
    case 'edit': return <Ionicons name="pencil" size={20} color='#FFFFFF' />;
    case 'delete': return <Ionicons name="trash" size={20} color='#FFFFFF' />;
    case 'notes': return <Ionicons name="document" size={25} color='#FFFFFF' />;
    case 'changes': return <Ionicons name="document" size={25} color='#FFFFFF' />;
    default: return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
  }
};

  const toggleExpanded = (noteId: number) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  const startEditing = (note: Note) => {
    setEditingNote({
      id: note.id,
      id_local: note.id_local,
      titulo: note.titulo,
      description: note.description,
      division: note.division,
      categoria_id: note.categoria_id,
    });
    // Initialize refs with note values
    tituloRef.current = note.titulo;
    descriptionRef.current = note.description;
    // Ensure the note is expanded
    const newExpanded = new Set(expandedNotes);
    newExpanded.add(note.id);
    setExpandedNotes(newExpanded);
  };

  const cancelEditing = () => {
    setEditingNote(null);
  };

  const startCreating = () => {
    setIsCreating(true);
    setNewNote({ id: null, id_local: '', titulo: '', description: '', division: divisions[0] || null, categoria_id: null });
    // Initialize refs
    tituloRef.current = '';
    descriptionRef.current = '';
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewNote({ id: null, id_local: '', titulo: '', description: '', division: null, categoria_id: null });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
  
      let hours = date.getUTCHours(); // <-- usa getUTCHours() para evitar ajustes de zona
      const minutes = date.getUTCMinutes();
  
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12; // convierte 0 → 12 y 13–23 → 1–11
  
      const formatted = `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;

      return `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}, ${formatted}`;
    } catch (error) {
      return dateString;
    }
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return null;
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.nombre : null;
  };


  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.titulo.toLowerCase().includes(searchText.toLowerCase()) ||
      note.description.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesDivision = 
      selectedDivision === 'all' || 
      selectedDivision === 'none' && !note.division ||
      note.division === selectedDivision;
    
    const matchesDate = !selectedDate || (() => {
      const noteDate = new Date(note.updated_at);
      const filterDate = selectedDate;
      
      // Compare only date part (ignore time)
      const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
      const filterDateOnly = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
      
      return noteDateOnly.getTime() === filterDateOnly.getTime();
    })();
    
    const matchesCategory = 
      selectedCategory === 'all' || 
      (selectedCategory === 'none' && !note.categoria_id) ||
      note.categoria_id === selectedCategory;
    
    const matchesEmpleado = 
      !empleadoFilter || 
      note.empleado.toLowerCase().includes(empleadoFilter.toLowerCase());
    
    return matchesSearch && matchesDivision && matchesDate && matchesCategory && matchesEmpleado;
  });

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Handle back navigation
  const handleBack = () => {
    navigation.goBack();
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const resetAllFilters = () => {
    setSearchText('');
    setSelectedDivision('all');
    setSelectedDate(null);
    setSelectedCategory('all');
    setEmpleadoFilter('');
  };

  const formatDateForDisplay = (date: Date) => {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const fetchChanges = async (noteId: number) => {
    try {
      setIsLoadingChanges(true);
      setChanges([]);

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Error', 'No hay conexión a internet');
        setIsLoadingChanges(false);
        return;
      }

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        throw new Error('Current marca not found');
      }
      const currentMarcaData = JSON.parse(currentMarca);
      if (!currentMarcaData) {
        throw new Error('Current marca data not found');
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No authentication token found');
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const response = await fetch(`${apiUrl}/api/puestos/${currentMarcaData.puesto.id}/notas/${noteId}/changes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchChanges(noteId);
        } else {
          Alert.alert('Error', 'Sesión expirada. Por favor inicie sesión nuevamente.');
          await logout();
          return;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChangesResponse = await response.json();

      if (data.status && data.changes) {
        setChanges(data.changes);
      } else {
        setChanges([]);
        if (data.message) {
          Alert.alert('Información', data.message);
        }
      }
    } catch (err) {
      console.error('Error fetching changes:', err);
      Alert.alert('Error', 'No se pudieron cargar los cambios de la nota');
      setChanges([]);
    } finally {
      setIsLoadingChanges(false);
    }
  };

  const openChangesModal = (noteId: number) => {
    setSelectedNoteId(noteId);
    setIsChangesModalVisible(true);
    fetchChanges(noteId);
  };

  const closeChangesModal = () => {
    setIsChangesModalVisible(false);
    setSelectedNoteId(null);
    setChanges([]);
  };

  const renderNoteItem = (note: Note) => {
    const isExpanded = expandedNotes.has(note.id);
    const isEditing = editingNote?.id === note.id;

    return (
      <ThemedView key={note.id} style={styles.noteCard}>
        {isEditing ? (
          // Edit mode
          <ThemedView style={styles.editContainer}>
            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Título:</ThemedText>
              <TextInput
                style={styles.input}
                defaultValue={editingNote.titulo}
                onChangeText={(text) => { tituloRef.current = text; }}
                placeholder="Título de la nota"
                placeholderTextColor="#999"
                key={`titulo-edit-${editingNote.id}`}
              />
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Descripción:</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                defaultValue={editingNote.description}
                onChangeText={(text) => { descriptionRef.current = text; }}
                placeholder="Descripción de la nota"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`description-edit-${editingNote.id}`}
              />
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Categoría:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={editingNote.categoria_id}
                  onValueChange={(value) => setEditingNote({ ...editingNote, categoria_id: value as number | null })}
                  style={styles.picker}
                >
                  <Picker.Item label="Sin categoría" value={null} />
                  {categories.map((category) => (
                    <Picker.Item key={category.id} label={category.nombre} value={category.id} />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.buttonRow}>
              <TouchableOpacity style={styles.confirmButton} onPress={() => updateNote(note.id)}>
                <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        ) : (
          // View mode
          <>
            <TouchableOpacity
              style={styles.noteHeader}
              onPress={() => toggleExpanded(note.id)}
              activeOpacity={0.7}
            >
              <ThemedView style={styles.noteHeaderContent}>
                <ThemedText style={styles.noteTitle}>{note.titulo}</ThemedText>
                <ThemedView style={styles.noteMetadata}>
                  {getCategoryName(note.categoria_id) && (
                    <ThemedView style={styles.categoryBadge}>
                      <ThemedText style={styles.categoryText}>{getCategoryName(note.categoria_id)}</ThemedText>
                    </ThemedView>
                  )}
                  <ThemedText style={styles.noteDate}>{formatDate(note.updated_at)}</ThemedText>
                </ThemedView>
              </ThemedView>
              <ThemedText style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</ThemedText>
            </TouchableOpacity>

            {isExpanded && (
              <ThemedView style={styles.noteBody}>
                <ThemedText style={styles.noteDescription}>{note.description}</ThemedText>
                
                {/* Último cambio info */}
                <ThemedView style={styles.lastChangeContainer}>
                  <ThemedText style={styles.lastChangeLabel}>Último cambio:</ThemedText>
                  <ThemedText style={styles.lastChangeEmployee}>{note.empleado}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.buttonRow}>
                  <TouchableOpacity style={styles.editButton} onPress={() => startEditing(note)}>
                    <ThemedText style={styles.editButtonText}>{getActionIcon('edit')}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.changesButton} onPress={() => openChangesModal(note.id)}>
                    <ThemedText style={styles.changesButtonText}>{getActionIcon('changes')}</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            )}
          </>
        )}
      </ThemedView>
    );
  };

  const renderNewNoteForm = () => {
    if (!isCreating) return null;

    return (
      <ThemedView style={[styles.noteCard, styles.newNoteCard]}>
        <ThemedView style={styles.editContainer}>
          <ThemedText style={styles.newNoteTitle}>Nueva Nota</ThemedText>
          
          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Título:</ThemedText>
            <TextInput
              style={styles.input}
              defaultValue={newNote.titulo}
              onChangeText={(text) => { tituloRef.current = text; }}
              placeholder="Título de la nota"
              placeholderTextColor="#999"
              key="titulo-create"
            />
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Descripción:</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              defaultValue={newNote.description}
              onChangeText={(text) => { descriptionRef.current = text; }}
              placeholder="Descripción de la nota"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              key="description-create"
            />
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Categoría:</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={newNote.categoria_id}
                onValueChange={(value) => setNewNote({ ...newNote, categoria_id: value as number | null })}
                style={styles.picker}
              >
                <Picker.Item label="Sin categoría" value={null} />
                {categories.map((category) => (
                  <Picker.Item key={category.id} label={category.nombre} value={category.id} />
                ))}
              </Picker>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.buttonRow}>
            <TouchableOpacity style={styles.confirmButton} onPress={createNote}>
              <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelCreating}>
              <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Bitácora de novedades" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando novedades...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Notes"
        />
      </ThemedView>
    );
  }

  // Si no hay marca registrada, mostrar mensaje
  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Bitácora de novedades" />
        <ThemedView style={styles.noMarcaContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF9500" />
          <ThemedText style={styles.noMarcaTitle}>No hay marca registrada</ThemedText>
          <ThemedText style={styles.noMarcaMessage}>
            Debes registrar una marca de ingreso antes de acceder a la bitácora de novedades.
          </ThemedText>
          <TouchableOpacity 
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <ThemedText style={styles.goBackButtonText}>Volver</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Notes"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Bitácora de novedades" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>

          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('notes')} Bitácora de novedades
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona las notas del puesto
            </ThemedText>
          </ThemedView>

          {/* Puesto Info */}
          {puesto && (
            <ThemedView style={styles.puestoContainer}>
              <ThemedText style={styles.puestoLabel}>Puesto:</ThemedText>
              <ThemedText style={styles.puestoName}>{puesto.nombre}</ThemedText>
            </ThemedView>
          )}

          {/* Filters */}
          <ThemedView style={styles.filtersMain}>
            {/* Filter Header */}
            <ThemedView style={styles.filterHeader}>
              <TouchableOpacity 
                style={styles.filterToggleButton}
                onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                <ThemedText style={styles.filterToggleText}>
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
              <ThemedView style={styles.filterContent}>
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Título o Descripción:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Buscar por título o descripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>
                
                {/* Date Filter */}
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                  <ThemedView style={styles.dateFilterRow}>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <ThemedText style={styles.dateButtonText}>
                        {selectedDate ? formatDateForDisplay(selectedDate) : 'Seleccionar fecha'}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    
                    {selectedDate && (
                      <TouchableOpacity
                        style={styles.clearDateButton}
                        onPress={clearDateFilter}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </ThemedView>
                </ThemedView>

                {/* Category Filter */}
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Categoría:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedCategory}
                      onValueChange={(value) => setSelectedCategory(value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todas las categorías" value="all" />
                      <Picker.Item label="Sin categoría" value="none" />
                      {categories.map((category) => (
                        <Picker.Item key={category.id} label={category.nombre} value={category.id} />
                      ))}
                    </Picker>
                  </ThemedView>
                </ThemedView>

                {/* Empleado Filter */}
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Último cambio por:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={empleadoFilter}
                    onChangeText={setEmpleadoFilter}
                    placeholder="Buscar por empleado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>

          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}

          {/* Create Button */}
          {!isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          )}

          {/* New Note Form */}
          {renderNewNoteForm()}

          {/* Notes List */}
          <ThemedView style={styles.notesContainer}>
            {filteredNotes.length === 0 ? (
              <ThemedView style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>
                  {notes.length === 0 
                    ? 'No hay notas creadas aún' 
                    : 'No se encontraron notas con los filtros aplicados'}
                </ThemedText>
              </ThemedView>
            ) : (
              filteredNotes.map(note => renderNoteItem(note))
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>
      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Notes"
      />

      {/* Changes Modal */}
      <Modal
        visible={isChangesModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeChangesModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.changesModalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Bitácora de cambios</ThemedText>
              <TouchableOpacity onPress={closeChangesModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </ThemedView>

            {isLoadingChanges ? (
              <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Cargando cambios...</ThemedText>
              </ThemedView>
            ) : changes.length === 0 ? (
              <ThemedView style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No hay cambios registrados para esta nota</ThemedText>
              </ThemedView>
            ) : (
              <ScrollView style={styles.changesList}>
                {changes.map((change, index) => (
                  <ThemedView key={index} style={styles.changeItem}>
                    {/* Título */}
                    <ThemedView style={styles.changeHeader}>
                      <ThemedText style={styles.changeTitle}>{change.titulo}</ThemedText>
                    </ThemedView>
                    
                    {/* Categoría */}
                    {change.categoria && (
                      <ThemedView style={styles.changeCategoryContainer}>
                        <ThemedView style={styles.changeCategoryBadge}>
                          <ThemedText style={styles.changeCategoryText}>{change.categoria}</ThemedText>
                        </ThemedView>
                      </ThemedView>
                    )}
                    
                    {/* Descripción */}
                    <ThemedText style={styles.changeDescription}>{change.description}</ThemedText>
                    
                    {/* Información del empleado y fecha con fondo celeste */}
                    <ThemedView style={styles.changeInfoContainer}>
                      <ThemedText style={styles.changeEmployee}>Realizado por: {change.empleado}</ThemedText>
                      <ThemedText style={styles.changeDate}>Realizado en: {formatDate(change.created_at)}</ThemedText>
                    </ThemedView>
                  </ThemedView>
                ))}
              </ScrollView>
            )}
          </ThemedView>
        </ThemedView>
      </Modal>
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
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  puestoContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  puestoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  puestoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    
  },
  filtersMain: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  filterHeader: {
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
  filterToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  resetFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  filterContent: {
    padding: 16,
    gap: 10,
    backgroundColor: '#F8F9FA',
  },
  filterGroupSearch: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  filterGroupDivision: {
    width: '40%',
    backgroundColor: '#fff',
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
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notesContainer: {
    width: '100%',
    gap: 16,
  },
  noteCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  newNoteCard: {
    marginBottom: 20,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  noteHeaderContent: {
    flex: 1,
    gap: 8,
    backgroundColor: '#fff',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  noteMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  divisionBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  divisionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noteDate: {
    fontSize: 12,
    opacity: 0.6,
    color: '#666',
  },
  expandIcon: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  noteBody: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
    backgroundColor: '#fff',
  },
  noteDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  lastChangeContainer: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
    marginTop: 8,
  },
  lastChangeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  lastChangeEmployee: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editContainer: {
    padding: 16,
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  newNoteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
    backgroundColor: '#fff',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
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
  dateFilterContainer: {
    width: '100%',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  clearDateButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  changesButton: {
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  changesButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  changesModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  changesList: {
    maxHeight: 400,
  },
  changeItem: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  changeHeader: {
    marginBottom: 8,
  },
  changeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    backgroundColor: '#fff',
  },
  changeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 8,
  },
  changeDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  changeMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#fff',
  },
  changeEmployee: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  changeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  changeCategoryContainer: {
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  changeCategoryBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  changeCategoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  changeInfoContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
  },
});

