import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, ActivityIndicator } from 'react-native';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';

export default function Leaderboard() {
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

    const renderItem = ({ item, index }) => (
        <View style={styles.card}>
            <View style={styles.rankContainer}>
                {index < 3 ? (
                    <Ionicons name="trophy" size={24} color={index === 0 ? 'gold' : index === 1 ? 'silver' : '#cd7f32'} />
                ) : (
                    <Text style={styles.rankText}>#{index + 1}</Text>
                )}
            </View>
            <Image
                source={{ uri: item.userDetails?.profileImage || 'https://via.placeholder.com/50' }}
                style={styles.avatar}
            />
            <View style={styles.info}>
                <Text style={styles.username}>{item.userDetails?.username || "Hiker"}</Text>
                <Text style={styles.stats}>{Math.round(item.totalDistance / 1000)} km • {item.treksCount} treks</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 60,
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
    rankContainer: {
        width: 40,
        alignItems: 'center',
    },
    rankText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#777',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginHorizontal: 15,
        backgroundColor: '#eee',
    },
    info: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    stats: {
        color: '#666',
        marginTop: 4,
    },
});
