
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import client from '../../api/client';
import PostItem from '../../components/PostItem';
import { useAuth } from '../../context/AuthContext';

// V2 Components
import StoryBar from '../../components/StoryBar';
import LiveTrekCard from '../../components/LiveTrekCard';
import NewsSection from '../../components/NewsSection';
import UpcomingTreks from '../../components/UpcomingTreks';
import TopTrekkers from '../../components/TopTrekkers';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeFeed() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [processedData, setProcessedData] = useState([]);
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

    useEffect(() => {
        if (!user || posts.length === 0) {
            setProcessedData(posts);
            return;
        }

        const followingArr = user.following || [];

        // Split posts
        const friendsPosts = [];
        const otherPosts = [];

        if (Array.isArray(posts)) {
            posts.forEach(post => {
                const isFriend = followingArr.includes(post.user._id) || post.user._id === user._id;
                if (isFriend) {
                    friendsPosts.push(post);
                } else {
                    otherPosts.push(post);
                }
            });
        }

        const newData = [];
        if (friendsPosts.length > 0) {
            newData.push({ type: 'header', title: 'Your Activity', _id: 'header-friends' });
            newData.push(...friendsPosts);
        } else {
            newData.push({ type: 'empty-friends', title: 'Start following people', _id: 'empty-friends' });
        }

        if (otherPosts.length > 0) {
            newData.push({ type: 'header', title: 'Suggested for You', _id: 'header-suggestions' });
            newData.push(...otherPosts);
        }

        setProcessedData(newData);

    }, [posts, user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFeed();
    };

    const TopHeader = () => (
        <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.logoText}>HikerNet</Text>
            <View style={styles.headerIcons}>
                <View style={styles.iconButton}>
                    {/* Placeholder for notifications/messages */}
                </View>
            </View>
        </View>
    );

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <StoryBar />

            {/* 
               User requested cleanup: "add the header under it only story"
               Commenting out widgets that made it look "not nice" or cluttered for now.
               If user wants them back in a different spot, we can uncomment.
            */}
            <LiveTrekCard />
            <NewsSection />
            <UpcomingTreks />
            <TopTrekkers />

            <View style={styles.feedHeader}>
                <Text style={styles.sectionTitle}>Community Feed</Text>
            </View>
        </View>
    );

    const renderItem = ({ item }) => {
        if (item.type === 'header') {
            return (
                <View style={styles.feedSectionHeader}>
                    <Text style={styles.feedSectionTitle}>{item.title}</Text>
                    <View style={styles.divider} />
                </View>
            );
        }
        if (item.type === 'empty-friends') {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Start following hikers to see their updates here!</Text>
                </View>
            );
        }
        return <PostItem post={item} />;
    };

    return (
        <View style={styles.container}>
            <TopHeader />
            {loading ? (
                <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={processedData}
                    keyExtractor={(item) => item._id || item.title || 'uknown' + Math.random()}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={<Text style={styles.emptyText}>No posts yet.</Text>}
                    contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        zIndex: 10,
    },
    logoText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#28a745',
        fontFamily: 'System', // Use default or custom font
    },
    headerIcons: {
        flexDirection: 'row',
    },
    iconButton: {
        marginLeft: 15,
    },
    headerContainer: {
        backgroundColor: '#fff',
    },
    feedHeader: {
        paddingHorizontal: 15,
        marginBottom: 5,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    feedSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        marginTop: 10,
    },
    feedSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
        marginRight: 10,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#eee',
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: '#888',
        fontSize: 14,
    }
});
