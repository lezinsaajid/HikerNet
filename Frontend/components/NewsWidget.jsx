
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const NEWS_DATA = [
    {
        id: '1',
        title: 'Top 5 Monsoon Treks in Kerala',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        link: 'https://www.keralatourism.org/'
    },
    {
        id: '2',
        title: 'Essential Trekking Gear Checklist',
        image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1353&q=80',
        link: 'https://www.rei.com/learn/expert-advice/day-hiking-checklist.html'
    },
    {
        id: '3',
        title: 'Safety Tips for Solo Trekkers',
        image: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        link: 'https://www.wildcraft.com/'
    },
    {
        id: '4',
        title: 'New Eco-Friendly Trails Opened',
        image: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        link: 'https://www.keralatourism.org/ecotourism/'
    }
];

export default function NewsWidget() {
    const handlePress = (url) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Trending News</Text>
                <TouchableOpacity>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {NEWS_DATA.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.card} onPress={() => handlePress(item.link)}>
                        <Image source={{ uri: item.image }} style={styles.image} />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.gradient}
                        >
                            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
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
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    seeAll: {
        color: '#28a745',
        fontWeight: '600',
    },
    scroll: {
        paddingLeft: 15,
        paddingRight: 5,
    },
    card: {
        width: 200,
        height: 120,
        marginRight: 15,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '60%',
        justifyContent: 'flex-end',
        padding: 10,
    },
    cardTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10
    }
});
