
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, FlatList, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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

interface FileGroup {
  fileName: string;
  records: DataRecord[];
  totalRecords: number;
}

export default function DataFilesScreen() {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);

  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';
  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    groupRecordsByFile();
  }, [records]);

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

  const exportFileGroupToCSV = async (fileGroup: FileGroup) => {
    try {
      if (fileGroup.records.length === 0) {
        Alert.alert('No Data', 'No records to export for this file');
        return;
      }

      // Get all unique field names from the file group records
      const allFieldNames = new Set<string>();
      fileGroup.records.forEach(record => {
        Object.keys(record.data).forEach(fieldId => {
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
      fileGroup.records.forEach(record => {
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
      const fileName = `${fileGroup.fileName}_export.csv`;
      const filePath = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(filePath, csvContent);

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export File Group Data',
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

  const renderFileGroup = ({ item }: { item: FileGroup }) => {
    return (
      <View style={styles.fileGroupContainer}>
        <View style={styles.fileGroupHeader}>
          <Text style={styles.fileGroupName}>📁 {item.fileName}</Text>
          <Text style={styles.fileGroupCount}>{item.totalRecords} records</Text>
        </View>
        
        <TouchableOpacity
          style={styles.exportFileButton}
          onPress={() => exportFileGroupToCSV(item)}
        >
          <Text style={styles.exportFileButtonText}>📊 Export File to CSV</Text>
        </TouchableOpacity>

        <FlatList
          data={item.records}
          renderItem={renderRecord}
          keyExtractor={(record) => record.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Files</ThemedText>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Total Files: {fileGroups.length} | Total Records: {records.length}
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.clearButton} onPress={clearAllRecords}>
          <Text style={styles.clearButtonText}>🗑️ Clear All Records</Text>
        </TouchableOpacity>
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
  actionContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 200,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
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
  exportFileButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
    alignSelf: 'flex-end',
  },
  exportFileButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
