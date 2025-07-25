import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, FlatList, Modal, TextInput, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface TemplateField {
  id: string;
  name: string;
  type: 'free_text' | 'date' | 'number' | 'fixed_data' | 'fixed_date' | 'barcode';
  required: boolean;
  defaultValue?: string;
  options?: string[]; // For fixed_data type
}

interface CSVExportSettings {
  includeHeader: boolean;
  delimiter: 'comma' | 'semicolon' | 'pipe' | 'custom';
  customDelimiter?: string;
  fieldPositions: { [fieldId: string]: number };
  fileExtension: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  csvExportSettings: CSVExportSettings;
  createdAt: Date;
}

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [currentField, setCurrentField] = useState<Partial<TemplateField>>({});
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  const fieldTypes = [
    { label: 'Free Text', value: 'free_text' },
    { label: 'Date', value: 'date' },
    { label: 'Number', value: 'number' },
    { label: 'Fixed Data', value: 'fixed_data' },
    { label: 'Fixed Date', value: 'fixed_date' },
    { label: 'Barcode Scanning', value: 'barcode' },
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        const parsedData = JSON.parse(content);

        // Ensure we have an array and handle legacy format
        if (Array.isArray(parsedData)) {
          const loadedTemplates = parsedData.map((template: any) => ({
            id: template.id,
            name: template.name,
            description: template.description || '',
            fields: template.fields || [],
            csvExportSettings: template.csvExportSettings || {
              includeHeader: false,
              delimiter: 'comma',
              customDelimiter: '',
              fieldPositions: {}
            },
            createdAt: new Date(template.createdAt)
          }));
          setTemplates(loadedTemplates);
        } else {
          setTemplates([]);
        }
      }
    } catch (error) {
      console.log('Error loading templates:', error);
      setTemplates([]);
    }
  };

  const saveTemplates = async (newTemplates: Template[]) => {
    try {
      await FileSystem.writeAsStringAsync(TEMPLATES_FILE, JSON.stringify(newTemplates));
    } catch (error) {
      console.log('Error saving templates:', error);
    }
  };

  const createTemplate = () => {
    setNewTemplateName('');
    setTemplateFields([]);
    setEditingTemplateId(null);
    setActiveTab('fields');
    setCsvExportSettings({
      includeHeader: false,
      delimiter: 'comma',
      customDelimiter: '',
      fieldPositions: {},
      fileExtension: 'csv'
    });
    setShowTemplateModal(true);
  };

  const addField = () => {
    setCurrentField({
      name: '',
      type: 'free_text',
      required: false,
      defaultValue: '',
      options: []
    });
    setEditingFieldIndex(null);
    setShowFieldModal(true);
  };

  const editField = (index: number) => {
    setCurrentField({ ...templateFields[index] });
    setEditingFieldIndex(index);
    setShowFieldModal(true);
  };

  const saveField = () => {
    if (!currentField.name?.trim()) {
      Alert.alert('Invalid Input', 'Please enter a field name.');
      return;
    }

    const newField: TemplateField = {
      id: currentField.id || Date.now().toString(),
      name: currentField.name.trim(),
      type: currentField.type || 'free_text',
      required: currentField.required || false,
      defaultValue: currentField.defaultValue || '',
      options: currentField.options || []
    };

    let updatedFields = [...templateFields];
    if (editingFieldIndex !== null) {
      updatedFields[editingFieldIndex] = newField;
    } else {
      updatedFields.push(newField);
    }

    setTemplateFields(updatedFields);
    
    // Initialize CSV position for new field
    if (editingFieldIndex === null) {
      const newPosition = Math.max(...Object.values(csvExportSettings.fieldPositions), 0) + 1;
      setCsvExportSettings(prev => ({
        ...prev,
        fieldPositions: {
          ...prev.fieldPositions,
          [newField.id]: newPosition
        }
      }));
    }
    
    setShowFieldModal(false);
    setCurrentField({});
    setEditingFieldIndex(null);
  };

  const removeField = (index: number) => {
    const fieldToRemove = templateFields[index];
    const updatedFields = templateFields.filter((_, i) => i !== index);
    setTemplateFields(updatedFields);
    
    // Remove CSV position for deleted field
    setCsvExportSettings(prev => {
      const { [fieldToRemove.id]: removed, ...remainingPositions } = prev.fieldPositions;
      return {
        ...prev,
        fieldPositions: remainingPositions
      };
    });
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      Alert.alert('Invalid Input', 'Please enter a template name.');
      return;
    }

    if (templateFields.length === 0) {
      Alert.alert('Invalid Input', 'Please add at least one field to the template.');
      return;
    }

    if (!validateColumnPositions()) {
      Alert.alert('Invalid CSV Settings', 'Please fix duplicate column positions before saving the template.');
      return;
    }

    let updatedTemplates;
    if (editingTemplateId) {
      // Edit existing template
      updatedTemplates = templates.map(template => 
        template.id === editingTemplateId 
          ? {
              ...template,
              name: newTemplateName.trim(),
              fields: templateFields,
              csvExportSettings: csvExportSettings,
            }
          : template
      );
      Alert.alert('Success', 'Template updated successfully!');
    } else {
      // Create new template
      const newTemplate: Template = {
        id: Date.now().toString(),
        name: newTemplateName.trim(),
        description: '',
        fields: templateFields,
        csvExportSettings: csvExportSettings,
        createdAt: new Date()
      };
      updatedTemplates = [...templates, newTemplate];
      Alert.alert('Success', 'Template created successfully!');
    }

    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);

    setNewTemplateName('');
    setTemplateFields([]);
    setEditingTemplateId(null);
    setShowTemplateModal(false);
  };

  const viewTemplate = (template: Template) => {
    setSelectedTemplateForView(template);
    setShowViewTemplateModal(true);
  };

  const closeViewTemplate = () => {
    setShowViewTemplateModal(false);
    setSelectedTemplateForView(null);
  };

  const editTemplate = (template: Template) => {
    setNewTemplateName(template.name);
    setTemplateFields([...template.fields]);
    setEditingTemplateId(template.id);
    setActiveTab('fields');
    setCsvExportSettings(template.csvExportSettings || {
      includeHeader: false,
      delimiter: 'comma',
      customDelimiter: '',
      fieldPositions: {},
      fileExtension: 'csv'
    });
    setShowTemplateModal(true);
  };

  const [showUseTemplateModal, setShowUseTemplateModal] = useState(false);
  const [selectedTemplateForUse, setSelectedTemplateForUse] = useState<Template | null>(null);
  const [showViewTemplateModal, setShowViewTemplateModal] = useState(false);
  const [selectedTemplateForView, setSelectedTemplateForView] = useState<Template | null>(null);
  const [showDeleteTemplateModal, setShowDeleteTemplateModal] = useState(false);
  const [selectedTemplateForDelete, setSelectedTemplateForDelete] = useState<Template | null>(null);
  const [activeTab, setActiveTab] = useState<'fields' | 'csv'>('fields');
  const [csvExportSettings, setCsvExportSettings] = useState<CSVExportSettings>({
    includeHeader: false,
    delimiter: 'comma',
    customDelimiter: '',
    fieldPositions: {}
  });

  const useTemplate = (template: Template) => {
    setSelectedTemplateForUse(template);
    setShowUseTemplateModal(true);
  };

  const confirmUseTemplate = () => {
    if (selectedTemplateForUse) {
      router.push(`/data-entry?templateId=${selectedTemplateForUse.id}`);
      setShowUseTemplateModal(false);
      setSelectedTemplateForUse(null);
    }
  };

  const cancelUseTemplate = () => {
    setShowUseTemplateModal(false);
    setSelectedTemplateForUse(null);
  };

  const deleteTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateForDelete(template);
      setShowDeleteTemplateModal(true);
    }
  };

  const confirmDeleteTemplate = () => {
    if (selectedTemplateForDelete) {
      const updatedTemplates = templates.filter(t => t.id !== selectedTemplateForDelete.id);
      setTemplates(updatedTemplates);
      saveTemplates(updatedTemplates);
      setShowDeleteTemplateModal(false);
      setSelectedTemplateForDelete(null);
    }
  };

  const cancelDeleteTemplate = () => {
    setShowDeleteTemplateModal(false);
    setSelectedTemplateForDelete(null);
  };

  const addFixedDataOption = () => {
    const options = currentField.options || [];
    options.push('');
    setCurrentField({ ...currentField, options });
  };

  const updateFixedDataOption = (index: number, value: string) => {
    const options = [...(currentField.options || [])];
    options[index] = value;
    setCurrentField({ ...currentField, options });
  };

  const removeFixedDataOption = (index: number) => {
    const options = (currentField.options || []).filter((_, i) => i !== index);
    setCurrentField({ ...currentField, options });
  };

  const updateFieldPosition = (fieldId: string, position: number | null) => {
    setCsvExportSettings(prev => ({
      ...prev,
      fieldPositions: {
        ...prev.fieldPositions,
        [fieldId]: position === null ? 0 : position
      }
    }));
  };

  const validateColumnPositions = () => {
    const positions = Object.values(csvExportSettings.fieldPositions).filter(pos => pos > 0);
    const uniquePositions = new Set(positions);
    return positions.length === uniquePositions.size;
  };

  const getDuplicatePositions = () => {
    const positions = Object.values(csvExportSettings.fieldPositions);
    const positionCounts = {};
    positions.forEach(pos => {
      if (pos > 0) {
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      }
    });
    return Object.keys(positionCounts).filter(pos => positionCounts[pos] > 1).map(Number);
  };

  const getDelimiterSymbol = (delimiter: string, customDelimiter?: string) => {
    switch (delimiter) {
      case 'comma': return ',';
      case 'semicolon': return ';';
      case 'pipe': return '|';
      case 'custom': return customDelimiter || ',';
      default: return ',';
    }
  };

  const renderTemplate = ({ item }: { item: Template }) => (
    <View style={styles.templateItem}>
      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.templateDescription}>{item.description}</Text>
        <Text style={styles.templateFields}>Fields: {item.fields.length}</Text>
        <Text style={styles.templateDate}>
          Created: {item.createdAt.toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.templateActions}>
        <TouchableOpacity
          style={styles.useButton}
          onPress={() => useTemplate(item)}
        >
          <Text style={styles.useButtonText}>▶️ Use</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => viewTemplate(item)}
        >
          <Text style={styles.viewButtonText}>👁️ View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => editTemplate(item)}
        >
          <Text style={styles.editButtonText}>✏️ Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTemplate(item.id)}
        >
          <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderField = ({ item, index }: { item: TemplateField; index: number }) => (
    <View style={styles.fieldItem}>
      <View style={styles.fieldInfo}>
        <Text style={styles.fieldName}>{item.name}</Text>
        <Text style={styles.fieldType}>Type: {fieldTypes.find(t => t.value === item.type)?.label}</Text>
        <Text style={styles.fieldRequired}>Required: {item.required ? 'Yes' : 'No'}</Text>
      </View>
      <View style={styles.fieldActions}>
        <TouchableOpacity
          style={styles.editFieldButton}
          onPress={() => editField(index)}
        >
          <Text style={styles.editFieldButtonText}>✏️ Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeFieldButton}
          onPress={() => removeField(index)}
        >
          <Text style={styles.removeFieldButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Collector</ThemedText>

      

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.templateButton} 
          onPress={createTemplate}
        >
          <Text style={styles.buttonText}>Create Template</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id}
        style={styles.templatesList}
        showsVerticalScrollIndicator={true}
        scrollIndicatorInsets={{ right: 2 }}
        persistentScrollbar={true}
        indicatorStyle="black"
      />

      {/* Template Creation Modal */}
      <Modal visible={showTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.largeModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingTemplateId ? 'Edit Template' : 'Create Template'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Template name"
                value={newTemplateName}
                onChangeText={setNewTemplateName}
              />

              {/* Tab Navigation */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'fields' && styles.activeTab]}
                  onPress={() => setActiveTab('fields')}
                >
                  <Text style={[styles.tabText, activeTab === 'fields' && styles.activeTabText]}>
                    📝 Fields
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'csv' && styles.activeTab]}
                  onPress={() => setActiveTab('csv')}
                >
                  <Text style={[styles.tabText, activeTab === 'csv' && styles.activeTabText]}>
                    🗂️ CSV Export Settings
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Fields Tab */}
              {activeTab === 'fields' && (
                <View style={styles.fieldsSection}>
                  <View style={styles.fieldsSectionHeader}>
                    <Text style={styles.fieldsSectionTitle}>Fields ({templateFields.length})</Text>
                    <TouchableOpacity style={styles.addFieldButton} onPress={addField}>
                      <Text style={styles.addFieldButtonText}>Add Field</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView 
                    style={styles.fieldsScrollView}
                    contentContainerStyle={styles.fieldsScrollContent}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    scrollIndicatorInsets={{ right: 1 }}
                    indicatorStyle="black"
                  >
                    {templateFields.map((item, index) => (
                      <View key={`${item.id}-${index}`}>
                        {renderField({ item, index })}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* CSV Export Settings Tab */}
              {activeTab === 'csv' && (
                <View style={styles.csvSettingsSection}>
                  {/* Header Option - Vertical Layout */}
                  <View style={styles.csvSettingGroup}>
                    <Text style={styles.csvSettingTitle}>Header Option</Text>
                    <View style={styles.compactPickerContainer}>
                      <Picker
                        selectedValue={csvExportSettings.includeHeader ? 'with' : 'without'}
                        onValueChange={(value) => setCsvExportSettings(prev => ({
                          ...prev,
                          includeHeader: value === 'with'
                        }))}
                        style={styles.compactPicker}
                        itemStyle={styles.pickerItem}
                      >
                        <Picker.Item label="With Header" value="with" />
                        <Picker.Item label="Without Header" value="without" />
                      </Picker>
                    </View>
                  </View>

                  {/* Delimiter Selection - Vertical Layout */}
                  <View style={styles.csvSettingGroup}>
                    <Text style={styles.csvSettingTitle}>Delimiter</Text>
                    <View style={styles.compactPickerContainer}>
                      <Picker
                        selectedValue={csvExportSettings.delimiter}
                        onValueChange={(value) => setCsvExportSettings(prev => ({
                          ...prev,
                          delimiter: value
                        }))}
                        style={styles.compactPicker}
                      >
                        <Picker.Item label="Comma ," value="comma" />
                        <Picker.Item label="Semicolon ;" value="semicolon" />
                        <Picker.Item label="Pipe |" value="pipe" />
                        <Picker.Item label="Custom" value="custom" />
                      </Picker>
                    </View>
                  </View>
                  
                  {/* Custom Delimiter Input - Vertical Layout */}
                  {csvExportSettings.delimiter === 'custom' && (
                    <View style={styles.csvSettingGroup}>
                      <Text style={styles.csvSettingTitle}>Custom Delimiter</Text>
                      <TextInput
                        style={styles.compactInput}
                        placeholder="Enter symbol (e.g. #, ~)"
                        value={csvExportSettings.customDelimiter || ''}
                        onChangeText={(text) => setCsvExportSettings(prev => ({
                          ...prev,
                          customDelimiter: text
                        }))}
                        maxLength={3}
                      />
                    </View>
                  )}

                  {/* File Extension - Vertical Layout */}
                  <View style={styles.csvSettingGroup}>
                    <Text style={styles.csvSettingTitle}>File Extension</Text>
                    <TextInput
                      style={styles.compactInput}
                      placeholder="csv"
                      value={csvExportSettings.fileExtension || ''}
                      onChangeText={(text) => setCsvExportSettings(prev => ({
                        ...prev,
                        fileExtension: text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                      }))}
                      maxLength={10}
                    />
                  </View>

                  {/* Column Positioning - Optimized */}
                  <View style={styles.csvSettingGroup}>
                    <Text style={styles.csvSettingTitle}>Column Positioning</Text>
                    
                    {templateFields.length > 0 ? (
                      <ScrollView 
                        style={styles.positionContainer}
                        contentContainerStyle={styles.positionScrollContent}
                        showsVerticalScrollIndicator={true}
                        persistentScrollbar={true}
                        nestedScrollEnabled={true}
                      >
                        {templateFields.map((field, index) => {
                          const currentPosition = csvExportSettings.fieldPositions[field.id] || index + 1;
                          const duplicatePositions = getDuplicatePositions();
                          const isDuplicate = duplicatePositions.includes(currentPosition);
                          
                          return (
                            <View key={field.id} style={styles.compactPositionRow}>
                              <Text style={styles.compactFieldName} numberOfLines={1}>
                                {field.name}
                              </Text>
                              <View style={styles.compactPositionInput}>
                                <TextInput
                                  style={[
                                    styles.positionNumberInput,
                                    isDuplicate && styles.duplicatePositionInput
                                  ]}
                                  value={currentPosition === 0 ? '' : String(currentPosition)}
                                  onChangeText={(text) => {
                                    if (text === '') {
                                      updateFieldPosition(field.id, null);
                                    } else {
                                      const position = parseInt(text);
                                      if (!isNaN(position) && position >= 0) {
                                        updateFieldPosition(field.id, position);
                                      }
                                    }
                                  }}
                                  keyboardType="numeric"
                                  placeholder={String(index + 1)}
                                  textAlign="center"
                                  selectTextOnFocus={true}
                                />
                              </View>
                              {isDuplicate && (
                                <Text style={styles.duplicateWarning}>!</Text>
                              )}
                            </View>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <Text style={styles.noFieldsText}>
                        Add fields in the Fields tab to configure positions
                      </Text>
                    )}
                    
                    {templateFields.length > 0 && !validateColumnPositions() && (
                      <Text style={styles.validationWarning}>
                        ⚠️ Duplicate column positions detected. Each field should have a unique position number.
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setNewTemplateName('');
                    setTemplateFields([]);
                    setEditingTemplateId(null);
                    setActiveTab('fields');
                    setCsvExportSettings({
                      includeHeader: false,
                      delimiter: 'comma',
                      customDelimiter: '',
                      fieldPositions: {},
                      fileExtension: 'csv'
                    });
                    setShowTemplateModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveTemplate}
                >
                  <Text style={styles.saveButtonText}>
                    {editingTemplateId ? 'Update Template' : 'Save Template'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Field Creation/Edit Modal */}
      <Modal visible={showFieldModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.largeModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingFieldIndex !== null ? 'Edit Field' : 'Add Field'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Field name"
                value={currentField.name || ''}
                onChangeText={(text) => setCurrentField({ ...currentField, name: text })}
              />

              <Text style={styles.label}>Field Type:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={currentField.type}
                  onValueChange={(value) => setCurrentField({ ...currentField, type: value })}
                  style={styles.picker}
                >
                  {fieldTypes.map((type) => (
                    <Picker.Item key={type.value} label={type.label} value={type.value} />
                  ))}
                </Picker>
              </View>

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setCurrentField({ ...currentField, required: !currentField.required })}
                >
                  <Text style={styles.checkboxIcon}>
                    {currentField.required ? '☑' : '☐'}
                  </Text>
                  <Text style={styles.checkboxText}>
                    Required Field
                  </Text>
                </TouchableOpacity>
              </View>

              {(currentField.type === 'free_text' || currentField.type === 'number') && (
                <View style={styles.defaultValueSection}>
                  <Text style={styles.defaultValueLabel}>Default Value (Optional):</Text>
                  <TextInput
                    style={[styles.input, styles.defaultValueInput]}
                    placeholder={`Enter default ${currentField.type === 'number' ? 'number' : 'text'}`}
                    value={currentField.defaultValue || ''}
                    onChangeText={(text) => setCurrentField({ ...currentField, defaultValue: text })}
                    keyboardType={currentField.type === 'number' ? 'numeric' : 'default'}
                  />
                </View>
              )}

              {currentField.type === 'fixed_date' && (
                <View style={styles.defaultValueSection}>
                  <Text style={styles.defaultValueLabel}>Fixed Date Value:</Text>
                  <TextInput
                    style={[styles.input, styles.defaultValueInput]}
                    placeholder="YYYY-MM-DD"
                    value={currentField.defaultValue || ''}
                    onChangeText={(text) => setCurrentField({ ...currentField, defaultValue: text })}
                  />
                </View>
              )}

              {currentField.type === 'fixed_data' && (
                <View style={styles.defaultValueSection}>
                  <Text style={styles.defaultValueLabel}>Default Value (Optional):</Text>
                  <TextInput
                    style={[styles.input, styles.defaultValueInput]}
                    placeholder="Enter default selection"
                    value={currentField.defaultValue || ''}
                    onChangeText={(text) => setCurrentField({ ...currentField, defaultValue: text })}
                  />
                </View>
              )}

              {currentField.type === 'fixed_data' && (
                <View style={styles.fixedDataSection}>
                  <Text style={styles.label}>Options:</Text>
                  {(currentField.options || []).map((option, index) => (
                    <View key={index} style={styles.optionRow}>
                      <TextInput
                        style={[styles.input, styles.optionInput]}
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChangeText={(text) => updateFixedDataOption(index, text)}
                      />
                      <TouchableOpacity
                        style={styles.removeOptionButton}
                        onPress={() => removeFixedDataOption(index)}
                      >
                        <Text style={styles.removeOptionButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addOptionButton} onPress={addFixedDataOption}>
                    <Text style={styles.addOptionButtonText}>+ Add Option</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setCurrentField({});
                    setEditingFieldIndex(null);
                    setShowFieldModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveField}
                >
                  <Text style={styles.saveButtonText}>Save Field</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Use Template Confirmation Modal */}
      <Modal visible={showUseTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.useTemplateModalContent}>
            <Text style={styles.useTemplateModalTitle}>🚀 Use Template</Text>
            
            <View style={styles.useTemplateInfo}>
              <Text style={styles.useTemplateNameText}>
                "{selectedTemplateForUse?.name}"
              </Text>
            </View>

            <View style={styles.useTemplateButtons}>
              <TouchableOpacity
                style={styles.useTemplateCancelButton}
                onPress={cancelUseTemplate}
              >
                <Text style={styles.useTemplateCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.useTemplateStartButton}
                onPress={confirmUseTemplate}
              >
                <Text style={styles.useTemplateStartButtonText}>Use</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Template Modal */}
      <Modal visible={showViewTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.viewTemplateModalContent}>
            <Text style={styles.viewTemplateModalTitle}>👁️ View Template</Text>
            
            <View style={styles.viewTemplateInfo}>
              <Text style={styles.viewTemplateNameText}>
                "{selectedTemplateForView?.name}"
              </Text>
              
              <View style={styles.viewTemplateDetails}>
                <Text style={styles.viewTemplateDetailText}>
                  Fields: {selectedTemplateForView?.fields.length || 0}
                </Text>
                
                {selectedTemplateForView?.fields && selectedTemplateForView.fields.length > 0 && (
                  <View style={styles.viewTemplateFieldsList}>
                    {selectedTemplateForView.fields.map((field, index) => (
                      <Text key={index} style={styles.viewTemplateFieldItem}>
                        • {field.name} ({fieldTypes.find(t => t.value === field.type)?.label})
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.viewTemplateButtons}>
              <TouchableOpacity
                style={styles.viewTemplateCloseButton}
                onPress={closeViewTemplate}
              >
                <Text style={styles.viewTemplateCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Template Modal */}
      <Modal visible={showDeleteTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteTemplateModalContent}>
            <Text style={styles.deleteTemplateModalTitle}>🗑️ Delete Template</Text>
            
            <View style={styles.deleteTemplateInfo}>
              <Text style={styles.deleteTemplateNameText}>
                "{selectedTemplateForDelete?.name}"
              </Text>
              
              <Text style={styles.deleteTemplateWarningText}>
                Are you sure you want to delete this template? This action cannot be undone.
              </Text>
            </View>

            <View style={styles.deleteTemplateButtons}>
              <TouchableOpacity
                style={styles.deleteTemplateCancelButton}
                onPress={cancelDeleteTemplate}
              >
                <Text style={styles.deleteTemplateCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteTemplateConfirmButton}
                onPress={confirmDeleteTemplate}
              >
                <Text style={styles.deleteTemplateConfirmButtonText}>Delete</Text>
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
    padding: 20,
    paddingBottom: 130, // Add extra bottom padding to account for tab bar
    backgroundColor: '#ffffff',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 40,
    color: '#000000',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  statsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5282',
  },
  actionContainer: {
    gap: 10,
    marginBottom: 20,
  },
  templateButton: {
    backgroundColor: '#68d391',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(104, 211, 145, 0.3)',
    elevation: 6,
    borderWidth: 2,
    borderColor: '#9ae6b4',
  },
  
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
  },
  templatesList: {
    flex: 1,
  },
  templateItem: {
    flexDirection: 'column',
    backgroundColor: 'white',
    padding: 8,
    marginBottom: 6,
    borderRadius: 8,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  templateInfo: {
    marginBottom: 6,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#2d3748',
  },
  templateDescription: {
    fontSize: 12,
    marginBottom: 4,
    color: '#4a5568',
    fontStyle: 'italic',
  },
  templateFields: {
    fontSize: 11,
    marginBottom: 2,
    color: '#718096',
    fontWeight: '600',
  },
  templateDate: {
    fontSize: 10,
    color: '#a0aec0',
  },
  templateActions: {
    flexDirection: 'row',
    gap: 6,
  },
  useButton: {
    flex: 1,
    backgroundColor: '#38a169',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    boxShadow: '0px 1px 2px rgba(56, 161, 105, 0.2)',
    elevation: 2,
  },
  useButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#63b3ed',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    boxShadow: '0px 1px 2px rgba(99, 179, 237, 0.2)',
    elevation: 2,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f6ad55',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    boxShadow: '0px 1px 2px rgba(246, 173, 85, 0.2)',
    elevation: 2,
  },
  editButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fc8181',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    boxShadow: '0px 1px 2px rgba(252, 129, 129, 0.2)',
    elevation: 2,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '95%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#2d3748',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2d3748',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 5,
    marginBottom: 15,
  },
  picker: {
    height: 50,
  },
  checkboxContainer: {
    marginBottom: 15,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    minHeight: 48,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checkboxIcon: {
    fontSize: 24,
    marginRight: 12,
    color: '#4299e1',
  },
  checkboxText: {
    fontSize: 16,
    color: '#2d3748',
    flex: 1,
  },
  fieldsSection: {
    marginBottom: 20,
  },
  fieldsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fieldsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  addFieldButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  addFieldButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fieldsScrollView: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  fieldsScrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  fieldItem: {
    flexDirection: 'row',
    backgroundColor: '#f7fafc',
    padding: 6,
    marginBottom: 5,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#4299e1',
  },
  fieldInfo: {
    flex: 1,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#2d3748',
  },
  fieldType: {
    fontSize: 12,
    marginBottom: 2,
    color: '#4a5568',
  },
  fieldRequired: {
    fontSize: 12,
    color: '#718096',
  },
  fieldActions: {
    flexDirection: 'row',
    gap: 5,
  },
  editFieldButton: {
    backgroundColor: '#f6ad55',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 2px rgba(246, 173, 85, 0.2)',
    elevation: 2,
  },
  editFieldButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  removeFieldButton: {
    backgroundColor: '#fc8181',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 2px rgba(252, 129, 129, 0.2)',
    elevation: 2,
  },
  removeFieldButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fixedDataSection: {
    marginBottom: 15,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  optionInput: {
    flex: 1,
    marginRight: 10,
    marginBottom: 0,
  },
  removeOptionButton: {
    backgroundColor: '#e53e3e',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeOptionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addOptionButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  addOptionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#a0aec0',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#48bb78',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  useTemplateModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  useTemplateModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  useTemplateInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  useTemplateText: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  useTemplateNameText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#68d391',
    minWidth: '80%',
    boxShadow: '0px 2px 8px rgba(104, 211, 145, 0.15)',
    elevation: 3,
  },
  useTemplateButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  useTemplateCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    minWidth: 80,
  },
  useTemplateCancelButtonText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
  },
  useTemplateStartButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  useTemplateStartButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  viewTemplateModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  viewTemplateModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  viewTemplateInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  viewTemplateNameText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#63b3ed',
    minWidth: '80%',
    boxShadow: '0px 2px 8px rgba(99, 179, 237, 0.15)',
    elevation: 3,
  },
  viewTemplateDetails: {
    width: '100%',
    alignItems: 'flex-start',
  },
  viewTemplateDetailText: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 8,
    lineHeight: 22,
  },
  viewTemplateFieldsList: {
    marginTop: 10,
    width: '100%',
  },
  viewTemplateFieldItem: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
    paddingLeft: 8,
    lineHeight: 20,
  },
  viewTemplateButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  viewTemplateCloseButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  viewTemplateCloseButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteTemplateModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  deleteTemplateModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  deleteTemplateInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  deleteTemplateNameText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fc8181',
    minWidth: '80%',
    boxShadow: '0px 2px 8px rgba(252, 129, 129, 0.15)',
    elevation: 3,
  },
  deleteTemplateWarningText: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteTemplateButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  deleteTemplateCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    minWidth: 80,
  },
  deleteTemplateCancelButtonText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteTemplateConfirmButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  deleteTemplateConfirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#4299e1',
    boxShadow: '0px 2px 4px rgba(66, 153, 225, 0.2)',
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  activeTabText: {
    color: 'white',
  },
  csvSettingsSection: {
    marginBottom: 20,
  },
  csvSettingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  csvSettingHalf: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  csvSettingGroup: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  csvSettingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  compactCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactCheckboxIcon: {
    fontSize: 16,
    marginRight: 6,
    color: '#4299e1',
  },
  compactCheckboxText: {
    fontSize: 13,
    color: '#2d3748',
    fontWeight: '500',
  },
  compactPickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    backgroundColor: 'white',
    height: 50,
    justifyContent: 'center',
  },
  compactPicker: {
    height: 50,
    fontSize: 16,
    color: '#2d3748',
    textAlign: 'center',
  },
  pickerItem: {
    fontSize: 16,
    color: '#2d3748',
    height: 50,
  },
  customDelimiterContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: 'white',
  },
  positionContainer: {
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 160,
  },
  positionScrollContent: {
    padding: 8,
  },
  compactPositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  compactFieldName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
    marginRight: 8,
  },
  compactPositionInput: {
    width: 50,
  },
  positionNumberInput: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 4,
    padding: 6,
    fontSize: 13,
    backgroundColor: 'white',
    fontWeight: '600',
  },
  noFieldsText: {
    fontSize: 13,
    color: '#a0aec0',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 16,
  },
  duplicatePositionInput: {
    borderColor: '#e53e3e',
    borderWidth: 2,
    backgroundColor: '#fed7d7',
  },
  duplicateWarning: {
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  validationWarning: {
    fontSize: 12,
    color: '#e53e3e',
    textAlign: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fed7d7',
    borderRadius: 4,
    fontWeight: '500',
  },
  defaultValueSection: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  defaultValueLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  defaultValueInput: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e0',
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3748',
  },
});