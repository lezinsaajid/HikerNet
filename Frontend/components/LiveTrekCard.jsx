
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function LiveTrekCard() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.liveText}>Live</Text>
                <View style={styles.dot} />
            </View>

            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1551632811-561732d1e306?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80' }}
                style={styles.card}
                imageStyle={{ borderRadius: 15 }}
            >
                <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
                    style={styles.gradient}
                >
                    <View style={styles.topRow}>
                        <View style={styles.liveBadge}>
                            <Text style={styles.liveBadgeText}>Live</Text>
                        </View>
                        <View style={styles.viewerBadge}>
                            <Text style={styles.viewerText}>154 👁</Text>
                        </View>
                    </View>

                    <View style={styles.bottomRow}>
                        <View>
                            <Text style={styles.trekTitle}>Chembra Peak Expedition</Text>
                            <Text style={styles.trekUser}>with @alex_adventures</Text>
                        </View>
                        <TouchableOpacity style={styles.shareButton}>
                            <Text style={styles.shareText}>Share </Text>
                            <Ionicons name="share-outline" size={16} color="black" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 15,
        marginBottom: 25,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    liveText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 5,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'red',
    },
    card: {
        height: 200,
        width: '100%',
        justifyContent: 'space-between',
    },
    gradient: {
        flex: 1,
        borderRadius: 15,
        justifyContent: 'space-between',
        padding: 15,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    liveBadge: {
        backgroundColor: '#e74c3c',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    liveBadgeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    viewerBadge: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    viewerText: {
        color: 'white',
        fontSize: 12,
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
    },
    trekUser: {
        color: '#ddd',
        fontSize: 14,
    },
    shareButton: {
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    shareText: {
        fontWeight: 'bold',
        fontSize: 12,
    }
});
