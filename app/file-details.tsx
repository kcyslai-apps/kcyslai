import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ScrollView, Alert, TextInput, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface DataRecord {
  id: string;
  templateId: string;
  templateName: string;
  data: { [fieldId: string]: string };
  timestamp: Date;
  dataFileName?: string;
  preservedTemplateFields?: TemplateField[];
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
  const [showMissingTemplateModal, setShowMissingTemplateModal] = useState(false);


  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';
  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when the screen comes into focus (e.g., returning from data entry)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

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
        let template = templates.find(t => t.id === record.templateId);

        // Use preserved template fields if original template is deleted
        if (!template && record.preservedTemplateFields) {
          template = {
            id: record.templateId,
            name: record.templateName,
            description: 'Deleted Template',
            fields: record.preservedTemplateFields,
            createdAt: new Date()
          };
        }

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

  const closeMissingTemplateModal = () => {
    setShowMissingTemplateModal(false);
  };

  const renderRecord = ({ item }: { item: DataRecord }) => {
    let template = templates.find(t => t.id === item.templateId);
    let isTemplateDeleted = false;

    // If template not found but record has preserved template fields, use those
    if (!template && item.preservedTemplateFields) {
      template = {
        id: item.templateId,
        name: item.templateName,
        description: 'Deleted Template',
        fields: item.preservedTemplateFields,
        createdAt: new Date()
      };
      isTemplateDeleted = true;
    }

    return (
      <View style={styles.recordItem}>
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <Text style={styles.inputTimeLabel}>
              Input Time: {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString()}
            </Text>
          </View>
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

  const hasDeletedTemplate = fileRecords.length > 0 && fileRecords.some(record => {
    const template = templates.find(t => t.id === record.templateId);
    return !template && record.preservedTemplateFields;
  });

  return (
    <ThemedView style={styles.container}>
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

      {/* Missing Template Modal */}
      <Modal visible={showMissingTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.missingTemplateModalContent}>
            <Text style={styles.missingTemplateModalTitle}>⚠️ Missing Template ID</Text>

            <View style={styles.missingTemplateModalInfo}>
              <Text style={styles.missingTemplateModalMessage}>
                The original template used for this file has been deleted or is missing.
              </Text>
              <Text style={styles.missingTemplateModalWarning}>
                Cannot continue input without the original template.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.missingTemplateModalButton}
              onPress={closeMissingTemplateModal}
            >
              <Text style={styles.missingTemplateModalButtonText}>OK</Text>
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
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
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
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recordHeaderLeft: {
    flex: 1,
    marginRight: 8,
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
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
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
  missingTemplateModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    borderWidth: 2,
    borderColor: '#fbb6ce',
  },
  missingTemplateModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#2d3748',
    textAlign: 'center',
  },
  missingTemplateModalInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  missingTemplateModalMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 15,
  },
  missingTemplateModalWarning: {
    fontSize: 14,
    color: '#e53e3e',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  missingTemplateModalButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  missingTemplateModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deletedTemplateIndicator: {
    fontSize: 11,
    color: '#e53e3e',
    fontStyle: 'italic',
    marginRight: 8,
    backgroundColor: '#fed7d7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deletedTemplateWarning: {
    fontSize: 14,
    color: '#e53e3e',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 8,
  },
});