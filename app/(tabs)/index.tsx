import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, FlatList, Modal, TextInput } from 'react-native';
import { Camera, CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface Template {
  id: string;
  name: string;
  data: any;
  createdAt: Date;
}

interface ScannedData {
  data: string;
  type: string;
  timestamp: Date;
}

export default function TemplatesScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [scannedData, setScannedData] = useState<ScannedData[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedData, setSelectedData] = useState<ScannedData | null>(null);

  const TEMPLATES_FILE = FileSystem.documentDirectory + 'templates.json';
  const SCANNED_DATA_FILE = FileSystem.documentDirectory + 'scannedData.json';

  useEffect(() => {
    loadTemplates();
    loadScannedData();
  }, []);

  const loadTemplates = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(TEMPLATES_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
        const loadedTemplates = JSON.parse(content).map((template: any) => ({
          ...template,
          createdAt: new Date(template.createdAt)
        }));
        setTemplates(loadedTemplates);
      }
    } catch (error) {
      console.log('Error loading templates:', error);
    }
  };

  const loadScannedData = async () => {
    try {
      const fileExists = await FileSystem.getInfoAsync(SCANNED_DATA_FILE);
      if (fileExists.exists) {
        const content = await FileSystem.readAsStringAsync(SCANNED_DATA_FILE);
        const loadedData = JSON.parse(content).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setScannedData(loadedData);
      }
    } catch (error) {
      console.log('Error loading scanned data:', error);
    }
  };

  const saveTemplates = async (newTemplates: Template[]) => {
    try {
      await FileSystem.writeAsStringAsync(TEMPLATES_FILE, JSON.stringify(newTemplates));
    } catch (error) {
      console.log('Error saving templates:', error);
    }
  };

  const saveScannedData = async (newData: ScannedData[]) => {
    try {
      await FileSystem.writeAsStringAsync(SCANNED_DATA_FILE, JSON.stringify(newData));
    } catch (error) {
      console.log('Error saving scanned data:', error);
    }
  };

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    setScanned(true);
    const newScannedData: ScannedData = {
      data,
      type,
      timestamp: new Date()
    };

    const updatedScannedData = [...scannedData, newScannedData];
    setScannedData(updatedScannedData);
    saveScannedData(updatedScannedData);

    setSelectedData(newScannedData);
    setShowCamera(false);
    Alert.alert('QR Code Scanned', `Type: ${type}\nData: ${data}`);
  };

  const startScanning = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan QR codes.');
        return;
      }
    }
    setScanned(false);
    setShowCamera(true);
  };

  const createTemplate = () => {
    if (!selectedData) {
      Alert.alert('No Data Selected', 'Please scan a QR code first.');
      return;
    }
    setShowTemplateModal(true);
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim() || !selectedData) {
      Alert.alert('Invalid Input', 'Please enter a template name.');
      return;
    }

    const newTemplate: Template = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      data: selectedData,
      createdAt: new Date()
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);

    setNewTemplateName('');
    setShowTemplateModal(false);
    Alert.alert('Success', 'Template saved successfully!');
  };

  const deleteTemplate = (templateId: string) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedTemplates = templates.filter(t => t.id !== templateId);
            setTemplates(updatedTemplates);
            saveTemplates(updatedTemplates);
          }
        }
      ]
    );
  };

  const renderTemplate = ({ item }: { item: Template }) => (
    <View style={styles.templateItem}>
      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.templateData}>Data: {item.data.data}</Text>
        <Text style={styles.templateDate}>
          Created: {item.createdAt.toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteTemplate(item.id)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Collector</ThemedText>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Templates: {templates.length}</Text>
        <Text style={styles.statsText}>Total Files: {templates.length}</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[styles.templateButton, !selectedData && styles.disabledButton]} 
          onPress={createTemplate}
          disabled={!selectedData}
        >
          <Text style={styles.buttonText}>Create Template</Text>
        </TouchableOpacity>
      </View>

      {selectedData && (
        <View style={styles.selectedDataContainer}>
          <Text style={styles.selectedDataTitle}>Last Scanned:</Text>
          <Text style={styles.selectedDataText}>{selectedData.data}</Text>
          <Text style={styles.selectedDataType}>Type: {selectedData.type}</Text>
        </View>
      )}

      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id}
        style={styles.templatesList}
        showsVerticalScrollIndicator={false}
      />

      <Text style={styles.poweredByText}>Powered by Smart Alliance</Text>

      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'pdf417'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraText}>Scan a QR code</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Template</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter template name"
              value={newTemplateName}
              onChangeText={setNewTemplateName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setNewTemplateName('');
                  setShowTemplateModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveTemplate}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 40,
    color: '#000000',
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
  templateButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a0aec0',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedDataContainer: {
    backgroundColor: '#f7fafc',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4299e1',
  },
  selectedDataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2d3748',
  },
  selectedDataText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#4a5568',
  },
  selectedDataType: {
    fontSize: 12,
    color: '#718096',
  },
  templatesList: {
    flex: 1,
  },
  templateItem: {
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
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2d3748',
  },
  templateData: {
    fontSize: 14,
    marginBottom: 5,
    color: '#4a5568',
  },
  templateDate: {
    fontSize: 12,
    color: '#718096',
  },
  deleteButton: {
    backgroundColor: '#e53e3e',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    alignItems: 'center',
  },
  cameraText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 15,
  },
  closeButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#2d3748',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#a0aec0',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#48bb78',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  poweredByText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#718096',
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
});