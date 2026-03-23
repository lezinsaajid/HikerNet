import React, { useEffect, useState } from 'react';
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import * as SplashScreen from 'expo-splash-screen';
import { View, Animated, StyleSheet, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';

import NotificationManager from '../components/NotificationManager';
import { NotificationProvider } from '../context/NotificationContext';

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
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <NotificationManager />
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />

            {splashVisible && (
              <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
                {/* Minimalist Logo Splash */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', alignItems: 'center' }}>
                  <Image
                    source={require('../assets/images/logo_hikernet.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </Animated.View>
              </Animated.View>
            )}
          </View>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}


const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Clean white background for the logo
  },
  logoImage: {
    width: 320, // Slightly larger for impact
    height: 320,
  }
});
