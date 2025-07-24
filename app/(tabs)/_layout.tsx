
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarShowLabel: false,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingTop: 12,
            backgroundColor: colorScheme === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTopWidth: 0,
            borderRadius: 25,
            marginHorizontal: 20,
            marginBottom: 25,
          },
          default: {
            height: 70 + Math.max(insets.bottom, 20),
            paddingBottom: Math.max(insets.bottom, 15),
            paddingTop: 12,
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderTopWidth: 0,
            borderRadius: 25,
            marginHorizontal: 20,
            marginBottom: 25,
            boxShadow: colorScheme === 'dark' 
              ? '0 -10px 40px rgba(0, 0, 0, 0.5)' 
              : '0 -10px 40px rgba(0, 0, 0, 0.1)',
            elevation: 15,
          },
        }),
        tabBarIconStyle: {
          marginBottom: 0,
          marginTop: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 32 : 28} 
              name="doc.text.fill" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 32 : 28} 
              name="folder.fill" 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
