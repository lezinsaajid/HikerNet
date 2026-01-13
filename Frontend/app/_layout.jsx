import React, { useEffect, useState } from 'react';
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import * as SplashScreen from 'expo-splash-screen';
import { View, Animated, StyleSheet, Image } from 'react-native';
import LottieView from 'lottie-react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const fadeAnim = useState(new Animated.Value(1))[0];
  const scaleAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    async function prepare() {
      try {
        // Just a short delay to ensure assets are ready
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      // Hide the native splash screen immediately when app is ready
      // This reveals our custom Lottie animated splash
      SplashScreen.hideAsync();

      // Let the "fun" animation play for 3 seconds before we transition out
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 2.5,
            duration: 1200,
            useNativeDriver: true,
          })
        ]).start(() => {
          setSplashVisible(false);
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />

        {splashVisible && (
          <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
            {/* Dramatic Forest Background */}
            <Image
              source={require('../assets/images/forest_splash_bg.png')}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={styles.overlay} />

            {/* Fun Lottie Animation */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', alignItems: 'center' }}>
              <LottieView
                source={require('../assets/animations/hiking.json')}
                autoPlay
                loop
                style={styles.lottie}
              />
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#171010',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 16, 16, 0.5)',
  },
  lottie: {
    width: 300,
    height: 300,
  }
});
