import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';

export default function NearbyTrails() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [trails, setTrails] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTrails();
    }, []);

    const loadTrails = async () => {
        setIsLoading(true);
        try {
            const res = await client.get('/treks/feed/public');
            setTrails(res.data);
        } catch (error) {
            console.error("Failed to load trails", error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderTrailItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({
                pathname: `/trek/${item._id}`,
                params: { id: item._id }
            })}
        >
            <Image
                source={{ uri: item.images?.[0] || 'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=2070&auto=format&fit=crop' }}
                style={styles.cardImage}
            />
            <View style={styles.cardContent}>
                <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardDistance}>{item.stats?.distance ? `${(item.stats.distance / 1000).toFixed(2)} km` : '0 km'}</Text>
                    <Text style={styles.cardDate}>Uploaded: {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                {item.rating ? (
                    <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={16} color="#ffc107" />
                        <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                ) : (
                    <View style={styles.ratingContainer}>
                        <Ionicons name="location-outline" size={16} color="#666" />
                        <Text style={[styles.ratingText, { color: '#666' }]}>{item.location || 'Unknown'}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    const filteredTrails = trails.filter(trail => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            trail.name?.toLowerCase().includes(query) ||
            trail.location?.toLowerCase().includes(query)
        );
    });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nearby Trails</Text>
            </View>

            <View style={styles.searchWrapper}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search for trails..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <View style={styles.content}>
                {isLoading ? (
                    <Text>Loading trails...</Text>
                ) : (
                    <FlatList
                        data={filteredTrails}
                        renderItem={renderTrailItem}
                        keyExtractor={item => item._id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>
                                    {searchQuery ? `No trails found matching "${searchQuery}"` : "No available trails now"}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    searchWrapper: {
        padding: 15,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f3f5',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 45,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 15,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardImage: {
        width: '100%',
        height: 150,
    },
    cardContent: {
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    cardDistance: {
        fontSize: 14,
        color: '#666',
    },
    cardDate: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff9db',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fcc419',
        marginLeft: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        fontSize: 16,
        marginBottom: 20,
    },
});
