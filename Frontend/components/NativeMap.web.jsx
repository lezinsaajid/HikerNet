import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NativeMap = ({ children }) => {
    return (
        <View style={styles.webPlaceholder}>
            <Ionicons name="map-outline" size={64} color="#ccc" />
            <Text style={styles.webPlaceholderText}>
                Maps are currently only available on mobile devices.
            </Text>
            {/* We render children just in case, but they will likely be empty or markers */}
            {false && children}
        </View>
    );
};

// Dummy components for web
export const Marker = () => null;
export const Polyline = () => null;

const styles = StyleSheet.create({
    webPlaceholder: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    webPlaceholderText: {
        color: '#adb5bd',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
        fontWeight: '500',
    },
});

export default NativeMap;
