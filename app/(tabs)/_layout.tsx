
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#f8f9fa',
          borderTopWidth: 0,
          height: 100,
          paddingBottom: 15,
          paddingTop: 15,
          paddingHorizontal: 20,
        },
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#6c757d',
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          marginTop: 8,
        },
        tabBarShowIcon: false,
        tabBarItemStyle: {
          backgroundColor: '#ffffff',
          borderRadius: 12,
          marginHorizontal: 5,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: '#dee2e6',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveBackgroundColor: '#007AFF',
        tabBarInactiveBackgroundColor: '#ffffff',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Main',
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
