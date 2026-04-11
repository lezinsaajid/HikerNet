import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import client from '../../api/client';
import { getTrailImage } from '../../utils/imageUtils';
import NativeMap, { Polyline, Marker } from '../../components/NativeMap';
import PathPreviewMap from './_components/PathPreviewMap';

const MARKER_ICONS = [
    { name: 'water', icon: 'water', color: '#007bff', label: 'Water' },
    { name: 'camera', icon: 'camera', color: '#6610f2', label: 'Viewpoint' },
    { name: 'danger', icon: 'warning', color: '#dc3545', label: 'Danger' },
    { name: 'camp', icon: 'bonfire', color: '#fd7e14', label: 'Camp' },
    { name: 'rest', icon: 'cafe', color: '#6f42c1', label: 'Rest' },
    { name: 'mountain', icon: 'mountain', color: '#6d4c41', label: 'Peak' },
    { name: 'tree', icon: 'leaf', color: '#2e7d32', label: 'Forest' },
    { name: 'animal', icon: 'paw', color: '#ef6c00', label: 'Wildlife' },
    { name: 'flag', icon: 'flag', color: '#c62828', label: 'Goal' },
    { name: 'info', icon: 'information-circle', color: '#00838f', label: 'Info' },
    { name: 'trail', icon: 'trail-sign', color: '#455a64', label: 'Trail' },
    { name: 'rain', icon: 'rainy', color: '#0288d1', label: 'Rain' },
    { name: 'bicycle', icon: 'bicycle', color: '#311b92', label: 'Cycle' },
    { name: 'fish', icon: 'fish', color: '#03a9f4', label: 'Fishing' },
    { name: 'home', icon: 'home', color: '#546e7a', label: 'Shelter' },
    { name: 'star', icon: 'star', color: '#fbc02d', label: 'Special' },
];

