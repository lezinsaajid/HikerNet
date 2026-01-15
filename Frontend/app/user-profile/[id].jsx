import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Dimensions, FlatList } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import UserListModal from '../../components/UserListModal';

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

    useEffect(() => {
        if (id) {
            fetchProfileData();
            fetchUserPosts();
        }
    }, [id, fetchProfileData, fetchUserPosts]);

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
            await client.post(`/users/block/${id}`);

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

    const renderPostGrid = ({ item }) => (
        <TouchableOpacity style={styles.postGridItem}>
            <Image
                source={{ uri: item.image || 'https://via.placeholder.com/301' }}
                style={styles.gridImage}
            />
        </TouchableOpacity>
    );

    if (loading && !userData) {
        return (
            <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#4A7C44" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
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
                data={posts}
                numColumns={3}
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
                            <TouchableOpacity style={[styles.tabItem, styles.activeTabItem]}>
                                <Text style={[styles.tabLabel, styles.activeTabLabel]}>Snaps</Text>
                                <View style={styles.activeIndicator} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.tabItem}>
                                <Text style={styles.tabLabel}>Stories</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.tabItem}>
                                <Text style={styles.tabLabel}>Adventures</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                }
                renderItem={renderPostGrid}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="images-outline" size={64} color="#EEE" />
                            <Text style={styles.emptyText}>No posts yet</Text>
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
        </SafeAreaView>
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
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
    },
    avatarContainer: {
        marginRight: 20,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F0F0F0',
    },
    titleInfo: {
        flex: 1,
    },
    displayName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2D2D2D',
        letterSpacing: 0.5,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
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
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 25,
    },
    actionBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
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
        borderWidth: 1,
        borderColor: '#E8E8E8',
        borderRadius: 20,
        paddingVertical: 20,
        marginBottom: 30,
        backgroundColor: '#FFF',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D2D2D',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#8A8A8A',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statsDivider: {
        width: 1,
        height: '60%',
        backgroundColor: '#E8E8E8',
        alignSelf: 'center',
    },
    tabsSection: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    tabItem: {
        marginRight: 30,
        paddingBottom: 8,
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
});
