import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, FlatList, Modal, TextInput, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
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

interface Template {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
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
    setShowFieldModal(false);
    setCurrentField({});
    setEditingFieldIndex(null);
  };

  const removeField = (index: number) => {
    const updatedFields = templateFields.filter((_, i) => i !== index);
    setTemplateFields(updatedFields);
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

    let updatedTemplates;
    if (editingTemplateId) {
      // Edit existing template
      updatedTemplates = templates.map(template => 
        template.id === editingTemplateId 
          ? {
              ...template,
              name: newTemplateName.trim(),
              fields: templateFields,
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
    Alert.alert(
      template.name,
      `Description: ${template.description || 'No description'}\n\nFields (${template.fields.length}):\n${template.fields.map(f => `• ${f.name} (${fieldTypes.find(t => t.value === f.type)?.label})`).join('\n')}`,
      [{ text: 'Close', style: 'cancel' }]
    );
  };

  const editTemplate = (template: Template) => {
    setNewTemplateName(template.name);
    setTemplateFields([...template.fields]);
    setEditingTemplateId(template.id);
    setShowTemplateModal(true);
  };

  const deleteTemplate = (templateId: string) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedTemplates = templates.filter(t => t.id !== templateId);
            setTemplates(updatedTemplates);
            saveTemplates(updatedTemplates);
          }
        }
      ]
    );
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

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Templates: {templates.length}</Text>
        <Text style={styles.statsText}>Total Fields: {templates.reduce((sum, t) => sum + t.fields.length, 0)}</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.templateButton} 
          onPress={createTemplate}
        >
          <Text style={styles.buttonText}>Create Template</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.templatesContainer}>
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
      </View>

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

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setNewTemplateName('');
                    setTemplateFields([]);
                    setEditingTemplateId(null);
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
                  <Text style={styles.checkboxText}>
                    {currentField.required ? '☑' : '☐'} Required Field
                  </Text>
                </TouchableOpacity>
              </View>

              {(currentField.type === 'free_text' || currentField.type === 'number') && (
                <TextInput
                  style={styles.input}
                  placeholder="Default value (optional)"
                  value={currentField.defaultValue || ''}
                  onChangeText={(text) => setCurrentField({ ...currentField, defaultValue: text })}
                  keyboardType={currentField.type === 'number' ? 'numeric' : 'default'}
                />
              )}

              {currentField.type === 'fixed_date' && (
                <TextInput
                  style={styles.input}
                  placeholder="Fixed date (YYYY-MM-DD)"
                  value={currentField.defaultValue || ''}
                  onChangeText={(text) => setCurrentField({ ...currentField, defaultValue: text })}
                />
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
  templatesContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 4,
    marginVertical: 8,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    gap: 8,
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
  },
  checkboxText: {
    fontSize: 16,
    color: '#2d3748',
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
});