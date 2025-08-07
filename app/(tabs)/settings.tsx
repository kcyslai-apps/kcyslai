import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';

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
  isDefault?: boolean;
  isProtected?: boolean;
}

export default function SettingsScreen() {
  const appVersion = Constants.expoConfig?.version || "1.0.16"; // This matches the version in app.json
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showExportSelectionModal, setShowExportSelectionModal] = useState(false);
  const [selectedTemplateForExport, setSelectedTemplateForExport] = useState<string>('');
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);
  const [exportedTemplateName, setExportedTemplateName] = useState('');
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [importedTemplateCount, setImportedTemplateCount] = useState<number>(0);

  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadTemplates();
  }, []);

  // Reload templates when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadTemplates();
    }, [])
  );

  const loadTemplates = async (forceReload = false) => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        const loadedTemplates = JSON.parse(content);
        const templatesWithDates = loadedTemplates.map((template: any) => ({
          ...template,
          createdAt: new Date(template.createdAt),
          isDefault: template.isDefault || false,
          isProtected: template.isProtected || false
        }));
        setTemplates(templatesWithDates);
        console.log('Settings - Loaded templates:', templatesWithDates.length);
        console.log('Settings - Template names:', templatesWithDates.map(t => t.name));
      } else {
        console.log('Templates file does not exist');
        setTemplates([]);
      }
    } catch (error) {
      console.log('Error loading templates:', error);
      setTemplates([]);
    }
  };

  const saveTemplates = async (templates: Template[]) => {
    try {
      await FileSystem.writeAsStringAsync(TEMPLATES_FILE, JSON.stringify(templates));
    } catch (error) {
      console.log('Error saving templates:', error);
    }
  };

  const showExportSelection = async () => {
    // Reload templates to ensure we have the latest data
    await loadTemplates();

    // Check again after loading
    if (templates.length === 0) {
      showError('No templates available to export');
      return;
    }
    setSelectedTemplateForExport('');
    setShowExportSelectionModal(true);
  };

  const selectTemplate = (templateId: string) => {
    setSelectedTemplateForExport(templateId);
  };

  const exportSelectedTemplate = async () => {
    try {
      if (!selectedTemplateForExport) {
        showError('Please select a template to export');
        return;
      }

      const selectedTemplate = templates.find(t => t.id === selectedTemplateForExport);
      if (!selectedTemplate) {
        showError('Template not found');
        return;
      }

      const exportData = {
        templates: [selectedTemplate],
        exportDate: new Date().toISOString(),
        appVersion: appVersion
      };

      const fileName = `barcode2file_template_${selectedTemplate.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));

      setShowExportSelectionModal(false);
      setExportedTemplateName(selectedTemplate.name);
      setShowExportSuccessModal(true);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Export Template',
          mimeType: 'application/json'
        });
      }
    } catch (error) {
      showError('Failed to export template. Please try again.');
      console.log('Export error:', error);
    }
  };

  const cancelExportSelection = () => {
    setShowExportSelectionModal(false);
    setSelectedTemplateForExport('');
  };

  const importTemplates = async () => {
    try {
      // Force reload templates to ensure we have the latest state
      await loadTemplates(true);

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

          // Get the most current templates from file system for accurate duplicate checking
          const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
          let currentTemplates: Template[] = [];

          if (fileExists.exists) {
            const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
            const loadedTemplates = JSON.parse(content);
            currentTemplates = loadedTemplates.map((template: any) => ({
              ...template,
              createdAt: new Date(template.createdAt)
            }));
          }

          // Check for duplicate names against current file system data
          const duplicateNames: string[] = [];
          const existingNames = currentTemplates.map(t => t.name.toLowerCase());

          importedTemplates.forEach((template: Template) => {
            if (existingNames.includes(template.name.toLowerCase())) {
              duplicateNames.push(template.name);
            }
          });

          if (duplicateNames.length > 0) {
            showError(`Templates with the following names already exist and will be skipped:\n${duplicateNames.join(', ')}`);
            return;
          }

          // Import templates using current file system data
          const updatedTemplates = [...currentTemplates, ...importedTemplates];
          setTemplates(updatedTemplates);
          await saveTemplates(updatedTemplates);

          // Reload templates from file system to ensure state consistency
          await loadTemplates();

          // Update state for the new import success modal
          setImportedTemplateCount(importedTemplates.length);
          setShowImportSuccessModal(true);

          // The original Alert.alert is removed as per the new design pattern
          // Alert.alert('Success', `Successfully imported ${importedTemplates.length} template(s)`);
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

  const closeExportSuccessModal = () => {
    setShowExportSuccessModal(false);
    setExportedTemplateName('');
  };

  // Handler for the new import success modal
  const closeImportSuccessModal = () => {
    setShowImportSuccessModal(false);
    setImportedTemplateCount(0);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
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

          <TouchableOpacity style={styles.actionButton} onPress={showExportSelection}>
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

      {/* Export Selection Modal */}
      <Modal 
        visible={showExportSelectionModal} 
        transparent 
        animationType="slide"
        onShow={() => {
          console.log('Export modal opened, templates count:', templates.length);
          console.log('Templates:', templates.map(t => t.name));
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.exportSelectionModalContent}>
            <Text style={styles.exportSelectionModalTitle}>📤 Select Template to Export</Text>

            <ScrollView style={styles.templateSelectionList} showsVerticalScrollIndicator={false}>
              {templates.length === 0 ? (
                <View style={styles.noTemplatesContainer}>
                  <Text style={styles.noTemplatesText}>No templates available</Text>
                  <Text style={styles.noTemplatesSubtext}>Create templates first to export them</Text>
                </View>
              ) : (
                templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateSelectionItem,
                      selectedTemplateForExport === template.id && styles.selectedTemplateItem
                    ]}
                    onPress={() => selectTemplate(template.id)}
                  >
                    <View style={styles.templateSelectionContent}>
                      <Text style={styles.templateSelectionCheckbox}>
                        {selectedTemplateForExport === template.id ? '🔘' : '⚪'}
                      </Text>
                      <View style={styles.templateSelectionInfo}>
                        <Text style={[
                          styles.templateSelectionName,
                          selectedTemplateForExport === template.id && styles.selectedTemplateName
                        ]}>
                          {template.name}
                        </Text>
                        {template.description && (
                          <Text style={styles.templateSelectionDescription}>
                            {template.description}
                          </Text>
                        )}
                        <Text style={styles.templateSelectionFields}>
                          {template.fields.length} field(s)
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.exportSelectionModalButtons}>
              <TouchableOpacity
                style={styles.exportSelectionCancelButton}
                onPress={cancelExportSelection}
              >
                <Text style={styles.exportSelectionCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.exportSelectionConfirmButton,
                  !selectedTemplateForExport && styles.disabledButton
                ]}
                onPress={exportSelectedTemplate}
                disabled={!selectedTemplateForExport}
              >
                <Text style={[
                  styles.exportSelectionConfirmButtonText,
                  !selectedTemplateForExport && styles.disabledButtonText
                ]}>
                  Export Template
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Success Modal */}
      <Modal visible={showExportSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.exportSuccessModalContent}>
            <Text style={styles.exportSuccessModalTitle}>✅ Export Successful</Text>
            <View style={styles.exportSuccessModalInfo}>
              <Text style={styles.exportSuccessModalMessage}>
                Template has been successfully exported
              </Text>
              <Text style={styles.exportSuccessTemplateText}>
                "{exportedTemplateName}"
              </Text>
            </View>
            <TouchableOpacity
              style={styles.exportSuccessModalButton}
              onPress={closeExportSuccessModal}
            >
              <Text style={styles.exportSuccessModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Import Success Modal */}
      <Modal visible={showImportSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.exportSuccessModalContent}>
            <ThemedText style={styles.exportSuccessModalTitle}>✅ Import Successful</ThemedText>
            <ThemedView style={styles.exportSuccessModalInfo}>
              <ThemedText style={styles.exportSuccessModalMessage}>
                Successfully imported {importedTemplateCount} template(s)
              </ThemedText>
            </ThemedView>
            <TouchableOpacity
              style={styles.exportSuccessModalButton}
              onPress={closeImportSuccessModal}
            >
              <ThemedText style={styles.exportSuccessModalButtonText}>OK</ThemedText>
            </TouchableOpacity>
          </ThemedView>
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
  exportSelectionModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '95%',
    maxWidth: 600,
    maxHeight: '85%',
    minHeight: '70%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#4299e1',
  },
  exportSelectionModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  templateSelectionList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minHeight: 300,
    maxHeight: 400,
  },
  templateSelectionItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  selectedTemplateItem: {
    borderColor: '#4299e1',
    backgroundColor: '#f0f8ff',
  },
  templateSelectionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
  },
  templateSelectionCheckbox: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 2,
  },
  templateSelectionInfo: {
    flex: 1,
  },
  templateSelectionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  selectedTemplateName: {
    color: '#2b6cb0',
  },
  templateSelectionDescription: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  templateSelectionFields: {
    fontSize: 12,
    color: '#a0aec0',
    fontStyle: 'italic',
  },
  exportSelectionModalButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  exportSelectionCancelButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportSelectionCancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '600',
  },
  exportSelectionConfirmButton: {
    flex: 1,
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportSelectionConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#cbd5e0',
  },
  disabledButtonText: {
    color: '#a0aec0',
  },
  noTemplatesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noTemplatesText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#718096',
    marginBottom: 8,
  },
  noTemplatesSubtext: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
  },
  exportSuccessModalContent: {
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
    borderColor: '#68d391',
  },
  exportSuccessModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2d3748',
    textAlign: 'center',
  },
  exportSuccessModalInfo: {
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
  },
  exportSuccessModalMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 15,
  },
  exportSuccessTemplateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0fff4',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#68d391',
    minWidth: '80%',
    elevation: 3,
  },
  exportSuccessModalButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  exportSuccessModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

});