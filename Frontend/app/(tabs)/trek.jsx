import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient'; // Ensure this is installed, if not, use plain View
import client from '../../api/client';
import SafeScreen from '../../components/SafeScreen';
import { getTrailImage } from '../../utils/imageUtils';

const { width } = Dimensions.get('window');

export default function TrailExploreScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [trails, setTrails] = useState([]);
    const [discoveredTrails, setDiscoveredTrails] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [location, setLocation] = useState(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                let loc = await Location.getCurrentPositionAsync({});
                setLocation(loc.coords);
            }
            loadTrails();
        })();
    }, []);
    useEffect(() => {
        if (location) {
            loadNearbyDiscovery();
        }
    }, [location]);

    const loadNearbyDiscovery = async () => {
        try {
            const res = await client.get(`/treks/discover?lat=${location.latitude}&lon=${location.longitude}&radius=50000`);

            let sorted = res.data.map(t => {
                if (t.coordinates) {
                    const d = calculateDist(location.latitude, location.longitude, t.coordinates.latitude, t.coordinates.longitude);
                    return { ...t, distance: d.toFixed(1) };
                }
                return t;
            }).sort((a, b) => (parseFloat(a.distance) || Infinity) - (parseFloat(b.distance) || Infinity));

            setDiscoveredTrails(sorted);
        } catch (error) {
            console.error("Discovery pre-load failed:", error);
        }
    };

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

    const calculateDist = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleGlobalSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearchingGlobal(true);
        try {
            let url = `/treks/discover?q=${encodeURIComponent(searchQuery)}`;
            if (location) {
                url += `&lat=${location.latitude}&lon=${location.longitude}&radius=50000`; // 50km
            }
            const res = await client.get(url);

            let finalTrails = res.data;
            if (location) {
                finalTrails = finalTrails.map(t => {
                    if (t.coordinates) {
                        const d = calculateDist(location.latitude, location.longitude, t.coordinates.latitude, t.coordinates.longitude);
                        return { ...t, distance: d.toFixed(2) };
                    }
                    return t;
                }).sort((a, b) => (parseFloat(a.distance) || Infinity) - (parseFloat(b.distance) || Infinity));
            }

            setDiscoveredTrails(finalTrails);
        } catch (error) {
            console.error("Failed to discover trails", error);
        } finally {
            setIsSearchingGlobal(false);
        }
    };

    const renderTrailItem = ({ item }) => {
        const isOSM = item.source === 'OSM';
        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => isOSM ? router.push(`/trek/osm-${item.osmId}?type=${item.type}`) : router.push(`/trek/${item._id}`)}
            >
                <Image
                    source={{ uri: getTrailImage(item) }}
                    style={styles.cardImage}
                />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.imageOverlay}
                />
                <View style={styles.cardBadge}>
                    <Ionicons name={isOSM ? "shield-checkmark" : "people"} size={12} color="#FFF" />
                    <Text style={styles.badgeText}>{isOSM ? "Verified" : "Community"}</Text>
                </View>

                {item.difficulty && (
                    <View style={[styles.cardBadge, { left: undefined, right: 20, backgroundColor: 'rgba(74, 124, 68, 0.8)' }]}>
                        <Text style={styles.badgeText}>{item.difficulty}</Text>
                    </View>
                )}

                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.cardMeta}>
                        <View style={styles.metaItem}>
                            <Ionicons name="location-sharp" size={14} color="#FFF" />
                            <Text style={styles.metaText}>{item.location || 'Unknown'}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="walk" size={14} color="#FFF" />
                            <Text style={styles.metaText}>
                                {item.distance
                                    ? `${parseFloat(item.distance).toFixed(1)} km`
                                    : item.stats?.distance
                                        ? `${(item.stats.distance / 1000).toFixed(1)} km`
                                        : '--'
                                }
                            </Text>
                        </View>
                        {item.routeType && (
                            <View style={styles.metaItem}>
                                <Ionicons name="map" size={14} color="#FFF" />
                                <Text style={styles.metaText}>{item.routeType}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const filteredTrails = trails.filter(trail => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            trail.name?.toLowerCase().includes(query) ||
            trail.location?.toLowerCase().includes(query)
        );
    });

    const combinedResults = [...filteredTrails, ...discoveredTrails];

    return (
        <SafeScreen style={styles.container}>
            <View style={styles.paperHeader}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.welcomeText}>Find your next</Text>
                        <Text style={styles.headerTitle}>Adventure</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.createIconButton}
                        onPress={() => router.push('/trek/create')}
                    >
                        <Ionicons name="add" size={28} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchPaper}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={22} color="#4A7C44" style={{ marginRight: 12 }} />
                        <TextInput
                            placeholder="Search mountain, city, trail..."
                            placeholderTextColor="#99B096"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                if (text === '') setDiscoveredTrails([]);
                            }}
                            returnKeyType="search"
                            onSubmitEditing={handleGlobalSearch}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={handleGlobalSearch} style={styles.searchBtn}>
                                <Ionicons name="arrow-forward" size={18} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.content}>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4A7C44" />
                        <Text style={styles.loadingText}>Fetching nearby trails...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={combinedResults}
                        renderItem={renderTrailItem}
                        keyExtractor={item => item._id || `osm-${item.osmId}`}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        ListHeaderComponent={
                            <View style={styles.listHeader}>
                                {isSearchingGlobal && (
                                    <View style={styles.searchingOverlay}>
                                        <ActivityIndicator color="#4A7C44" />
                                        <Text style={styles.searchingText}>Searching worldwide...</Text>
                                    </View>
                                )}
                                <Text style={styles.sectionTitle}>
                                    {searchQuery ? `Results for "${searchQuery}"` : "Popular Nearby"}
                                </Text>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <View style={styles.emptyIconContainer}>
                                    <Ionicons name="map-outline" size={60} color="#4A7C44" />
                                </View>
                                <Text style={styles.emptyTitle}>No Trails Found</Text>
                                <Text style={styles.emptySubtitle}>
                                    We couldn't find any trails matching your search. Why not create one yourself?
                                </Text>

                                <TouchableOpacity
                                    style={styles.primaryCreateBtn}
                                    onPress={() => router.push('/trek/create')}
                                >
                                    <Text style={styles.primaryCreateBtnText}>Create New Trail</Text>
                                    <Ionicons name="chevron-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                                </TouchableOpacity>

                                {searchQuery && (
                                    <TouchableOpacity style={styles.osmSearchBtn} onPress={handleGlobalSearch}>
                                        <Text style={styles.osmSearchBtnText}>Search OpenStreetMap</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                    />
                )}
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAF8',
    },
    paperHeader: {
        paddingTop: 10,
        paddingHorizontal: 25,
        paddingBottom: 40,
        backgroundColor: '#FFF',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
        zIndex: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    welcomeText: {
        fontSize: 16,
        color: '#8CA08A',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    headerTitle: {
        fontSize: 36,
        fontWeight: '900',
        color: '#1A3317',
        letterSpacing: -1,
    },
    createIconButton: {
        backgroundColor: '#4A7C44',
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4A7C44',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    searchPaper: {
        backgroundColor: '#F3F7F2',
        borderRadius: 22,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E2EBE1',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        height: 60,
    },
    searchInput: {
        flex: 1,
        fontSize: 17,
        color: '#1A3317',
        fontWeight: '600',
    },
    searchBtn: {
        backgroundColor: '#4A7C44',
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    listHeader: {
        marginTop: 30,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1A3317',
        marginBottom: 10,
    },
    card: {
        height: 240,
        backgroundColor: '#FFF',
        borderRadius: 30,
        marginBottom: 25,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 15,
        elevation: 6,
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    cardBadge: {
        position: 'absolute',
        top: 20,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backdropFilter: 'blur(10px)', // For platforms that support it
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
        marginLeft: 5,
        textTransform: 'uppercase',
    },
    cardInfo: {
        position: 'absolute',
        bottom: 25,
        left: 25,
        right: 25,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFF',
        marginBottom: 8,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    metaText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 6,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    loadingText: {
        marginTop: 15,
        color: '#8CA08A',
        fontWeight: '600',
    },
    searchingOverlay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 15,
        marginBottom: 15,
    },
    searchingText: {
        color: '#2E7D32',
        fontWeight: '700',
        marginLeft: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
        paddingHorizontal: 30,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F3F7F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 25,
    },
    emptyTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: '#1A3317',
        marginBottom: 10,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#8CA08A',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 35,
    },
    primaryCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4A7C44',
        paddingHorizontal: 35,
        paddingVertical: 18,
        borderRadius: 22,
        shadowColor: '#4A7C44',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    primaryCreateBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
    },
    osmSearchBtn: {
        marginTop: 20,
        padding: 10,
    },
    osmSearchBtnText: {
        color: '#4A7C44',
        fontWeight: '700',
        fontSize: 15,
        textDecorationLine: 'underline',
    }
});
