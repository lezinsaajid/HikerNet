import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import SafeScreen from '../../components/SafeScreen';


export default function Leaderboard() {
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await client.get('/users/leaderboard');
                setUsers(res.data);
            } catch (error) {
                console.error("Error fetching leaderboard", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const getTierColor = (tier) => {
        switch (tier) {
            case 'Trail Master': return '#ff922b'; // Orange
            case 'Pathfinder': return '#5c7cfa'; // Blue
            case 'Explorer': return '#28a745'; // Green
            case 'Wanderer': return '#94d82d'; // Lime
            default: return '#adb5bd'; // Gray
        }
    };

    const renderItem = ({ item, index }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/user-profile/${item._id}`)}
        >
            <View style={styles.rankBadgeContainer}>
                <View style={[styles.tierBadgeWrapper, { backgroundColor: getTierColor(item.tier) }]}>
                    <Text style={styles.tierRankText}>{item.tier || "Newbie"}</Text>
                </View>
                <Text style={styles.rankLabel}>Rank #{index + 1}</Text>
            </View>

            <View style={styles.profileSection}>
                <Image
                    source={{ uri: item.profileImage || 'https://via.placeholder.com/60' }}
                    style={styles.avatar}
                />
                <View style={styles.info}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.username}>{item.username}</Text>
                        {item.location && <Text style={styles.locationSmall}> • {item.location}</Text>}
                    </View>
                    <Text style={styles.stats}>{item.treksCount} trails • {Math.round(item.totalDistance / 1000)} km</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeScreen>
            <Text style={styles.headerTitle}>Global Leaderboard</Text>
            {loading ? (
                <ActivityIndicator size="large" color="#28a745" />
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                />
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    list: {
        paddingHorizontal: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
    },
    rankBadgeContainer: {
        width: 85,
        alignItems: 'center',
        paddingRight: 10,
        borderRightWidth: 1,
        borderRightColor: '#F0F0F0',
    },
    tierBadgeWrapper: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 4,
        alignItems: 'center',
        width: '100%',
    },
    tierRankText: {
        fontSize: 9,
        color: '#fff',
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    rankLabel: {
        fontSize: 11,
        color: '#AAB8C2',
        fontWeight: '700',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingLeft: 15,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    info: {
        flex: 1,
    },
    username: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#1A1A1B',
        marginBottom: 2,
    },
    stats: {
        fontSize: 12,
        color: '#71767B',
        marginTop: 2,
    },
    locationSmall: {
        fontSize: 12,
        color: '#28a745',
        marginLeft: 4,
        fontWeight: '500',
    }
});
