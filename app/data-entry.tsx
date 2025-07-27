import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput, ScrollView, Modal, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Camera, CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [isDatePickerBusy, setIsDatePickerBusy] = useState(false);

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
              if (field.type === 'fixed_date') {
                initialFixedData[field.id] = field.defaultValue || formatDateForField(new Date(), field);
              } else {
                initialFixedData[field.id] = field.defaultValue || '';
              }
            } else {
              if (field.type === 'date') {
                initialVariableData[field.id] = field.defaultValue || formatDateForField(new Date(), field);
              } else {
                initialVariableData[field.id] = field.defaultValue || '';
              }
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

  const formatDateForField = (date: Date, field: TemplateField): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (field.dateFormat) {
      case 'dd/MM/yyyy':
        return `${day}/${month}/${year}`;
      case 'MM/dd/yyyy':
        return `${month}/${day}/${year}`;
      case 'yyyyMMdd':
        return `${year}${month}${day}`;
      case 'dd-MM-yyyy':
        return `${day}-${month}-${year}`;
      case 'yyyy.MM.dd':
        return `${year}.${month}.${day}`;
      case 'custom':
        // For custom format, use the custom format or default
        return field.customDateFormat || `${year}-${month}-${day}`;
      default:
        return `${year}-${month}-${day}`;
    }
  };

  const parseFieldDate = (dateString: string, field: TemplateField): Date | null => {
    if (!dateString) return null;

    try {
      let year = 0, month = 0, day = 0;

      switch (field.dateFormat) {
        case 'dd/MM/yyyy':
          const ddMMyyyy = dateString.split('/');
          if (ddMMyyyy.length === 3) {
            day = parseInt(ddMMyyyy[0]);
            month = parseInt(ddMMyyyy[1]) - 1; // Month is 0-based
            year = parseInt(ddMMyyyy[2]);
          }
          break;
        case 'MM/dd/yyyy':
          const MMddyyyy = dateString.split('/');
          if (MMddyyyy.length === 3) {
            month = parseInt(MMddyyyy[0]) - 1; // Month is 0-based
            day = parseInt(MMddyyyy[1]);
            year = parseInt(MMddyyyy[2]);
          }
          break;
        case 'yyyyMMdd':
          if (dateString.length === 8) {
            year = parseInt(dateString.substring(0, 4));
            month = parseInt(dateString.substring(4, 6)) - 1; // Month is 0-based
            day = parseInt(dateString.substring(6, 8));
          }
          break;
        case 'dd-MM-yyyy':
          const ddMMyyyy2 = dateString.split('-');
          if (ddMMyyyy2.length === 3) {
            day = parseInt(ddMMyyyy2[0]);
            month = parseInt(ddMMyyyy2[1]) - 1; // Month is 0-based
            year = parseInt(ddMMyyyy2[2]);
          }
          break;
        case 'yyyy.MM.dd':
          const yyyyMMdd = dateString.split('.');
          if (yyyyMMdd.length === 3) {
            year = parseInt(yyyyMMdd[0]);
            month = parseInt(yyyyMMdd[1]) - 1; // Month is 0-based
            day = parseInt(yyyyMMdd[2]);
          }
          break;
        default:
          // Default format YYYY-MM-DD
          const defaultParts = dateString.split('-');
          if (defaultParts.length === 3) {
            year = parseInt(defaultParts[0]);
            month = parseInt(defaultParts[1]) - 1; // Month is 0-based
            day = parseInt(defaultParts[2]);
          }
          break;
      }

      if (year > 0 && month >= 0 && day > 0) {
        return new Date(year, month, day);
      }
    } catch (error) {
      console.log('Error parsing date:', error);
    }

    return null;
  };

  const openDatePicker = (fieldId: string) => {
    // Get current field value or use today's date
    const field = template?.fields.find(f => f.id === fieldId);
    const currentValue = field?.type === 'fixed_date' 
      ? fixedFormData[fieldId] 
      : variableFormData[fieldId];

    // Parse current date value or use today
    let initialDate = new Date();
    if (currentValue && field) {
      try {
        // Try to parse the current value back to a date
        const parsedDate = parseFieldDate(currentValue, field);
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          initialDate = parsedDate;
        }
      } catch (error) {
        console.log('Could not parse current date value, using today');
      }
    }

    setSelectedDate(initialDate);
    setTempDate(initialDate);
    setCurrentDateField(fieldId);
    setShowDatePicker(true);
    setIsDatePickerBusy(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const isAndroid = Platform.OS === 'android';

    if (selectedDate) {
      setTempDate(selectedDate);
      setSelectedDate(selectedDate);

      // For Android, immediately apply the change and close with a small delay
      if (isAndroid) {
        setTimeout(() => {
          applyDateChange(selectedDate);
          closeDatePicker();
        }, 100);
      }
    } else if (isAndroid) {
      // User cancelled on Android
      setTimeout(() => {
        closeDatePicker();
      }, 100);
    }
  };

  const applyDateChange = (date: Date) => {
    if (currentDateField && template) {
      const field = template.fields.find(f => f.id === currentDateField);
      if (field) {
        const formattedDate = formatDateForField(date, field);

        if (field.type === 'fixed_date') {
          updateFixedFieldValue(currentDateField, formattedDate);
        } else {
          updateVariableFieldValue(currentDateField, formattedDate);
        }
      }
    }
  };

  const closeDatePicker = () => {
    // Prevent rapid state changes
    if (isDatePickerBusy && showDatePicker) {
      setShowDatePicker(false);
      
      // Clean up state with a slight delay to prevent conflicts
      setTimeout(() => {
        setCurrentDateField(null);
        setTempDate(selectedDate);
        setIsDatePickerBusy(false);
      }, 150);
    }
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
      if (field.type === 'date') {
        initialData[field.id] = field.defaultValue || formatDateForField(new Date(), field);
      } else {
        initialData[field.id] = field.defaultValue || '';
      }
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
          <View style={styles.dateContainer}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder={field.dateFormat === 'custom' ? field.customDateFormat || 'Enter date' : field.dateFormat || 'YYYY-MM-DD'}
              value={value}
              editable={false}
              pointerEvents="none"
            />
            <TouchableOpacity
                style={[
                  styles.calendarButton,
                  (showDatePicker || isDatePickerBusy) && styles.disabledCalendarButton
                ]}
                onPress={() => openDatePicker(field.id)}
                disabled={showDatePicker || isDatePickerBusy}
              >
                <Text style={styles.calendarButtonText}>📅</Text>
              </TouchableOpacity>
          </View>
        );

      case 'fixed_date':
        return (
          <View style={styles.fixedValueContainer}>
            <View style={styles.dateContainer}>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder={field.dateFormat === 'custom' ? field.customDateFormat || 'Enter date' : field.dateFormat || 'YYYY-MM-DD'}
                value={value}
                editable={false}
                pointerEvents="none"
              />
              <TouchableOpacity
                style={[
                  styles.calendarButton,
                  (showDatePicker || isDatePickerBusy) && styles.disabledCalendarButton
                ]}
                onPress={() => openDatePicker(field.id)}
                disabled={showDatePicker || isDatePickerBusy}
              >
                <Text style={styles.calendarButtonText}>📅</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={styles.scanButtonText}>📷</Text>
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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal 
          visible={showDatePicker} 
          transparent 
          animationType="fade"
          onRequestClose={closeDatePicker}
        >
          <TouchableOpacity 
            style={styles.datePickerModalOverlay}
            activeOpacity={1}
            onPress={closeDatePicker}
          >
            <TouchableOpacity 
              style={styles.datePickerModalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.datePickerTitle}>Select Date</Text>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                style={styles.datePicker}
              />
              {Platform.OS === 'ios' && (
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity
                    style={styles.datePickerCancelButton}
                    onPress={closeDatePicker}
                  >
                    <Text style={styles.datePickerCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePickerConfirmButton}
                    onPress={() => {
                      applyDateChange(tempDate);
                      closeDatePicker();
                    }}
                  >
                    <Text style={styles.datePickerConfirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    color: '#495057',
  },
  calendarButton: {
    backgroundColor: '#4299e1',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  calendarButtonText: {
    fontSize: 18,
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
  datePickerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
    justifyContent: 'center',
  },
  datePickerCancelButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  datePickerCancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
  },
  datePickerConfirmButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  datePickerConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledCalendarButton: {
    opacity: 0.5,
  },
});