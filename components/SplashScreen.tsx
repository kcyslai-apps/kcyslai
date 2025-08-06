
import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { ThemedText } from './ThemedText';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const scaleAnim = new Animated.Value(0.8);
  const opacityAnim = new Animated.Value(0);
  const rotateAnim = new Animated.Value(0);

  useEffect(() => {
    // Start animations
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
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ),
    ]).start();

    // Navigate to main app after 5 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
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
        {/* Barcode Icon SVG recreation */}
        <View style={styles.barcodeIcon}>
          <View style={styles.orangeBackground}>
            {/* White circle */}
            <View style={styles.whiteCircle}>
              <View style={styles.orangeInnerCircle} />
            </View>
            
            {/* Barcode lines */}
            <View style={styles.barcodeLines}>
              <View style={[styles.line, { width: 4, height: 30 }]} />
              <View style={[styles.line, { width: 2, height: 25 }]} />
              <View style={[styles.line, { width: 3, height: 35 }]} />
              <View style={[styles.line, { width: 2, height: 20 }]} />
              <View style={[styles.line, { width: 4, height: 32 }]} />
              <View style={[styles.line, { width: 2, height: 28 }]} />
              <View style={[styles.line, { width: 3, height: 22 }]} />
              <View style={[styles.line, { width: 2, height: 30 }]} />
              <View style={[styles.line, { width: 4, height: 26 }]} />
            </View>
          </View>
        </View>
      </Animated.View>
      
      <Animated.View style={[styles.textContainer, { opacity: opacityAnim }]}>
        <ThemedText type="title" style={styles.appName}>Barcode2File</ThemedText>
        <ThemedText style={styles.tagline}>Scan • Save • Organize</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 40,
  },
  barcodeIcon: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orangeBackground: {
    width: 120,
    height: 120,
    backgroundColor: '#FF6B35',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  whiteCircle: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 16,
    position: 'absolute',
    top: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orangeInnerCircle: {
    width: 16,
    height: 16,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
  },
  barcodeLines: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    gap: 2,
  },
  line: {
    backgroundColor: '#1a1a1a',
  },
  textContainer: {
    alignItems: 'center',
  },
  appName: {
    color: 'white',
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
