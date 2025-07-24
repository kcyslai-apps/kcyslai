import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 80,
          paddingBottom: 15,
          paddingTop: 15,
          position: 'absolute',
          bottom: 120,
          left: 20,
          right: 20,
          borderRadius: 0,
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: '#6c757d',
        tabBarInactiveTintColor: '#6c757d',
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          marginTop: 0,
          marginBottom: 0,
          textAlign: 'center',
          alignSelf: 'center',
        },
        tabBarShowIcon: false,
        tabBarItemStyle: {
          backgroundColor: 'transparent',
          borderRadius: 0,
          marginHorizontal: 5,
          paddingVertical: 15,
          borderWidth: 0,
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
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