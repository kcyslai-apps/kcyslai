
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, FlatList, TextInput, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

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
    if (!newTemplate.name?.trim() || !newTemplate.description?.trim()) {
      Alert.alert('Error', 'Please fill in template name and description');
      return;
    }

    if (!newTemplate.fields || newTemplate.fields.length === 0) {
      Alert.alert('Error', 'Please add at least one template field');
      return;
    }

    const template: Template = {
      id: Date.now().toString(),
      name: newTemplate.name,
      description: newTemplate.description,
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
        <ThemedText style={styles.templateName}>{item.name}</ThemedText>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTemplate(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <ThemedText style={styles.templateDescription}>{item.description}</ThemedText>
      <ThemedText style={styles.templateFields}>
        Fields: {item.fields.map(f => f.name).join(', ')}
      </ThemedText>
      <ThemedText style={styles.templateDate}>
        Created: {new Date(item.createdAt).toLocaleDateString()}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Templates</ThemedText>
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
          <ThemedText style={styles.emptyText}>No templates created yet</ThemedText>
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
            <ThemedText type="subtitle">Create Template</ThemedText>
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
            
            <TextInput
              style={styles.input}
              placeholder="Template Description"
              value={newTemplate.description}
              onChangeText={(text) => setNewTemplate(prev => ({ ...prev, description: text }))}
              multiline
            />

            <ThemedText style={styles.sectionTitle}>Fields</ThemedText>
            
            <View style={styles.fieldInputContainer}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Field Name"
                value={newField.name}
                onChangeText={(text) => setNewField(prev => ({ ...prev, name: text }))}
              />
            </View>

            <View style={styles.fieldTypeContainer}>
              <ThemedText style={styles.fieldTypeLabel}>Field Type:</ThemedText>
              <View style={styles.fieldTypeButtons}>
                {[
                  { key: 'freetext', label: 'Free Text' },
                  { key: 'number', label: 'Number' },
                  { key: 'date', label: 'Date' },
                  { key: 'fixeddata', label: 'Fixed Data' },
                  { key: 'fixeddate', label: 'Fixed Date' },
                  { key: 'barcode', label: 'Barcode' }
                ].map((typeOption) => (
                  <TouchableOpacity
                    key={typeOption.key}
                    style={[
                      styles.typeButton,
                      newField.type === typeOption.key && styles.typeButtonSelected
                    ]}
                    onPress={() => setNewField(prev => ({ ...prev, type: typeOption.key as any }))}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      newField.type === typeOption.key && styles.typeButtonTextSelected
                    ]}>
                      {typeOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    flex: 1,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  templateItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
  },
  templateDescription: {
    fontSize: 14,
    marginBottom: 5,
  },
  templateFields: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 5,
  },
  templateDate: {
    fontSize: 12,
    opacity: 0.5,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cancelText: {
    color: '#007AFF',
    fontSize: 16,
  },
  saveText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  fieldInputContainer: {
    marginBottom: 15,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  fieldTypeContainer: {
    marginBottom: 15,
  },
  fieldTypeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  fieldTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
  },
  typeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#333',
  },
  typeButtonTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  addFieldButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  addFieldText: {
    color: 'white',
    fontWeight: 'bold',
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    marginBottom: 8,
  },
  fieldDetails: {
    flex: 1,
  },
  fieldName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  fieldType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  fieldOptions: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  removeFieldText: {
    color: '#FF3B30',
  },
});
