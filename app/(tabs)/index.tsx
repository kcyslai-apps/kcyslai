
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, FlatList } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface ScannedItem {
  id: string;
  data: string;
  type: string;
  timestamp: string;
}

export default function BarcodeScanner() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
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
        
        // Skip header line if it exists
        for (let i = 1; i < lines.length; i++) {
          const [id, data, type, timestamp] = lines[i].split(',');
          if (id && data && type && timestamp) {
            items.push({ id, data, type, timestamp });
          }
        }
        setScannedItems(items);
      }
    } catch (error) {
      console.error('Error loading scanned data:', error);
    }
  };

  const saveToCSV = async (newItem: ScannedItem) => {
    try {
      const fileUri = FileSystem.documentDirectory + 'scanned_barcodes.csv';
      const fileExists = await FileSystem.getInfoAsync(fileUri);
      
      let csvContent = '';
      
      if (!fileExists.exists) {
        // Create header if file doesn't exist
        csvContent = 'ID,Data,Type,Timestamp\n';
      } else {
        csvContent = await FileSystem.readAsStringAsync(fileUri);
      }
      
      // Append new item
      csvContent += `${newItem.id},${newItem.data},${newItem.type},${newItem.timestamp}\n`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
    } catch (error) {
      console.error('Error saving to CSV:', error);
      Alert.alert('Error', 'Failed to save barcode data');
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setIsScanning(false);
    
    const newItem: ScannedItem = {
      id: Date.now().toString(),
      data,
      type,
      timestamp: new Date().toISOString()
    };
    
    await saveToCSV(newItem);
    setScannedItems(prev => [newItem, ...prev]);
    
    Alert.alert(
      'Barcode Scanned',
      `Type: ${type}\nData: ${data}`,
      [{ text: 'OK', onPress: () => setScanned(false) }]
    );
  };

  const shareCSVFile = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + 'scanned_barcodes.csv';
      const fileExists = await FileSystem.getInfoAsync(fileUri);
      
      if (!fileExists.exists) {
        Alert.alert('No Data', 'No scanned data to share');
        return;
      }
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share Scanned Barcodes'
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const clearData = async () => {
    Alert.alert(
      'Clear Data',
      'Are you sure you want to clear all scanned data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const fileUri = FileSystem.documentDirectory + 'scanned_barcodes.csv';
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
              setScannedItems([]);
            } catch (error) {
              console.error('Error clearing data:', error);
            }
          }
        }
      ]
    );
  };

  if (hasPermission === null) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Requesting camera permission...</ThemedText>
      </ThemedView>
    );
  }

  if (hasPermission === false) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>No access to camera</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {isScanning ? (
        <View style={styles.scannerContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={styles.scanner}
          />
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsScanning(false);
                setScanned(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.mainContent}>
          <ThemedText type="title" style={styles.title}>Barcode Scanner</ThemedText>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setIsScanning(true)}
            >
              <Text style={styles.buttonText}>Start Scanning</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shareButton}
              onPress={shareCSVFile}
            >
              <Text style={styles.buttonText}>Share CSV File</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearData}
            >
              <Text style={styles.buttonText}>Clear Data</Text>
            </TouchableOpacity>
          </View>

          <ThemedText type="subtitle" style={styles.historyTitle}>
            Scanned Items ({scannedItems.length})
          </ThemedText>
          
          <FlatList
            data={scannedItems}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => (
              <View style={styles.listItem}>
                <ThemedText style={styles.itemData}>{item.data}</ThemedText>
                <ThemedText style={styles.itemType}>{item.type}</ThemedText>
                <ThemedText style={styles.itemTimestamp}>
                  {new Date(item.timestamp).toLocaleString()}
                </ThemedText>
              </View>
            )}
            ListEmptyComponent={
              <ThemedText style={styles.emptyText}>No items scanned yet</ThemedText>
            }
          />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scannerContainer: {
    flex: 1,
  },
  scanner: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: 'black',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    gap: 15,
    marginBottom: 30,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyTitle: {
    marginBottom: 15,
  },
  list: {
    flex: 1,
  },
  listItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
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
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    opacity: 0.5,
  },
});
