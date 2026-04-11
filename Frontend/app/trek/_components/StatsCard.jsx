import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StatsCard({ stats, formatDuration }) {
    return (
        <View style={styles.container}>
            <View style={styles.statsBar}>
                {/* Total Time Section */}
                <View style={styles.timeSection}>
                    <Text style={styles.label}>Total Time</Text>
                    <Text style={styles.timeValue}>{formatDuration(stats.duration)}</Text>
                </View>

                {/* Distance Section */}
                <View style={styles.statSection}>
                    <Text style={styles.label}>Distance</Text>
                    <Text style={styles.value}>
                        {(stats.distance / 1000).toFixed(2)} <Text style={styles.unit}>km</Text>
                    </Text>
                </View>

                {/* Elevation Section */}
                <View style={styles.statSection}>
                    <Text style={styles.label}>Elevation</Text>
                    <Text style={styles.value}>
                        {Math.round(stats.elevationGain)} <Text style={styles.unit}>m</Text>
                    </Text>
                </View>

                {/* Speed Section */}
                <View style={styles.statSection}>
                    <Text style={styles.label}>Speed</Text>
                    <Text style={styles.value}>
                        {stats.avgSpeed} <Text style={styles.unit}>km/h</Text>
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'absolute', top: 50, left: 15, right: 15, zIndex: 1000 },
    statsBar: { 
        flexDirection: 'row', 
        backgroundColor: 'white', 
        borderRadius: 20, 
        overflow: 'hidden',
        height: 60,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        alignItems: 'center'
    },
    timeSection: { 
        backgroundColor: '#c62828', 
        height: '100%', 
        paddingHorizontal: 15, 
        justifyContent: 'center', 
        alignItems: 'center',
        minWidth: 100
    },
    statSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderLeftWidth: 1,
        borderLeftColor: '#f0f0f0'
    },
    label: {
        fontSize: 10,
        color: '#888',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 2
    },
    timeValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    value: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333'
    },
    unit: {
        fontSize: 10,
        color: '#666'
    }
});