export default function TrailDetailsScreen() {
    const router = useRouter();
    const { id, type } = useLocalSearchParams();
    const [trail, setTrail] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const isOSM = id?.startsWith('osm-');

    useEffect(() => {
        if (id) {
            loadTrailDetails();
        }
    }, [id]);

    const loadTrailDetails = async () => {
        setIsLoading(true);
        try {
            if (isOSM) {
                const osmId = id.replace('osm-', '');
                const res = await client.get(`/treks/discover/${osmId}?type=${type || 'relation'}`);

                const elev = res.data.elevationData;

                setTrail({
                    ...res.data,
                    description: res.data.tags?.description || res.data.tags?.note || "This is a verified trail from OpenStreetMap.",
                    images: [getTrailImage(res.data)],
                    stats: {
                        distance: res.data.tags?.distance ? parseFloat(res.data.tags.distance) * 1000 : 0,
                        elevationGain: elev?.elevationGain || 0,
                        maxElev: elev?.maxElevation || 0,
                        difficulty: res.data.difficulty || "Easy"
                    },
                    // Map OSM coordinates to the format expected by the app
                    coordinates: res.data.coordinates || []
                });
            } else {
                const res = await client.get(`/treks/${id}`);
                const data = res.data;

                // Map path.coordinates to [{latitude, longitude}]
                if (data.path && data.path.coordinates) {
                    if (data.path.type === 'MultiLineString') {
                        // Flatten segments for simple preview or handle MultiPolyline
                        data.coordinates = data.path.coordinates.flat().map(c => ({
                            latitude: c[1],
                            longitude: c[0]
                        }));
                    } else {
                        data.coordinates = data.path.coordinates.map(c => ({
                            latitude: c[1],
                            longitude: c[0]
                        }));
                    }
                }

                setTrail(data);
            }
        } catch (error) {
            console.error(`Failed to load trail details for id: ${id}`, error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStart = (mode) => {
        router.push({
            pathname: '/trek/active-trek',
            params: {
                trailId: id,
                mode
            }
        });
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#28a745" />
                <Text style={{ marginTop: 10, color: '#666' }}>Fetching trail data...</Text>
            </View>
        );
    }

    if (!trail) {
        return (
            <View style={[styles.container, styles.center]}>
                <Ionicons name="alert-circle" size={60} color="#DDD" />
                <Text style={{ fontSize: 18, color: '#666', marginTop: 15 }}>Trail not found.</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
                    <Text style={styles.backLinkText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: trail.images?.[0] || 'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.heroImage}
                />
                <LinearGradient
                    colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.7)']}
                    style={StyleSheet.absoluteFill}
                />
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{trail.name}</Text>
                        <View style={styles.locationRow}>
                            <Ionicons name="location-sharp" size={14} color="#666" />
                            <Text style={styles.locationText}>{trail.location || 'Natural Area'}</Text>
                        </View>
                    </View>
                    {isOSM ? (
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="shield-checkmark" size={14} color="#28a745" />
                            <Text style={styles.verifiedText}>OSM Verified</Text>
                        </View>
                    ) : trail.rating && (
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={16} color="#ffc107" />
                            <Text style={styles.ratingText}>{trail.rating}</Text>
                        </View>
                    )}
                </View>

                {trail.coordinates && trail.coordinates.length > 0 && (
                    <View style={styles.mapPreviewContainer}>
                        <Text style={styles.sectionTitle}>Recorded Path</Text>
                        <View style={styles.mapWrapper}>
                            <PathPreviewMap 
                                coordinates={trail.coordinates} 
                                waypoints={trail.waypoints}
                            />
                        </View>
                    </View>
                )}

                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Ionicons name="resize" size={20} color="#4A7C44" />
                        <Text style={styles.statBoxValue}>
                            {trail.stats?.distance ? (trail.stats.distance / 1000).toFixed(1) : '0'}
                        </Text>
                        <Text style={styles.statBoxLabel}>km dist</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Ionicons name="trending-up" size={20} color="#4A7C44" />
                        <Text style={styles.statBoxValue}>
                            {trail.stats?.elevationGain || '0'}
                        </Text>
                        <Text style={styles.statBoxLabel}>m gain</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Ionicons name="speedometer" size={20} color="#4A7C44" />
                        <Text style={styles.statBoxValue} numberOfLines={1}>
                            {trail.difficulty || trail.stats?.difficulty || 'Medium'}
                        </Text>
                        <Text style={styles.statBoxLabel}>Level</Text>
                    </View>
                </View>

                <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Surface</Text>
                        <Text style={styles.infoValue}>{trail.surface || 'Natural'}</Text>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Visibility</Text>
                        <Text style={styles.infoValue}>{trail.visibility || 'Good'}</Text>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Peak</Text>
                        <Text style={styles.infoValue}>{trail.stats?.maxElev ? `${trail.stats.maxElev}m` : '--'}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Trail Description</Text>
                <Text style={styles.description}>
                    {trail.description || "No detailed description available for this trail."}
                </Text>

                {trail.elevationData?.profile && (
                    <View style={styles.elevationProfile}>
                        <Text style={styles.sectionTitle}>Elevation Profile</Text>
                        <View style={styles.profileGraph}>
                            {trail.elevationData.profile.map((h, i) => {
                                const min = trail.elevationData.minElevation;
                                const max = trail.elevationData.maxElevation;
                                const range = max - min || 1;
                                const height = ((h - min) / range) * 60 + 10;
                                return (
                                    <View key={i} style={[styles.graphBar, { height }]} />
                                );
                            })}
                        </View>
                    </View>
                )}

                <View style={styles.actionSection}>
                    <TouchableOpacity
                        style={[styles.mainBtn, styles.soloBtn]}
                        onPress={() => handleStart('solo')}
                    >
                        <Ionicons name="navigate" size={22} color="white" />
                        <Text style={styles.mainBtnText}>
                            {trail.status === 'completed' ? 'Re-run Solo' : 'Start Solo Trek'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.mainBtn, styles.groupBtn]}
                        onPress={() => handleStart('group')}
                    >
                        <Ionicons name="people-circle" size={24} color="white" />
                        <Text style={styles.mainBtnText}>
                            {trail.status === 'completed' ? 'Re-run Group' : 'Start Group Trek'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAF8',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        width: '100%',
        height: 350,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 45,
        height: 45,
        borderRadius: 23,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        backgroundColor: '#F8FAF8',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        marginTop: -40,
        padding: 30,
        minHeight: 500,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 25,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1A3317',
        marginBottom: 8,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        color: '#666',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 6,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#C8E6C9',
    },
    verifiedText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2E7D32',
        marginLeft: 5,
        textTransform: 'uppercase',
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
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    statBox: {
        backgroundColor: '#FFF',
        width: '30%',
        padding: 15,
        borderRadius: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    statBoxValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1A3317',
        marginTop: 10,
    },
    statBoxLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8CA08A',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    infoRow: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 25,
        justifyContent: 'space-between',
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    infoItem: {
        alignItems: 'center',
        flex: 1,
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#8CA08A',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A3317',
    },
    infoDivider: {
        width: 1,
        height: '80%',
        backgroundColor: '#E2EBE1',
        alignSelf: 'center',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1A3317',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        lineHeight: 26,
        color: '#556B52',
        marginBottom: 30,
        fontWeight: '500',
    },
    elevationProfile: {
        marginBottom: 40,
    },
    profileGraph: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 100,
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    graphBar: {
        width: 6,
        backgroundColor: '#4A7C44',
        borderRadius: 3,
        opacity: 0.6,
    },
    actionSection: {
        paddingBottom: 50,
    },
    mainBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 22,
        marginBottom: 15,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    soloBtn: {
        backgroundColor: '#4A7C44',
        shadowColor: '#4A7C44',
    },
    groupBtn: {
        backgroundColor: '#1E4620',
        shadowColor: '#1E4620',
    },
    mainBtnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        marginLeft: 10,
    },
    backLink: {
        marginTop: 20,
        padding: 10,
    },
    backLinkText: {
        color: '#4A7C44',
        fontWeight: '700',
        fontSize: 16,
    },
    mapPreviewContainer: {
        marginBottom: 30,
    },
    mapWrapper: {
        height: 250,
        borderRadius: 25,
        overflow: 'hidden',
        marginTop: 10,
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
});
