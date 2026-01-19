import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Immersive Forest Background */}
      <Image
        source={require('../assets/images/welcome_bg.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Dark Overlay for Text Legibility */}
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Main Hero Text */}
          <View style={styles.textSection}>
            <Text style={styles.title}>The best{"\n"}app for{"\n"}hikers</Text>
          </View>

          {/* Action Footer */}
          <View style={styles.footerSection}>
            <Link href="/login" asChild>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => console.log("Link to Login pressed")}
              >
                <Text style={styles.signInText}>Sign in</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/register" asChild>
              <TouchableOpacity
                onPress={() => console.log("Link to Register pressed")}
                style={styles.registerLink}
              >
                <Text style={styles.registerText}>Create an account</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', // Subtle dimming
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  textSection: {
    marginTop: 60,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 56,
    letterSpacing: -1,
  },
  footerSection: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  signInButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // Translucent White
    width: '100%',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  registerLink: {
    paddingVertical: 10,
  },
  registerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.9,
  },
});
