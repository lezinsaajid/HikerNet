import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import UserListModal from '../../components/UserListModal';
import SafeScreen from '../../components/SafeScreen';

const { width } = Dimensions.get('window');


export default function UserProfile() {
    const { user, updateUserData } = useAuth();
    const router = useRouter();
    const { id } = useLocalSearchParams(); // Get user ID from route params
    const [posts, setPosts] = useState([]);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);

    // User List Modal State
    const [userListVisible, setUserListVisible] = useState(false);
    const [userListType, setUserListType] = useState('followers');
    const [activeTab, setActiveTab] = useState('posts'); // 'posts', 'trails', 'tagged'
    const [userStories, setUserStories] = useState([]);
    const [userAdventures, setUserAdventures] = useState([]);

    useEffect(() => {
        if (id) {
            fetchProfileData();
            fetchUserPosts();
            fetchUserStories();
            fetchUserAdventures();
        }
    }, [id, fetchProfileData, fetchUserPosts, fetchUserStories, fetchUserAdventures]);

    const fetchProfileData = useCallback(async () => {
        try {
            const res = await client.get(`/users/profile/${id}`);
            setUserData(res.data);
            const currentFollowing = Array.isArray(user?.following) ? user.following.map(fid => String(fid)) : [];
            setIsFollowing(currentFollowing.includes(String(id)));
        } catch (error) {
            console.error("Error fetching profile:", error);
            Alert.alert("Error", "User not found");
            router.back();
        }
    }, [id, user?.following, router]);

    const fetchUserPosts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await client.get(`/users/posts/${id}`);
            setPosts(res.data);
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchUserStories = useCallback(async () => {
        try {
            const res = await client.get(`/stories/user/${id}`);
            setUserStories(res.data || []);
        } catch (error) {
            console.error("Error fetching stories:", error);
        }
    }, [id]);

    const fetchUserAdventures = useCallback(async () => {
        try {
            const res = await client.get(`/adventures/user/${id}`);
            setUserAdventures(res.data || []);
        } catch (error) {
            console.error("Error fetching adventures:", error);
        }
    }, [id]);

    const openUserList = (type) => {
        setUserListType(type);
        setUserListVisible(true);
    };

    const handleConnect = async () => {
        try {
            const res = await client.post(`/users/follow/${id}`);

            // Toggle local state
            setIsFollowing(!isFollowing);

            const currentUserIdStr = String(user._id);
            const targetIdStr = String(id);

            // Update profile being viewed (targetId)
            setUserData(prev => ({
                ...prev,
                followers: !isFollowing
                    ? [...(prev.followers || []), currentUserIdStr]
                    : (prev.followers || []).filter(fid => String(fid) !== currentUserIdStr),
                following: !isFollowing
                    ? [...(prev.following || []), currentUserIdStr]
                    : (prev.following || []).filter(fid => String(fid) !== currentUserIdStr)
            }));

            // Sync with global user state (currentUser)
            const updatedFollowing = !isFollowing
                ? [...(user.following || []), targetIdStr]
                : (user.following || []).filter(fid => String(fid) !== targetIdStr);
            const updatedFollowers = !isFollowing
                ? [...(user.followers || []), targetIdStr]
                : (user.followers || []).filter(fid => String(fid) !== targetIdStr);

            updateUserData({ ...user, following: updatedFollowing, followers: updatedFollowers });

        } catch (error) {
            console.error("Error connecting:", error);
            Alert.alert("Error", "Could not update connection");
        }
    };

    const handleMenuPress = () => {
        Alert.alert(
            "Options",
            "Select an action",
            [
                {
                    text: isFollowing ? "Remove Friend" : "Follow",
                    onPress: handleConnect, // Reusing handleConnect logic which toggles follow
                },
                {
                    text: "Block User",
                    style: "destructive",
                    onPress: confirmBlock,
                },
                {
                    text: "Cancel",
                    style: "cancel",
                }
            ]
        );
    };

    const confirmBlock = () => {
        Alert.alert(
            "Block User",
            "Are you sure? This will remove them from your friends list.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Block", style: "destructive", onPress: handleBlock }
            ]
        );
    };

    const handleBlock = async () => {
        try {
            const res = await client.post(`/users/block/${id}`);

            // Update local state if needed, or simply route back
            Alert.alert("Blocked", "User has been blocked.");

            // Remove from friends list if blocked
            if (isFollowing) {
                const targetIdStr = String(id);
                const updatedFollowing = (user.following || []).filter(fid => String(fid) !== targetIdStr);
                const updatedFollowers = (user.followers || []).filter(fid => String(fid) !== targetIdStr);
                updateUserData({ ...user, following: updatedFollowing, followers: updatedFollowers });
            }

            router.back();
        } catch (error) {
            console.error("Error blocking user:", error);
            Alert.alert("Error", "Failed to block user");
        }
    };

    const handleDeletePost = async (postId) => {
        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await client.delete(`/posts/${postId}`);
                            fetchUserPosts(); // Refresh posts
                            Alert.alert("Success", "Post deleted");
                        } catch (error) {
                            console.error("Delete post error:", error);
                            Alert.alert("Error", "Failed to delete post");
                        }
                    }
                }
            ]
        );
    };

    const renderGridItem = ({ item }) => {
        if (activeTab === 'trails') {
            return (
                <View style={styles.adventureCard}>
                    <View style={styles.adventureHeader}>
                        <View style={styles.adventureUserGroup}>
                            <Image source={{ uri: item.user?.profileImage }} style={styles.adventureAvatar} />
                            <View>
                                <Text style={styles.adventureUsername}>{item.user?.username}</Text>
                                <Text style={styles.adventureDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.adventureContent}>{item.content}</Text>
                </View>
            );
        }

        if (activeTab === 'tagged') {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="person-circle-outline" size={64} color="#EEE" />
                    <Text style={styles.emptyText}>No tagged posts yet</Text>
                </View>
            );
        }

        const isStory = activeTab === 'stories';
        const imageUri = isStory ? item.media : item.image;
        const isOwner = String(id) === String(user?._id);

        return (
            <TouchableOpacity
                style={styles.postGridItem}
                onPress={() => {
                    if (isStory) {
                        router.push({ pathname: '/story/view', params: { userId: id } });
                    } else {
                        router.push(`/post/${item._id}`);
                    }
                }}
                onLongPress={() => {
                    if (!isStory && isOwner) {
                        handleDeletePost(item._id);
                    }
                }}
            >
                <Image
                    source={{ uri: imageUri || 'https://via.placeholder.com/301' }}
                    style={styles.gridImage}
                />
            </TouchableOpacity>
        );
    };

    if (loading && !userData) {
        return (
            <SafeScreen style={{ justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4A7C44" />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerUsername}>{userData?.username}</Text>
                <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
                    <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <FlatList
                key={activeTab === 'trails' ? 'single' : 'grid'}
                data={activeTab === 'posts' ? posts : (activeTab === 'trails' ? userAdventures : [])}
                numColumns={activeTab === 'trails' ? 1 : 3}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={
                    <View style={styles.headerContainer}>
                        <View style={styles.profileMainInfo}>
                            <View style={styles.avatarContainer}>
                                <Image
                                    source={{ uri: userData?.profileImage || 'https://via.placeholder.com/150' }}
                                    style={styles.avatar}
                                />
                            </View>
                            <View style={styles.titleInfo}>
                                <Text style={styles.displayName}>{userData?.username}</Text>
                                <View style={styles.locationRow}>
                                    <Ionicons name="location-outline" size={14} color="#666" />
                                    <Text style={styles.locationText}>{userData?.location || "Mountain Peak, CO"}</Text>
                                </View>
                            </View>
                        </View>

                        {userData?.bio ? (
                            <Text style={styles.bioText} numberOfLines={3}>
                                {userData.bio}
                            </Text>
                        ) : null}

                        {/* Action Buttons: Chat & Connect ONLY */}
                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.chatBtn]}
                                onPress={() => Alert.alert("Chat", "Coming soon!")}
                            >
                                <Text style={styles.chatBtnText}>Chat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, isFollowing ? styles.followingBtn : styles.connectBtn]}
                                onPress={handleConnect}
                            >
                                <Text style={[styles.connectBtnText, isFollowing && styles.followingBtnText]}>
                                    {isFollowing ? "Following" : "Connect"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{posts.length}</Text>
                                <Text style={styles.statLabel}>Trails</Text>
                            </View>
                            <View style={styles.statsDivider} />
                            <TouchableOpacity style={styles.statItem} onPress={() => openUserList('following')}>
                                <Text style={styles.statValue}>
                                    {userData?._id && user?._id && String(userData._id) === String(user._id) ? (user.following?.length || 0) : (userData?.following?.length || 0)}
                                </Text>
                                <Text style={styles.statLabel}>Friends</Text>
                            </TouchableOpacity>
                            <View style={styles.statsDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>
                                    {posts.length > 0 && userData?.rank ? `#${userData.rank}` : '#-'}
                                </Text>
                                <Text style={styles.statLabel}>Rank</Text>
                            </View>
                        </View>

                        <View style={styles.tabsSection}>
                            <TouchableOpacity
                                style={[styles.tabItem, activeTab === 'posts' && styles.activeTabItem]}
                                onPress={() => setActiveTab('posts')}
                            >
                                <Ionicons
                                    name={activeTab === 'posts' ? "grid" : "grid-outline"}
                                    size={24}
                                    color={activeTab === 'posts' ? "#2D2D2D" : "#A0A0A0"}
                                />
                                {activeTab === 'posts' && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabItem, activeTab === 'trails' && styles.activeTabItem]}
                                onPress={() => setActiveTab('trails')}
                            >
                                <Ionicons
                                    name={activeTab === 'trails' ? "map" : "map-outline"}
                                    size={24}
                                    color={activeTab === 'trails' ? "#2D2D2D" : "#A0A0A0"}
                                />
                                {activeTab === 'trails' && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabItem, activeTab === 'tagged' && styles.activeTabItem]}
                                onPress={() => setActiveTab('tagged')}
                            >
                                <Ionicons
                                    name={activeTab === 'tagged' ? "person" : "person-outline"}
                                    size={24}
                                    color={activeTab === 'tagged' ? "#2D2D2D" : "#A0A0A0"}
                                />
                                {activeTab === 'tagged' && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>
                        </View>
                    </View>
                }
                renderItem={renderGridItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name={activeTab === 'stories' ? "play-circle-outline" : "images-outline"}
                                size={64}
                                color="#EEE"
                            />
                            <Text style={styles.emptyText}>
                                {activeTab === 'posts' ? "No posts yet" : activeTab === 'trails' ? "No trails yet" : "No tagged posts yet"}
                            </Text>
                        </View>
                    )
                }
            />

            <UserListModal
                visible={userListVisible}
                onClose={() => setUserListVisible(false)}
                userId={id}
                type={userListType}
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#FFF',
    },
    headerUsername: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    backButton: {
        padding: 5,
    },
    listContent: {
        paddingBottom: 20,
    },
    headerContainer: {
        paddingHorizontal: 20,
        paddingTop: 15,
        backgroundColor: '#FBFBFB',
    },
    profileMainInfo: {
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarContainer: {
        marginBottom: 15,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0F0F0',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    titleInfo: {
        alignItems: 'center',
    },
    displayName: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#2D2D2D',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        fontSize: 14,
        color: '#6F6F6F',
        marginLeft: 4,
    },
    bioText: {
        fontSize: 14,
        color: '#262626',
        lineHeight: 20,
        marginBottom: 25,
        paddingHorizontal: 20,
        textAlign: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        marginBottom: 30,
        paddingHorizontal: 15,
    },
    actionBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 5,
    },
    chatBtn: {
        backgroundColor: '#403A36',
    },
    chatBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    connectBtn: {
        backgroundColor: '#7A4B3A',
    },
    connectBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    followingBtn: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#7A4B3A',
    },
    followingBtnText: {
        color: '#7A4B3A',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 10,
        marginBottom: 20,
        backgroundColor: 'transparent',
    },
    statItem: {
        alignItems: 'center',
        marginHorizontal: 20,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2D2D2D',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        color: '#999',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    statsDivider: {
        width: 1,
        height: '40%',
        backgroundColor: '#DDD',
        alignSelf: 'center',
    },
    tabsSection: {
        flexDirection: 'row',
        marginBottom: 10,
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingBottom: 12,
        position: 'relative',
    },
    tabLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#A0A0A0',
    },
    activeTabLabel: {
        color: '#2D2D2D',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#2D2D2D',
        borderRadius: 1,
    },
    postGridItem: {
        width: width / 3,
        height: width / 3,
        padding: 4,
    },
    gridImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        backgroundColor: '#EEE',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        color: '#AAA',
        marginTop: 10,
        fontSize: 16,
    },
    adventureCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 20,
        marginBottom: 15,
        borderRadius: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    adventureHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    adventureUserGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    adventureAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 10,
        backgroundColor: '#F0F0F0',
    },
    adventureUsername: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2D2D2D',
    },
    adventureDate: {
        fontSize: 12,
        color: '#999',
    },
    adventureContent: {
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
    },
});
