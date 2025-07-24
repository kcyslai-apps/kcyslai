
import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, FlatList, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface FileItem {
  name: string;
  uri: string;
  size: number;
  modificationTime: number;
}

export default function DataFilesScreen() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) return;

      const fileList = await FileSystem.readDirectoryAsync(documentsDir);
      const fileDetails = await Promise.all(
        fileList.map(async (fileName) => {
          const fileUri = documentsDir + fileName;
          const info = await FileSystem.getInfoAsync(fileUri);
          return {
            name: fileName,
            uri: fileUri,
            size: info.size || 0,
            modificationTime: info.modificationTime || 0,
          };
        })
      );

      const sortedFiles = fileDetails.sort((a, b) => b.modificationTime - a.modificationTime);
      setFiles(sortedFiles);
      
      const total = fileDetails.reduce((sum, file) => sum + file.size, 0);
      setTotalSize(total);
    } catch (error) {
      console.error('Error loading files:', error);
      Alert.alert('Error', 'Failed to load files');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  const shareFile = async (fileUri: string, fileName: string) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: `Share ${fileName}`,
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this platform');
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const deleteFile = async (fileUri: string, fileName: string) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete ${fileName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(fileUri);
              loadFiles();
              Alert.alert('Success', 'File deleted successfully');
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert('Error', 'Failed to delete file');
            }
          },
        },
      ]
    );
  };

  const importFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const documentsDir = FileSystem.documentDirectory;
        if (!documentsDir) return;

        const newUri = documentsDir + asset.name;
        await FileSystem.copyAsync({
          from: asset.uri,
          to: newUri,
        });

        loadFiles();
        Alert.alert('Success', 'File imported successfully');
      }
    } catch (error) {
      console.error('Error importing file:', error);
      Alert.alert('Error', 'Failed to import file');
    }
  };

  const exportAllData = async () => {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) return;

      const summary = {
        totalFiles: files.length,
        totalSize: totalSize,
        files: files.map(file => ({
          name: file.name,
          size: file.size,
          modified: formatDate(file.modificationTime),
        })),
        exportDate: new Date().toISOString(),
      };

      const exportUri = documentsDir + 'data_summary.json';
      await FileSystem.writeAsStringAsync(exportUri, JSON.stringify(summary, null, 2));

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportUri);
      } else {
        Alert.alert('Export Complete', 'Data summary saved to data_summary.json');
      }

      loadFiles();
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data summary');
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all files. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const file of files) {
                await FileSystem.deleteAsync(file.uri);
              }
              loadFiles();
              Alert.alert('Success', 'All data cleared');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear all data');
            }
          },
        },
      ]
    );
  };

  const renderFileItem = ({ item }: { item: FileItem }) => (
    <ThemedView style={styles.fileItem}>
      <ThemedView style={styles.fileInfo}>
        <Text style={styles.fileName}>{item.name}</Text>
        <Text style={styles.fileDetails}>Size: {formatFileSize(item.size)}</Text>
        <Text style={styles.fileDate}>Modified: {formatDate(item.modificationTime)}</Text>
      </ThemedView>
      <ThemedView style={styles.fileActions}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => shareFile(item.uri, item.name)}
        >
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteFile(item.uri, item.name)}
        >
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Files</ThemedText>

      <ThemedView style={styles.statsContainer}>
        <Text style={styles.statsText}>Total Files: {files.length}</Text>
        <Text style={styles.statsText}>Total Size: {formatFileSize(totalSize)}</Text>
      </ThemedView>

      <ThemedView style={styles.actionContainer}>
        <TouchableOpacity style={styles.recordsButton} onPress={() => router.push('/data-records')}>
          <Text style={styles.buttonText}>View Data Records</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={importFile}>
          <Text style={styles.buttonText}>Import File</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={exportAllData}>
          <Text style={styles.buttonText}>Export Data Summary</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
          <Text style={styles.buttonText}>Clear All Data</Text>
        </TouchableOpacity>
      </ThemedView>

      <FlatList
        data={files}
        renderItem={renderFileItem}
        keyExtractor={(item) => item.uri}
        style={styles.filesList}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={loadFiles}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 40,
    color: '#2d3748',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  statsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5282',
  },
  actionContainer: {
    gap: 10,
    marginBottom: 20,
  },
  recordsButton: {
    backgroundColor: '#38a169',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#4299e1',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filesList: {
    flex: 1,
  },
  fileItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2d3748',
  },
  fileDetails: {
    fontSize: 14,
    marginBottom: 5,
    color: '#4a5568',
  },
  fileDate: {
    fontSize: 12,
    color: '#718096',
  },
  fileActions: {
    gap: 5,
  },
  shareButton: {
    backgroundColor: '#4299e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButton: {
    backgroundColor: '#e53e3e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
});
