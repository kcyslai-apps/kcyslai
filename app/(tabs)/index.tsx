
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, FlatList, TextInput, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';

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

  const handleTouchMove = (event: any, index: number) => {
    const { locationY } = event.nativeEvent;
    // Check if finger is still within the option bounds
    if (locationY >= 0 && locationY <= 50) { // Assuming each option is ~50 points tall
      setHoveredOptionIndex(index);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

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

    const template: Template = {
      id: Date.now().toString(),
      name: newTemplate.name,
      description: '', // Set empty description since we removed the field
      fields: newTemplate.fields as TemplateField[],
      createdAt: new Date().toISOString()
    };

    const updatedTemplates = [...templates, template];
    setTemplates(updatedTemplates);
    await saveTemplates(updatedTemplates);
    
    setNewTemplate({ name: '', description: '', fields: [] });
    setShowCreateModal(false);
    Alert.alert('Success', 'Template created successfully');
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
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTemplate(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
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
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>Create Template</Text>
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
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
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
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
  deleteButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    boxShadow: '0 2px 4px rgba(255, 107, 107, 0.3)',
    elevation: 3,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
    color: '#000000',
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
    color: '#000000',
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 8,
    zIndex: 1001,
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
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
});
