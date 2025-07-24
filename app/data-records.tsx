
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, FlatList, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface DataRecord {
  id: string;
  templateId: string;
  templateName: string;
  data: { [fieldId: string]: string };
  timestamp: Date;
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

export default function DataRecordsScreen() {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');

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

  const getFilteredRecords = () => {
    if (selectedTemplate === 'all') {
      return records;
    }
    return records.filter(record => record.templateId === selectedTemplate);
  };

  const exportToCSV = async () => {
    try {
      const filteredRecords = getFilteredRecords();
      
      if (filteredRecords.length === 0) {
        Alert.alert('No Data', 'No records to export');
        return;
      }

      // Get all unique field names from the selected records
      const allFieldNames = new Set<string>();
      filteredRecords.forEach(record => {
        Object.keys(record.data).forEach(fieldId => {
          // Find the field name from template
          const template = templates.find(t => t.id === record.templateId);
          const field = template?.fields.find(f => f.id === fieldId);
          if (field) {
            allFieldNames.add(field.name);
          }
        });
      });

      // Create CSV header
      const headers = ['Template', 'Timestamp', ...Array.from(allFieldNames)];
      let csvContent = headers.join(',') + '\n';

      // Add data rows
      filteredRecords.forEach(record => {
        const template = templates.find(t => t.id === record.templateId);
        const row = [
          `"${record.templateName}"`,
          `"${record.timestamp.toISOString()}"`,
          ...Array.from(allFieldNames).map(fieldName => {
            const field = template?.fields.find(f => f.name === fieldName);
            const value = field ? record.data[field.id] || '' : '';
            return `"${value.replace(/"/g, '""')}"`;
          })
        ];
        csvContent += row.join(',') + '\n';
      });

      // Save CSV file
      const fileName = selectedTemplate === 'all' 
        ? 'all_data_records.csv' 
        : `${templates.find(t => t.id === selectedTemplate)?.name || 'template'}_records.csv`;
      
      const filePath = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(filePath, csvContent);

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Data Records',
        });
      } else {
        Alert.alert('Export Complete', `CSV file saved as ${fileName}`);
      }

    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export CSV');
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

  const clearAllRecords = () => {
    Alert.alert(
      'Clear All Records',
      'Are you sure you want to delete all data records? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify([]));
              setRecords([]);
              Alert.alert('Success', 'All records cleared');
            } catch (error) {
              console.error('Error clearing records:', error);
              Alert.alert('Error', 'Failed to clear records');
            }
          }
        }
      ]
    );
  };

  const renderRecord = ({ item }: { item: DataRecord }) => {
    const template = templates.find(t => t.id === item.templateId);
    
    return (
      <View style={styles.recordItem}>
        <View style={styles.recordHeader}>
          <Text style={styles.templateName}>{item.templateName}</Text>
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString()}
          </Text>
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
        
        <TouchableOpacity
          style={styles.deleteRecordButton}
          onPress={() => deleteRecord(item.id)}
        >
          <Text style={styles.deleteRecordText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const filteredRecords = getFilteredRecords();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Data Records</ThemedText>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Total Records: {filteredRecords.length}
        </Text>
      </View>

      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter by Template:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterButton, selectedTemplate === 'all' && styles.activeFilter]}
            onPress={() => setSelectedTemplate('all')}
          >
            <Text style={[styles.filterText, selectedTemplate === 'all' && styles.activeFilterText]}>
              All Templates
            </Text>
          </TouchableOpacity>
          
          {templates.map(template => (
            <TouchableOpacity
              key={template.id}
              style={[styles.filterButton, selectedTemplate === template.id && styles.activeFilter]}
              onPress={() => setSelectedTemplate(template.id)}
            >
              <Text style={[styles.filterText, selectedTemplate === template.id && styles.activeFilterText]}>
                {template.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.exportButton} onPress={exportToCSV}>
          <Text style={styles.exportButtonText}>📊 Export to CSV</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.clearButton} onPress={clearAllRecords}>
          <Text style={styles.clearButtonText}>🗑️ Clear All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredRecords}
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
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#2d3748',
  },
  statsContainer: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5282',
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    backgroundColor: '#f7fafc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeFilter: {
    backgroundColor: '#4299e1',
    borderColor: '#4299e1',
  },
  filterText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  activeFilterText: {
    color: 'white',
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    gap: 10,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#48bb78',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#e53e3e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recordsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  recordItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#718096',
  },
  recordData: {
    maxHeight: 120,
    marginBottom: 10,
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    width: 100,
    flexShrink: 0,
  },
  fieldValue: {
    fontSize: 14,
    color: '#2d3748',
    flex: 1,
    flexWrap: 'wrap',
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
