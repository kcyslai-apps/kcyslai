
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 35,
          paddingTop: 15,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
          height: 90,
        },
        tabBarActiveTintColor: '#4299e1',
        tabBarInactiveTintColor: '#718096',
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          marginTop: 5,
          marginBottom: 10,
        },
        tabBarShowIcon: false,
        tabBarIconStyle: {
          display: 'none',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="data-files"
        options={{
          title: 'Data Files',
        }}
      />
    </Tabs>
  );
}
