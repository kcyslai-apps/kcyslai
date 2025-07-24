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
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            height: 80 + insets.bottom,
            paddingBottom: insets.bottom + 12,
            paddingTop: 16,
            backgroundColor: colorScheme === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTopWidth: 0.5,
            borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderRadius: 20,
            marginHorizontal: 16,
            marginBottom: 20,
          },
          default: {
            height: 80 + Math.max(insets.bottom, 20),
            paddingBottom: Math.max(insets.bottom, 20),
            paddingTop: 16,
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderTopWidth: 0,
            borderRadius: 20,
            marginHorizontal: 16,
            marginBottom: 20,
            boxShadow: colorScheme === 'dark' 
              ? '0 -8px 32px rgba(0, 0, 0, 0.4)' 
              : '0 -8px 32px rgba(0, 0, 0, 0.08)',
            elevation: 12,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 6,
          lineHeight: 16,
          textAlign: 'center',
          letterSpacing: 0.5,
        },
        tabBarIconStyle: {
          marginBottom: 2,
          marginTop: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Templates',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 26 : 24} 
              name="doc.text.fill" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Files',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 26 : 24} 
              name="folder.fill" 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
