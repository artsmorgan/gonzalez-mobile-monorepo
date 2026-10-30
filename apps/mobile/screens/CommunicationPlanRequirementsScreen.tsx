import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
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

type CommunicationPlanRequirementsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CommunicationPlanRequirements'>;

export default function CommunicationPlanRequirementsScreen() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<CommunicationPlanRequirementsScreenNavigationProp>();

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader
        onMenuPress={() => setIsMenuVisible(true)}
        onHomePress={handleHomePress}
        title="Requisitos Registro Evidencias Plan de Comunicación"
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
              Requisitos Registro Evidencias Plan de Comunicación
            </ThemedText>
          </ThemedView>

          {/* Sección 1: RESPONSABLE DEL SEGUIMIENTO */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              RESPONSABLE DEL SEGUIMIENTO Y CUMPLIMIENTO DEL PLAN Y QUE LAS EVIDENCIAS ESTÉN EN TIEMPO Y FORMA:
            </ThemedText>
            
            <ThemedView style={styles.listContainer}>
              <ThemedView style={styles.listItem}>
                <Ionicons name="person-circle-outline" size={24} color="#007AFF" style={styles.icon} />
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>Fiscalizador General:</ThemedText>
                  <ThemedText style={styles.listItemText}>Gerente RRHH y Calidad (fiscaliza a cada gerente)</ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItem}>
                <Ionicons name="people-outline" size={24} color="#007AFF" style={styles.icon} />
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>Por Departamento:</ThemedText>
                  <ThemedText style={styles.listItemText}>Cada Gerente (fiscaliza a su personal a cargo)</ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          {/* Sección 2: EVIDENCIAS QUE SE DEBEN GUARDAR */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              EVIDENCIAS QUE SE DEBEN GUARDAR:
            </ThemedText>
            
            <ThemedView style={styles.listContainer}>
              <ThemedView style={styles.listItem}>
                <Ionicons name="document-text-outline" size={24} color="#007AFF" style={styles.icon} />
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemText}>
                    Material de Comunicación (presentación, imagen, PDF, gif, video, etc...)
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItem}>
                <Ionicons name="screenshot-outline" size={24} color="#007AFF" style={styles.icon} />
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemText}>
                    Pantallazo de la Comunicación (debe verse a quien se envió y lo que se envió)
                  </ThemedText>
                  <ThemedView style={styles.subListContainer}>
                    <ThemedView style={styles.subListItem}>
                      <ThemedText style={styles.bullet}>•</ThemedText>
                      <ThemedText style={styles.subListText}>Correo</ThemedText>
                    </ThemedView>
                    <ThemedView style={styles.subListItem}>
                      <ThemedText style={styles.bullet}>•</ThemedText>
                      <ThemedText style={styles.subListText}>WhatsApp</ThemedText>
                    </ThemedView>
                    <ThemedView style={styles.subListItem}>
                      <ThemedText style={styles.bullet}>•</ThemedText>
                      <ThemedText style={styles.subListText}>Otro medio digital</ThemedText>
                    </ThemedView>
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItem}>
                <Ionicons name="clipboard-outline" size={24} color="#007AFF" style={styles.icon} />
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemText}>
                    RRHH-F-006 Registro de capacitación interna
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItem}>
                <Ionicons name="calendar-outline" size={24} color="#007AFF" style={styles.icon} />
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemText}>
                    GDO-F-006-Agenda-Minuta Electrónica o GDO-F-007-Plantilla Agenda-Minuta Física
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          {/* Sección 3: DIRECCIÓN PARA GUARDAR EVIDENCIAS */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              DIRECCIÓN PARA GUARDAR EVIDENCIAS:
            </ThemedText>
            
            <ThemedView style={styles.listContainer}>
              <ThemedView style={styles.directoryItem}>
                <Ionicons name="folder-outline" size={24} color="#FF9800" style={styles.icon} />
                <ThemedView style={styles.directoryItemContent}>
                  <ThemedText style={styles.directoryItemTitle}>Aseo y Limpieza:</ThemedText>
                  <ThemedView style={styles.pathContainer}>
                    <ThemedText style={styles.pathText}>
                      \\192.168.0.14\iso\CORPORACION GONZALEZ\REGISTROS\AYL_ASEO Y LIMPIEZA\EVIDENCIAS PLAN DE COMUNICACION
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.directoryItem}>
                <Ionicons name="folder-outline" size={24} color="#FF9800" style={styles.icon} />
                <ThemedView style={styles.directoryItemContent}>
                  <ThemedText style={styles.directoryItemTitle}>Seguridad:</ThemedText>
                  <ThemedView style={styles.pathContainer}>
                    <ThemedText style={styles.pathText}>
                      \\192.168.0.14\iso\CORPORACION GONZALEZ\REGISTROS\SEG_SEGURIDAD\EVIDENCIAS PLAN DE COMUNICACION
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.directoryItem}>
                <Ionicons name="folder-outline" size={24} color="#FF9800" style={styles.icon} />
                <ThemedView style={styles.directoryItemContent}>
                  <ThemedText style={styles.directoryItemTitle}>Recursos Humanos:</ThemedText>
                  <ThemedView style={styles.pathContainer}>
                    <ThemedText style={styles.pathText}>
                      \\192.168.0.14\iso\CORPORACION GONZALEZ\REGISTROS\RRHH_RECURSOS HUMANOS\EVIDENCIAS PLAN DE COMUNICACION
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.directoryItem}>
                <Ionicons name="folder-outline" size={24} color="#FF9800" style={styles.icon} />
                <ThemedView style={styles.directoryItemContent}>
                  <ThemedText style={styles.directoryItemTitle}>Financiero:</ThemedText>
                  <ThemedView style={styles.pathContainer}>
                    <ThemedText style={styles.pathText}>
                      \\192.168.0.14\iso\CONSORCIO\REGISTROS\Z_REGISTROS COMPARTIDOS\FINANCIERO\EVIDENCIAS PLAN DE COMUNICACION
                    </ThemedText>
                  </ThemedView>
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
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    textTransform: 'uppercase',
    lineHeight: 22,
  },
  listContainer: {
    marginTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  listItemText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  subListContainer: {
    marginTop: 10,
    marginLeft: 10,
  },
  subListItem: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 10,
    marginTop: 2,
    fontWeight: 'bold',
  },
  subListText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
    lineHeight: 20,
  },
  directoryItem: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
    padding: 15,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  directoryItemContent: {
    flex: 1,
  },
  directoryItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
  },
  pathContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pathText: {
    fontSize: 13,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});

