import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NavigationBanner({ navigation, offTrackWarning, onToggleNavMode }) {
  if (!navigation) return null;

  return (
    <View style={[styles.navBanner, offTrackWarning && styles.navBannerAlert]}>
      <View style={styles.navIconContainer}>
        <Ionicons name={offTrackWarning ? "warning-outline" : "navigate-outline"} size={28} color="white" />
      </View>
      <View style={styles.navTextContainer}>
        <Text style={styles.navDistance}>
          {navigation.distanceToTrail}
          <Text style={styles.navUnit}>m</Text>
        </Text>
        <Text style={styles.navStatus}>{navigation.guidance}</Text>
      </View>
      <TouchableOpacity onPress={onToggleNavMode} style={styles.navClose}>
        <Ionicons name="close-outline" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  navBanner: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: '#007bff', borderRadius: 15, padding: 15, zIndex: 1001, flexDirection: 'row' },
  navBannerAlert: { backgroundColor: '#dc3545' },
  navIconContainer: { marginRight: 15 },
  navTextContainer: { flex: 1 },
  navDistance: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  navUnit: { fontSize: 12, fontWeight: 'normal' },
  navStatus: { color: 'white', fontSize: 14 },
  navClose: { padding: 5 },
});
