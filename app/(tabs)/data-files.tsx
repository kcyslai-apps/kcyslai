
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

  

  const deleteFileGroup = (fileName: string) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${fileName}" and all its data records?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedRecords = records.filter(r => (r.dataFileName || 'Unnamed File') !== fileName);
              await FileSystem.writeAsStringAsync(DATA_RECORDS_FILE, JSON.stringify(updatedRecords));
              setRecords(updatedRecords);
              Alert.alert('Success', 'File deleted successfully');
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert('Error', 'Failed to delete file');
            }
          }
        }
      ]
    );
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
            <Text style={styles.exportFileButtonText}>📊 Export File</Text>
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
});
