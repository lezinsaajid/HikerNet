import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StoryBar from '../../components/StoryBar';
import WeatherWidget from '../../components/WeatherWidget';
import SafeScreen from '../../components/SafeScreen';


export default function HomeFeed() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFeed = async () => {
        try {
            const res = await client.get('/posts/feed');
            setPosts(res.data);
        } catch (error) {
            console.error("Error fetching feed", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchFeed();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFeed();
    };

    const renderPost = ({ item }) => (
        <View style={styles.postCard}>
            <View style={styles.header}>
                <Image source={{ uri: item.user.profileImage }} style={styles.avatar} />
                <Text style={styles.username}>{item.user.username}</Text>
            </View>
            {item.image && (
                <Image source={{ uri: item.image }} style={styles.postImage} />
            )}
            <View style={styles.content}>
                <Text style={styles.caption}>
                    <Text style={styles.usernameText}>{item.user.username} </Text>
                    {item.caption}
                </Text>

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="heart-outline" size={24} color="black" />
                        <Text style={styles.actionText}>{item.likes.length}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="chatbubble-outline" size={24} color="black" />
                        <Text style={styles.actionText}>{item.comments.length}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <SafeScreen>
            <View style={styles.topBar}>
                <Text style={styles.logo}>Hikernet</Text>
                <WeatherWidget compact={true} />
            </View>

            <View>
                <StoryBar />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item._id}
                    renderItem={renderPost}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No posts yet. Follow some hikers!</Text>}
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
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    logo: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#28a745',
        fontFamily: 'System', // default
    },
    postCard: {
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    avatar: {
        width: 35,
        height: 35,
        borderRadius: 17.5,
        marginRight: 10,
        backgroundColor: '#eee',
    },
    username: {
        fontWeight: 'bold',
    },
    postImage: {
        width: '100%',
        height: 300,
        backgroundColor: '#f8f8f8',
    },
    content: {
        padding: 10,
    },
    caption: {
        fontSize: 14,
        marginBottom: 10,
    },
    usernameText: {
        fontWeight: 'bold',
    },
    actions: {
        flexDirection: 'row',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
    },
    actionText: {
        marginLeft: 5,
        fontSize: 14,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#888',
    }
});
