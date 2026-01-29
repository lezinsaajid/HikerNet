
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../api/client';

const { width } = Dimensions.get('window');

export default function TopTrekkers() {
    const [topHikers, setTopHikers] = useState([]);
    const router = useRouter();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await client.get('/users/leaderboard');
                setTopHikers(res.data.slice(0, 3)); // Top 3 for collage
            } catch (error) {
                console.error("Error fetching top trekkers", error);
            }
        };
        fetchLeaderboard();
    }, []);

    if (topHikers.length < 3) return null; // Need at least 3 for the specific collage layout

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Top Trekkers</Text>

            <TouchableOpacity style={styles.collage} onPress={() => router.push('/leaderboard')}>
                {/* Big Left Image (Rank 1) */}
                <View style={styles.leftCol}>
                    <Image source={{ uri: topHikers[0].profileImage }} style={styles.bigImage} />
                    <View style={styles.overlay}>
                        <Text style={styles.rankName}>1. {topHikers[0].username}</Text>
                        <Text style={styles.rankStats}>{topHikers[0].treksCount} Treks</Text>
                    </View>
                </View>

                {/* Right Column (Rank 2 & 3) */}
                <View style={styles.rightCol}>
                    <View style={styles.rightTop}>
                        <Image source={{ uri: topHikers[1].profileImage }} style={styles.smallImage} />
                        <View style={styles.overlaySmall}>
                            <Text style={styles.rankNameSmall}>2. {topHikers[1].username}</Text>
                        </View>
                    </View>
                    <View style={styles.rightBottom}>
                        <Image source={{ uri: topHikers[2].profileImage }} style={styles.smallImage} />
                        <View style={styles.overlaySmall}>
                            <Text style={styles.rankNameSmall}>3. {topHikers[2].username}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 15,
        marginBottom: 30,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    collage: {
        flexDirection: 'row',
        height: 250,
        borderRadius: 15,
        overflow: 'hidden',
    },
    leftCol: {
        flex: 2,
        marginRight: 2,
    },
    rightCol: {
        flex: 1,
        marginLeft: 2,
    },
    rightTop: {
        flex: 1,
        marginBottom: 2,
    },
    rightBottom: {
        flex: 1,
        marginTop: 2,
    },
    bigImage: {
        width: '100%',
        height: '100%',
    },
    smallImage: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    overlaySmall: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 5,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    rankName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    rankStats: {
        color: '#ddd',
        fontSize: 12,
    },
    rankNameSmall: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    }
});
