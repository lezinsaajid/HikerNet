
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import client from '../api/client';

export default function UpcomingTreks() {
    const [treks, setTreks] = useState([]);

    useEffect(() => {
        const fetchTreks = async () => {
            try {
                // Fetch nearby (or just generic) treks. 
                // Since this is generic "Upcoming", let's just fetch some treks.
                const res = await client.get('/treks/nearby?lat=11.6854&lon=76.1320&radius=100'); // Wayanad coords default
                setTreks(res.data.slice(0, 5));
            } catch (error) {
                console.log("Error fetching upcoming treks", error);
            }
        };
        fetchTreks();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Upcoming Treks</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {treks.map((trek, index) => (
                    <TouchableOpacity key={trek._id} style={styles.card}>
                        <Image
                            source={{
                                uri: trek.images && trek.images.length > 0
                                    ? trek.images[0]
                                    : `https://source.unsplash.com/random/400x600?nature,mountain&sig=${index}`
                            }}
                            style={styles.image}
                        />
                        <View style={styles.overlay}>
                            <Text style={styles.trekName} numberOfLines={2}>{trek.name}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
                {/* Fallback if no treks found */}
                {treks.length === 0 && (
                    [1, 2].map(i => (
                        <View key={i} style={styles.card}>
                            <Image
                                source={{ uri: `https://source.unsplash.com/random/400x600?forest&sig=${i}` }}
                                style={styles.image}
                            />
                            <View style={styles.overlay}>
                                <Text style={styles.trekName}>Loading Trek...</Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 25,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 15,
        marginBottom: 15,
        color: '#333',
    },
    scroll: {
        paddingLeft: 15,
        paddingRight: 5,
    },
    card: {
        width: 140,
        height: 220,
        marginRight: 15,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    trekName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
    }
});
