import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/build/Ionicons';

type ManagementPlanningControlScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ManagementPlanningControl'>;

export default function ManagementPlanningControlScreen() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ManagementPlanningControlScreenNavigationProp>();

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const renderMacroactivityBox = (number: number, title: string, icon: string, style: any) => {
    return (
      <ThemedView key={number} style={[styles.macroactivityBox, style]}>
        <ThemedView style={styles.macroactivityNumber}>
          <ThemedText style={styles.macroactivityNumberText}>{number}</ThemedText>
        </ThemedView>
        <Ionicons name={icon as any} size={32} color="#007AFF" style={styles.macroactivityIcon} />
        <ThemedText style={styles.macroactivityTitle}>{title}</ThemedText>
      </ThemedView>
    );
  };

  const renderArrow = (direction: 'right' | 'down' | 'up' | 'diagonal-right' | 'diagonal-left') => {
    let iconName = 'arrow-forward';
    let rotation = '0deg';
    
    switch (direction) {
      case 'right':
        iconName = 'arrow-forward';
        rotation = '0deg';
        break;
      case 'down':
        iconName = 'arrow-down';
        rotation = '0deg';
        break;
      case 'up':
        iconName = 'arrow-up';
        rotation = '0deg';
        break;
      case 'diagonal-right':
        iconName = 'arrow-down';
        rotation = '-45deg';
        break;
      case 'diagonal-left':
        iconName = 'arrow-down';
        rotation = '45deg';
        break;
    }

    return (
      <View style={[styles.arrowContainer, { transform: [{ rotate: rotation }] }]}>
        <Ionicons name={iconName as any} size={24} color="#666" />
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader
        onMenuPress={() => setIsMenuVisible(true)}
        onHomePress={handleHomePress}
        title="Planificación y Control Gerencial"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
        <ThemedView style={styles.documentContainer}>
          {/* Título Principal */}
          <ThemedView style={styles.titleSection}>
            <ThemedText style={styles.mainTitle}>
              HOJA DE PROCESO PLANIFICACIÓN Y CONTROL GERENCIAL
            </ThemedText>
            <ThemedText style={styles.documentCode}>PCG-H-001</ThemedText>
          </ThemedView>

          {/* Sección I: OBJETIVO */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>I. OBJETIVO</ThemedText>
            <ThemedText style={styles.sectionContent}>
              Planificar y controlar el Sistema de Gestión de la Calidad (SGC) para asegurar el cumplimiento de su misión, política y objetivos de calidad, dentro de un marco de control oportuno y comunicación, garantizando la integridad del sistema.
            </ThemedText>
          </ThemedView>

          {/* Sección II: ALCANCE */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>II. ALCANCE</ThemedText>
            <ThemedText style={styles.sectionContent}>
              Desde la planificación del SGC hasta el presupuesto.
            </ThemedText>
          </ThemedView>

          {/* Sección III: RESPONSABLE */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>III. RESPONSABLE DE EJECUCION DE ACTIVIDADES</ThemedText>
            <ThemedView style={styles.listContainer}>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>Gerente General</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>Equipo Gerencial</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>Mandos medios</ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          {/* Sección IV: DOCUMENTOS Y REGISTROS */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>IV. DOCUMENTOS Y REGISTROS ASOCIADOS</ThemedText>
            <ThemedView style={styles.listContainer}>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-001 Política de Calidad</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-002 Objetivos Empresariales</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-003 Mapa de procesos</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-004 Plan estratégico</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-005 Control de Revisiones por la Dirección</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-006-Matriz de partes interesadas</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-007 Plan de comunicación</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-008-Matriz de Gestión del Conocimiento</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>PCG-F-009-Matriz Planificación de Cambios</ThemedText>
              </ThemedView>
              <ThemedView style={[styles.listItem, styles.highlightedItem]}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={[styles.listText, styles.highlightedText]}>
                  PCG-H-001-Hoja de Proceso Planificación y Control Gerencial
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>GDO-F-007 Plantilla Agenda-Minuta Física</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>RRHH-F-006 Registro de Capacitación Interna</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>SEG-F-003 Checklist Supervisión</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>SEG-F-042 Checklist Supervisión CNFL</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>SEG-F-042 Checklist Supervisión ICE</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>AYL-F-023 Informe de Supervisión Semanal</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>MEC-P-001 Procedimiento Mejora Continua</ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItem}>
                <ThemedText style={styles.bullet}>•</ThemedText>
                <ThemedText style={styles.listText}>
                  RGO-P-001-Procedimiento de Gestión de riesgos y oportunidades
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          {/* Sección V: MAPEO DE MACROACTIVIDADES */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>V. MAPEO DE MACROACTIVIDADES</ThemedText>
            
            {/* Diagrama de Flujo en Cascada */}
            <ThemedView style={styles.flowchartContainer}>
              {/* Macroactividad 1 */}
              <ThemedView style={styles.cascadeItem}>
                {renderMacroactivityBox(1, 'Planificar el SGC', 'clipboard-outline', styles.topBox)}
                <ThemedView style={styles.cascadeArrow}>
                  {renderArrow('down')}
                </ThemedView>
              </ThemedView>

              {/* Macroactividad 2 */}
              <ThemedView style={styles.cascadeItem}>
                {renderMacroactivityBox(2, 'Realizar la revisión por la Dirección', 'people-outline', styles.topBox)}
                <ThemedView style={styles.cascadeArrow}>
                  {renderArrow('down')}
                </ThemedView>
              </ThemedView>

              {/* Macroactividad 3 */}
              <ThemedView style={styles.cascadeItem}>
                {renderMacroactivityBox(3, 'Comunicación Interna y Externa', 'chatbubbles-outline', styles.topBox)}
                <ThemedView style={styles.cascadeArrow}>
                  {renderArrow('down')}
                </ThemedView>
              </ThemedView>

              {/* Macroactividad 6 */}
              <ThemedView style={styles.cascadeItem}>
                {renderMacroactivityBox(6, 'Liderazgo y compromiso', 'trophy-outline', styles.middleBox)}
                <ThemedView style={styles.cascadeArrow}>
                  {renderArrow('down')}
                </ThemedView>
              </ThemedView>

              {/* Macroactividad 5 */}
              <ThemedView style={styles.cascadeItem}>
                {renderMacroactivityBox(5, 'Planificación de cambios', 'sync-outline', styles.middleBox)}
                <ThemedView style={styles.cascadeArrow}>
                  {renderArrow('down')}
                </ThemedView>
              </ThemedView>

              {/* Macroactividad 4 */}
              <ThemedView style={styles.cascadeItem}>
                {renderMacroactivityBox(4, 'Gestionar el Conocimiento', 'library-outline', styles.middleBox)}
                <ThemedView style={styles.cascadeArrow}>
                  {renderArrow('down')}
                </ThemedView>
              </ThemedView>

              {/* Macroactividad 7 */}
              <ThemedView style={styles.cascadeItem}>
                {renderMacroactivityBox(7, 'Presupuesto', 'cash-outline', styles.bottomBox)}
              </ThemedView>
            </ThemedView>
          </ThemedView>

          {/* Sección VI: DESCRIPCION */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>VI. DESCRIPCION</ThemedText>

            {/* MACROACTIVIDAD 1 */}
            <ThemedView style={styles.macroactivitySection}>
              <ThemedText style={styles.macroactivitySectionTitle}>
                1. MACROACTIVIDAD 1: PLANIFICAR EL SGC
              </ThemedText>
              
              <ThemedView style={styles.subsection}>
                <ThemedText style={styles.subsectionTitle}>
                  1.1. Determinar procesos necesarios
                </ThemedText>
                <ThemedText style={styles.responsibleText}>
                  Responsable: Gerente General y Equipo Gerencial.
                </ThemedText>
                <ThemedView style={styles.numberedList}>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.1.1.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Los procesos para el SGC se determinan utilizando PCG-F-003-Mapa de procesos.
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.subsection}>
                <ThemedText style={styles.subsectionTitle}>
                  1.2. Planificación estratégica
                </ThemedText>
                <ThemedText style={styles.responsibleText}>
                  Responsable: Equipo Gerencial.
                </ThemedText>
                <ThemedView style={styles.numberedList}>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.2.1.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Identifica factores internos y externos relevantes para el propósito y dirección estratégica de la organización utilizando PCG-F-004-Plan estratégico.
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.2.2.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Define el PCG-F-004-Plan estratégico considerando: A. Misión, Visión, Valores; B. Estrategias; C. Objetivos; D. Plan operativo.
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.2.3.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Da seguimiento y revisa la información del plan estratégico al menos anualmente durante la revisión por la dirección.
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.2.4.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Identifica y documenta oportunidades/riesgos que afectan al SGC en PCG-F-004-Plan estratégico, gestionados mediante RGO-P-001-Procedimiento de Gestión de riesgos y oportunidades.
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.subsection}>
                <ThemedText style={styles.subsectionTitle}>
                  1.3. Comprensión de necesidades y expectativas de partes interesadas
                </ThemedText>
                <ThemedText style={styles.responsibleText}>
                  Responsable: Equipo Gerencial.
                </ThemedText>
                <ThemedView style={styles.numberedList}>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.3.1.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Completa PCG-F-006-Matriz de partes interesadas con: A. Identificación de partes interesadas; B. Requisitos (necesidades/expectativas); C. Acciones de seguimiento/revisión.
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.responsibleText}>
                    Responsable de ejecución (PCG-F-006-Matriz de partes interesadas):
                  </ThemedText>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.3.2.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Ejecuta acciones de seguimiento/revisión de información de partes interesadas.
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.responsibleText}>
                    Responsable: Equipo Gerencial.
                  </ThemedText>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.3.3.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Da seguimiento a la implementación de acciones.
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.subsection}>
                <ThemedText style={styles.subsectionTitle}>
                  1.4. Determinar política y objetivos de Calidad
                </ThemedText>
                <ThemedText style={styles.responsibleText}>
                  Responsable: Gerente General y Equipo Gerencial.
                </ThemedText>
                <ThemedView style={styles.numberedList}>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.4.1.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Aprueba/revisa la Política de Calidad del SGC en PCG-F-004-Plan estratégico, asegurando alineación con el propósito organizacional y dirección estratégica.
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.4.2.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Determina/modifica/revisa objetivos empresariales (objetivos de calidad en PCG-F-004-Plan estratégico), asegurando coherencia con la Política de Calidad.
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.4.3.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Revisa Política y Objetivos Empresariales anualmente durante la Revisión por la Dirección para permanente adecuación.
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.responsibleText}>
                    Responsable: Personal de Recursos Humanos.
                  </ThemedText>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.4.4.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Registra comunicación de política/objetivos en RRHH-F-006 Registro de Capacitación Interna para inducción, según PCG-F-007 Plan de comunicación.
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.responsibleText}>
                    Responsable: Gerente General.
                  </ThemedText>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.4.5.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Proporciona evidencia de aprobación de política/objetivos y presupuesto requerido para operacionalización.
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.responsibleText}>
                    Responsable: Equipo Gerencial.
                  </ThemedText>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.4.6.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Establece Planes Operativos en PCG-F-004-Plan estratégico, asignando recursos para cumplimiento de objetivos/metas.
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.4.7.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Coordina implementación de acciones en Planes Operativos con personal correspondiente.
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.responsibleText}>
                    Responsable: Equipo Gerencial.
                  </ThemedText>
                  <ThemedView style={styles.numberedListItem}>
                    <ThemedText style={styles.numberedListNumber}>1.5.</ThemedText>
                    <ThemedText style={styles.numberedListText}>
                      Da seguimiento a acciones en PCG-F-004-Plan estratégico Plan Operativo según fechas establecidas.
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* MACROACTIVIDAD 2 */}
            <ThemedView style={styles.macroactivitySection}>
              <ThemedText style={styles.macroactivitySectionTitle}>
                2. MACROACTIVIDAD 2: REALIZAR LA REVISION POR LA DIRECCION
              </ThemedText>
              <ThemedText style={styles.responsibleText}>
                Responsable: Equipo Gerencial.
              </ThemedText>
              <ThemedView style={styles.numberedList}>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>2.1.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Anualmente realiza Revisión por la Dirección del SGC, considerando información en PCG-F-005 Control de Revisiones por la Dirección.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>2.2.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Documenta decisiones en PCG-F-005 Control de Revisiones por la Dirección, describiendo acciones/decisiones, incluyendo: a) oportunidades de mejora; b) necesidad de cambio del SGC; c) necesidades de recursos.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>2.3.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Genera acciones de mejora para cada revisión según MEC-P-001 Procedimiento Mejora Continua.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* MACROACTIVIDAD 3 */}
            <ThemedView style={styles.macroactivitySection}>
              <ThemedText style={styles.macroactivitySectionTitle}>
                3. MACROACTIVIDAD 3: COMUNICACION INTERNA Y EXTERNA
              </ThemedText>
              <ThemedText style={styles.responsibleText}>
                Responsable: Equipo Gerencial.
              </ThemedText>
              <ThemedView style={styles.numberedList}>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>3.1.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Anualmente crea y comunica PCG-F-007 Plan de comunicación a mandos medios, considerando: A. Política de Calidad; B. Objetivos de Calidad relevantes; C. Importancia de gestión de calidad efectiva; D. Contribución a efectividad del SGC (incluyendo beneficios de mejora de desempeño); E. Implicaciones de incumplimiento del SGC; F. Promoción de Enfoque de Procesos; G. Promoción de Pensamiento Basado en Riesgos; H. Promoción de Mejora; I. Necesidades/expectativas de comunicación de partes interesadas; J. Cualquier otro elemento necesario.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>3.2.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Ejecuta actividades del plan de comunicación y proporciona evidencia.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>3.3.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Seguimiento mensual de PCG-F-007 Plan de comunicación.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>3.4.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Evalúa efectividad de PCG-F-007 Plan de comunicación utilizando indicadores de la hoja de proceso de Planificación y Control Gerencial (ej: efectividad interna mediante encuesta de clima laboral, evaluación de satisfacción/quejas de clientes).
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* MACROACTIVIDAD 4 */}
            <ThemedView style={styles.macroactivitySection}>
              <ThemedText style={styles.macroactivitySectionTitle}>
                4. MACROACTIVIDAD 4: GESTIONAR EL CONOCIMIENTO
              </ThemedText>
              <ThemedText style={styles.responsibleText}>
                Responsable: Equipo Gerencial.
              </ThemedText>
              <ThemedView style={styles.numberedList}>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>4.1.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Completa PCG-F-008-Matriz de Gestión del Conocimiento por proceso, considerando: a) El conocimiento; b) El dueño del conocimiento; c) La herramienta de gestión; d) El método de transmisión/actualización.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>4.2.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Asegura ejecución de PCG-F-008 Matriz de Gestión del Conocimiento una vez completada.
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.responsibleText}>
                  Responsable del Conocimiento (PCG-F-008-Matriz de Gestión del Conocimiento):
                </ThemedText>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>4.3.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Ejecuta acciones para gestionar conocimiento organizacional y mantiene PCG-F-008 Matriz de Gestión del Conocimiento actualizada.
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.responsibleText}>
                  Responsable: Equipo Gerencial.
                </ThemedText>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>4.4.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Anualmente analiza conocimiento organizacional compilado y evalúa ajustes necesarios a PCG-F-008-Matriz de Gestión del Conocimiento.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* MACROACTIVIDAD 5 */}
            <ThemedView style={styles.macroactivitySection}>
              <ThemedText style={styles.macroactivitySectionTitle}>
                5. MACROACTIVIDAD 5: PLANIFICACION DE CAMBIOS
              </ThemedText>
              <ThemedText style={styles.responsibleText}>
                Responsable: Equipo gerencial.
              </ThemedText>
              <ThemedView style={styles.numberedList}>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>5.1.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Determina cambios del SGC, los cuales deben planificarse según PCG-F-009-Matriz Planificación de cambios.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>5.2.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Asegura que todos los cambios del SGC se alineen con esta metodología.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>5.3.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Gestiona cambios relacionados con nuevos contratos según LOG-P-001-Procedimiento de Logística.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* MACROACTIVIDAD 6 */}
            <ThemedView style={styles.macroactivitySection}>
              <ThemedText style={styles.macroactivitySectionTitle}>
                6. MACROACTIVIDAD 6: LIDERAZGO Y COMPROMISO
              </ThemedText>
              <ThemedText style={styles.responsibleText}>
                Responsable: Equipo gerencial.
              </ThemedText>
              <ThemedView style={styles.numberedList}>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>6.1.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Realiza sesiones gerenciales mensuales, documentadas en GDO-F-006-Agenda-Minuta Electrónica.
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.responsibleText}>
                  Responsable: Jefaturas (Heads of Departments).
                </ThemedText>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>6.2.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Realiza sesiones de equipo mensuales para: A. Comprometer, dirigir y apoyar al personal para efectividad del SGC; B. Seguimiento de tareas diarias; C. Abordar necesidades de recursos; D. Mejorar procesos; E. Abordar cualquier otro elemento necesario.
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>6.3.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Documenta estas sesiones en GDO-F-006-Agenda-Minuta Electrónica o GDO-F-007-Agenda-Minuta Física.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* MACROACTIVIDAD 7 */}
            <ThemedView style={styles.macroactivitySection}>
              <ThemedText style={styles.macroactivitySectionTitle}>
                7. MACROACTIVIDAD 7: PRESUPUESTO
              </ThemedText>
              <ThemedText style={styles.responsibleText}>
                Responsable: Equipo gerencial.
              </ThemedText>
              <ThemedView style={styles.numberedList}>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>7.1.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Anualmente genera presupuesto del SGC, asegurando considerar todos los recursos necesarios para gestión efectiva del sistema.
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.responsibleText}>
                  Responsable: Gerente Administrativo Financiero (Administrative Financial Manager).
                </ThemedText>
                <ThemedView style={styles.numberedListItem}>
                  <ThemedText style={styles.numberedListNumber}>7.2.</ThemedText>
                  <ThemedText style={styles.numberedListText}>
                    Actualiza el presupuesto conforme se ajusten contratos o compromisos.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView>
      <AppFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  documentContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  titleSection: {
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  documentCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  section: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  sectionContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  listContainer: {
    marginTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 16,
    color: '#000',
    marginRight: 10,
    marginTop: 2,
  },
  listText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 24,
  },
  highlightedItem: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 6,
    marginTop: 5,
  },
  highlightedText: {
    fontWeight: 'bold',
    color: '#C62828',
  },
  flowchartContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cascadeItem: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  cascadeArrow: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  macroactivityBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  topBox: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  middleBox: {
    backgroundColor: '#F3E5F5',
    borderColor: '#9C27B0',
  },
  bottomBox: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  macroactivityNumber: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#007AFF',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  macroactivityNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  macroactivityIcon: {
    marginTop: 8,
    marginBottom: 8,
  },
  macroactivityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    lineHeight: 18,
  },
  arrowContainer: {
    padding: 5,
  },
  macroactivitySection: {
    marginTop: 20,
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  macroactivitySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  subsection: {
    marginTop: 15,
    marginBottom: 15,
    paddingLeft: 10,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  responsibleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 5,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  numberedList: {
    marginTop: 10,
  },
  numberedListItem: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  numberedListNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 10,
    minWidth: 50,
  },
  numberedListText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
});

