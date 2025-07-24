import React from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function DataFilesScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Data Files</ThemedText>

      <ThemedView style={styles.actionContainer}>
        <TouchableOpacity style={styles.recordsButton} onPress={() => router.push('/data-records')}>
          <Text style={styles.buttonText}>View Data Records</Text>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 40,
    marginTop: 40,
    color: '#2d3748',
  },
  actionContainer: {
    width: '100%',
    maxWidth: 300,
  },
  recordsButton: {
    backgroundColor: '#38a169',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(56, 161, 105, 0.3)',
    elevation: 6,
    borderWidth: 2,
    borderColor: '#48bb78',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});