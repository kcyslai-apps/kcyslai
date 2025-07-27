
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ScrollView, Alert, TextInput, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface DataRecord {
  id: string;
  templateId: string;
  templateName: string;
  data: { [fieldId: string]: string };
  timestamp: Date;
  dataFileName?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  createdAt: Date;
}

interface TemplateField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export default function FileDetailsScreen() {
  const { fileName } = useLocalSearchParams<{ fileName: string }>();
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fileRecords, setFileRecords] = useState<DataRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredRecords, setFilteredRecords] = useState<DataRecord[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [showTemplateNotFoundModal, setShowTemplateNotFoundModal] = useState(false);

  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';
  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (records.length > 0 && fileName) {
      const filtered = records.filter(record => 
        (record.dataFileName || 'Unnamed File') === fileName
      );
      const sorted = filtered.sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      );
      setFileRecords(sorted);
      setFilteredRecords(sorted);
    }
  }, [records, fileName]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRecords(fileRecords);
    } else {
      const filtered = fileRecords.filter(record => {
        const template = templates.find(t => t.id === record.templateId);
        
        // Search in template name
        if (record.templateName.toLowerCase().includes(searchQuery.toLowerCase())) {
          return true;
        }
        
        // Search in all field values
        return Object.entries(record.data).some(([fieldId, value]) => {
          const field = template?.fields.find(f => f.id === fieldId);
          if (!field || !value) return false;
          
          // Search in field name
          if (field.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return true;
          }
          
          // Search in field value
          return value.toLowerCase().includes(searchQuery.toLowerCase());
        });
      });
      
      setFilteredRecords(filtered);
    }
  }, [searchQuery, fileRecords, templates]);

  const loadData = async () => {
    await Promise.all([loadRecords(), loadTemplates()]);
  };

  const loadRecords = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(DATA_RECORDS_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(DATA_RECORDS_FILE);
        const loadedRecords = JSON.parse(content).map((record: any) => ({
          ...record,
          timestamp: new Date(record.timestamp)
        }));
        setRecords(loadedRecords);
      }
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        const loadedTemplates = JSON.parse(content);
        setTemplates(loadedTemplates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const deleteRecord = (recordId: string) => {
    setRecordToDelete(recordId);
    setShowDeleteModal(true);
  };

  const confirmDeleteRecord = async () => {
    if (recordToDelete) {
      try {
        const updatedRecords = records.filter(r => r.id !== recordToDelete);
        await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));
        setRecords(updatedRecords);
        setShowDeleteModal(false);
        setRecordToDelete(null);
      } catch (error) {
        console.error('Error deleting record:', error);
        Alert.alert('Error', 'Failed to delete record');
        setShowDeleteModal(false);
        setRecordToDelete(null);
      }
    }
  };

  const cancelDeleteRecord = () => {
    setShowDeleteModal(false);
    setRecordToDelete(null);
  };

  const continueInput = () => {
    if (fileRecords.length === 0) {
      Alert.alert('No Records', 'Cannot continue input - no records found in this file');
      return;
    }

    // Get the template ID from the first record (all records in a file should use the same template)
    const firstRecord = fileRecords[0];
    const templateExists = templates.find(t => t.id === firstRecord.templateId);

    if (!templateExists) {
      setShowTemplateNotFoundModal(true);
      return;
    }

    // Navigate to data entry with the existing template and file name
    router.push({
      pathname: '/data-entry',
      params: {
        templateId: firstRecord.templateId,
        dataFileName: encodeURIComponent(fileName || 'Unnamed File')
      }
    });
  };

  const closeTemplateNotFoundModal = () => {
    setShowTemplateNotFoundModal(false);
  };

  const renderRecord = ({ item }: { item: DataRecord }) => {
    const template = templates.find(t => t.id === item.templateId);
    
    return (
      <View style={styles.recordItem}>
        <View style={styles.recordHeader}>
          <Text style={styles.inputTimeLabel}>
            Input Time: {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString()}
          </Text>
          <TouchableOpacity
            style={styles.deleteRecordButton}
            onPress={() => deleteRecord(item.id)}
          >
            <Text style={styles.deleteRecordText}>🗑️</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.recordData} showsVerticalScrollIndicator={false}>
          {Object.entries(item.data).map(([fieldId, value]) => {
            const field = template?.fields.find(f => f.id === fieldId);
            if (!field || !value) return null;
            
            return (
              <View key={fieldId} style={styles.dataRow}>
                <Text style={styles.fieldName}>{field.name}:</Text>
                <Text style={styles.fieldValue}>{value}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>File Details</ThemedText>
      </View>

      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>📁 {fileName}</Text>
        <Text style={styles.recordCount}>
          Total Records: {fileRecords.length}
        </Text>
        {fileRecords.length > 0 && (
          <TouchableOpacity
            style={styles.continueInputButton}
            onPress={continueInput}
          >
            <Text style={styles.continueInputButtonText}>🔄 Continue Input</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍 Search entries..."
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredRecords}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        style={styles.recordsList}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery.length > 0 
                ? `No records found matching "${searchQuery}"`
                : "No records found in this file."
              }
            </Text>
          </View>
        }
      />

      {/* Delete Record Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>🗑️ Delete Entry</Text>

            <View style={styles.deleteModalInfo}>
              <Text style={styles.deleteModalMessage}>
                Are you sure you want to delete this entry?
              </Text>
              <Text style={styles.deleteModalWarning}>
                This action cannot be undone. The data record will be permanently deleted.
              </Text>
            </View>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={cancelDeleteRecord}
              >
                <Text style={styles.deleteModalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                onPress={confirmDeleteRecord}
              >
                <Text style={styles.deleteModalConfirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Template Not Found Modal */}
      <Modal visible={showTemplateNotFoundModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.templateNotFoundModalContent}>
            <Text style={styles.templateNotFoundModalTitle}>⚠️ Template Not Available</Text>

            <View style={styles.templateNotFoundModalInfo}>
              <Text style={styles.templateNotFoundModalMessage}>
                Template no longer available. Unable to continue input.
              </Text>
              <Text style={styles.templateNotFoundModalSubMessage}>
                The original template used for this file has been deleted or is missing.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.templateNotFoundModalButton}
              onPress={closeTemplateNotFoundModal}
            >
              <Text style={styles.templateNotFoundModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 50,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
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
    marginRight: 60,
  },
  fileInfo: {
    backgroundColor: '#e8f4f8',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bee3f8',
  },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 3,
    textAlign: 'center',
  },
  recordCount: {
    fontSize: 12,
    color: '#4a5568',
    marginBottom: 8,
  },
  continueInputButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38a169',
    marginTop: 4,
  },
  continueInputButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    marginHorizontal: 12,
    marginBottom: 8,
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#ffffff',
    paddingRight: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 11,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  recordsList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  recordItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  inputTimeLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
    marginRight: 6,
  },
  recordData: {
    marginBottom: 6,
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingHorizontal: 2,
    alignItems: 'flex-start',
  },
  fieldName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a5568',
    width: 80,
    flexShrink: 0,
    marginRight: 6,
  },
  fieldValue: {
    fontSize: 12,
    color: '#2d3748',
    flex: 1,
    lineHeight: 16,
    flexWrap: 'wrap',
  },
  deleteRecordButton: {
    backgroundColor: '#fed7d7',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fc8181',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
    height: 26,
  },
  deleteRecordText: {
    color: '#c53030',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  deleteModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fc8181',
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  deleteModalInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 15,
  },
  deleteModalWarning: {
    fontSize: 14,
    color: '#e53e3e',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  deleteModalCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    minWidth: 80,
  },
  deleteModalCancelButtonText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteModalConfirmButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  deleteModalConfirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  templateNotFoundModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fbb6ce',
  },
  templateNotFoundModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  templateNotFoundModalInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  templateNotFoundModalMessage: {
    fontSize: 16,
    color: '#e53e3e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 15,
    fontWeight: 'bold',
  },
  templateNotFoundModalSubMessage: {
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  templateNotFoundModalButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  templateNotFoundModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
