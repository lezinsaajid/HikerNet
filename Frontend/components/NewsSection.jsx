import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, ActivityIndicator, Linking } from 'react-native';
import { Link } from 'expo-router';
import { fetchTrekkingNews } from '../api/news';
import { LinearGradient } from 'expo-linear-gradient';

export default function NewsSection() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadNews();
    }, []);

    const loadNews = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchTrekkingNews();
            // Only show top 5 in homepage horizontal scroll
            setNews(data.slice(0, 5));
        } catch (err) {
            setError('Failed to load news.');
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => item.url && Linking.openURL(item.url)}
        >
            <Image source={{ uri: item.urlToImage }} style={styles.image} />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                style={styles.gradient}
            >
                <Text style={styles.source} numberOfLines={1}>
                    {item.source?.name || 'News Source'}
                </Text>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>Trekking News</Text>
                {error ? (
                    <TouchableOpacity onPress={loadNews}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                ) : (
                    <Link href="/news" asChild>
                        <TouchableOpacity>
                            <Text style={styles.seeAll}>See All</Text>
                        </TouchableOpacity>
                    </Link>
                )}
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="small" color="#28a745" />
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <FlatList
                    data={news}
                    keyExtractor={(item, index) => item.url || index.toString()}
                    renderItem={renderItem}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No news found at the moment.</Text>
                    }
                />
            )}
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
    retryText: {
        color: '#28a745',
        fontSize: 14,
        fontWeight: '600',
    },
    centerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 140,
    },
    errorText: {
        color: '#dc3545',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 20,
        paddingHorizontal: 20,
    },
    listContent: {
        paddingHorizontal: 15,
    },
    card: {
        width: 280,
        height: 160,
        marginRight: 15,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#eee',
        // Shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        // Elevation for Android
        elevation: 3,
    },
    image: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
        justifyContent: 'flex-end',
        padding: 15,
    },
    source: {
        fontSize: 11,
        color: '#28a745',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
        lineHeight: 20,
    }
});
