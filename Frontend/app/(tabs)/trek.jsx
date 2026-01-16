import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';




export default function TrekDashboard() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');


    const [treks, setTreks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTreks();

        // Refresh when screen comes into focus
        const unsubscribe = router.addListener?.('focus', loadTreks); // Or useFocusEffect from expo-router if available
        // Simple initial load is enough for now
    }, []);

    const loadTreks = async () => {
        try {
            // Using a public feed endpoint or similar. Based on routes, /treks/feed/public seems appropriate.
            // If that endpoint needs auth but we are logged in, it should work.
            // Or /treks/user/:id for personal. User asked for "all the treks that is uploaded".
            // So /treks/feed/public is the best match.
            const res = await client.get('/treks/feed/public');
            setTreks(res.data);
        } catch (error) {
            console.error("Failed to load treks", error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderTrekItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({
                pathname: `/trek/${item._id}`,
                // Optional: pass data to avoid immediate fetch if desired, but id based fetch is cleaner for deep links
                params: { id: item._id }
            })}
        >
            {/* Handle image arrays or single strings */}
            <Image
                source={{ uri: item.images?.[0] || 'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=2070&auto=format&fit=crop' }}
                style={styles.cardImage}
            />
            <View style={styles.cardContent}>
                <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardDistance}>{item.stats?.distance ? `${(item.stats.distance / 1000).toFixed(2)} km` : '0 km'}</Text>
                </View>
                {/* Only show rating if it exists, since model doesn't strictly have it yet */}
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

    const filteredTreks = treks.filter(trek => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            trek.name?.toLowerCase().includes(query) ||
            trek.location?.toLowerCase().includes(query)
        );
    });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Explore Treks</Text>
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
                <Text style={styles.sectionTitle}>
                    {searchQuery ? 'Search Results' : 'Nearby Treks'}
                </Text>
                {isLoading ? (
                    <Text>Loading treks...</Text>
                ) : (
                    <FlatList
                        data={filteredTreks}
                        renderItem={renderTrekItem}
                        keyExtractor={item => item._id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            searchQuery ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No treks found matching &quot;{searchQuery}&quot;</Text>
                                    <TouchableOpacity
                                        style={styles.addLocationButton}
                                        onPress={() => router.push({
                                            pathname: '/trek/create',
                                            params: { initialName: searchQuery }
                                        })}
                                    >
                                        <Ionicons name="add-circle-outline" size={24} color="#28a745" />
                                        <Text style={styles.addLocationText}>Add new location: {searchQuery}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No available treks now</Text>
                            )
                        }
                        ListFooterComponent={
                            filteredTreks.length > 0 ? (
                                <TouchableOpacity style={styles.card} onPress={() => router.push('/trek/create')}>
                                    <View style={[styles.cardImage, { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Ionicons name="add" size={50} color="#28a745" />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <View>
                                            <Text style={styles.cardTitle}>Add New Location</Text>
                                            <Text style={styles.cardDistance}>Start tracking a new trek</Text>
                                        </View>
                                        <View style={[styles.ratingContainer, { backgroundColor: '#e8f5e9' }]}>
                                            <Ionicons name="walk" size={16} color="#28a745" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ) : null
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
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
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
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
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
    addLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#e8f5e9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#c3e6cb',
    },
    addLocationText: {
        color: '#28a745',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});
