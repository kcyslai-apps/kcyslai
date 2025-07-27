
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
  dateFormat?: string;
  customDateFormat?: string;
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
  const [fixedFormData, setFixedFormData] = useState<{ [fieldId: string]: string }>({});
  const [variableFormData, setVariableFormData] = useState<{ [fieldId: string]: string }>({});
  const [showCamera, setShowCamera] = useState(false);
  const [currentBarcodeField, setCurrentBarcodeField] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [currentDataFileName, setCurrentDataFileName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<'fixed' | 'variable'>('fixed');
  const [recordCount, setRecordCount] = useState(0);

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
          
          // Initialize fixed data form
          const initialFixedData: { [fieldId: string]: string } = {};
          const initialVariableData: { [fieldId: string]: string } = {};
          
          foundTemplate.fields.forEach(field => {
            if (field.type === 'fixed_data' || field.type === 'fixed_date') {
              initialFixedData[field.id] = field.defaultValue || '';
            } else {
              initialVariableData[field.id] = field.defaultValue || '';
            }
          });
          
          setFixedFormData(initialFixedData);
          setVariableFormData(initialVariableData);

          // Check if we have fixed fields, if not skip to variable page
          const hasFixedFields = foundTemplate.fields.some(field => 
            field.type === 'fixed_data' || field.type === 'fixed_date'
          );
          
          if (!hasFixedFields) {
            setCurrentPage('variable');
          }
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

  const updateFixedFieldValue = (fieldId: string, value: string) => {
    setFixedFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const updateVariableFieldValue = (fieldId: string, value: string) => {
    setVariableFormData(prev => ({
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
      updateVariableFieldValue(currentBarcodeField, data);
      setCurrentBarcodeField(null);
      setShowCamera(false);
    }
  };

  const validateFixedForm = (): boolean => {
    if (!template) return false;

    const fixedFields = template.fields.filter(field => 
      field.type === 'fixed_data' || field.type === 'fixed_date'
    );

    for (const field of fixedFields) {
      if (field.required && !fixedFormData[field.id]?.trim()) {
        Alert.alert('Validation Error', `${field.name} is required`);
        return false;
      }
    }
    return true;
  };

  const validateVariableForm = (): boolean => {
    if (!template) return false;

    const variableFields = template.fields.filter(field => 
      field.type !== 'fixed_data' && field.type !== 'fixed_date'
    );

    for (const field of variableFields) {
      if (field.required && !variableFormData[field.id]?.trim()) {
        Alert.alert('Validation Error', `${field.name} is required`);
        return false;
      }
    }
    return true;
  };

  const proceedToVariablePage = () => {
    if (!validateFixedForm()) return;
    setCurrentPage('variable');
  };

  const saveDataRecord = async () => {
    if (!validateVariableForm() || !template) return;

    try {
      // Load existing records
      let existingRecords: DataRecord[] = [];
      const fileExists = await FileSystem.getInfoAsync(DATA_RECORDS_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(DATA_RECORDS_FILE);
        existingRecords = JSON.parse(content);
      }

      // Combine fixed and variable data
      const combinedData = { ...fixedFormData, ...variableFormData };

      // Create new record
      const newRecord: DataRecord = {
        id: Date.now().toString(),
        templateId: template.id,
        templateName: template.name,
        data: combinedData,
        timestamp: new Date()
      };

      // Save updated records
      const updatedRecords = [...existingRecords, newRecord];
      await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));

      const newCount = recordCount + 1;
      setRecordCount(newCount);

      const successMessage = currentDataFileName
        ? `Record ${newCount} saved to "${currentDataFileName}" successfully!`
        : `Record ${newCount} saved successfully!`;

      Alert.alert(
        'Success',
        successMessage,
        [
          { text: 'Add Another Entry', onPress: resetVariableForm },
        ]
      );
    } catch (error) {
      console.error('Error saving data:', error);
      Alert.alert('Error', 'Failed to save data');
    }
  };

  const resetVariableForm = () => {
    if (!template) return;

    const initialData: { [fieldId: string]: string } = {};
    const variableFields = template.fields.filter(field => 
      field.type !== 'fixed_data' && field.type !== 'fixed_date'
    );

    variableFields.forEach(field => {
      initialData[field.id] = field.defaultValue || '';
    });
    
    setVariableFormData(initialData);
  };

  const exitDataEntry = () => {
    Alert.alert(
      'Exit Data Entry',
      `You have saved ${recordCount} record(s). Do you want to exit?`,
      [
        { text: 'Continue', style: 'cancel' },
        { text: 'Exit', onPress: () => router.back() }
      ]
    );
  };

  const getFixedFields = () => {
    return template?.fields.filter(field => 
      field.type === 'fixed_data' || field.type === 'fixed_date'
    ) || [];
  };

  const getVariableFields = () => {
    return template?.fields.filter(field => 
      field.type !== 'fixed_data' && field.type !== 'fixed_date'
    ) || [];
  };

  const renderField = (field: TemplateField, isFixedPage: boolean = false) => {
    const value = isFixedPage ? (fixedFormData[field.id] || '') : (variableFormData[field.id] || '');
    const updateFunction = isFixedPage ? updateFixedFieldValue : updateVariableFieldValue;

    switch (field.type) {
      case 'free_text':
        return (
          <TextInput
            style={styles.input}
            placeholder={`Enter ${field.name}`}
            value={value}
            onChangeText={(text) => updateFunction(field.id, text)}
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
            onChangeText={(text) => updateFunction(field.id, text)}
            keyboardType="numeric"
          />
        );

      case 'date':
        return (
          <TextInput
            style={styles.input}
            placeholder={field.dateFormat === 'custom' ? field.customDateFormat || 'Enter date' : field.dateFormat || 'YYYY-MM-DD'}
            value={value}
            onChangeText={(text) => updateFunction(field.id, text)}
          />
        );

      case 'fixed_date':
        return (
          <View style={styles.fixedValueContainer}>
            <TextInput
              style={styles.input}
              placeholder={field.dateFormat === 'custom' ? field.customDateFormat || 'Enter date' : field.dateFormat || 'YYYY-MM-DD'}
              value={value}
              onChangeText={(text) => updateFunction(field.id, text)}
            />
          </View>
        );

      case 'fixed_data':
        const allOptions = field.options || [];
        const defaultValue = field.defaultValue;

        if (defaultValue && !allOptions.includes(defaultValue)) {
          allOptions.unshift(defaultValue);
        }

        const inputMode = field.inputMode || 'select_only';

        if (inputMode === 'editable') {
          return (
            <View style={styles.editableUnifiedContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type or tap to select from options"
                value={value}
                onChangeText={(text) => updateFunction(field.id, text)}
              />
              {allOptions.length > 0 && (
                <View style={styles.quickSelectContainer}>
                  <Text style={styles.quickSelectLabel}>Quick Select:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSelectScroll}>
                    {allOptions.map((option, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.quickSelectOption}
                        onPress={() => updateFunction(field.id, option)}
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
          return (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={value || field.defaultValue || ''}
                onValueChange={(itemValue) => updateFunction(field.id, itemValue)}
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
              onChangeText={(text) => updateFunction(field.id, text)}
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
            onChangeText={(text) => updateFunction(field.id, text)}
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
          <ThemedText type="title" style={styles.title}>
            {currentPage === 'fixed' ? 'Fixed Data Entry' : 'Data Entry'}
          </ThemedText>
        </View>

        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateDescription}>{template.description}</Text>
          {currentDataFileName && (
            <Text style={styles.dataFileName}>📂 Data File: {currentDataFileName}</Text>
          )}
          {currentPage === 'variable' && recordCount > 0 && (
            <Text style={styles.recordCount}>📊 Records Saved: {recordCount}</Text>
          )}
        </View>

        {/* Fixed Data Page */}
        {currentPage === 'fixed' && (
          <View style={styles.formContainer}>
            <Text style={styles.pageInstruction}>
              Enter the fixed data that will be used for all entries:
            </Text>
            
            {getFixedFields().map((field) => (
              <View key={field.id} style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  {field.name}
                  {field.required && <Text style={styles.required}> *</Text>}
                  <Text style={styles.fixedFieldIndicator}> 📌</Text>
                </Text>
                {renderField(field, true)}
              </View>
            ))}

            <View style={styles.fixedPageButtons}>
              <TouchableOpacity style={styles.proceedButton} onPress={proceedToVariablePage}>
                <Text style={styles.proceedButtonText}>
                  Proceed to Data Entry →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Variable Data Page */}
        {currentPage === 'variable' && (
          <View style={styles.formContainer}>
            <Text style={styles.pageInstruction}>
              Enter data for each record. Click "Save & Continue" to add another entry:
            </Text>

            {getVariableFields().map((field) => (
              <View key={field.id} style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  {field.name}
                  {field.required && <Text style={styles.required}> *</Text>}
                </Text>
                {renderField(field, false)}
              </View>
            ))}

            <View style={styles.variablePageButtons}>
              <TouchableOpacity style={styles.exitButton} onPress={exitDataEntry}>
                <Text style={styles.exitButtonText}>Exit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveDataRecord}>
                <Text style={styles.saveButtonText}>Save & Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4299e1',
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 8,
  },
  dataFileName: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '600',
    marginBottom: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  recordCount: {
    fontSize: 14,
    color: '#48bb78',
    fontWeight: 'bold',
  },
  formContainer: {
    padding: 15,
  },
  pageInstruction: {
    fontSize: 16,
    color: '#4a5568',
    backgroundColor: '#e6fffa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#38b2ac',
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  fixedFieldIndicator: {
    color: '#48bb78',
    fontSize: 14,
  },
  required: {
    color: '#e53e3e',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    minHeight: 44,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
  },
  fixedValueContainer: {
    marginBottom: 0,
  },
  barcodeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  barcodeInput: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: '#4299e1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  scanButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  fixedPageButtons: {
    marginTop: 20,
    paddingBottom: 20,
  },
  proceedButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
  },
  proceedButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  variablePageButtons: {
    flexDirection: 'row',
    marginTop: 20,
    paddingBottom: 20,
    gap: 12,
  },
  exitButton: {
    flex: 1,
    backgroundColor: '#e53e3e',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
  },
  exitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#48bb78',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
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
    borderRadius: 8,
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
    marginBottom: 6,
  },
  quickSelectScroll: {
    flexDirection: 'row',
  },
  quickSelectOption: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  quickSelectOptionText: {
    fontSize: 13,
    color: '#2d3748',
    fontWeight: '500',
  },
});
