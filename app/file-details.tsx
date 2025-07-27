
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ScrollView } from 'react-native';
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

  const DATA_RECORDS_FILE = FileSystem.documentDirectory + 'dataRecords.json';
  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (records.length > 0 && fileName) {
      const filteredRecords = records.filter(record => 
        (record.dataFileName || 'Unnamed File') === fileName
      );
      setFileRecords(filteredRecords.sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      ));
    }
  }, [records, fileName]);

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
        <Text style={styles.recordCount}>{fileRecords.length} records</Text>
      </View>

      <FlatList
        data={fileRecords}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        style={styles.recordsList}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No records found in this file.</Text>
          </View>
        }
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
    fontSize: 14,
    color: '#4a5568',
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
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
});
