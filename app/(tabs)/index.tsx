
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
  type: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  options?: string[]; // for select type
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
    type: 'text',
    required: false
  });

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
    if (!newTemplate.name || !newTemplate.description || !newTemplate.fields?.length) {
      Alert.alert('Error', 'Please fill in all fields and add at least one template field');
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

    const field: TemplateField = {
      id: Date.now().toString(),
      name: newField.name,
      type: newField.type || 'text',
      required: newField.required || false,
      options: newField.options
    };

    setNewTemplate(prev => ({
      ...prev,
      fields: [...(prev.fields || []), field]
    }));

    setNewField({ name: '', type: 'text', required: false });
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
              <TouchableOpacity style={styles.addFieldButton} onPress={addField}>
                <Text style={styles.addFieldText}>Add</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={newTemplate.fields}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.fieldItem}>
                  <Text style={styles.fieldName}>{item.name} ({item.type})</Text>
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
    flexDirection: 'row',
    marginBottom: 15,
  },
  fieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
  },
  addFieldButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addFieldText: {
    color: 'white',
    fontWeight: 'bold',
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    marginBottom: 5,
  },
  fieldName: {
    flex: 1,
  },
  removeFieldText: {
    color: '#FF3B30',
  },
});
