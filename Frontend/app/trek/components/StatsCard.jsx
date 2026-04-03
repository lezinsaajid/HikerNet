import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StatsCard({ stats, formatDuration }) {
    return (
        <View style={styles.statsCard}>
            <View style={styles.statsMainRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Distance</Text>
                    <Text style={styles.statValue}>
                        {(stats.distance / 1000).toFixed(2)}
                        <Text style={styles.unitText}> km</Text>
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Time</Text>
                    <Text style={styles.statValue}>{formatDuration(stats.duration)}</Text>
                </View>
            </View>

            <View style={styles.statsSecondaryRow}>
                <View style={styles.statDetail}>
                    <Ionicons name="speedometer-outline" size={16} color="#666" />
                    <Text style={styles.statDetailText}>{stats.avgSpeed} km/h</Text>
                </View>
                <View style={styles.statDetail}>
                    <Ionicons name="trending-up-outline" size={16} color="#666" />
                    <Text style={styles.statDetailText}>{Math.round(stats.elevationGain)}m UP</Text>
                </View>
                <View style={styles.statDetail}>
                    <Ionicons name="navigate-outline" size={16} color="#666" />
                    <Text style={styles.statDetailText}>{Math.round(stats.maxAltitude)}m MAX</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    statsCard: { backgroundColor: 'rgba(255,255,255,0.95)', padding: 15, borderRadius: 20, marginBottom: 20, width: '100%', elevation: 5 },
    statsMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    statItem: { alignItems: 'center', flex: 1 },
    statDivider: { width: 1, height: '70%', backgroundColor: '#e0e0e0' },
    statsSecondaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12 },
    statDetail: { flexDirection: 'row', alignItems: 'center' },
    statDetailText: { fontSize: 14, color: '#444', fontWeight: '600', marginLeft: 6 },
    statLabel: { fontSize: 12, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
    statValue: { fontSize: 26, fontWeight: 'bold', color: '#28a745' },
    unitText: { fontSize: 14, color: '#666' },
});
