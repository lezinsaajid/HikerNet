import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { fetchTrekkingNews } from '../api/news';

export default function NewsScreen() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadNews();
    }, []);

    const loadNews = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);
            
            // fetch 15 articles for the main page
            const data = await fetchTrekkingNews();
            setNews(data);
        } catch (err) {
            setError(err.message || 'Failed to load news. Please try again later.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => item.url && Linking.openURL(item.url)}
        >
            <Image source={{ uri: item.urlToImage }} style={styles.image} />
            <View style={styles.cardContent}>
                <View style={styles.metaData}>
                    <Text style={styles.source} numberOfLines={1}>
                        {item.source?.name || 'News Source'}
                    </Text>
                    <Text style={styles.date}>
                        {new Date(item.publishedAt).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric'
                        })}
                    </Text>
                </View>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            <Stack.Screen 
                options={{ 
                    title: "Trekking News",
                    headerStyle: { backgroundColor: '#fff' },
                    headerTintColor: '#000',
                    headerTitleStyle: { fontWeight: 'bold' },
                    headerShown: false // since we are using secure area
                }} 
            />
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#28a745" />
                    <Text style={styles.loadingText}>Fetching latest updates...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>Oops! {error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => loadNews()}>
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={news}
                    keyExtractor={(item, index) => item.url || index.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadNews(true)} />
                    }
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No news found at the moment.</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 15,
        color: '#666',
        fontSize: 15,
    },
    errorText: {
        color: '#dc3545',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 15,
    },
    retryButton: {
        backgroundColor: '#28a745',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    retryText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#666',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 40,
    },
    listContent: {
        padding: 15,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden',
        // Shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        // Elevation for Android
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    image: {
        width: 110,
        height: 110,
        backgroundColor: '#eee',
    },
    cardContent: {
        flex: 1,
        padding: 12,
        justifyContent: 'space-between',
    },
    metaData: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    source: {
        flex: 1,
        fontSize: 12,
        color: '#28a745',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginRight: 8,
    },
    date: {
        fontSize: 12,
        color: '#888',
    },
    title: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#333',
        lineHeight: 20,
    }
});
