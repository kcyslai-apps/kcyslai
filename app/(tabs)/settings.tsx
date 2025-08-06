
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

interface TemplateField {
  id: string;
  label: string;
  type: 'free_text' | 'date' | 'number' | 'fixed_data' | 'fixed_date' | 'barcode';
  required: boolean;
  value?: string;
  maxLength?: number;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface CSVExportSettings {
  includeHeader: boolean;
  delimiter: 'comma' | 'semicolon' | 'pipe' | 'custom';
  customDelimiter?: string;
  fieldPositions: { [fieldId: string]: number };
  fileExtension: string;
  includeQuotes: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  csvExportSettings: CSVExportSettings;
  createdAt: Date;
}

export default function SettingsScreen() {
  const appVersion = "1.0.0"; // This matches the version in app.json
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        const loadedTemplates = JSON.parse(content);
        setTemplates(loadedTemplates.map((template: any) => ({
          ...template,
          createdAt: new Date(template.createdAt)
        })));
      }
    } catch (error) {
      console.log('Error loading templates:', error);
    }
  };

  const saveTemplates = async (templates: Template[]) => {
    try {
      await FileSystem.writeAsStringAsync(TEMPLATES_FILE, JSON.stringify(templates));
    } catch (error) {
      console.log('Error saving templates:', error);
    }
  };

  const exportTemplates = async () => {
    try {
      if (templates.length === 0) {
        showError('No templates available to export');
        return;
      }

      const exportData = {
        templates: templates,
        exportDate: new Date().toISOString(),
        appVersion: appVersion
      };

      const fileName = `barcode2file_templates_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Export Templates',
          mimeType: 'application/json'
        });
      } else {
        Alert.alert('Export Complete', `Templates exported to: ${fileName}`);
      }
    } catch (error) {
      showError('Failed to export templates. Please try again.');
      console.log('Export error:', error);
    }
  };

  const importTemplates = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const content = await FileSystem.readAsStringAsync(fileUri);
        
        try {
          const importData = JSON.parse(content);
          
          if (!importData.templates || !Array.isArray(importData.templates)) {
            showError('Invalid template file format');
            return;
          }

          const importedTemplates = importData.templates.map((template: any) => ({
            ...template,
            createdAt: new Date(template.createdAt)
          }));

          // Check for duplicate names
          const duplicateNames: string[] = [];
          const existingNames = templates.map(t => t.name.toLowerCase());
          
          importedTemplates.forEach((template: Template) => {
            if (existingNames.includes(template.name.toLowerCase())) {
              duplicateNames.push(template.name);
            }
          });

          if (duplicateNames.length > 0) {
            showError(`Templates with the following names already exist and will be skipped:\n${duplicateNames.join(', ')}`);
            return;
          }

          // Import templates
          const updatedTemplates = [...templates, ...importedTemplates];
          setTemplates(updatedTemplates);
          await saveTemplates(updatedTemplates);

          Alert.alert('Success', `Successfully imported ${importedTemplates.length} template(s)`);
        } catch (parseError) {
          showError('Invalid JSON file format');
        }
      }
    } catch (error) {
      showError('Failed to import templates. Please try again.');
      console.log('Import error:', error);
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const closeErrorModal = () => {
    setShowErrorModal(false);
    setErrorMessage('');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>App Configuration</Text>
        </View>

        {/* App Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>App Version</Text>
            <Text style={styles.settingValue}>{appVersion}</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>App Name</Text>
            <Text style={styles.settingValue}>Barcode2File</Text>
          </View>
        </View>

        {/* Template Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Template Management</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Total Templates</Text>
            <Text style={styles.settingValue}>{templates.length}</Text>
          </View>
          
          <TouchableOpacity style={styles.actionButton} onPress={exportTemplates}>
            <Text style={styles.actionButtonText}>📤 Export Templates</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={importTemplates}>
            <Text style={styles.actionButtonText}>📥 Import Templates</Text>
          </TouchableOpacity>
        </View>

        
      </ScrollView>

      {/* Error Modal */}
      <Modal visible={showErrorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.errorModalContent}>
            <Text style={styles.errorModalTitle}>❌ Import Error</Text>
            <Text style={styles.errorModalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={closeErrorModal}
            >
              <Text style={styles.errorModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Account for tab bar
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f7fafc',
  },
  settingLabel: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#fed7d7',
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2d3748',
    textAlign: 'center',
  },
  errorModalMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  errorModalButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  errorModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
