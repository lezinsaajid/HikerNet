
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import client from '../api/client';

export default function LeaderboardWidget() {
    const [topHikers, setTopHikers] = useState([]);
    const router = useRouter();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await client.get('/users/leaderboard?timeframe=all');
                setTopHikers(res.data.slice(0, 3));
            } catch (error) {
                console.error("Error fetching leaderboard preview", error);
            }
        };
        fetchLeaderboard();
    }, []);

    if (topHikers.length === 0) return null;

    // Arrange as Silver, Gold, Bronze
    const podiumOrder = [topHikers[1], topHikers[0], topHikers[2]];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="trophy" size={20} color="#28a745" style={{ marginRight: 6 }} />
                    <Text style={styles.title}>Top Hikers</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/leaderboard')}>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.card}
                onPress={() => router.push('/leaderboard')}
            >
                <LinearGradient colors={['#1a1a1b', '#2d2d2e']} style={styles.gradient}>
                    <View style={styles.podiumRow}>
                        {podiumOrder.map((user, index) => {
                            if (!user) return <View key={index} style={styles.hikerItem} />;
                            const isFirst = index === 1;
                            const color = isFirst ? '#FFD700' : (index === 0 ? '#C0C0C0' : '#CD7F32');

                            return (
                                <View key={user._id} style={[styles.hikerItem, isFirst && styles.hikerItemFirst]}>
                                    <View style={[styles.avatarContainer, { borderColor: color }]}>
                                        <Image
                                            source={{ uri: user.profileImage || 'https://via.placeholder.com/150' }}
                                            style={[styles.avatar, isFirst && styles.avatarFirst]}
                                        />
                                        <View style={[styles.rankBadge, { backgroundColor: color }]}>
                                            <Text style={styles.rankText}>{isFirst ? '1' : (index === 0 ? '2' : '3')}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.username} numberOfLines={1}>{user.username}</Text>
                                    <Text style={styles.score}>{user.treksCount} Trails</Text>
                                </View>
                            );
                        })}
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1a1a1b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    seeAll: {
        color: '#28a745',
        fontWeight: '700',
        fontSize: 13,
    },
    card: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    gradient: {
        paddingVertical: 20,
        paddingHorizontal: 10,
    },
    podiumRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
    },
    hikerItem: {
        alignItems: 'center',
        width: '30%',
    },
    hikerItemFirst: {
        transform: [{ translateY: -5 }],
    },
    avatarContainer: {
        position: 'relative',
        borderWidth: 2.5,
        padding: 2,
        borderRadius: 100,
        marginBottom: 8,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#333',
    },
    avatarFirst: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    username: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 2,
    },
    score: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
    },
    rankBadge: {
        position: 'absolute',
        bottom: -6,
        alignSelf: 'center',
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#1a1a1b',
    },
    rankText: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: '900',
    },
});
