
import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 30,
          paddingTop: 20,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
          height: 100,
        },
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#718096',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'bold',
          marginTop: 6,
          textShadowColor: 'rgba(0,0,0,0.3)',
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        },
        tabBarIconStyle: {
          marginBottom: -4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer, 
              focused ? styles.iconContainerActiveHome : styles.iconContainerInactive
            ]}>
              <IconSymbol 
                size={focused ? 28 : 24} 
                name="home" 
                color={focused ? '#ffffff' : color} 
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="data-files"
        options={{
          title: 'Data Files',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer, 
              focused ? styles.iconContainerActiveFiles : styles.iconContainerInactive
            ]}>
              <IconSymbol 
                size={focused ? 28 : 24} 
                name="doc.text.fill" 
                color={focused ? '#ffffff' : color} 
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconContainerInactive: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainerActiveHome: {
    backgroundColor: '#68d391',
    borderWidth: 3,
    borderColor: '#9ae6b4',
    transform: [{ scale: 1.15 }],
    shadowColor: '#68d391',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainerActiveFiles: {
    backgroundColor: '#4299e1',
    borderWidth: 3,
    borderColor: '#63b3ed',
    transform: [{ scale: 1.15 }],
    shadowColor: '#4299e1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
