import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

export default function TrekDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [trek, setTrek] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadTrekDetails();
        }
    }, [id]);

    const loadTrekDetails = async () => {
        try {
            const res = await client.get(`/treks/${id}`);
            setTrek(res.data);
        } catch (error) {
            console.error("Failed to load trek details", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStart = (mode) => {
        router.push({
            pathname: '/trek/active',
            params: {
                trekId: id, // Pass existing ID to resume/follow
                mode
            }
        });
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text>Loading details...</Text>
            </View>
        );
    }

    if (!trek) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text>Trek not found.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: 'blue' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Image
                source={{ uri: trek.images?.[0] || 'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=2070&auto=format&fit=crop' }}
                style={styles.heroImage}
            />

            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{trek.name}</Text>
                    {trek.rating && (
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={16} color="#ffc107" />
                            <Text style={styles.ratingText}>{trek.rating}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.locationText}>{trek.location || 'Unknown Location'}</Text>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {trek.stats?.distance ? (trek.stats.distance / 1000).toFixed(2) : '0'}
                        </Text>
                        <Text style={styles.statLabel}>km</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {trek.stats?.duration ? Math.round(trek.stats.duration / 60) : '0'}
                        </Text>
                        <Text style={styles.statLabel}>min</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {trek.stats?.elevationGain || '0'}
                        </Text>
                        <Text style={styles.statLabel}>m elev</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>About this trail</Text>
                <Text style={styles.description}>
                    {trek.description || "No description provided for this trek."}
                </Text>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.soloButton]}
                        onPress={() => handleStart('solo')}
                    >
                        <Ionicons name="person" size={24} color="white" />
                        <View style={styles.buttonContent}>
                            <Text style={styles.buttonTitle}>Solo Trek</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.groupButton]}
                        onPress={() => handleStart('group')}
                    >
                        <Ionicons name="people" size={24} color="white" />
                        <View style={styles.buttonContent}>
                            <Text style={styles.buttonTitle}>Group Trek</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroImage: {
        width: '100%',
        height: 250,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        padding: 20,
        backgroundColor: 'white',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff9db',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratingText: {
        fontWeight: 'bold',
        color: '#fcc419',
        marginLeft: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    locationText: {
        color: '#666',
        marginLeft: 5,
        fontSize: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f0f0f0',
        marginBottom: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        color: '#999',
        fontSize: 12,
    },
    statDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    description: {
        lineHeight: 24,
        color: '#555',
        marginBottom: 30,
    },
    footer: {
        marginTop: 'auto',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    soloButton: {
        backgroundColor: '#28a745',
    },
    groupButton: {
        backgroundColor: '#17a2b8',
    },
    buttonContent: {
        marginLeft: 10,
    },
    buttonTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
});
