
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          paddingBottom: 15,
          paddingTop: 15,
          height: 70,
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
        },
        tabBarActiveTintColor: '#4299e1',
        tabBarInactiveTintColor: '#718096',
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarShowIcon: true,
        tabBarIconStyle: {
          marginBottom: -3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ 
              fontSize: 20,
              color: focused ? '#4299e1' : '#718096',
            }}>🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="data-files"
        options={{
          title: 'Data Files',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ 
              fontSize: 20,
              color: focused ? '#4299e1' : '#718096',
            }}>📁</Text>
          ),
        }}
      />
    </Tabs>
  );
}
