
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput, ScrollView, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Camera, CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface TemplateField {
  id: string;
  name: string;
  type: 'free_text' | 'date' | 'number' | 'fixed_data' | 'fixed_date' | 'barcode';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  inputMode?: 'select_only' | 'editable';
}

interface Template {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  createdAt: Date;
}

interface DataRecord {
  id: string;
  templateId: string;
  templateName: string;
  data: { [fieldId: string]: string };
  timestamp: Date;
}

export default function DataEntryScreen() {
  const { templateId, dataFileName } = useLocalSearchParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<{ [fieldId: string]: string }>({});
  const [showCamera, setShowCamera] = useState(false);
  const [currentBarcodeField, setCurrentBarcodeField] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [currentDataFileName, setCurrentDataFileName] = useState<string>('');

  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';
  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';

  useEffect(() => {
    loadTemplate();
    if (dataFileName && typeof dataFileName === 'string') {
      setCurrentDataFileName(decodeURIComponent(dataFileName));
    }
  }, [templateId, dataFileName]);

  const loadTemplate = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        const templates: Template[] = JSON.parse(content);
        const foundTemplate = templates.find(t => t.id === templateId);
        
        if (foundTemplate) {
          setTemplate(foundTemplate);
          // Initialize form data with default values
          const initialData: { [fieldId: string]: string } = {};
          foundTemplate.fields.forEach(field => {
            if (field.type === 'fixed_data' && field.defaultValue) {
              // For fixed_data fields, set the default value
              initialData[field.id] = field.defaultValue;
            } else if (field.defaultValue) {
              initialData[field.id] = field.defaultValue;
            } else {
              initialData[field.id] = '';
            }
          });
          setFormData(initialData);
        } else {
          Alert.alert('Error', 'Template not found');
          router.back();
        }
      }
    } catch (error) {
      console.error('Error loading template:', error);
      Alert.alert('Error', 'Failed to load template');
      router.back();
    }
  };

  const updateFieldValue = (fieldId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const openBarcodeScanner = (fieldId: string) => {
    setCurrentBarcodeField(fieldId);
    setShowCamera(true);
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (currentBarcodeField) {
      updateFieldValue(currentBarcodeField, data);
      setCurrentBarcodeField(null);
      setShowCamera(false);
    }
  };

  const validateForm = (): boolean => {
    if (!template) return false;

    for (const field of template.fields) {
      if (field.required && !formData[field.id]?.trim()) {
        Alert.alert('Validation Error', `${field.name} is required`);
        return false;
      }
    }
    return true;
  };

  const saveDataRecord = async () => {
    if (!validateForm() || !template) return;

    try {
      // Load existing records
      let existingRecords: DataRecord[] = [];
      const fileExists = await FileSystem.getInfoAsync(DATA_RECORDS_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(DATA_RECORDS_FILE);
        existingRecords = JSON.parse(content);
      }

      // Create new record
      const newRecord: DataRecord = {
        id: Date.now().toString(),
        templateId: template.id,
        templateName: template.name,
        data: { ...formData },
        timestamp: new Date()
      };

      // Save updated records
      const updatedRecords = [...existingRecords, newRecord];
      await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));

      const successMessage = currentDataFileName 
        ? `Data saved to "${currentDataFileName}" successfully!`
        : 'Data saved successfully!';
        
      Alert.alert(
        'Success',
        successMessage,
        [
          { text: 'Add Another', onPress: resetForm },
          { text: 'Back to Templates', onPress: () => router.back() }
        ]
      );
    } catch (error) {
      console.error('Error saving data:', error);
      Alert.alert('Error', 'Failed to save data');
    }
  };

  const resetForm = () => {
    if (!template) return;
    
    const initialData: { [fieldId: string]: string } = {};
    template.fields.forEach(field => {
      if (field.type === 'fixed_data' && field.defaultValue) {
        // For fixed_data fields, set the default value
        initialData[field.id] = field.defaultValue;
      } else if (field.defaultValue) {
        initialData[field.id] = field.defaultValue;
      } else {
        initialData[field.id] = '';
      }
    });
    setFormData(initialData);
  };

  const renderField = (field: TemplateField) => {
    const value = formData[field.id] || '';

    switch (field.type) {
      case 'free_text':
        return (
          <TextInput
            style={styles.input}
            placeholder={`Enter ${field.name}`}
            value={value}
            onChangeText={(text) => updateFieldValue(field.id, text)}
            multiline={true}
            numberOfLines={3}
          />
        );

      case 'number':
        return (
          <TextInput
            style={styles.input}
            placeholder={`Enter ${field.name}`}
            value={value}
            onChangeText={(text) => updateFieldValue(field.id, text)}
            keyboardType="numeric"
          />
        );

      case 'date':
        return (
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={value}
            onChangeText={(text) => updateFieldValue(field.id, text)}
          />
        );

      case 'fixed_date':
        return (
          <View style={styles.fixedValueContainer}>
            <Text style={styles.fixedValue}>{field.defaultValue || 'No date set'}</Text>
          </View>
        );

      case 'fixed_data':
        // Ensure default value is always available as an option
        const allOptions = field.options || [];
        const defaultValue = field.defaultValue;
        
        // Add default value to options if it exists and isn't already in the options
        if (defaultValue && !allOptions.includes(defaultValue)) {
          allOptions.unshift(defaultValue);
        }
        
        // Check input mode - default to 'select_only' for backward compatibility
        const inputMode = field.inputMode || 'select_only';
        
        if (inputMode === 'editable') {
          return (
            <View style={styles.editableUnifiedContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type or tap to select from options"
                value={value}
                onChangeText={(text) => updateFieldValue(field.id, text)}
              />
              {allOptions.length > 0 && (
                <View style={styles.quickSelectContainer}>
                  <Text style={styles.quickSelectLabel}>Quick Select:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSelectScroll}>
                    {allOptions.map((option, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.quickSelectOption}
                        onPress={() => updateFieldValue(field.id, option)}
                      >
                        <Text style={styles.quickSelectOptionText}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        } else {
          // Select only mode
          return (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={value || field.defaultValue || ''}
                onValueChange={(itemValue) => updateFieldValue(field.id, itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Select..." value="" />
                {allOptions.map((option, index) => (
                  <Picker.Item key={index} label={option} value={option} />
                ))}
              </Picker>
            </View>
          );
        }

      case 'barcode':
        return (
          <View style={styles.barcodeContainer}>
            <TextInput
              style={[styles.input, styles.barcodeInput]}
              placeholder="Scan or enter barcode"
              value={value}
              onChangeText={(text) => updateFieldValue(field.id, text)}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => openBarcodeScanner(field.id)}
            >
              <Text style={styles.scanButtonText}>📷 Scan</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <TextInput
            style={styles.input}
            placeholder={`Enter ${field.name}`}
            value={value}
            onChangeText={(text) => updateFieldValue(field.id, text)}
          />
        );
    }
  };

  if (!template) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading template...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>Data Entry</ThemedText>
        </View>

        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateDescription}>{template.description}</Text>
          {currentDataFileName && (
            <Text style={styles.dataFileName}>📂 Data File: {currentDataFileName}</Text>
          )}
        </View>

        <View style={styles.formContainer}>
          {template.fields.map((field) => (
            <View key={field.id} style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                {field.name}
                {field.required && <Text style={styles.required}> *</Text>}
              </Text>
              {renderField(field)}
            </View>
          ))}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.resetButton} onPress={resetForm}>
            <Text style={styles.resetButtonText}>Reset Form</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={saveDataRecord}>
            <Text style={styles.saveButtonText}>Save Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Barcode Scanner Modal */}
      <Modal visible={showCamera} transparent animationType="fade">
        <View style={styles.cameraContainer}>
          {permission?.granted ? (
            <>
              <CameraView
                style={styles.camera}
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'pdf417', 'code128', 'code39', 'ean13', 'ean8'],
                }}
              />
              <View style={styles.cameraOverlay}>
                <Text style={styles.cameraText}>Scan a barcode</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowCamera(false)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionText}>Camera permission required</Text>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCamera(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4299e1',
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#2d3748',
  },
  templateInfo: {
    backgroundColor: '#f7fafc',
    padding: 8,
    marginHorizontal: 15,
    marginBottom: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4299e1',
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 2,
  },
  templateDescription: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 1,
  },
  dataFileName: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '600',
    marginTop: 2,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  formContainer: {
    padding: 15,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 6,
  },
  required: {
    color: '#e53e3e',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 6,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    minHeight: 40,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 44,
  },
  fixedValueContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#f7fafc',
    minHeight: 40,
  },
  fixedValue: {
    fontSize: 16,
    color: '#4a5568',
  },
  barcodeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  barcodeInput: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: '#4299e1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
    minHeight: 40,
  },
  scanButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 15,
    paddingBottom: 20,
    gap: 10,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#a0aec0',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    minHeight: 44,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#48bb78',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    minHeight: 44,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    alignItems: 'center',
  },
  cameraText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 15,
  },
  closeButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editableUnifiedContainer: {
    gap: 8,
  },
  quickSelectContainer: {
    marginTop: 6,
  },
  quickSelectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 4,
  },
  quickSelectScroll: {
    flexDirection: 'row',
  },
  quickSelectOption: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  quickSelectOptionText: {
    fontSize: 13,
    color: '#2d3748',
    fontWeight: '500',
  },
});
