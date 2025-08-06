
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
  const rotateAnim = new Animated.Value(0);
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

    // Start rotation animation (one full rotation)
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 3000, // Faster rotation - 3 seconds
      useNativeDriver: true,
    }).start(() => {
      // After rotation completes, fade out and transition
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    });
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOutAnim }]}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { scale: scaleAnim },
              { rotate: spin }
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        <Image 
          source={require('../assets/images/barcode-icon.png')} 
          style={styles.barcodeIcon}
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
