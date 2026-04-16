
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function LiveTrekCard({ treks = [] }) {
    if (!treks || treks.length === 0) return null;

    // For now, show the first live trek. 
    // In a future update, this could be a carousel.
    const trek = treks[0];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.liveText}>Live Now</Text>
                <View style={styles.dot} />
            </View>

            <TouchableOpacity activeOpacity={0.9}>
                <ImageBackground
                    source={{ uri: trek.user?.profileImage || 'https://images.unsplash.com/photo-1551632811-561732d1e306' }}
                    style={styles.card}
                    imageStyle={{ borderRadius: 15 }}
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                        style={styles.gradient}
                    >
                        <View style={styles.topRow}>
                            <View style={styles.liveBadge}>
                                <Text style={styles.liveBadgeText}>LIVE</Text>
                            </View>
                            <View style={styles.viewerBadge}>
                                <Text style={styles.locationText}>
                                    <Ionicons name="location" size={10} color="white" /> {trek.location || 'Exploring'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.bottomRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.trekTitle} numberOfLines={1}>{trek.name}</Text>
                                <Text style={styles.trekUser}>by @{trek.user?.username}</Text>
                                <View style={styles.statsRow}>
                                    <Text style={styles.statText}>{(trek.stats?.distance / 1000).toFixed(2)} km</Text>
                                    <View style={styles.statDivider} />
                                    <Text style={styles.statText}>{Math.floor((trek.stats?.duration || 0) / 60)} min</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.watchButton}>
                                <Text style={styles.watchText}>Watch </Text>
                                <Ionicons name="play-circle" size={16} color="#28a745" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 15,
        marginBottom: 20,
        marginTop: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    liveText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#e74c3c',
    },
    card: {
        height: 180,
        width: '100%',
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    gradient: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 15,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    liveBadge: {
        backgroundColor: '#e74c3c',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    liveBadgeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 10,
    },
    viewerBadge: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    locationText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '500',
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    trekTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    trekUser: {
        color: '#eee',
        fontSize: 13,
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    statText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    statDivider: {
        width: 1,
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.4)',
        marginHorizontal: 8,
    },
    watchButton: {
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    watchText: {
        fontWeight: 'bold',
        fontSize: 13,
        color: '#333',
    }
});
