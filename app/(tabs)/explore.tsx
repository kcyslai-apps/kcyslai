
import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, FlatList, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface DataFile {
  name: string;
  uri: string;
  size: number;
  modificationTime: number;
  type: string;
}

export default function DataFilesScreen() {
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    loadDataFiles();
  }, []);

  const loadDataFiles = async () => {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) return;

      const files = await FileSystem.readDirectoryAsync(documentsDir);
      const dataFileList: DataFile[] = [];
      let size = 0;

      for (const fileName of files) {
        const fileUri = documentsDir + fileName;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (fileInfo.exists && !fileInfo.isDirectory) {
          const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';
          dataFileList.push({
            name: fileName,
            uri: fileUri,
            size: fileInfo.size || 0,
            modificationTime: fileInfo.modificationTime || 0,
            type: fileType
          });
          size += fileInfo.size || 0;
        }
      }

      dataFileList.sort((a, b) => b.modificationTime - a.modificationTime);
      setDataFiles(dataFileList);
      setTotalSize(size);
    } catch (error) {
      console.error('Error loading data files:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const shareFile = async (file: DataFile) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      await Sharing.shareAsync(file.uri, {
        dialogTitle: `Share ${file.name}`
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const deleteFile = async (file: DataFile) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete ${file.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(file.uri);
              loadDataFiles(); // Refresh the list
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert('Error', 'Failed to delete file');
            }
          }
        }
      ]
    );
  };

  const importFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const documentsDir = FileSystem.documentDirectory;
        if (!documentsDir) return;

        const newFileUri = documentsDir + asset.name;
        await FileSystem.copyAsync({
          from: asset.uri,
          to: newFileUri
        });

        Alert.alert('Success', `${asset.name} has been imported successfully`);
        loadDataFiles(); // Refresh the list
      }
    } catch (error) {
      console.error('Error importing file:', error);
      Alert.alert('Error', 'Failed to import file');
    }
  };

  const exportAllFiles = async () => {
    if (dataFiles.length === 0) {
      Alert.alert('No Files', 'No data files to export');
      return;
    }

    try {
      const fileList = dataFiles.map(file => ({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        lastModified: new Date(file.modificationTime).toISOString()
      }));

      const exportData = {
        exportDate: new Date().toISOString(),
        totalFiles: dataFiles.length,
        totalSize: formatFileSize(totalSize),
        files: fileList
      };

      const exportUri = FileSystem.documentDirectory + 'data_files_export.json';
      await FileSystem.writeAsStringAsync(exportUri, JSON.stringify(exportData, null, 2));

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Data Files List'
        });
      } else {
        Alert.alert('Success', 'Export file created successfully');
      }
    } catch (error) {
      console.error('Error exporting files list:', error);
      Alert.alert('Error', 'Failed to export files list');
    }
  };

  const clearAllFiles = async () => {
    Alert.alert(
      'Clear All Files',
      'Are you sure you want to delete all data files? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const file of dataFiles) {
                await FileSystem.deleteAsync(file.uri, { idempotent: true });
              }
              loadDataFiles(); // Refresh the list
              Alert.alert('Success', 'All data files have been deleted');
            } catch (error) {
              console.error('Error clearing files:', error);
              Alert.alert('Error', 'Failed to delete some files');
            }
          }
        }
      ]
    );
  };

  const renderFile = ({ item }: { item: DataFile }) => (
    <ThemedView style={styles.fileItem}>
      <ThemedView style={styles.fileInfo}>
        <ThemedText style={styles.fileName}>{item.name}</ThemedText>
        <ThemedText style={styles.fileDetails}>
          {formatFileSize(item.size)} • {item.type.toUpperCase()}
        </ThemedText>
        <ThemedText style={styles.fileDate}>
          Modified: {new Date(item.modificationTime).toLocaleString()}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.fileActions}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => shareFile(item)}
        >
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteFile(item)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Files</ThemedText>
      
      <ThemedView style={styles.statsContainer}>
        <ThemedText type="subtitle">Storage Overview</ThemedText>
        <ThemedText>Total Files: {dataFiles.length}</ThemedText>
        <ThemedText>Total Size: {formatFileSize(totalSize)}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={importFile}
        >
          <Text style={styles.buttonText}>Import File</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={exportAllFiles}
        >
          <Text style={styles.buttonText}>Export File List</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={clearAllFiles}
        >
          <Text style={styles.buttonText}>Clear All Files</Text>
        </TouchableOpacity>
      </ThemedView>

      <FlatList
        data={dataFiles}
        keyExtractor={(item) => item.uri}
        renderItem={renderFile}
        style={styles.filesList}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No data files found</ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#000000',
  },
  statsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  actionContainer: {
    gap: 10,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
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
    backgroundColor: '#f8f9fa',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#000000',
  },
  fileDetails: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 5,
  },
  fileDate: {
    fontSize: 12,
    color: '#666666',
  },
  fileActions: {
    gap: 5,
    justifyContent: 'center',
  },
  shareButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#666666',
  },
});
