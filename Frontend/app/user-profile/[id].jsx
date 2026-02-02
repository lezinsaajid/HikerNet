import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import UserListModal from '../../components/UserListModal';
import SafeScreen from '../../components/SafeScreen';

const { width } = Dimensions.get('window');

const TIER_STYLING = {
    'Trail Master': { color: '#28a745', icon: 'flame', glow: 'rgba(40, 167, 69, 0.4)' },
    'Pathfinder': { color: '#007AFF', icon: 'map', glow: 'rgba(0, 122, 255, 0.4)' },
    'Explorer': { color: '#34C759', icon: 'compass', glow: 'rgba(52, 199, 89, 0.4)' },
    'Wanderer': { color: '#28a745', icon: 'walk', glow: 'rgba(255, 214, 10, 0.4)' },
    'Newbie': { color: '#8E8E93', icon: 'footsteps', glow: 'rgba(142, 142, 147, 0.4)' }
};

const getTierColor = (tier) => TIER_STYLING[tier]?.color || '#adb5bd';
const getTierGlow = (tier) => TIER_STYLING[tier]?.glow || 'rgba(173, 181, 189, 0.2)';


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
            // Fetch both Treks and Adventure Remarks
            const [treksRes, remarksRes] = await Promise.all([
                client.get(`/treks/user/${id}`),
                client.get(`/adventures/user/${id}`)
            ]);

            // Combine and sort by date
            const combined = [
                ...(treksRes.data || []).map(t => ({ ...t, displayType: 'trek' })),
                ...(remarksRes.data || []).map(r => ({ ...r, displayType: 'remark' }))
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setUserAdventures(combined);
        } catch (error) {
            console.error("Error fetching adventures:", error);
            setUserAdventures([]);
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
            const isRemark = item.displayType === 'remark';
            return (
                <TouchableOpacity
                    activeOpacity={isRemark ? 1 : 0.7}
                    onPress={() => {
                        if (!isRemark) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push(`/trek/${item._id}`);
                        }
                    }}
                >
                    <View style={styles.adventureCard}>
                        <View style={styles.adventureHeader}>
                            <View style={styles.adventureUserGroup}>
                                <Ionicons
                                    name={isRemark ? "chatbubble-ellipses-outline" : "map-outline"}
                                    size={24}
                                    color={isRemark ? "#28a745" : "#4A7C44"}
                                    style={{ marginRight: 10 }}
                                />
                                <View>
                                    <Text style={styles.adventureUsername}>{isRemark ? "Adventure Remark" : item.name}</Text>
                                    <Text style={styles.adventureDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                                </View>
                            </View>
                        </View>
                        {isRemark ? (
                            <Text style={styles.adventureContent}>{item.content}</Text>
                        ) : item.location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                <Ionicons name="location" size={14} color="#666" />
                                <Text style={[styles.adventureContent, { marginLeft: 4 }]}>{item.location}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
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
                <ActivityIndicator size="large" color="#28a745" />
            </SafeScreen>
        );
    }

    const handleChatPress = async () => {
        try {
            const res = await client.post('/chat', { partnerId: id });
            router.push(`/chat/${res.data._id}`);
        } catch (error) {
            console.error("Chat creation error:", error);
            Alert.alert("Error", "Could not start chat");
        }
    };

    return (
        <SafeScreen backgroundColor="#F8F9FA" statusBarStyle="dark-content">
            {/* ... topBar ... */}
            <View style={styles.topBar}>
                {/* ... existing topBar content ... */}
                <LinearGradient
                    colors={['#F8F9FA', '#FBFBFB']}
                    style={StyleSheet.absoluteFill}
                />
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.back();
                    }}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={28} color="#1a1a1b" />
                </TouchableOpacity>
                <Text style={styles.headerUsername}>{userData?.username}</Text>
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleMenuPress();
                    }}
                    style={styles.menuButton}
                >
                    <Ionicons name="ellipsis-horizontal" size={24} color="#1a1a1b" />
                </TouchableOpacity>
            </View>

            <FlatList
                // ... props ...
                key={activeTab === 'trails' ? 'single' : 'grid'}
                data={activeTab === 'posts' ? posts : (activeTab === 'trails' ? userAdventures : [])}
                numColumns={activeTab === 'trails' ? 1 : 3}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={
                    <Animated.View entering={FadeInUp.duration(600)} style={styles.headerContainer}>
                        {/* ... headerGradient ... */}
                        <LinearGradient
                            colors={['#E8F5E9', '#FFFFFF']}
                            style={styles.headerGradient}
                        />
                        {/* ... profileRow ... */}
                        <View style={styles.profileRow}>
                            {/* ... avatarWrapper ... */}
                            <View style={styles.avatarWrapper}>
                                <View style={[styles.avatarGlow, { backgroundColor: getTierGlow(userData?.tier || 'Wanderer') }]} />
                                <View style={styles.avatarContainer}>
                                    <Image
                                        source={{ uri: userData?.profileImage || 'https://via.placeholder.com/150' }}
                                        style={styles.avatar}
                                    />
                                </View>
                            </View>

                            <View style={styles.infoColumn}>
                                <Text style={styles.displayName}>{userData?.username || 'Hiker'}</Text>

                                {userData?.location && (
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-sharp" size={14} color="#A0A0A0" />
                                        <Text style={styles.locationText}>{userData.location}</Text>
                                    </View>
                                )}

                                <View style={[styles.tierBadge, { backgroundColor: getTierColor(userData?.tier || 'Wanderer') + '20', borderColor: getTierColor(userData?.tier || 'Wanderer') }]}>
                                    <Ionicons name={TIER_STYLING[userData?.tier || 'Wanderer']?.icon || 'walk'} size={12} color={getTierColor(userData?.tier || 'Wanderer')} style={{ marginRight: 4 }} />
                                    <Text style={[styles.tierBadgeText, { color: getTierColor(userData?.tier || 'Wanderer') }]}>{userData?.tier || 'Wanderer'}</Text>
                                </View>

                                {userData?.bio && (
                                    <Text style={styles.bioText} numberOfLines={3}>{userData.bio}</Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.statsBar}>
                            {/* ... statsBar items ... */}
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setActiveTab('trails');
                                }}
                            >
                                <Text style={styles.statValue}>{userData?.treksCount || userAdventures.length}</Text>
                                <Text style={styles.statLabel}>Trails</Text>
                            </TouchableOpacity>
                            <View style={styles.statDivider} />
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    openUserList('followers');
                                }}
                            >
                                <Text style={styles.statValue}>{userData?.followers?.length || 0}</Text>
                                <Text style={styles.statLabel}>Friends</Text>
                            </TouchableOpacity>
                            <View style={styles.statDivider} />
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    router.push('/leaderboard');
                                }}
                            >
                                <Text style={styles.statValue}>
                                    {(userData?.treksCount || userAdventures.length) > 0 && userData?.rank ? `#${userData.rank}` : '#-'}
                                </Text>
                                <Text style={styles.statLabel}>Rank</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.chatBtn]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    handleChatPress();
                                }}
                            >
                                <Text style={styles.chatBtnText}>Chat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, isFollowing ? styles.followingBtn : styles.connectBtn]}
                                onPress={() => {
                                    Haptics.impactAsync(isFollowing ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
                                    handleConnect();
                                }}
                            >
                                <Text style={[styles.connectBtnText, isFollowing && styles.followingBtnText]}>
                                    {isFollowing ? "Following" : "Connect"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.tabSectionContainer}>
                            <View style={styles.tabsSection}>
                                <TouchableOpacity
                                    style={[styles.tabItem, activeTab === 'posts' && styles.activeTabItem]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setActiveTab('posts');
                                    }}
                                >
                                    <Ionicons
                                        name={activeTab === 'posts' ? "grid" : "grid-outline"}
                                        size={22}
                                        color={activeTab === 'posts' ? "#28a745" : "#A0A0A0"}
                                    />
                                    {activeTab === 'posts' && <Animated.View layout={Layout} style={styles.activeIndicator} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabItem, activeTab === 'trails' && styles.activeTabItem]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setActiveTab('trails');
                                    }}
                                >
                                    <Ionicons
                                        name={activeTab === 'trails' ? "map" : "map-outline"}
                                        size={22}
                                        color={activeTab === 'trails' ? "#28a745" : "#A0A0A0"}
                                    />
                                    {activeTab === 'trails' && <Animated.View layout={Layout} style={styles.activeIndicator} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabItem, activeTab === 'tagged' && styles.activeTabItem]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setActiveTab('tagged');
                                    }}
                                >
                                    <Ionicons
                                        name={activeTab === 'tagged' ? "person" : "person-outline"}
                                        size={22}
                                        color={activeTab === 'tagged' ? "#28a745" : "#A0A0A0"}
                                    />
                                    {activeTab === 'tagged' && <Animated.View layout={Layout} style={styles.activeIndicator} />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
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
        backgroundColor: '#F8F9FA',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 60,
        backgroundColor: '#F8F9FA',
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerUsername: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1b',
        letterSpacing: -0.5,
    },
    backButton: {
        padding: 5,
    },
    menuButton: {
        padding: 5,
    },
    listContent: {
        paddingBottom: 40,
        backgroundColor: '#FBFBFB',
    },
    headerContainer: {
        backgroundColor: '#FFF',
        paddingBottom: 25,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        overflow: 'visible',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        zIndex: 5,
    },
    headerGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingTop: 10,
        marginBottom: 35,
    },
    avatarWrapper: {
        marginRight: 20,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarGlow: {
        position: 'absolute',
        width: 110,
        height: 110,
        borderRadius: 55,
        opacity: 0.6,
    },
    avatarContainer: {
        width: 90,
        height: 90,
        borderRadius: 45,
        padding: 3,
        backgroundColor: '#FFF',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 42,
        backgroundColor: '#F2F2F7',
    },
    infoColumn: {
        flex: 1,
    },
    displayName: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1a1a1b',
        letterSpacing: -1,
        marginBottom: 2,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationText: {
        fontSize: 13,
        color: '#8e8e93',
        marginLeft: 4,
        fontWeight: '500',
    },
    tierBadge: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 10,
    },
    tierBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bioText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#444',
        paddingHorizontal: 25,
        marginBottom: 15,
        fontWeight: '500',
    },
    statsBar: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        marginHorizontal: 20,
        borderRadius: 20,
        paddingVertical: 18,
        marginBottom: 35,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1a1a1b',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        color: '#8e8e93',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: '60%',
        backgroundColor: 'rgba(0,0,0,0.08)',
        alignSelf: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        marginBottom: 30,
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
        backgroundColor: '#FFF',
    },
    chatBtnText: {
        color: '#1a1a1b',
        fontSize: 14,
        fontWeight: '700',
    },
    connectBtn: {
        backgroundColor: '#28a745',
    },
    connectBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    followingBtn: {
        backgroundColor: '#F0F2F5',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    followingBtnText: {
        color: '#1a1a1b',
        fontWeight: '700',
    },
    tabSectionContainer: {
        backgroundColor: '#FBFBFB',
        marginTop: 35,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 15,
    },
    tabsSection: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 10,
    },
    tabItem: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
        position: 'relative',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 25,
        height: 3,
        backgroundColor: '#28a745',
        borderRadius: 2,
    },
    postGridItem: {
        width: width / 3,
        height: width / 3,
        padding: 2,
    },
    gridImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        backgroundColor: '#EEE',
    },
    adventureCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 20,
        marginVertical: 8,
        padding: 15,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    adventureHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    adventureUserGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    adventureUsername: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    adventureDate: {
        fontSize: 12,
        color: '#999',
    },
    adventureContent: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    },
    emptyText: {
        color: '#CCC',
        marginTop: 15,
        fontSize: 16,
        fontWeight: '600',
    },
});
