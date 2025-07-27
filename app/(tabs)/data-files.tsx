
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, FlatList, ScrollView, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
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
  csvExportSettings?: CSVExportSettings;
}

interface TemplateField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  dateFormat?: string;
  customDateFormat?: string;
}

interface FileGroup {
  fileName: string;
  records: DataRecord[];
  totalRecords: number;
}

interface CSVExportSettings {
  includeHeader: boolean;
  delimiter: 'comma' | 'semicolon' | 'pipe' | 'custom';
  customDelimiter?: string;
  fieldPositions: { [fieldId: string]: number };
  fileExtension: string;
}

export default function DataFilesScreen() {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';
  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    groupRecordsByFile();
  }, [records]);

  // Reload data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

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
        setRecords(loadedRecords.sort((a: DataRecord, b: DataRecord) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        ));
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

  const groupRecordsByFile = () => {
    const groups: { [fileName: string]: DataRecord[] } = {};
    
    records.forEach(record => {
      const fileName = record.dataFileName || 'Unnamed File';
      if (!groups[fileName]) {
        groups[fileName] = [];
      }
      groups[fileName].push(record);
    });

    const fileGroupsArray = Object.entries(groups).map(([fileName, groupRecords]) => ({
      fileName,
      records: groupRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      totalRecords: groupRecords.length
    }));

    // Sort file groups by most recent record in each group
    fileGroupsArray.sort((a, b) => {
      const aLatest = a.records[0]?.timestamp.getTime() || 0;
      const bLatest = b.records[0]?.timestamp.getTime() || 0;
      return bLatest - aLatest;
    });

    setFileGroups(fileGroupsArray);
  };

  // Format date according to template field settings
  const formatDateForExport = (dateValue: string, field: TemplateField): string => {
    if (!dateValue || (field.type !== 'date' && field.type !== 'fixed_date')) {
      return dateValue;
    }

    try {
      // Parse the stored date (always in YYYY-MM-DD format)
      const dateParts = dateValue.split('-');
      if (dateParts.length !== 3) return dateValue;
      
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const day = parseInt(dateParts[2]);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) return dateValue;

      // Format according to field's date format
      const dateFormat = field.dateFormat || 'yyyy-MM-dd';
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const yearStr = String(year);

      switch (dateFormat) {
        case 'dd/MM/yyyy':
          return `${dayStr}/${monthStr}/${yearStr}`;
        case 'MM/dd/yyyy':
          return `${monthStr}/${dayStr}/${yearStr}`;
        case 'yyyyMMdd':
          return `${yearStr}${monthStr}${dayStr}`;
        case 'dd-MM-yyyy':
          return `${dayStr}-${monthStr}-${yearStr}`;
        case 'yyyy.MM.dd':
          return `${yearStr}.${monthStr}.${dayStr}`;
        case 'custom':
          // Handle custom date format
          if (field.customDateFormat) {
            let customFormat = field.customDateFormat;
            customFormat = customFormat.replace(/yyyy/g, yearStr);
            customFormat = customFormat.replace(/MM/g, monthStr);
            customFormat = customFormat.replace(/dd/g, dayStr);
            return customFormat;
          }
          return dateValue;
        default:
          // Default YYYY-MM-DD format
          return dateValue;
      }
    } catch (error) {
      console.error('Error formatting date for export:', error);
      return dateValue;
    }
  };

  const exportFileGroupToCSV = async (fileGroup: FileGroup) => {
    try {
      if (fileGroup.records.length === 0) {
        Alert.alert('No Data', 'No records to export for this file');
        return;
      }

      // Get the template from the first record (all records in a file use the same template)
      const firstRecord = fileGroup.records[0];
      const template = templates.find(t => t.id === firstRecord.templateId);
      
      if (!template) {
        Alert.alert('Error', 'Template not found for this file');
        return;
      }

      // Get CSV export settings from template
      const csvSettings = template.csvExportSettings || {
        includeHeader: false,
        delimiter: 'comma',
        customDelimiter: '',
        fieldPositions: {},
        fileExtension: 'csv'
      };

      // Get delimiter symbol
      const getDelimiterSymbol = (delimiter: string, customDelimiter?: string) => {
        switch (delimiter) {
          case 'comma': return ',';
          case 'semicolon': return ';';
          case 'pipe': return '|';
          case 'custom': return customDelimiter || ',';
          default: return ',';
        }
      };

      const delimiter = getDelimiterSymbol(csvSettings.delimiter, csvSettings.customDelimiter);

      // Sort fields by their position (fields without position go to the end)
      const fieldsWithPosition = template.fields
        .map(field => ({
          ...field,
          position: csvSettings.fieldPositions[field.id] || 999
        }))
        .sort((a, b) => a.position - b.position);

      let csvContent = '';

      // Add header if configured
      if (csvSettings.includeHeader) {
        const headers = fieldsWithPosition.map(field => `"${field.name}"`);
        csvContent += headers.join(delimiter) + '\n';
      }

      // Add data rows
      fileGroup.records.forEach(record => {
        const row = fieldsWithPosition.map(field => {
          let value = record.data[field.id] || '';
          
          // Format date fields according to template settings
          if ((field.type === 'date' || field.type === 'fixed_date') && value) {
            value = formatDateForExport(value, field);
          }
          
          return `"${value.replace(/"/g, '""')}"`;
        });
        csvContent += row.join(delimiter) + '\n';
      });

      // Use template's file extension
      const fileExtension = csvSettings.fileExtension || 'csv';
      const fileName = `${fileGroup.fileName}_export.${fileExtension}`;
      const filePath = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(filePath, csvContent);

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: fileExtension === 'csv' ? 'text/csv' : 'text/plain',
          dialogTitle: 'Export File Group Data',
        });
      } else {
        Alert.alert('Export Complete', `File saved as ${fileName}`);
      }

    } catch (error) {
      console.error('Error exporting file:', error);
      Alert.alert('Error', 'Failed to export file');
    }
  };

  const deleteRecord = (recordId: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedRecords = records.filter(r => r.id !== recordId);
              await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));
              setRecords(updatedRecords);
            } catch (error) {
              console.error('Error deleting record:', error);
              Alert.alert('Error', 'Failed to delete record');
            }
          }
        }
      ]
    );
  };

  

  const deleteFileGroup = (fileName: string) => {
    setFileToDelete(fileName);
    setShowDeleteModal(true);
  };

  const confirmDeleteFile = async () => {
    if (fileToDelete) {
      try {
        const updatedRecords = records.filter(r => (r.dataFileName || 'Unnamed File') !== fileToDelete);
        await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));
        setRecords(updatedRecords);
        setShowDeleteModal(false);
        setFileToDelete(null);
        
        // Show success message
        setShowSuccessMessage(true);
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 800);
      } catch (error) {
        console.error('Error deleting file:', error);
        Alert.alert('Error', 'Failed to delete file');
      }
    }
  };

  const cancelDeleteFile = () => {
    setShowDeleteModal(false);
    setFileToDelete(null);
  };

  const viewFileDetails = (fileGroup: FileGroup) => {
    router.push({
      pathname: '/file-details',
      params: { fileName: fileGroup.fileName }
    });
  };

  const renderFileGroup = ({ item }: { item: FileGroup }) => {
    return (
      <View style={styles.fileGroupContainer}>
        <View style={styles.fileGroupHeader}>
          <Text style={styles.fileGroupName}>📁 {item.fileName}</Text>
          <Text style={styles.fileGroupCount}>{item.totalRecords} records</Text>
        </View>
        
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => viewFileDetails(item)}
          >
            <Text style={styles.viewButtonText}>👁️ View</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.deleteFileButton}
            onPress={() => deleteFileGroup(item.fileName)}
          >
            <Text style={styles.deleteFileButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.exportFileButton}
            onPress={() => exportFileGroupToCSV(item)}
          >
            <Text style={styles.exportFileButtonText}>📊 Export</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Files</ThemedText>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Total Files: {fileGroups.length}
        </Text>
      </View>

      

      <FlatList
        data={fileGroups}
        renderItem={renderFileGroup}
        keyExtractor={(item) => item.fileName}
        style={styles.fileGroupsList}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={loadData}
      />

      {/* Delete File Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>🗑️ Delete File</Text>

            <View style={styles.deleteModalInfo}>
              <Text style={styles.deleteModalMessage}>
                Are you sure you want to delete this file?
              </Text>
              <Text style={styles.deleteModalFileName}>
                "{fileToDelete}"
              </Text>
              <Text style={styles.deleteModalWarning}>
                This action cannot be undone. All data records in this file will be permanently deleted.
              </Text>
            </View>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={cancelDeleteFile}
              >
                <Text style={styles.deleteModalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                onPress={confirmDeleteFile}
              >
                <Text style={styles.deleteModalConfirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Message Overlay */}
      {showSuccessMessage && (
        <View style={styles.successMessageOverlay}>
          <View style={styles.successMessageContainer}>
            <Text style={styles.successMessageText}>✓ File deleted successfully</Text>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingBottom: 130,
    backgroundColor: '#ffffff',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 40,
    color: '#000000',
  },
  statsContainer: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5282',
  },
  
  fileGroupsList: {
    flex: 1,
  },
  fileGroupContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  fileGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e0',
  },
  fileGroupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  fileGroupCount: {
    fontSize: 14,
    color: '#4a5568',
    backgroundColor: '#edf2f7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  viewButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteFileButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
  },
  deleteFileButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  exportFileButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
  },
  exportFileButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
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
  deleteModalFileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fc8181',
    minWidth: '80%',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  successMessageText: {
    color: '#2f855a',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
