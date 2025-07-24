
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, FlatList, TextInput, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { BarCodeScanner } from 'expo-barcode-scanner';

interface Template {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  createdAt: string;
}

interface TemplateField {
  id: string;
  name: string;
  type: 'freetext' | 'number' | 'date' | 'fixeddata' | 'fixeddate' | 'barcode';
  required: boolean;
  options?: string[]; // for fixeddata type
}

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<Template>>({
    name: '',
    description: '',
    fields: []
  });
  const [newField, setNewField] = useState<Partial<TemplateField>>({
    name: '',
    type: 'freetext',
    required: false,
    options: []
  });
  const [fieldOptions, setFieldOptions] = useState<string>('');
  const [showFieldTypeDropdown, setShowFieldTypeDropdown] = useState(false);
  const [hoveredOptionIndex, setHoveredOptionIndex] = useState<number>(-1);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showDataInputModal, setShowDataInputModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [dataInputValues, setDataInputValues] = useState<{[key: string]: string}>({});
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanningFieldId, setScanningFieldId] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const handleTouchMove = (event: any, index: number) => {
    const { locationY } = event.nativeEvent;
    // Check if finger is still within the option bounds
    if (locationY >= 0 && locationY <= 50) { // Assuming each option is ~50 points tall
      setHoveredOptionIndex(index);
    }
  };

  useEffect(() => {
    loadTemplates();
    getCameraPermissions();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasCameraPermission(status === 'granted');
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanningFieldId) {
      setDataInputValues(prev => ({
        ...prev,
        [scanningFieldId]: data
      }));
      setShowBarcodeScanner(false);
      setScanningFieldId(null);
      Alert.alert('Scanned Successfully', `Barcode: ${data}`);
    }
  };

  const startBarcodeScanning = (fieldId: string) => {
    if (hasCameraPermission === null) {
      Alert.alert('Permission Required', 'Requesting camera permission...');
      getCameraPermissions();
      return;
    }
    if (hasCameraPermission === false) {
      Alert.alert('No Camera Access', 'Please enable camera access in your device settings to scan barcodes.');
      return;
    }
    setScanningFieldId(fieldId);
    setShowBarcodeScanner(true);
  };

  const loadTemplates = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + 'templates.json';
      const fileExists = await FileSystem.getInfoAsync(fileUri);
      
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(fileUri);
        const templatesData = JSON.parse(content);
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const saveTemplates = async (templatesData: Template[]) => {
    try {
      const fileUri = FileSystem.documentDirectory + 'templates.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(templatesData, null, 2));
    } catch (error) {
      console.error('Error saving templates:', error);
      Alert.alert('Error', 'Failed to save templates');
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.name?.trim()) {
      Alert.alert('Error', 'Please fill in template name');
      return;
    }

    if (!newTemplate.fields || newTemplate.fields.length === 0) {
      Alert.alert('Error', 'Please add at least one template field');
      return;
    }

    if (editingTemplate) {
      // Update existing template
      const updatedTemplate: Template = {
        ...editingTemplate,
        name: newTemplate.name,
        fields: newTemplate.fields as TemplateField[],
      };

      const updatedTemplates = templates.map(t => 
        t.id === editingTemplate.id ? updatedTemplate : t
      );
      setTemplates(updatedTemplates);
      await saveTemplates(updatedTemplates);
      
      setEditingTemplate(null);
      Alert.alert('Success', 'Template updated successfully');
    } else {
      // Create new template
      const template: Template = {
        id: Date.now().toString(),
        name: newTemplate.name,
        description: '',
        fields: newTemplate.fields as TemplateField[],
        createdAt: new Date().toISOString()
      };

      const updatedTemplates = [...templates, template];
      setTemplates(updatedTemplates);
      await saveTemplates(updatedTemplates);
      Alert.alert('Success', 'Template created successfully');
    }
    
    setNewTemplate({ name: '', description: '', fields: [] });
    setShowCreateModal(false);
  };

  const addField = () => {
    if (!newField.name) {
      Alert.alert('Error', 'Please enter a field name');
      return;
    }

    if (newField.type === 'fixeddata' && !fieldOptions.trim()) {
      Alert.alert('Error', 'Please enter options for Fixed Data field (comma-separated)');
      return;
    }

    const field: TemplateField = {
      id: Date.now().toString(),
      name: newField.name,
      type: newField.type || 'freetext',
      required: newField.required || false,
      options: newField.type === 'fixeddata' ? fieldOptions.split(',').map(opt => opt.trim()) : undefined
    };

    setNewTemplate(prev => ({
      ...prev,
      fields: [...(prev.fields || []), field]
    }));

    setNewField({ name: '', type: 'freetext', required: false, options: [] });
    setFieldOptions('');
  };

  const removeField = (fieldId: string) => {
    setNewTemplate(prev => ({
      ...prev,
      fields: prev.fields?.filter(field => field.id !== fieldId) || []
    }));
  };

  const editTemplate = (template: Template) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      description: template.description,
      fields: template.fields
    });
    setShowCreateModal(true);
  };

  const useTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setDataInputValues({});
    setShowDataInputModal(true);
  };

  const saveDataEntry = async () => {
    if (!selectedTemplate) return;

    // Validate required fields
    for (const field of selectedTemplate.fields) {
      if (field.required && !dataInputValues[field.id]?.trim()) {
        Alert.alert('Error', `${field.name} is required`);
        return;
      }
    }

    // Save data entry to file
    try {
      const dataEntry = {
        id: Date.now().toString(),
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        data: dataInputValues,
        createdAt: new Date().toISOString()
      };

      const fileUri = FileSystem.documentDirectory + 'data_entries.json';
      const fileExists = await FileSystem.getInfoAsync(fileUri);
      
      let existingEntries = [];
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(fileUri);
        existingEntries = JSON.parse(content);
      }

      existingEntries.push(dataEntry);
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(existingEntries, null, 2));

      setShowDataInputModal(false);
      setDataInputValues({});
      Alert.alert('Success', 'Data entry saved successfully');
    } catch (error) {
      console.error('Error saving data entry:', error);
      Alert.alert('Error', 'Failed to save data entry');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedTemplates = templates.filter(t => t.id !== templateId);
            setTemplates(updatedTemplates);
            await saveTemplates(updatedTemplates);
          }
        }
      ]
    );
  };

  const renderTemplate = ({ item }: { item: Template }) => (
    <View style={styles.templateItem}>
      <View style={styles.templateHeader}>
        <Text style={styles.templateName}>{item.name}</Text>
        <View style={styles.templateActions}>
          <TouchableOpacity
            style={styles.useButton}
            onPress={() => useTemplate(item)}
          >
            <Text style={styles.useButtonText}>Use</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => editTemplate(item)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteTemplate(item.id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.templateDescription}>{item.description}</Text>
      <Text style={styles.templateFields}>
        Fields: {item.fields.map(f => f.name).join(', ')}
      </Text>
      <Text style={styles.templateDate}>
        Created: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Templates</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.buttonText}>Create Template</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No templates created yet</Text>
        }
      />

      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </Text>
            <TouchableOpacity onPress={createTemplate}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              style={styles.input}
              placeholder="Template Name"
              value={newTemplate.name}
              onChangeText={(text) => setNewTemplate(prev => ({ ...prev, name: text }))}
            />

            <Text style={styles.sectionTitle}>Fields</Text>
            
            <View style={styles.fieldInputContainer}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Field Name"
                value={newField.name}
                onChangeText={(text) => setNewField(prev => ({ ...prev, name: text }))}
              />
            </View>

            <View style={styles.fieldTypeContainer}>
              <Text style={styles.fieldTypeLabel}>Field Type:</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={styles.dropdown}
                  onPress={() => setShowFieldTypeDropdown(!showFieldTypeDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {newField.type === 'freetext' ? 'Free Text' :
                     newField.type === 'number' ? 'Number' :
                     newField.type === 'date' ? 'Date' :
                     newField.type === 'fixeddata' ? 'Fixed Data' :
                     newField.type === 'fixeddate' ? 'Fixed Date' :
                     newField.type === 'barcode' ? 'Barcode' : 'Select Type'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                
                {showFieldTypeDropdown && (
                  <View style={styles.dropdownOptions}>
                    {[
                      { key: 'freetext', label: 'Free Text' },
                      { key: 'number', label: 'Number' },
                      { key: 'date', label: 'Date' },
                      { key: 'fixeddata', label: 'Fixed Data' },
                      { key: 'fixeddate', label: 'Fixed Date' },
                      { key: 'barcode', label: 'Barcode' }
                    ].map((typeOption, index) => (
                      <TouchableOpacity
                        key={typeOption.key}
                        style={[
                          styles.dropdownOption,
                          hoveredOptionIndex === index && styles.dropdownOptionHovered
                        ]}
                        onPress={() => {
                          setNewField(prev => ({ ...prev, type: typeOption.key as any }));
                          setShowFieldTypeDropdown(false);
                          setHoveredOptionIndex(-1);
                        }}
                        onTouchStart={() => setHoveredOptionIndex(index)}
                        onTouchMove={(event) => handleTouchMove(event, index)}
                        onTouchEnd={() => setHoveredOptionIndex(-1)}
                        onTouchCancel={() => setHoveredOptionIndex(-1)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          hoveredOptionIndex === index && styles.dropdownOptionTextHovered
                        ]}>
                          {typeOption.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {newField.type === 'fixeddata' && (
              <TextInput
                style={styles.input}
                placeholder="Enter options (comma-separated)"
                value={fieldOptions}
                onChangeText={setFieldOptions}
                multiline
              />
            )}

            <TouchableOpacity style={styles.addFieldButton} onPress={addField}>
              <Text style={styles.addFieldText}>Add Field</Text>
            </TouchableOpacity>

            <FlatList
              data={newTemplate.fields}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.fieldItem}>
                  <View style={styles.fieldDetails}>
                    <Text style={styles.fieldName}>{item.name}</Text>
                    <Text style={styles.fieldType}>
                      {item.type === 'freetext' ? 'Free Text' :
                       item.type === 'number' ? 'Number' :
                       item.type === 'date' ? 'Date' :
                       item.type === 'fixeddata' ? 'Fixed Data' :
                       item.type === 'fixeddate' ? 'Fixed Date' :
                       item.type === 'barcode' ? 'Barcode' : item.type}
                    </Text>
                    {item.options && (
                      <Text style={styles.fieldOptions}>Options: {item.options.join(', ')}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeField(item.id)}>
                    <Text style={styles.removeFieldText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Data Input Modal */}
      <Modal
        visible={showDataInputModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDataInputModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>
              Enter Data: {selectedTemplate?.name}
            </Text>
            <TouchableOpacity onPress={saveDataEntry}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {selectedTemplate?.fields.map((field) => (
              <View key={field.id} style={styles.dataFieldContainer}>
                <Text style={styles.dataFieldLabel}>
                  {field.name} {field.required && <Text style={styles.requiredAsterisk}>*</Text>}
                </Text>
                
                {field.type === 'fixeddata' && field.options ? (
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity 
                      style={styles.dropdown}
                      onPress={() => {
                        // Could implement dropdown for fixed data options
                        Alert.alert(
                          'Select Option',
                          'Choose an option:',
                          field.options?.map(option => ({
                            text: option,
                            onPress: () => setDataInputValues(prev => ({
                              ...prev,
                              [field.id]: option
                            }))
                          })) || []
                        );
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        {dataInputValues[field.id] || 'Select an option'}
                      </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                ) : field.type === 'date' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={dataInputValues[field.id] || ''}
                    onChangeText={(text) => setDataInputValues(prev => ({
                      ...prev,
                      [field.id]: text
                    }))}
                  />
                ) : field.type === 'number' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter number"
                    keyboardType="numeric"
                    value={dataInputValues[field.id] || ''}
                    onChangeText={(text) => setDataInputValues(prev => ({
                      ...prev,
                      [field.id]: text
                    }))}
                  />
                ) : field.type === 'barcode' ? (
                  <View>
                    <TextInput
                      style={styles.input}
                      placeholder="Scan or enter barcode"
                      value={dataInputValues[field.id] || ''}
                      onChangeText={(text) => setDataInputValues(prev => ({
                        ...prev,
                        [field.id]: text
                      }))}
                    />
                    <TouchableOpacity 
                      style={styles.scanButton}
                      onPress={() => startBarcodeScanning(field.id)}
                    >
                      <Text style={styles.scanButtonText}>📷 Scan Barcode</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                    value={dataInputValues[field.id] || ''}
                    onChangeText={(text) => setDataInputValues(prev => ({
                      ...prev,
                      [field.id]: text
                    }))}
                    multiline={field.type === 'freetext'}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity
              style={styles.scannerCloseButton}
              onPress={() => {
                setShowBarcodeScanner(false);
                setScanningFieldId(null);
              }}
            >
              <Text style={styles.scannerCloseText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan Barcode</Text>
            <View style={{ width: 60 }} />
          </View>
          
          {hasCameraPermission === null ? (
            <View style={styles.scannerMessage}>
              <Text style={styles.scannerMessageText}>Requesting camera permission...</Text>
            </View>
          ) : hasCameraPermission === false ? (
            <View style={styles.scannerMessage}>
              <Text style={styles.scannerMessageText}>No access to camera</Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={getCameraPermissions}
              >
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.scannerCameraContainer}>
              <BarCodeScanner
                onBarCodeScanned={showBarcodeScanner ? handleBarCodeScanned : undefined}
                style={styles.scanner}
              />
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerInstructions}>
                  Point your camera at a barcode to scan
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 24,
  },
  title: {
    flex: 1,
    color: '#2D3748',
    fontSize: 32,
    fontWeight: '700',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 4,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
  },
  templateItem: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    marginBottom: 16,
    borderRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    color: '#2D3748',
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  useButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
  },
  useButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
  },
  editButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  dataFieldContainer: {
    marginBottom: 20,
  },
  dataFieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2D3748',
  },
  requiredAsterisk: {
    color: '#FF6B6B',
  },
  scanButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  templateDescription: {
    fontSize: 16,
    marginBottom: 8,
    color: '#4A5568',
    lineHeight: 22,
  },
  templateFields: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 8,
    fontWeight: '500',
  },
  templateDate: {
    fontSize: 12,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 80,
    color: '#718096',
    fontSize: 18,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
    elevation: 4,
    color: '#000000',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: '#2D3748',
  },
  fieldInputContainer: {
    marginBottom: 20,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    elevation: 4,
    color: '#000000',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  fieldTypeContainer: {
    marginBottom: 20,
  },
  fieldTypeLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#2D3748',
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  dropdownText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#718096',
  },
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 16,
    marginTop: 4,
    elevation: 8,
    zIndex: 1001,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
  },
  dropdownOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  dropdownOptionHovered: {
    backgroundColor: '#007AFF',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  dropdownOptionTextHovered: {
    color: '#ffffff',
  },
  addFieldButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  addFieldText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    marginBottom: 12,
    elevation: 4,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  fieldDetails: {
    flex: 1,
  },
  fieldName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#2D3748',
  },
  fieldType: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 4,
    fontWeight: '600',
  },
  fieldOptions: {
    fontSize: 12,
    color: '#718096',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  removeFieldText: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#000000',
  },
  scannerCloseButton: {
    padding: 10,
  },
  scannerCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  scannerCameraContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerInstructions: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  scannerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scannerMessageText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
