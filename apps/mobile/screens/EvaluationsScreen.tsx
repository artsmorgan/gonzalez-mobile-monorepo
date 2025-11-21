import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/build/Ionicons';

type EvaluationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Evaluations'>;

export default function EvaluationsScreen() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<EvaluationsScreenNavigationProp>();

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
      case 'evaluations': return <Ionicons name="clipboard" size={25} color='#000000' />;
      default: return <Ionicons name="clipboard" size={25} color='#000000' />;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Evaluaciones" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('evaluations')} Evaluaciones
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona las diferentes evaluaciones
            </ThemedText>
          </ThemedView>

          {/* Navigation Buttons */}
          <ThemedView style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('MileageControl' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="speedometer" size={24} color="#FFFFFF" /> Control de Kilometraje
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSecondary]}
              onPress={() => navigation.navigate('UniformRequest' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="shirt" size={24} color="#FFFFFF" /> Solicitud Uniforme
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTertiary]}
              onPress={() => navigation.navigate('RoutesAndTours' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="map" size={24} color="#FFFFFF" /> Rutas y Giras
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonQuaternary]}
              onPress={() => navigation.navigate('EmployeeSatisfaction' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="happy" size={24} color="#FFFFFF" /> Satisfacción del Personal
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonQuinary]}
              onPress={() => navigation.navigate('VehicleMaintenance' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="car" size={24} color="#FFFFFF" /> Planificación y Control de Mantenimiento
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSenary]}
              onPress={() => navigation.navigate('NonConformingProduct' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="warning" size={24} color="#FFFFFF" /> Producto No Conforme y Matriz
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSeptenary]}
              onPress={() => navigation.navigate('ComplaintsMaster' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="chatbubbles" size={24} color="#FFFFFF" /> Maestro de Quejas
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonOctonary]}
              onPress={() => navigation.navigate('CleanersControl' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="brush" size={24} color="#FFFFFF" /> Control de Aseadores
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonNonary]}
              onPress={() => navigation.navigate('PhysicalMinuteAgenda' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" /> Agenda Minuta Física
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonDecimal]}
              onPress={() => navigation.navigate('ActionPlan' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="list" size={24} color="#FFFFFF" /> Plan de Acción
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonUndecimal]}
              onPress={() => navigation.navigate('WorkRole' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="calendar" size={24} color="#FFFFFF" /> Rol de Trabajo
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonDuodenary]}
              onPress={() => navigation.navigate('ContractBasicData' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" /> Datos Básicos de Contrato
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTredecenary]}
              onPress={() => navigation.navigate('DeliverySchedule' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="calendar" size={24} color="#FFFFFF" /> Cronograma de Entrega
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonQuattuordecenary]}
              onPress={() => navigation.navigate('EnvironmentalManagementPlan' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="leaf" size={24} color="#FFFFFF" /> Plan de Gestión Ambiental
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonQuindecenary]}
              onPress={() => navigation.navigate('CleaningWorkPlan' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="water" size={24} color="#FFFFFF" /> Plan de Trabajo - Personal Aseo y Limpieza
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSexdecenary]}
              onPress={() => navigation.navigate('SpecialSituationsPlan' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="warning" size={24} color="#FFFFFF" /> Plan para la Atención de Situaciones Especiales
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSeptendecenary]}
              onPress={() => navigation.navigate('CleaningTasksActivities' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="clipboard" size={24} color="#FFFFFF" /> Registro de Tareas o Actividades de Limpieza
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonOctodecenary]}
              onPress={() => navigation.navigate('RiskMatrix' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="shield" size={24} color="#FFFFFF" /> Matriz de Riesgos
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonNovodecenary]}
              onPress={() => navigation.navigate('OpportunityMatrix' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="trending-up" size={24} color="#FFFFFF" /> Matriz de Oportunidades
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonVigintenary]}
              onPress={() => navigation.navigate('ProcessIndicatorMatrix' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="stats-chart" size={24} color="#FFFFFF" /> Matriz de Indicador de Procesos
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonUnvigintenary]}
              onPress={() => navigation.navigate('MonthlyWorkRole' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="calendar" size={24} color="#FFFFFF" /> Rol de Trabajo Mensual
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonDuovigintenary]}
              onPress={() => navigation.navigate('PermitRequest' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" /> Solicitud de Permiso
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('AttendanceControl' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="people" size={24} color="#FFFFFF" /> Control de Asistencia
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('OpeningClosingPosition' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="business" size={24} color="#FFFFFF" /> Apertura-Cierre de Puesto
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('InductionTourRecord' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" /> Registro de Inducción y Recorrido
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('SupervisionReport' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="clipboard" size={24} color="#FFFFFF" /> Informe de Supervisión
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('ElectricBrushGuide' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="brush" size={24} color="#FFFFFF" /> Guía de Uso de Cepillo Eléctrico
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('GeneralClientsList' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="list" size={24} color="#FFFFFF" /> Listado General de Clientes
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('ImprovementActionsControl' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" /> Control de Acciones de Mejora
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('QualityPolicy' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" /> Política de Calidad
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('BusinessQualityObjectives' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="flag" size={24} color="#FFFFFF" /> Objetivos Empresariales de Calidad
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('StakeholderAnalysisMatrix' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="people" size={24} color="#FFFFFF" /> Matriz de Análisis de Partes Interesadas
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('CommunicationPlan' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="chatbubbles" size={24} color="#FFFFFF" /> Plan de Comunicación
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('KnowledgeManagementMatrix' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="library" size={24} color="#FFFFFF" /> Matriz de Gestión del Conocimiento
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('ChangePlanning' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="clipboard" size={24} color="#FFFFFF" /> Planificación de Cambios del SGC
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('ManagementPlanningControl' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" /> Planificación y Control Gerencial
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonTresvigintenary]}
              onPress={() => navigation.navigate('CommunicationPlanRequirements' as never)}
            >
              <ThemedText style={styles.navButtonText}>
                <Ionicons name="mail-outline" size={24} color="#FFFFFF" /> Requisitos Registro Evidencias Plan de Comunicación
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Evaluations"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161719',
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
  buttonsContainer: {
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  navButton: {
    backgroundColor: '#FF9500',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  navButtonSecondary: {
    backgroundColor: '#5856D6',
  },
  navButtonTertiary: {
    backgroundColor: '#30D158',
  },
  navButtonQuaternary: {
    backgroundColor: '#FF3B30',
  },
  navButtonQuinary: {
    backgroundColor: '#007AFF',
  },
  navButtonSenary: {
    backgroundColor: '#9C27B0',
  },
  navButtonSeptenary: {
    backgroundColor: '#E91E63',
  },
  navButtonOctonary: {
    backgroundColor: '#00BCD4',
  },
  navButtonNonary: {
    backgroundColor: '#795548',
  },
  navButtonDecimal: {
    backgroundColor: '#9C27B0',
  },
  navButtonUndecimal: {
    backgroundColor: '#FF6F00',
  },
  navButtonDuodenary: {
    backgroundColor: '#607D8B',
  },
  navButtonTredecenary: {
    backgroundColor: '#3F51B5',
  },
  navButtonQuattuordecenary: {
    backgroundColor: '#4CAF50',
  },
  navButtonQuindecenary: {
    backgroundColor: '#9C27B0',
  },
  navButtonSexdecenary: {
    backgroundColor: '#FF5722',
  },
  navButtonSeptendecenary: {
    backgroundColor: '#795548',
  },
  navButtonOctodecenary: {
    backgroundColor: '#607D8B',
  },
  navButtonNovodecenary: {
    backgroundColor: '#9C27B0',
  },
  navButtonVigintenary: {
    backgroundColor: '#3F51B5',
  },
  navButtonUnvigintenary: {
    backgroundColor: '#00BCD4',
  },
  navButtonDuovigintenary: {
    backgroundColor: '#9C27B0',
  },
  navButtonTresvigintenary: {
    backgroundColor: '#607D8B',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
