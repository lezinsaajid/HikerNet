import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import client from '../api/client';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

const FALLBACK_IMAGES = [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80'
];

export default function UpcomingTreks() {
    const router = useRouter();
    const [treks, setTreks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTreks = async () => {
            try {
                let status = await Location.getForegroundPermissionsAsync();
                if (status.status !== 'granted') {
                    status = await Location.requestForegroundPermissionsAsync();
                }

                let lat = 11.6854;
                let lon = 76.1320;

                if (status.status === 'granted') {
                    try {
                        let loc = await Location.getLastKnownPositionAsync({});
                        if (!loc) {
                            loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                        }
                        if (loc) {
                            lat = loc.coords.latitude;
                            lon = loc.coords.longitude;
                        }
                    } catch (e) {
                        console.log("Could not get location", e);
                    }
                }

                const res = await client.get(`/treks/nearby?lat=${lat}&lon=${lon}&radius=100`);
                if (Array.isArray(res.data)) {
                    setTreks(res.data.slice(0, 10));
                } else {
                    setTreks([]);
                }
            } catch (error) {
                console.log("Error fetching treks", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTreks();
    }, []);

    const renderTrekCard = (trek, index) => {
        const imageUri = trek.images && trek.images.length > 0
            ? trek.images[0]
            : FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

        const userAvatar = trek.user?.profileImage
            ? { uri: trek.user.profileImage }
            : { uri: `https://ui-avatars.com/api/?name=${trek.user?.username || 'H'}&background=random` };

        return (
            <TouchableOpacity
                key={trek._id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => router.push(`/trek/${trek._id}`)}
            >
                <Image source={{ uri: imageUri }} style={styles.image} />

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradient}
                >
                    <View style={styles.content}>

                        {/* 🔥 FIXED TOP ROW */}
                        <View style={styles.topRow}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {trek.status === 'ongoing' ? 'LIVE' : 'UPCOMING'}
                                </Text>
                            </View>

                            {trek.distanceConfig && (
                                <View style={styles.distanceTag}>
                                    <Ionicons name="location-sharp" size={10} color="white" />
                                    <Text style={styles.distanceText}>
                                        {trek.distanceConfig.toFixed(1)} km
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* 👇 pushed down to avoid overlap */}
                        <Text style={styles.trekName} numberOfLines={1}>
                            {trek.name}
                        </Text>

                        <Text style={styles.locationText} numberOfLines={1}>
                            <Ionicons name="map-outline" size={12} color="#ccc" /> {trek.location || 'Unknown Trail'}
                        </Text>

                        <View style={styles.userRow}>
                            <Image source={userAvatar} style={styles.avatar} />
                            <Text style={styles.userName}>
                                {trek.user?.username || 'Hiker'}
                            </Text>
                        </View>

                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    if (loading) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Near Your Trails</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/trek')}>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                snapToInterval={CARD_WIDTH + 15}
                decelerationRate="fast"
            >
                {treks.map((trek, index) => renderTrekCard(trek, index))}

                {treks.length === 0 && (
                    <View style={styles.noTreks}>
                        <Ionicons name="trail-sign-outline" size={40} color="#eee" />
                        <Text style={styles.noTreksText}>No trails nearby yet</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    seeAll: {
        fontSize: 14,
        color: '#28a745',
        fontWeight: '600',
    },
    scroll: {
        paddingLeft: 20,
        paddingRight: 5,
    },
    card: {
        width: CARD_WIDTH,
        height: 200,
        marginRight: 15,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#f8f8f8',
    },
    image: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '100%',
        justifyContent: 'flex-end',
    },
    content: {
        padding: 15,
        paddingTop: 50, // 🔥 pushes text below badges
    },

    /* 🔥 FIXED SECTION */
    topRow: {
        position: 'absolute',
        top: -50,   // 🔥 change from 12 → 5 (or even 0)
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 2,
    },

    badge: {
        backgroundColor: '#28a745',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },

    distanceTag: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    distanceText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
        marginLeft: 4,
    },

    trekName: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    locationText: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 8,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'white',
    },
    userName: {
        color: 'white',
        fontSize: 12,
        marginLeft: 8,
    },

    noTreks: {
        width: CARD_WIDTH,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#f0f0f0',
        borderStyle: 'dashed',
        borderRadius: 20,
    },
    noTreksText: {
        color: '#999',
        marginTop: 10,
        fontSize: 14,
    },
});