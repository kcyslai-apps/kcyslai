
import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { ThemedText } from './ThemedText';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const scaleAnim = new Animated.Value(0.8);
  const opacityAnim = new Animated.Value(0);
  const iconFadeAnim = new Animated.Value(0);
  const fadeOutAnim = new Animated.Value(1);

  useEffect(() => {
    // Start initial animations
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Start fade-in animation for the icon
    Animated.timing(iconFadeAnim, {
      toValue: 1,
      duration: 2000, // 2 seconds fade-in
      useNativeDriver: true,
    }).start(() => {
      // After fade-in completes, wait a moment then fade out and transition
      setTimeout(() => {
        Animated.timing(fadeOutAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }, 3000); // Wait 3 seconds before starting fade out
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOutAnim }]}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Animated.Image 
          source={require('../assets/images/barcode-icon.png')} 
          style={[styles.barcodeIcon, { opacity: iconFadeAnim }]}
          resizeMode="contain"
        />
      </Animated.View>
      
      <Animated.View style={[styles.textContainer, { opacity: opacityAnim }]}>
        <ThemedText type="title" style={styles.appName}>Barcode2File</ThemedText>
        <ThemedText style={styles.tagline}>Scan • Save • Organize</ThemedText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 40,
  },
  barcodeIcon: {
    width: 120,
    height: 120,
  },
  textContainer: {
    alignItems: 'center',
  },
  appName: {
    color: '#1a1a1a',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagline: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '500',
  },
});
