
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const NEWS_ITEMS = [
    {
        id: 1,
        title: "Top 10 Monsoon Treks in 2026",
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        readTime: "5 min read"
    },
    {
        id: 2,
        title: "Gear Guide: Ultralight Backpacking",
        image: "https://images.unsplash.com/photo-1542152348-73599026b9f2?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        readTime: "3 min read"
    },
    {
        id: 3,
        title: "Survival Skills 101: Fire Starting",
        image: "https://images.unsplash.com/photo-1487612089476-bd46452292f7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        readTime: "7 min read"
    }
];

export default function NewsSection() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>Latest News</Text>
                <TouchableOpacity>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {NEWS_ITEMS.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.card}>
                        <Image source={{ uri: item.image }} style={styles.image} />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.gradient}
                        >
                            <Text style={styles.readTime}>{item.readTime}</Text>
                            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    seeAll: {
        color: '#28a745',
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        paddingHorizontal: 15,
    },
    card: {
        width: 200,
        height: 140,
        marginRight: 15,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#eee',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
        justifyContent: 'flex-end',
        padding: 10,
    },
    readTime: {
        color: '#ddd',
        fontSize: 10,
        marginBottom: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    title: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        lineHeight: 18,
    }
});
