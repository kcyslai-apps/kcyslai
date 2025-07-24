
import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, FlatList, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface ScannedItem {
  id: string;
  data: string;
  type: string;
  timestamp: string;
}

export default function DataManagement() {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [stats, setStats] = useState({ total: 0, types: {} as Record<string, number> });

  useEffect(() => {
    loadScannedData();
  }, []);

  const loadScannedData = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + 'scanned_barcodes.csv';
      const fileExists = await FileSystem.getInfoAsync(fileUri);
      
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(fileUri);
        const lines = content.split('\n').filter(line => line.trim());
        const items: ScannedItem[] = [];
        const typeCount: Record<string, number> = {};
        
        for (let i = 1; i < lines.length; i++) {
          const [id, data, type, timestamp] = lines[i].split(',');
          if (id && data && type && timestamp) {
            items.push({ id, data, type, timestamp });
            typeCount[type] = (typeCount[type] || 0) + 1;
          }
        }
        
        setScannedItems(items);
        setStats({ total: items.length, types: typeCount });
      }
    } catch (error) {
      console.error('Error loading scanned data:', error);
    }
  };

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const fileName = `scanned_barcodes.${format}`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      if (format === 'csv') {
        const csvFileUri = FileSystem.documentDirectory + 'scanned_barcodes.csv';
        const fileExists = await FileSystem.getInfoAsync(csvFileUri);
        
        if (!fileExists.exists) {
          Alert.alert('No Data', 'No data to export');
          return;
        }
        
        await Sharing.shareAsync(csvFileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export CSV Data'
        });
      } else {
        const jsonData = JSON.stringify(scannedItems, null, 2);
        await FileSystem.writeAsStringAsync(fileUri, jsonData);
        
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export JSON Data'
        });
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const fileUri = result.assets[0].uri;
        const content = await FileSystem.readAsStringAsync(fileUri);
        
        // Save imported data
        const targetUri = FileSystem.documentDirectory + 'scanned_barcodes.csv';
        await FileSystem.writeAsStringAsync(targetUri, content);
        
        Alert.alert('Success', 'Data imported successfully');
        loadScannedData();
      }
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Error', 'Failed to import data');
    }
  };

  const deleteItem = async (itemId: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedItems = scannedItems.filter(item => item.id !== itemId);
              
              // Recreate CSV file
              let csvContent = 'ID,Data,Type,Timestamp\n';
              updatedItems.forEach(item => {
                csvContent += `${item.id},${item.data},${item.type},${item.timestamp}\n`;
              });
              
              const fileUri = FileSystem.documentDirectory + 'scanned_barcodes.csv';
              await FileSystem.writeAsStringAsync(fileUri, csvContent);
              
              loadScannedData();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Management</ThemedText>
      
      <ThemedView style={styles.statsContainer}>
        <ThemedText type="subtitle">Statistics</ThemedText>
        <ThemedText>Total Items: {stats.total}</ThemedText>
        {Object.entries(stats.types).map(([type, count]) => (
          <ThemedText key={type}>
            {type}: {count} items
          </ThemedText>
        ))}
      </ThemedView>

      <ThemedView style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => exportData('csv')}
        >
          <Text style={styles.buttonText}>Export CSV</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => exportData('json')}
        >
          <Text style={styles.buttonText}>Export JSON</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.importButton}
          onPress={importData}
        >
          <Text style={styles.buttonText}>Import CSV</Text>
        </TouchableOpacity>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.listTitle}>All Scanned Items</ThemedText>
      
      <FlatList
        data={scannedItems}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <ThemedView style={styles.listItem}>
            <ThemedView style={styles.itemContent}>
              <ThemedText style={styles.itemData}>{item.data}</ThemedText>
              <ThemedText style={styles.itemType}>{item.type}</ThemedText>
              <ThemedText style={styles.itemTimestamp}>
                {new Date(item.timestamp).toLocaleString()}
              </ThemedText>
            </ThemedView>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteItem(item.id)}
            >
              <Text style={styles.deleteButtonText}>×</Text>
            </TouchableOpacity>
          </ThemedView>
        )}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No items found</ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  statsContainer: {
    padding: 15,
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  importButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listTitle: {
    marginBottom: 15,
  },
  list: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemData: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  itemType: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 5,
  },
  itemTimestamp: {
    fontSize: 12,
    opacity: 0.5,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    opacity: 0.5,
  },
});
