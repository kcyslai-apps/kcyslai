import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, FlatList, Modal, TextInput, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
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
  isProtected?: boolean; // Added for protection status
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

  // Reload templates when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadTemplates();
    }, [])
  );

  const loadTemplates = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      let loadedTemplates: Template[] = [];
      
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        try {
          const parsedData = JSON.parse(content);

          // Ensure we have an array and handle legacy format
          if (Array.isArray(parsedData)) {
            loadedTemplates = parsedData.map((template: any) => ({
              id: template.id,
              name: template.name,
              description: template.description || '',
              fields: template.fields || [],
              csvExportSettings: template.csvExportSettings || {
                includeHeader: false,
                delimiter: 'comma',
                customDelimiter: '',
                fieldPositions: {},
                fileExtension: 'csv',
                includeQuotes: true
              },
              createdAt: new Date(template.createdAt),
              isProtected: template.isProtected || false // Load protection status
            }));
          }
        } catch (parseError) {
          console.log('Error parsing templates file:', parseError);
          loadedTemplates = [];
        }
      }

      // Check if the default Stock Count template exists
      const hasDefaultTemplate = loadedTemplates.some(template => 
        template.id === "1753791586091" && template.name === "Stock Count"
      );

      // If default template doesn't exist, add it
      if (!hasDefaultTemplate) {
        const defaultStockCountTemplate: Template = {
          id: "1753791586091", // Provided ID
          name: "Stock Count",
          description: "",
          fields: [
            {
              id: "1753791519541",
              name: "Location",
              type: "fixed_data",
              required: true,
              defaultValue: "",
              options: [],
              inputMode: "editable",
              dateFormat: "YYYY-MM-DD",
              customDateFormat: ""
            },
            {
              id: "1753791530032",
              name: "Barcode",
              type: "barcode",
              required: true,
              defaultValue: "",
              options: [],
              inputMode: "select_only",
              dateFormat: "YYYY-MM-DD",
              customDateFormat: ""
            },
            {
              id: "1753791545448",
              name: "Date",
              type: "fixed_date",
              required: true,
              defaultValue: "",
              options: [],
              inputMode: "select_only",
              dateFormat: "yyyyMMdd",
              customDateFormat: ""
            },
            {
              id: "1753791555840",
              name: "Quantity",
              type: "number",
              required: true,
              defaultValue: "",
              options: [],
              inputMode: "select_only",
              dateFormat: "YYYY-MM-DD",
              customDateFormat: ""
            }
          ],
          csvExportSettings: {
            includeHeader: false,
            delimiter: "comma",
            customDelimiter: "",
            fieldPositions: {
              "1753791519541": 1,
              "1753791530032": 2,
              "1753791545448": 4,
              "1753791555840": 3
            },
            fileExtension: "csv",
            includeQuotes: false
          },
          createdAt: new Date("2025-07-29T12:19:46.091Z"),
          isProtected: true // Mark as protected
        };
        
        loadedTemplates.unshift(defaultStockCountTemplate); // Add at beginning
        await saveTemplates(loadedTemplates);
        console.log('Default template added.');
      }

      setTemplates(loadedTemplates);
      console.log('Templates loaded successfully:', loadedTemplates.length);
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
      fileExtension: 'csv',
      includeQuotes: true
    });
    setShowTemplateModal(true);
  };

  const addField = () => {
    setCurrentField({
      name: '',
      type: 'free_text',
      required: true,
      defaultValue: '',
      options: [],
      inputMode: 'editable',
      dateFormat: 'YYYY-MM-DD',
      customDateFormat: ''
    });
    setEditingFieldIndex(null);
    setShowFieldModal(true);
  };

  const editField = (index: number) => {
    const field = templateFields[index];
    // Ensure fixed_data fields default to 'editable' if no inputMode is set
    const fieldToEdit = {
      ...field,
      inputMode: field.type === 'fixed_data' && !field.inputMode ? 'editable' : field.inputMode
    };
    setCurrentField(fieldToEdit);
    setEditingFieldIndex(index);
    setShowFieldModal(true);
  };

  const saveField = () => {
    if (!currentField.name?.trim()) {
      setValidationError('Please enter a field name.');
      setShowValidationModal(true);
      return;
    }

    const newField: TemplateField = {
      id: currentField.id || Date.now().toString(),
      name: currentField.name.trim(),
      type: currentField.type || 'free_text',
      required: true,
      defaultValue: currentField.defaultValue || '',
      options: currentField.options || [],
      inputMode: currentField.type === 'fixed_data' ? (currentField.inputMode || 'editable') : (currentField.inputMode || 'select_only'),
      dateFormat: currentField.dateFormat || 'YYYY-MM-DD',
      customDateFormat: currentField.customDateFormat || ''
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
    setSelectedFieldForDelete({ field: fieldToRemove, index });
    setShowDeleteFieldModal(true);
  };

  const confirmDeleteField = () => {
    if (selectedFieldForDelete) {
      const { field: fieldToRemove, index } = selectedFieldForDelete;
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

      setShowDeleteFieldModal(false);
      setSelectedFieldForDelete(null);
    }
  };

  const cancelDeleteField = () => {
    setShowDeleteFieldModal(false);
    setSelectedFieldForDelete(null);
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      setValidationError('Please enter a template name.');
      setShowValidationModal(true);
      return;
    }

    if (templateFields.length === 0) {
      setValidationError('Please add at least one field to the template.');
      setShowValidationModal(true);
      return;
    }



    // Check for duplicate template names (excluding the current template if editing)
    const trimmedName = newTemplateName.trim();
    const duplicateTemplate = templates.find(template => 
      template.name.toLowerCase() === trimmedName.toLowerCase() && 
      template.id !== editingTemplateId
    );

    if (duplicateTemplate) {
      setValidationError('Template name already exists. Please enter a unique name.');
      setShowValidationModal(true);
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
    } else {
      // Create new template
      const newTemplate: Template = {
        id: Date.now().toString(),
        name: trimmedName,
        description: '',
        fields: templateFields,
        csvExportSettings: csvExportSettings,
        createdAt: new Date()
      };
      updatedTemplates = [...templates, newTemplate];
    }

    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);

    // Close the modal first
    setShowTemplateModal(false);

    // Show success message after closing modal
    setShowSuccessMessage(true);

    // Reset form state (except editingTemplateId which is reset when success modal closes)
    setNewTemplateName('');
    setTemplateFields([]);
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
    // Prevent editing protected templates
    if (template.isProtected) {
      setValidationError('This is a protected template and cannot be edited.');
      setShowValidationModal(true);
      return;
    }
    setNewTemplateName(template.name);
    setTemplateFields([...template.fields]);
    setEditingTemplateId(template.id);
    setActiveTab('fields');
    setCsvExportSettings(template.csvExportSettings || {
      includeHeader: false,
      delimiter: 'comma',
      customDelimiter: '',
      fieldPositions: {},
      fileExtension: 'csv',
      includeQuotes: true
    });
    setShowTemplateModal(true);
  };

  const [selectedTemplateForUse, setSelectedTemplateForUse] = useState<Template | null>(null);
  const [showViewTemplateModal, setShowViewTemplateModal] = useState(false);
  const [selectedTemplateForView, setSelectedTemplateForView] = useState<Template | null>(null);
  const [showDeleteTemplateModal, setShowDeleteTemplateModal] = useState(false);
  const [selectedTemplateForDelete, setSelectedTemplateForDelete] = useState<Template | null>(null);
  const [showDataFileModal, setShowDataFileModal] = useState(false);
  const [dataFileName, setDataFileName] = useState('');
  const [activeTab, setActiveTab] = useState<'fields' | 'csv'>('fields');
  const [csvExportSettings, setCsvExportSettings] = useState<CSVExportSettings>({
    includeHeader: false,
    delimiter: 'comma',
    customDelimiter: '',
    fieldPositions: {}
  });
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [selectedTemplateForClone, setSelectedTemplateForClone] = useState<Template | null>(null);
  const [cloneTemplateName, setCloneTemplateName] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false); // Renamed from showCloneSuccessMessage
  const [showDeleteFieldModal, setShowDeleteFieldModal] = useState(false);
  const [selectedFieldForDelete, setSelectedFieldForDelete] = useState<{ field: TemplateField; index: number } | null>(null);


  const useTemplate = (template: Template) => {
    setSelectedTemplateForUse(template);
    // Generate default filename based on template name
    const defaultFileName = template.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    setDataFileName(defaultFileName);
    setShowDataFileModal(true);
  };

  const cloneTemplate = (template: Template) => {
    // Prevent cloning protected templates if desired, or allow it if it makes sense
    // For now, we allow cloning of any template
    setSelectedTemplateForClone(template);
    setCloneTemplateName(`${template.name} - Copy`);
    setShowCloneModal(true);
  };

  const deleteTemplate = (template: Template) => { // Changed to accept template object
    if (template.isProtected) { // Check protection status here
      setValidationError('This is a protected template and cannot be deleted.');
      setShowValidationModal(true);
      return;
    }
    setSelectedTemplateForDelete(template);
    setShowDeleteTemplateModal(true);
  };

  const confirmCloneTemplate = async () => {
    if (!selectedTemplateForClone || !cloneTemplateName.trim()) {
      setValidationError('Please enter a template name.');
      setShowValidationModal(true);
      return;
    }

    // Check for duplicate template names
    const trimmedName = cloneTemplateName.trim();
    const duplicateTemplate = templates.find(template => 
      template.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateTemplate) {
      setValidationError('Template name already exists. Please enter a unique name.');
      setShowValidationModal(true);
      return;
    }

    // Create cloned template
    const clonedTemplate: Template = {
      id: Date.now().toString(),
      name: trimmedName,
      description: selectedTemplateForClone.description,
      fields: selectedTemplateForClone.fields.map(field => ({
        ...field,
        id: `${field.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })),
      csvExportSettings: { ...selectedTemplateForClone.csvExportSettings },
      createdAt: new Date(),
      isProtected: false // Cloned templates are not protected by default
    };

    const updatedTemplates = [...templates, clonedTemplate];
    setTemplates(updatedTemplates);
    await saveTemplates(updatedTemplates);

    setShowCloneModal(false);
    setSelectedTemplateForClone(null);
    setCloneTemplateName('');
  };

  const cancelCloneTemplate = () => {
    setShowCloneModal(false);
    setSelectedTemplateForClone(null);
    setCloneTemplateName('');
  };

  const confirmDeleteTemplate = async () => {
    if (!selectedTemplateForDelete) return;

    // Check if template is protected
    if (selectedTemplateForDelete.isProtected) {
      setValidationError('This is a protected template and cannot be deleted.');
      setShowValidationModal(true);
      setShowDeleteTemplateModal(false);
      setSelectedTemplateForDelete(null);
      return;
    }

    setShowDeleteTemplateModal(false);

    try {
      // Before deleting template, preserve its field definitions in existing data records
      const dataRecordsFile = FileSystem.documentDirectory + 'dataRecords.json';
      const fileExists = await FileSystem.getInfoAsync(dataRecordsFile);

      if (fileExists.exists) {
        try {
          const content = await FileSystem.readAsStringAsync(dataRecordsFile);
          const dataRecords = JSON.parse(content);

          // Update records that use this template to preserve field definitions
          const updatedRecords = dataRecords.map((record: any) => {
            if (record.templateId === selectedTemplateForDelete.id) {
              return {
                ...record,
                // Preserve template field definitions for future use
                preservedTemplateFields: selectedTemplateForDelete.fields,
                preservedCsvSettings: selectedTemplateForDelete.csvExportSettings,
                // Mark as orphaned for reference
                templateDeleted: true,
                templateDeletedAt: new Date().toISOString()
              };
            }
            return record;
          });

          // Save updated records with preserved template info
          await FileSystem.writeAsStringAsync(dataRecordsFile, JSON.stringify(updatedRecords));
        } catch (error) {
          console.error('Error preserving template info in data records:', error);
        }
      }

      // Remove the template
      const updatedTemplates = templates.filter(t => t.id !== selectedTemplateForDelete.id);
      setTemplates(updatedTemplates);
      await saveTemplates(updatedTemplates);

      // Reload templates from file system to ensure state consistency
      await loadTemplates();

      setSelectedTemplateForDelete(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      Alert.alert('Error', 'Failed to delete template');
    }
  };

  const cancelDeleteTemplate = () => {
    setShowDeleteTemplateModal(false);
    setSelectedTemplateForDelete(null);
  };

  const confirmCreateDataFile = () => {
    if (selectedTemplateForUse && dataFileName.trim()) {
      // Generate timestamp for final filename
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
      const finalFileName = `${dataFileName.trim()}_${timestamp}`;

      // Navigate to data entry with both template ID and final data file name
      router.push(`/data-entry?templateId=${selectedTemplateForUse.id}&dataFileName=${encodeURIComponent(finalFileName)}`);
      setShowDataFileModal(false);
      setSelectedTemplateForUse(null);
      setDataFileName('');
    }
  };

  const cancelCreateDataFile = () => {
    setShowDataFileModal(false);
    setSelectedTemplateForUse(null);
    setDataFileName('');
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
    setCsvExportSettings(prev => {
      const newPosition = position === null ? 0 : position;

      // If this position is already taken by another field, swap them
      const currentFieldWithPosition = Object.entries(prev.fieldPositions)
        .find(([id, pos]) => id !== fieldId && pos === newPosition);

      let updatedPositions = { ...prev.fieldPositions };

      if (currentFieldWithPosition) {
        // Swap positions: give the other field the current field's old position
        const currentFieldOldPosition = prev.fieldPositions[fieldId] || 0;
        updatedPositions[currentFieldWithPosition[0]] = currentFieldOldPosition;
      }

      updatedPositions[fieldId] = newPosition;

      return {
        ...prev,
        fieldPositions: updatedPositions
      };
    });
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



  const renderTemplate = ({ item }: { item: Template }) => {
    console.log('Rendering template:', item.name);
    return (
    <View style={styles.templateItem}>
      <View style={styles.templateInfo}>
        <View style={styles.templateHeaderRow}>
          <Text style={styles.templateName}>{item.name}</Text>
        </View>
        <View style={styles.templateDescriptionRow}>
          <Text style={styles.templateDescription}>{item.description}</Text>
        </View>
        <Text style={styles.templateFields}>Fields: {item.fields.length}</Text>
        <Text style={styles.templateDate}>
          Created: {item.createdAt.toLocaleDateString()}
        </Text>
        <View style={styles.templateActionsContainer}>
          <View style={styles.mainActionRow}>
            <TouchableOpacity
              style={styles.useButton}
              onPress={() => useTemplate(item)}
            >
              <Text style={styles.useButtonText}>🚀 Use</Text>
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
              onPress={() => deleteTemplate(item)}
            >
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cloneActionRow}>
            <TouchableOpacity
              style={styles.cloneButton}
              onPress={() => cloneTemplate(item)}
            >
              <Text style={styles.cloneButtonText}>📋 Clone</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
    );
  };

  const renderField = ({ item, index }: { item: TemplateField; index: number }) => (
    <View style={styles.fieldItem}>
      <View style={styles.fieldInfo}>
        <Text style={styles.fieldName}>{item.name}</Text>
        <Text style={styles.fieldType}>Type: {fieldTypes.find(t => t.value === item.type)?.label}</Text>
        <Text style={styles.fieldRequired}>Required: Yes</Text>
        {(item.type === 'date' || item.type === 'fixed_date') && (
          <Text style={styles.fieldFormat}>
            Format: {item.dateFormat === 'custom' ? item.customDateFormat || 'Custom' : item.dateFormat || 'YYYY-MM-DD'}
          </Text>
        )}
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

      {templates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No templates found</Text>
          <Text style={styles.emptyStateSubtext}>Create your first template to get started</Text>
        </View>
      ) : (
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
      )}

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
                editable={!editingTemplateId || !templates.find(t => t.id === editingTemplateId)?.isProtected} // Make name not editable for protected templates
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
                    🗂️ File Export Settings
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

              {/* File Export Settings Tab */}
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
                      onChangeText={(text) => {
                        // Only allow alphanumeric characters and convert to lowercase
                        const cleanText = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        // Only update if the text actually changed to prevent loops
                        if (cleanText !== csvExportSettings.fileExtension) {
                          setCsvExportSettings(prev => ({
                            ...prev,
                            fileExtension: cleanText
                          }));
                        }
                      }}
                      maxLength={10}
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Quotation Marks Option - Vertical Layout */}
                  <View style={styles.csvSettingGroup}>
                    <Text style={styles.csvSettingTitle}>Include quotation marks (" ") around data fields</Text>
                    <View style={styles.compactPickerContainer}>
                      <Picker
                        selectedValue={csvExportSettings.includeQuotes ? 'yes' : 'no'}
                        onValueChange={(value) => setCsvExportSettings(prev => ({
                          ...prev,
                          includeQuotes: value === 'yes'
                        }))}
                        style={styles.compactPicker}
                        itemStyle={styles.pickerItem}
                      >
                        <Picker.Item label="Yes (default)" value="yes" />
                        <Picker.Item label="No" value="no" />
                      </Picker>
                    </View>
                  </View>

                  {/* Column Positioning - Compact Implementation */}
                  <View style={styles.csvSettingGroup}>
                    <Text style={styles.csvSettingTitle}>Column Positioning</Text>

                    {templateFields.length > 0 ? (
                      <View style={styles.compactPositionContainer}>
                        {templateFields.map((field, index) => {
                          // Get current position or assign default sequential position
                          let currentPosition = csvExportSettings.fieldPositions[field.id];
                          if (!currentPosition || currentPosition === 0) {
                            currentPosition = index + 1;
                            // Update the position in the state to ensure consistency
                            updateFieldPosition(field.id, currentPosition);
                          }

                          // Get all assigned positions except for the current field
                          const assignedPositions = Object.entries(csvExportSettings.fieldPositions)
                            .filter(([fieldId, position]) => fieldId !== field.id && position > 0)
                            .map(([_, position]) => position);

                          // Generate available positions (1 to 20)
                          const availablePositions = [];
                          for (let i = 1; i <= 20; i++) {
                            if (!assignedPositions.includes(i) || i === currentPosition) {
                              availablePositions.push(i);
                            }
                          }

                          // Ensure positions are sorted
                          availablePositions.sort((a, b) => a - b);

                          return (
                            <View key={field.id} style={styles.compactPositionRow}>
                              <Text style={styles.compactFieldName} numberOfLines={1}>
                                {field.name}
                              </Text>
                              <View style={styles.compactDropdownContainer}>
                                <Picker
                                  selectedValue={currentPosition}
                                  onValueChange={(value) => {
                                    if (value !== null && value !== undefined && value !== '') {
                                      updateFieldPosition(field.id, value);
                                    }
                                  }}
                                  style={styles.compactPositionDropdown}
                                  itemStyle={styles.compactDropdownItem}
                                  mode="dropdown"
                                  prompt="Select Position"
                                >
                                  {availablePositions.map((position) => (
                                    <Picker.Item 
                                      key={position} 
                                      label={position.toString()} 
                                      value={position}
                                      color="#2d3748"
                                    />
                                  ))}
                                </Picker>
                                <View style={styles.compactDropdownDisplayOverlay}>
                                  <Text style={styles.compactDropdownDisplayText}>
                                    {currentPosition || ''}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.noFieldsText}>
                        Add fields in the Fields tab to configure positions
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
                      fileExtension: 'csv',
                      includeQuotes: true
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
                  onValueChange={(value) => {
                    const updatedField = { ...currentField, type: value };
                    // Set default inputMode to 'editable' when changing to fixed_data
                    if (value === 'fixed_data' && !currentField.inputMode) {
                      updatedField.inputMode = 'editable';
                    }
                    setCurrentField(updatedField);
                  }}
                  style={styles.picker}
                >
                  {fieldTypes.map((type) => (
                    <Picker.Item key={type.value} label={type.label} value={type.value} />
                  ))}
                </Picker>
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

              {(currentField.type === 'date' || currentField.type === 'fixed_date') && (
                <View style={styles.dateFormatSection}>
                  <Text style={styles.defaultValueLabel}>Date Format:</Text>
                  <View style={styles.dateFormatPickerContainer}>
                    <Picker
                      selectedValue={currentField.dateFormat || 'YYYY-MM-DD'}
                      onValueChange={(value) => setCurrentField({ ...currentField, dateFormat: value })}
                      style={styles.dateFormatPicker}
                    >
                      <Picker.Item label="YYYY-MM-DD (e.g., 2025-07-27)" value="YYYY-MM-DD" />
                      <Picker.Item label="dd/MM/yyyy (e.g., 27/07/2025)" value="dd/MM/yyyy" />
                      <Picker.Item label="MM/dd/yyyy (e.g., 07/27/2025)" value="MM/dd/yyyy" />
                      <Picker.Item label="yyyyMMdd (e.g., 20250727)" value="yyyyMMdd" />
                      <Picker.Item label="dd-MM-yyyy (e.g., 27-07-2025)" value="dd-MM-yyyy" />
                      <Picker.Item label="yyyy.MM.dd (e.g., 2025.07.27)" value="yyyy.MM.dd" />
                      <Picker.Item label="Custom Format" value="custom" />
                    </Picker>
                  </View>

                  {currentField.dateFormat === 'custom' && (
                    <View style={styles.customFormatSection}>
                      <Text style={styles.customFormatLabel}>Custom Date Format:</Text>
                      <TextInput
                        style={[styles.input, styles.customFormatInput]}
                        placeholder="e.g., dd-MMM-yyyy, MM/yyyy, etc."
                        value={currentField.customDateFormat || ''}
                        onChangeText={(text) => setCurrentField({ ...currentField, customDateFormat: text })}
                      />
                      <Text style={styles.formatHint}>
                        Use: yyyy (year), MM (month), dd (day), MMM (short month name), MMMM (full month name)
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {currentField.type === 'fixed_data' && (
                <View style={styles.defaultValueSection}>
                  <Text style={styles.defaultValueLabel}>Default Value (Optional):</Text>
                  <TextInput
                    style={[styles.input, styles.defaultValueInput]}
                    placeholder="Enter default value (max 30 chars)"
                    value={currentField.defaultValue || ''}
                    onChangeText={(text) => setCurrentField({ ...currentField, defaultValue: text })}
                    maxLength={30}
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
                        maxLength={30}
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

              {currentField.type === 'fixed_data' && (
                <View style={styles.inputModeSection}>
                  <Text style={styles.inputModeSectionLabel}>Input Mode:</Text>
                  <View style={styles.inputModePickerContainer}>
                    <Picker
                      selectedValue={currentField.inputMode || 'editable'}
                      onValueChange={(value) => setCurrentField({ ...currentField, inputMode: value as 'select_only' | 'editable' })}
                      style={styles.inputModePicker}
                      itemStyle={styles.inputModePickerItem}
                    >
                      <Picker.Item label="Editable" value="editable" />
                      <Picker.Item label="Select Only" value="select_only" />
                    </Picker>
                  </View>
                  {(currentField.inputMode === 'select_only') && (
                    <Text style={styles.inputModeDescription}>
                      Users can only choose from the predefined "Options" list. Manual typing is not allowed.
                    </Text>
                  )}
                  {(currentField.inputMode === 'editable' || !currentField.inputMode) && (
                    <Text style={styles.inputModeDescription}>
                      Users can select from the "Options" list or manually enter a custom value.
                      Predefined options act as suggestions or shortcuts.
                    </Text>
                  )}
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

      {/* Data File Creation Modal */}
      <Modal visible={showDataFileModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.dataFileModalContent}>
            <Text style={styles.dataFileModalTitle}>💾 Create Data File</Text>

            <View style={styles.dataFileInfo}>
              <Text style={styles.dataFileDescription}>
                Create a new data file for template:
              </Text>
              <Text style={styles.dataFileTemplateText}>
                "{selectedTemplateForUse?.name}"
              </Text>
              <Text style={styles.dataFileHint}>
                A timestamp will be automatically added to the final file name.
              </Text>
            </View>

            <View style={styles.dataFileInputSection}>
              <Text style={styles.dataFileInputLabel}>File Name (without timestamp):</Text>
              <TextInput
                style={styles.dataFileInput}
                value={dataFileName}
                onChangeText={setDataFileName}
                placeholder="Enter file name"
                selectTextOnFocus={true}
              />
              <Text style={styles.dataFilePreview}>
                Final name will be: {dataFileName.trim() ? `${dataFileName.trim()}_[timestamp]` : '[filename]_[timestamp]'}
              </Text>
            </View>

            <View style={styles.dataFileButtons}>
              <TouchableOpacity
                style={styles.dataFileCancelButton}
                onPress={cancelCreateDataFile}
              >
                <Text style={styles.dataFileCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dataFileCreateButton}
                onPress={confirmCreateDataFile}
              >
                <Text style={styles.dataFileCreateButtonText}>Create File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clone Template Modal */}
      <Modal visible={showCloneModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.cloneTemplateModalContent}>
            <Text style={styles.cloneTemplateModalTitle}>📋 Clone Template</Text>

            <View style={styles.cloneTemplateInfo}>
              <Text style={styles.cloneTemplateDescription}>
                Create a copy of template:
              </Text>
              <Text style={styles.cloneTemplateOriginalText}>
                "{selectedTemplateForClone?.name}"
              </Text>
            </View>

            <View style={styles.cloneTemplateInputSection}>
              <Text style={styles.cloneTemplateInputLabel}>New Template Name:</Text>
              <TextInput
                style={styles.cloneTemplateInput}
                value={cloneTemplateName}
                onChangeText={setCloneTemplateName}
                placeholder="Enter new template name"
                selectTextOnFocus={true}
              />
            </View>

            <View style={styles.cloneTemplateButtons}>
              <TouchableOpacity
                style={styles.cloneTemplateCancelButton}
                onPress={cancelCloneTemplate}
              >
                <Text style={styles.cloneTemplateCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cloneTemplateConfirmButton}
                onPress={confirmCloneTemplate}
              >
                <Text style={styles.cloneTemplateConfirmButtonText}>Clone</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Validation Error Modal */}
      <Modal visible={showValidationModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.validationModalContent}>
            <Text style={styles.validationModalTitle}>⚠️ Validation Error</Text>

            <View style={styles.validationModalInfo}>
              <Text style={styles.validationModalMessage}>
                {validationError}
              </Text>
            </View>

            <View style={styles.validationModalButtons}>
              <TouchableOpacity
                style={styles.validationModalOkButton}
                onPress={() => {
                  setShowValidationModal(false);
                  setValidationError('');
                }}
              >
                <Text style={styles.validationModalOkButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Template Creation Success Message Modal */}
      <Modal visible={showSuccessMessage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.templateSuccessModalContent}>
            <Text style={styles.templateSuccessModalTitle}>
              {editingTemplateId ? '✅ Template Updated' : '✅ Template Created'}
            </Text>

            <View style={styles.templateSuccessModalInfo}>
              <Text style={styles.templateSuccessModalMessage}>
                {editingTemplateId 
                  ? "Your template has been updated successfully and is ready to use!"
                  : "Your template has been created successfully and is ready to use!"
                }
              </Text>
            </View>

            <View style={styles.templateSuccessModalButtons}>
              <TouchableOpacity
                style={styles.templateSuccessModalOkButton}
                onPress={() => {
                  setShowSuccessMessage(false);
                  setEditingTemplateId(null);
                }}
              >
                <Text style={styles.templateSuccessModalOkButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Field Confirmation Modal */}
      <Modal visible={showDeleteFieldModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteFieldModalContent}>
            <Text style={styles.deleteFieldModalTitle}>🗑️ Delete Field</Text>

            <View style={styles.deleteFieldModalInfo}>
              <Text style={styles.deleteFieldNameText}>
                "{selectedFieldForDelete?.field.name}"
              </Text>

              <Text style={styles.deleteFieldWarningText}>
                Are you sure you want to delete this field? This action cannot be undone.
              </Text>
            </View>

            <View style={styles.deleteFieldModalButtons}>
              <TouchableOpacity
                style={styles.deleteFieldCancelButton}
                onPress={cancelDeleteField}
              >
                <Text style={styles.deleteFieldCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteFieldConfirmButton}
                onPress={confirmDeleteField}
              >
                <Text style={styles.deleteFieldConfirmButtonText}>Delete</Text>
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
    color: '#4a5568',
    fontStyle: 'italic',
    flex: 1,
    marginRight: 8,
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
  templateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateDescriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateSecondaryActions: {
    flexDirection: 'column',
    gap: 4,
    marginLeft: 8,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 6,
  },
  templateActionsContainer: {
    flexDirection: 'column',
    marginTop: 8,
    gap: 6,
  },
  mainActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  cloneActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  useButton: {
    flex: 1,
    backgroundColor: '#38a169',
    paddingVertical: 6,
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
    paddingVertical: 6,
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
    paddingVertical: 6,
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
  cloneButton: {
    backgroundColor: '#9f7aea',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    boxShadow: '0px 1px 2px rgba(159, 122, 234, 0.2)',
    elevation: 2,
    flex: 1,
  },
  cloneButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fc8181',
    paddingVertical: 6,
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
  fieldFormat: {
    fontSize: 12,
    color: '#4a5568',
    fontStyle: 'italic',
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

  viewTemplateModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
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
  dataFileModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  dataFileModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  dataFileInfo: {
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
  },
  dataFileDescription: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  dataFileTemplateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#68d391',
    minWidth: '80%',
    elevation: 3,
  },
  dataFileInputSection: {
    width: '100%',
    marginBottom: 25,
  },
  dataFileInputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  dataFileInput: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    width: '100%',
  },
  dataFileButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  dataFileCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    minWidth: 100,
  },
  dataFileCancelButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '500',
  },
  dataFileCreateButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  dataFileCreateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  dataFileHint: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 20,
  },
  dataFilePreview: {
    fontSize: 13,
    color: '#4a5568',
    fontStyle: 'italic',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    textAlign: 'center',
  },
  validationModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.25)',
  },
  validationModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  validationModalInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  validationModalMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fed7d7',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fc8181',
    minWidth: '80%',
  },
  validationModalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  validationModalOkButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  validationModalOkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: '#f8fafafc',
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
  compactPositionContainer: {
    backgroundColor: 'white',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    width: '100%',
  },
  compactPositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactFieldName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
    marginRight: 8,
    lineHeight: 14,
  },
  compactDropdownContainer: {
    width: 60,
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 4,
    backgroundColor: 'white',
    justifyContent: 'center',
    minHeight: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
    position: 'relative',
  },
  compactPositionDropdown: {
    height: 28,
    width: '100%',
    color: '#2d3748',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  compactDropdownItem: {
    fontSize: 13,
    color: '#2d3748',
    textAlign: 'center',
    height: 28,
    fontWeight: '600',
  },
  compactDropdownDisplayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  compactDropdownDisplayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
  },
  noFieldsText: {
    fontSize: 13,
    color: '#a0aec0',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
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
    marginBottom: 0,
  },
  inputModeDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 16,
  },
   inputModeSection: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputModeSectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  inputModePickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: '#ffffff',
    minHeight: 60,
  },
  inputModePicker: {
    height: 60,
    width: '100%',
  },
  inputModePickerItem: {
    fontSize: 16,
    color: '#2d3748',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#2d3748',
    flex: 1,
  },
  datePickerIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  clearDateButton: {
    backgroundColor: '#e53e3e',
        paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  clearDateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  customFormatSection: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  customFormatLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 6,
  },
  customFormatInput: {
    marginBottom: 8,
  },
  formatHint: {
    fontSize: 12,
    color: '#718096',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  dateFormatSection: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateFormatPickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: '#ffffff',
    minHeight: 60,
  },
  dateFormatPicker: {
    height: 60,
    width: '100%',
  },
  cloneTemplateModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  cloneTemplateModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  cloneTemplateInfo: {
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
  },
  cloneTemplateDescription: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  cloneTemplateOriginalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#9f7aea',
    minWidth: '80%',
    elevation: 3,
  },
  cloneTemplateInputSection: {
    width: '100%',
    marginBottom: 25,
  },
  cloneTemplateInputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  cloneTemplateInput: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    width: '100%',
  },
  cloneTemplateButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  cloneTemplateCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    minWidth: 100,
  },
  cloneTemplateCancelButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '500',
  },
  cloneTemplateConfirmButton: {
    backgroundColor: '#9f7aea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cloneTemplateConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successMessageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1000,
  },
  successMessageContainer: {
    backgroundColor: '#f0fff4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#68d391',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.25)',
    elevation: 6,
  },
  successMessageText: {
    color: '#2f855a',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteFieldModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  deleteFieldModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  deleteFieldModalInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  deleteFieldNameText: {
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
    elevation: 3,
  },
  deleteFieldWarningText: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteFieldModalButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  deleteFieldCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    minWidth: 80,
  },
  deleteFieldCancelButtonText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteFieldConfirmButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  deleteFieldConfirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  // New styles for template creation success modal
  templateSuccessModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f8ff',
  },
  templateSuccessModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  templateSuccessModalInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  templateSuccessModalMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0fff4',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#68d391',
    minWidth: '80%',
  },
  templateSuccessModalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  templateSuccessModalOkButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  templateSuccessModalOkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Added styles for protected badge
  protectedBadge: {
    backgroundColor: '#a0aec0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  protectedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});