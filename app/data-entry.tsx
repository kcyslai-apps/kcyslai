import React, { useState, useEffect, useRef, createRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput, ScrollView, Modal, Platform, Keyboard } from 'react-native';
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
  dataFileName?: string;
}

export default function DataEntryScreen() {
  const { templateId, dataFileName, continueInput, fixedFieldValues } = useLocalSearchParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [fixedFormData, setFixedFormData] = useState<{ [fieldId: string]: string }>({});
  const [variableFormData, setVariableFormData] = useState<{ [fieldId: string]: string }>({});
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [currentBarcodeField, setCurrentBarcodeField] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [currentDataFileName, setCurrentDataFileName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<'' | 'variable'>('fixed');
  const [recordCount, setRecordCount] = useState<number>(0);
  const [isContinueInput, setIsContinueInput] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [currentDateField, setCurrentDateField] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [isDatePickerBusy, setIsDatePickerBusy] = useState<boolean>(false);
  const inputRefs = useRef<{ [fieldId: string]: React.RefObject<TextInput> }>({});
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';
  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';

  useEffect(() => {
    // Check if this is a continue input session first
    if (continueInput === 'true') {
      setIsContinueInput(true);
    }

    loadTemplate();
    if (dataFileName && typeof dataFileName === 'string') {
      setCurrentDataFileName(decodeURIComponent(dataFileName));
    }

    // Add keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
      // Reset scroll position when keyboard hides
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [templateId, dataFileName, continueInput]);

  const loadTemplate = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        const templates: Template[] = JSON.parse(content);
        let foundTemplate = templates.find(t => t.id === templateId);

        // If template not found, check if we can reconstruct it from preserved data records
        if (!foundTemplate && isContinueInput && currentDataFileName) {
          try {
            const dataFileExists = await FileSystem.getInfoAsync(DATA_RECORDS_FILE);
            if (dataFileExists.exists) {
              const dataContent = await FileSystem.readAsStringAsync(DATA_RECORDS_FILE);
              const dataRecords = JSON.parse(dataContent);

              // Find a record from this data file that has preserved template info
              const recordWithPreservedTemplate = dataRecords.find((record: any) => 
                record.dataFileName === currentDataFileName && 
                record.templateId === templateId &&
                record.preservedTemplateFields
              );

              if (recordWithPreservedTemplate) {
                foundTemplate = {
                  id: recordWithPreservedTemplate.templateId,
                  name: recordWithPreservedTemplate.templateName,
                  description: '(Template was deleted, using preserved data)',
                  fields: recordWithPreservedTemplate.preservedTemplateFields,
                  csvExportSettings: recordWithPreservedTemplate.preservedCsvSettings || {
                    includeHeader: false,
                    delimiter: 'comma',
                    customDelimiter: '',
                    fieldPositions: {},
                    fileExtension: 'csv',
                    includeQuotes: true
                  },
                  createdAt: new Date()
                };
              }
            }
          } catch (error) {
            console.error('Error loading preserved template info:', error);
          }
        }

        if (foundTemplate) {
          setTemplate(foundTemplate);

          // Initialize fixed data form
          const initialFixedData: { [fieldId: string]: string } = {};
          const initialVariableData: { [fieldId: string]: string } = {};

          // If continuing input, use provided fixed field values
          let prefilledFixedData: { [fieldId: string]: string } = {};
          if (continueInput === 'true' && fixedFieldValues && typeof fixedFieldValues === 'string') {
            try {
              prefilledFixedData = JSON.parse(decodeURIComponent(fixedFieldValues));
              console.log('Parsed prefilled fixed data:', prefilledFixedData);
            } catch (error) {
              console.error('Error parsing fixed field values:', error);
            }
          }

          foundTemplate.fields.forEach(field => {
            if (field.type === 'fixed_data' || field.type === 'fixed_date') {
              // Use prefilled data if available, otherwise use default values
              if (prefilledFixedData[field.id]) {
                initialFixedData[field.id] = prefilledFixedData[field.id];
              } else if (field.type === 'fixed_date') {
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

          // Debug log to verify data is loaded correctly
          console.log('Loading fixed data for continue input:', initialFixedData);

          // Initialize input refs for all fields (both fixed and variable)
          const allFields = foundTemplate.fields;
          const variableFields = foundTemplate.fields.filter(field => 
            field.type !== 'fixed_data' && field.type !== 'fixed_date'
          );

          const refs: { [fieldId: string]: React.RefObject<TextInput> } = {};
          const order: string[] = [];

          // Create refs for all fields, not just variable ones
          allFields.forEach(field => {
            refs[field.id] = createRef<TextInput>();
          });

          // Only variable fields are included in field order for navigation
          variableFields.forEach(field => {
            order.push(field.id);
          });

          inputRefs.current = refs;
          setFieldOrder(order);

          // Only skip to variable page if there are no fixed fields
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

    // Standardize all date display formats to YYYY-MM-DD
    return `${year}-${month}-${day}`;
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
    // Prevent opening if already busy or open
    if (isDatePickerBusy || showDatePicker) {
      return;
    }

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

    setIsDatePickerBusy(true);
    setSelectedDate(initialDate);
    setTempDate(initialDate);
    setCurrentDateField(fieldId);

    // Small delay to ensure state is set before showing picker
    setTimeout(() => {
      setShowDatePicker(true);
    }, 50);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const isAndroid = Platform.OS === 'android';

    if (selectedDate) {
      setTempDate(selectedDate);
      setSelectedDate(selectedDate);

      // For Android, immediately apply the change and close
      if (isAndroid) {
        applyDateChange(selectedDate);
        closeDatePicker();
      }
    } else if (isAndroid) {
      // User cancelled on Android
      closeDatePicker();
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
    // Immediately hide the picker
    setShowDatePicker(false);

    // Clean up state after a short delay
    setTimeout(() => {
      setCurrentDateField(null);
      setIsDatePickerBusy(false);
    }, 100);
  };

  const openBarcodeScanner = (fieldId: string) => {
    setCurrentBarcodeField(fieldId);
    setShowCamera(true);
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (currentBarcodeField) {
      updateVariableFieldValue(currentBarcodeField, data);
      const scannedFieldId = currentBarcodeField;
      setCurrentBarcodeField(null);
      setShowCamera(false);

      // Auto-advance to next field after barcode scan
      setTimeout(() => {
        moveToNextField(scannedFieldId);
      }, 200);
    }
  };

  const validateFixedForm = (): boolean => {
    if (!template) return false;

    // Skip validation during continue input since fixed fields are read-only
    if (isContinueInput) return true;

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
        timestamp: new Date(),
        dataFileName: currentDataFileName
      };

      // Save updated records
      const updatedRecords = [...existingRecords, newRecord];
      await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));

      const newCount = recordCount + 1;
      setRecordCount(newCount);

      // Show brief success message
      setShowSuccessMessage(true);

      // Hide success message and reset form after 0.5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
        resetVariableForm();
      }, 500);
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

    // Focus first field after reset
    setTimeout(() => {
      if (fieldOrder.length > 0) {
        const firstFieldId = fieldOrder[0];
        inputRefs.current[firstFieldId]?.current?.focus();
      }
    }, 100);
  };

  const saveAndExit = () => {
    setShowExitConfirmModal(true);
  };

  const confirmExit = () => {
    setShowExitConfirmModal(false);
    router.back();
  };

  const cancelExit = () => {
    setShowExitConfirmModal(false);
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

  const moveToNextField = (currentFieldId: string) => {
    const currentIndex = fieldOrder.indexOf(currentFieldId);
    if (currentIndex >= 0 && currentIndex < fieldOrder.length - 1) {
      const nextFieldId = fieldOrder[currentIndex + 1];
      const nextRef = inputRefs.current[nextFieldId];
      if (nextRef?.current) {
        // Small delay to ensure the field is ready for focus
        setTimeout(() => {
          nextRef.current?.focus();
        }, 50);
      }
    }
  };

    const scrollToField = (fieldId: string) => {
    // Wait for keyboard to appear before calculating scroll position
    const scrollDelay = Platform.OS === 'android' ? 350 : 250;

    setTimeout(() => {
      const inputRef = inputRefs.current[fieldId];

      // All fields now have refs, so we can use precise measurement
      if (inputRef?.current && scrollViewRef.current) {
        inputRef.current.measureInWindow((x, y, width, height) => {
          // Get the field type to determine if it's a numeric field
          const field = template?.fields.find(f => f.id === fieldId);
          const isNumericField = field?.type === 'number';

          // Calculate visible screen height when keyboard is open
          const screenHeight = Platform.OS === 'ios' ? 812 : 800; // Approximate screen heights
          const availableHeight = screenHeight - keyboardHeight - 100; // Buffer space

          // Target position should be in the upper portion of visible area
          const targetPosition = isNumericField ? availableHeight * 0.2 : availableHeight * 0.3;

          // Calculate scroll offset needed to position field at target
          const fieldCurrentPosition = y;
          const scrollOffset = fieldCurrentPosition - targetPosition;

          // Only scroll if the field is not already visible in the target area
          if (fieldCurrentPosition > targetPosition || fieldCurrentPosition < 50) {
            scrollViewRef.current?.scrollTo({ 
              y: Math.max(0, scrollOffset), 
              animated: true 
            });
          }
        });
      }
    }, scrollDelay);
  };

  const renderField = (field: TemplateField, isFixedPage: boolean = false) => {
    const value = isFixedPage ? (fixedFormData[field.id] || '') : (variableFormData[field.id] || '');
    const updateFunction = isFixedPage ? updateFixedFieldValue : updateVariableFieldValue;

    switch (field.type) {
      case 'free_text':
        return (
          <TextInput
            ref={inputRefs.current[field.id]}
            style={styles.input}
            placeholder={`Enter ${field.name}`}
            value={value}
            onChangeText={(text) => updateFunction(field.id, text)}
            multiline={true}
            numberOfLines={3}
            onSubmitEditing={() => !isFixedPage && moveToNextField(field.id)}
            onPressIn={() => {
              // Only apply scroll behavior on variable page
              if (!isFixedPage) {
                setTimeout(() => scrollToField(field.id), 50);
              }
            }}
            onFocus={(event) => {
              // Only apply scroll and selection logic on variable page
              if (!isFixedPage) {
                setTimeout(() => scrollToField(field.id), 50);
                // Auto-select text on focus with a small delay to ensure it works
                if (value) {
                  setTimeout(() => {
                    event.target.setSelection?.(0, value.length);
                  }, 100);
                }
              }
            }}
            blurOnSubmit={false}
            selectTextOnFocus={true}
          />
        );

      case 'number':
        return (
          <TextInput
            ref={inputRefs.current[field.id]}
            style={styles.input}
            placeholder={`Enter ${field.name}`}
            value={value}
            onChangeText={(text) => updateFunction(field.id, text)}
            keyboardType="numeric"
            onSubmitEditing={() => !isFixedPage && moveToNextField(field.id)}
            onPressIn={() => {
              // Only apply scroll behavior on variable page
              if (!isFixedPage) {
                setTimeout(() => scrollToField(field.id), 50);
              }
            }}
            onFocus={(event) => {
              // Only apply scroll and selection logic on variable page
              if (!isFixedPage) {
                setTimeout(() => scrollToField(field.id), 50);
                // Auto-select text on focus with a small delay to ensure it works
                if (value) {
                  setTimeout(() => {
                    event.target.setSelection?.(0, value.length);
                  }, 100);
                }
              }
            }}
            blurOnSubmit={false}
            selectTextOnFocus={true}
          />
        );

      case 'date':
        return (
          <View style={styles.dateContainer}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder="YYYY-MM-DD"
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
                style={[
                  styles.input, 
                  styles.dateInput,
                  isContinueInput && styles.readOnlyInput
                ]}
                placeholder="YYYY-MM-DD"
                value={value}
                editable={false}
                pointerEvents="none"
              />
              <TouchableOpacity
                style={[
                  styles.calendarButton,
                  (showDatePicker || isDatePickerBusy || isContinueInput) && styles.disabledCalendarButton
                ]}
                onPress={() => !isContinueInput && openDatePicker(field.id)}
                disabled={showDatePicker || isDatePickerBusy || isContinueInput}
              >
                <Text style={styles.calendarButtonText}>📅</Text>
              </TouchableOpacity>
            </View>
            {isContinueInput && (
              <Text style={styles.readOnlyHint}>📌 Fixed value from existing entries</Text>
            )}
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
                ref={inputRefs.current[field.id]}
                style={[
                  styles.input,
                  isContinueInput && styles.readOnlyInput
                ]}
                placeholder="Type or tap to select from options"
                value={value}
                onChangeText={(text) => !isContinueInput && updateFunction(field.id, text)}
                onSubmitEditing={() => !isFixedPage && moveToNextField(field.id)}
                onPressIn={() => {
                  // Only apply scroll behavior on variable page
                  if (!isFixedPage) {
                    setTimeout(() => scrollToField(field.id), 50);
                  }
                }}
                onFocus={(event) => {
                  // Only apply scroll and selection logic on variable page
                  if (!isContinueInput) {
                  // Only apply scroll and selection logic on variable page
                    if (!isFixedPage) {
                      setTimeout(() => scrollToField(field.id), 50);
                      // Auto-select text on focus with a small delay to ensure it works
                      if (value) {
                        setTimeout(() => {
                          event.target.setSelection?.(0, value.length);
                        }, 100);
                      }
                    }
                  }
                }}
                blurOnSubmit={false}
                selectTextOnFocus={true}
                editable={!isContinueInput}
              />
              {allOptions.length > 0 && !isContinueInput && (
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
              {isContinueInput && (
                <Text style={styles.readOnlyHint}>📌 Fixed value from existing entries</Text>
              )}
            </View>
          );
        } else {
          return (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={value || field.defaultValue || ''}
                onValueChange={(itemValue) => !isContinueInput && updateFunction(field.id, itemValue)}
                style={[styles.picker, isContinueInput && styles.readOnlyPicker]}
                enabled={!isContinueInput}
              >
                <Picker.Item label="Select..." value="" />
                {allOptions.map((option, index) => (
                  <Picker.Item key={index} label={option} value={option} />
                ))}
              </Picker>
              {isContinueInput && (
                <Text style={styles.readOnlyHint}>📌 Fixed value from existing entries</Text>
              )}
            </View>
          );
        }

      case 'barcode':
        return (
          <View style={styles.barcodeContainer}>
            <TextInput
              ref={inputRefs.current[field.id]}
              style={[styles.input, styles.barcodeInput]}
              placeholder="Scan or enter barcode"
              value={value}
              onChangeText={(text) => updateFunction(field.id, text)}
              onSubmitEditing={() => !isFixedPage && moveToNextField(field.id)}
              onPressIn={() => {
                // Only apply scroll behavior on variable page
                if (!isFixedPage) {
                  setTimeout(() => scrollToField(field.id), 50);
                }
              }}
              onFocus={(event) => {
              // Only apply scroll and selection logic on variable page
                if (!isFixedPage) {
                  setTimeout(() => scrollToField(field.id), 50);
                  // Auto-select text on focus with a small delay to ensure it works
                  if (value) {
                    setTimeout(() => {
                      event.target.setSelection?.(0, value.length);
                    }, 100);
                  }
                }
              }}
              blurOnSubmit={false}
              selectTextOnFocus={true}
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
            ref={inputRefs.current[field.id]}
            style={styles.input}
            placeholder={`Enter ${field.name}`}
            value={value}
            onChangeText={(text) => updateFunction(field.id, text)}
            onSubmitEditing={() => !isFixedPage && moveToNextField(field.id)}
            onPressIn={() => {
              // Only apply scroll behavior on variable page
              if (!isFixedPage) {
                setTimeout(() => scrollToField(field.id), 50);
              }
            }}
            onFocus={(event) => {
              // Only apply scroll and selection logic on variable page
              if (!isFixedPage) {
                setTimeout(() => scrollToField(field.id), 50);
                // Auto-select text on focus with a small delay to ensure it works
                if (value) {
                  setTimeout(() => {
                    event.target.setSelection?.(0, value.length);
                  }, 100);
                }
              }
            }}
            blurOnSubmit={false}
            selectTextOnFocus={true}
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
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContainer,
          isKeyboardVisible && { paddingBottom: keyboardHeight + 20 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
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
              <TouchableOpacity style={styles.exitButton} onPress={saveAndExit}>
                <Text style={styles.exitButtonText}>Exit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveDataRecord}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Success Message Overlay */}
      {showSuccessMessage && (
        <View style={styles.successMessageOverlay}>
          <View style={styles.successMessageContainer}>
            <Text style={styles.successMessageText}>✓ Saved successfully</Text>
          </View>
        </View>
      )}

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

      {/* Save & Exit Confirmation Modal */}
      <Modal visible={showExitConfirmModal} transparent animationType="fade">
        <View style={styles.exitModalOverlay}>
          <View style={styles.exitModalContent}>
            <Text style={styles.exitModalTitle}>Exit Data Entry</Text>

            <View style={styles.exitModalInfo}>
              <Text style={styles.exitModalMessage}>
                You have saved {recordCount} record(s) to "{currentDataFileName}".
              </Text>
              <Text style={styles.exitModalSubMessage}>
                Do you want to exit data entry?
              </Text>
            </View>

            <View style={styles.exitModalButtons}>
              <TouchableOpacity
                style={styles.exitModalCancelButton}
                onPress={cancelExit}
              >
                <Text style={styles.exitModalCancelButtonText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exitModalConfirmButton}
                onPress={confirmExit}
              >
                <Text style={styles.exitModalConfirmButtonText}>Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  scrollContainer: {
    flexGrow: 1,
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
  successMessageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successMessageContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successMessageText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  exitModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  exitModalInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  exitModalMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  exitModalSubMessage: {
    fontSize: 15,
    color: '#2d3748',
    fontWeight: '600',
    textAlign: 'center',
  },
  exitModalButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  exitModalCancelButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  exitModalCancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exitModalConfirmButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  exitModalConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  readOnlyInput: {
    backgroundColor: '#f7fafc',
    color: '#4a5568',
    opacity: 0.8,
  },
  readOnlyPicker: {
    backgroundColor: '#f7fafc',
    opacity: 0.8,
  },
  readOnlyHint: {
    fontSize: 12,
    color: '#48bb78',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
});