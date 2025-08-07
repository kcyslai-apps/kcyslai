
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
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
  preservedTemplateFields?: TemplateField[];
  preservedCsvSettings?: CSVExportSettings;
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

interface CSVExportSettings {
  includeHeader: boolean;
  delimiter: 'comma' | 'semicolon' | 'pipe' | 'custom';
  customDelimiter?: string;
  fieldPositions: { [fieldId: string]: number };
  fileExtension: string;
  includeQuotes: boolean;
}

export default function FileDetailsScreen() {
  const { fileName } = useLocalSearchParams();
  const [fileRecords, setFileRecords] = useState<DataRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';
  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadData();
  }, []);

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
        
        // Filter records for this specific file
        const filteredRecords = loadedRecords.filter(
          (record: DataRecord) => (record.dataFileName || 'Unnamed File') === fileName
        );
        
        setFileRecords(filteredRecords.sort((a: DataRecord, b: DataRecord) => 
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
              // Load all records
              const fileExists = await FileSystem.getInfoAsync(DATA_RECORDS_FILE);
              if (fileExists.exists) {
                const content = await FileSystem.readAsStringAsync(DATA_RECORDS_FILE);
                const allRecords = JSON.parse(content);
                
                // Remove the specific record
                const updatedRecords = allRecords.filter((r: any) => r.id !== recordId);
                await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));
                
                // Reload data
                loadData();
              }
            } catch (error) {
              console.error('Error deleting record:', error);
              Alert.alert('Error', 'Failed to delete record');
            }
          }
        }
      ]
    );
  };

  const renderRecord = ({ item }: { item: DataRecord }) => {
    let template = templates.find(t => t.id === item.templateId);
    let isTemplateDeleted = false;

    if (!template && item.preservedTemplateFields) {
      template = {
        id: item.templateId,
        name: item.templateName,
        description: '',
        fields: item.preservedTemplateFields,
        createdAt: new Date()
      };
      isTemplateDeleted = true;
    }

    return (
      <View style={styles.recordItem}>
        <View style={styles.recordHeader}>
          <Text style={styles.recordTemplate}>
            {isTemplateDeleted ? '⚠️ ' : '📋 '}{template?.name || 'Unknown Template'}
          </Text>
          <Text style={styles.recordTime}>
            {item.timestamp.toLocaleString()}
          </Text>
        </View>
        
        <View style={styles.recordData}>
          {template?.fields.map(field => (
            <View key={field.id} style={styles.dataField}>
              <Text style={styles.fieldName}>{field.name}:</Text>
              <Text style={styles.fieldValue}>
                {item.data[field.id] || '-'}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.deleteRecordButton}
          onPress={() => deleteRecord(item.id)}
        >
          <Text style={styles.deleteRecordText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const hasDeletedTemplate = fileRecords.length > 0 && fileRecords.some(record => {
    const template = templates.find(t => t.id === record.templateId);
    return !template && record.preservedTemplateFields;
  });

  return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>📁 {fileName}</Text>
        <Text style={styles.recordCount}>
          Total Records: {fileRecords.length}
        </Text>
        {hasDeletedTemplate && (
          <Text style={styles.deletedTemplateWarning}>⚠️ Template Deleted</Text>
        )}
      </View>

      <FlatList
        data={fileRecords}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        style={styles.recordsList}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={loadData}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4299e1',
    fontWeight: 'bold',
  },
  
  fileInfo: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  fileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 5,
  },
  recordCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5282',
  },
  deletedTemplateWarning: {
    fontSize: 12,
    color: '#e53e3e',
    fontStyle: 'italic',
    marginTop: 2,
  },
  recordsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  recordItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e0',
  },
  recordTemplate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  recordTime: {
    fontSize: 12,
    color: '#718096',
  },
  recordData: {
    gap: 4,
    marginBottom: 10,
  },
  dataField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a5568',
    flex: 1,
  },
  fieldValue: {
    fontSize: 13,
    color: '#2d3748',
    flex: 2,
    textAlign: 'right',
  },
  deleteRecordButton: {
    backgroundColor: '#fed7d7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  deleteRecordText: {
    color: '#e53e3e',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
