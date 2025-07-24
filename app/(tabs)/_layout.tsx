
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
          borderTopColor: '#e0e0e0',
          height: 100,
          paddingBottom: 35,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
        tabBarShowIcon: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Templates',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="data-files"
        options={{
          title: 'Data Files',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
