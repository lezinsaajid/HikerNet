
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';

export default function LeaderboardWidget() {
    const [topHikers, setTopHikers] = useState([]);
    const router = useRouter();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await client.get('/users/leaderboard');
                // Take top 3
                setTopHikers(res.data.slice(0, 3));
            } catch (error) {
                console.error("Error fetching leaderboard preview", error);
            }
        };
        fetchLeaderboard();
    }, []);

    if (topHikers.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Top Hikers 🏆</Text>
                <TouchableOpacity onPress={() => router.push('/leaderboard')}>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.card} onPress={() => router.push('/leaderboard')}>
                <View style={styles.row}>
                    {topHikers.map((user, index) => (
                        <View key={user._id} style={styles.hikerItem}>
                            <View style={styles.rankBadge}>
                                <Text style={styles.rankText}>{index + 1}</Text>
                            </View>
                            <Image
                                source={{ uri: user.profileImage || 'https://via.placeholder.com/150' }}
                                style={[
                                    styles.avatar,
                                    index === 0 && styles.firstPlace,
                                    index === 1 && styles.secondPlace,
                                    index === 2 && styles.thirdPlace
                                ]}
                            />
                            <Text style={styles.username} numberOfLines={1}>{user.username}</Text>
                            <Text style={styles.score}>{user.treksCount} Treks</Text>
                        </View>
                    ))}
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        paddingHorizontal: 15,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    seeAll: {
        color: '#28a745',
        fontWeight: '600',
    },
    card: {
        backgroundColor: '#f9f9f9',
        borderRadius: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: '#eee',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
    },
    hikerItem: {
        alignItems: 'center',
        width: '30%',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginBottom: 5,
        borderWidth: 2,
        borderColor: '#ddd',
    },
    username: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    score: {
        fontSize: 10,
        color: '#666',
    },
    rankBadge: {
        position: 'absolute',
        top: -5,
        right: 15,
        backgroundColor: '#333',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    rankText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    // Rank specific styles
    firstPlace: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderColor: '#FFD700', // Gold
        borderWidth: 3,
    },
    secondPlace: {
        borderColor: '#C0C0C0', // Silver
    },
    thirdPlace: {
        borderColor: '#CD7F32', // Bronze
    },
});
