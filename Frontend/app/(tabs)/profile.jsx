import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, Dimensions, StatusBar } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import UserListModal from '../../components/UserListModal';
import SafeScreen from '../../components/SafeScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const TIER_STYLING = {
    'Trail Master': { color: '#28a745', icon: 'flame', glow: 'rgba(40, 167, 69, 0.4)' },
    'Pathfinder': { color: '#007AFF', icon: 'map', glow: 'rgba(0, 122, 255, 0.4)' },
    'Explorer': { color: '#34C759', icon: 'compass', glow: 'rgba(52, 199, 89, 0.4)' },
    'Wanderer': { color: '#FFD60A', icon: 'walk', glow: 'rgba(255, 214, 10, 0.4)' },
    'Newbie': { color: '#8E8E93', icon: 'footsteps', glow: 'rgba(142, 142, 147, 0.4)' }
};

const getTierColor = (tier) => TIER_STYLING[tier]?.color || '#adb5bd';
const getTierGlow = (tier) => TIER_STYLING[tier]?.glow || 'rgba(173, 181, 189, 0.2)';



export default function Profile() {
    const { user, updateUserData, accounts, switchAccount, prepareAddAccount, logout, logoutAll } = useAuth();
    const router = useRouter();

    // Data State
    const [posts, setPosts] = useState([]);
    const [userStories, setUserStories] = useState([]);
    const [userAdventures, setUserAdventures] = useState([]);
    const [taggedPosts, setTaggedPosts] = useState([]);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); // 'posts', 'trails', 'tagged'
    const [uploading, setUploading] = useState(false);

    // Account Switching State
    const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);

    // User List Modal State
    const [userListVisible, setUserListVisible] = useState(false);
    const [userListType, setUserListType] = useState('followers'); // 'followers', 'following', 'suggested'

    // Create Post State
    const [isPostModalVisible, setIsPostModalVisible] = useState(false);
    const [newPostCaption, setNewPostCaption] = useState('');
    const [newPostImage, setNewPostImage] = useState(null);
    const [creatingPost, setCreatingPost] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState([]);
    const [tagCandidates, setTagCandidates] = useState([]);

    useEffect(() => {
        if (isPostModalVisible && user?._id) {
            client.get(`/users/following/${user._id}`)
                .then(res => setTagCandidates(res.data || []))
                .catch(err => console.error(err));
        }
    }, [isPostModalVisible]);

    const filteredCandidates = tagInput.trim() 
        ? tagCandidates.filter(u => u.username.toLowerCase().includes(tagInput.replace(/^@/, '').toLowerCase()) && !tags.includes(u.username))
        : [];

    const handleAddTag = () => {
        const cleanTag = tagInput.trim().replace(/^@/, '');
        if (cleanTag && !tags.includes(cleanTag)) {
            setTags([...tags, cleanTag]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    // Adventure State
    const [isAdventureModalVisible, setIsAdventureModalVisible] = useState(false);
    const [newAdventureContent, setNewAdventureContent] = useState('');
    const [creatingAdventure, setCreatingAdventure] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (user?._id) {
                const currentId = String(user._id);
                console.log("[Profile] Loading data for user:", currentId);
                if (currentId && currentId !== 'undefined' && currentId !== 'null') {
                    setLoading(true);

                    // Clear stale data immediately if it belongs to another account
                    setUserData(prev => (prev && String(prev._id) !== currentId ? null : prev));
                    setPosts(prev => (userData && String(userData._id) !== currentId ? [] : prev));

                    Promise.all([
                        fetchProfileData(currentId),
                        fetchUserPosts(currentId),
                        fetchUserStories(currentId),
                        fetchUserAdventures(currentId),
                        fetchTaggedPosts(currentId)
                    ]).catch(err => {
                        console.error("[Profile] Fetch error:", err);
                    }).finally(() => {
                        setLoading(false);
                    });
                }
            }
        }, [user?._id, fetchProfileData, fetchUserPosts])
    );

    const fetchProfileData = useCallback(async (targetId) => {
        try {
            console.log(`[Profile] fetchProfileData for ID: "${targetId}"`);
            if (!targetId || targetId === 'undefined' || targetId === 'null') {
                console.warn("[Profile] Aborting fetchProfileData: Invalid ID");
                return;
            }

            const res = await client.get(`/users/profile/${targetId}`);
            if (res.data) {
                const fetchedUserId = String(res.data._id);
                const currentAuthUserId = String(user?._id);

                setUserData(res.data);

                // Sync with AuthContext if data changed and it's for the current active user
                if (fetchedUserId === currentAuthUserId) {
                    const needsSync =
                        res.data.username !== user.username ||
                        res.data.profileImage !== user.profileImage ||
                        res.data.bio !== user.bio ||
                        res.data.location !== user.location ||
                        (res.data.following?.length !== user.following?.length) ||
                        (res.data.followers?.length !== user.followers?.length);

                    if (needsSync) {
                        console.log("[Profile] Syncing fresh profile data to AuthContext");
                        updateUserData(res.data);
                    }
                }
            } else {
                setUserData({}); // Break potential infinite loading loops
            }
        } catch (error) {
            console.error("[Profile] fetchProfileData error:", error.response?.status, error.message);
            setUserData(prev => prev || {}); // Ensure we don't stay in 'null' state if initial fetch fails
        }
    }, [user?._id, updateUserData]); // Removed userData from dependencies

    const fetchUserPosts = useCallback(async (targetId) => {
        try {
            const res = await client.get(`/users/posts/${targetId}`);
            setPosts(res.data || []);
        } catch (error) {
            console.error("[Profile] fetchUserPosts error:", error);
            setPosts([]);
        }
    }, []);
    const fetchUserStories = useCallback(async (targetId) => {
        try {
            const res = await client.get(`/stories/user/${targetId}`);
            setUserStories(res.data || []);
        } catch (error) {
            console.error("[Profile] fetchUserStories error:", error);
            setUserStories([]);
        }
    }, []);

    const fetchTaggedPosts = useCallback(async (targetId) => {
        try {
            const res = await client.get(`/posts/tagged/${targetId}`);
            setTaggedPosts(res.data || []);
        } catch (error) {
            console.error("[Profile] fetchTaggedPosts error:", error);
            setTaggedPosts([]);
        }
    }, []);



    const pickProfileImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need access to your gallery to change your profile picture.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled) {
            handleProfileUpload(result.assets[0].base64);
        }
    };

    const fetchUserAdventures = useCallback(async (targetId) => {
        try {
            // Fetch both Treks and Adventure Remarks
            const [treksRes, remarksRes] = await Promise.all([
                client.get(`/treks/user/${targetId}`),
                client.get(`/adventures/user/${targetId}`)
            ]);

            // Combine and sort by date
            const combined = [
                ...(treksRes.data || []).map(t => ({ ...t, displayType: 'trek' })),
                ...(remarksRes.data || []).map(r => ({ ...r, displayType: 'remark' }))
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setUserAdventures(combined);
        } catch (error) {
            console.error("[Profile] fetchUserAdventures error:", error);
            setUserAdventures([]);
        }
    }, []);

    const handleCreateAdventure = async () => {
        if (!newAdventureContent.trim()) {
            Alert.alert("Error", "Please enter some content for your adventure remark.");
            return;
        }

        try {
            setCreatingAdventure(true);
            await client.post('/adventures/create', { content: newAdventureContent });
            setNewAdventureContent('');
            setIsAdventureModalVisible(false);
            fetchUserAdventures(user._id);
            Alert.alert("Success", "Adventure remark posted!");
        } catch (error) {
            console.error("Adventure creation error:", error.response?.data || error.message);
            Alert.alert("Failed", "Failed to post adventure remark.");
        } finally {
            setCreatingAdventure(false);
        }
    };

    const handleDeleteAdventure = async (item) => {
        const isTrek = item.displayType === 'trek';
        const deleteUrl = isTrek ? `/treks/${item._id}` : `/adventures/${item._id}`;
        const title = isTrek ? "Delete Trail" : "Delete Remark";
        const message = isTrek ? "Are you sure you want to delete this recorded trail?" : "Are you sure you want to delete this adventure remark?";

        Alert.alert(
            title,
            message,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await client.delete(deleteUrl);
                            fetchUserAdventures(user._id);
                            fetchProfileData(user._id); // Update rank and other stats
                            Alert.alert("Success", `${isTrek ? "Trail" : "Remark"} deleted!`);
                        } catch (error) {
                            console.error("Delete error:", error);
                            Alert.alert("Error", `Failed to delete ${isTrek ? "trail" : "remark"}.`);
                        }
                    }
                }
            ]
        );
    };

    const handleProfileUpload = async (base64) => {
        try {
            setUploading(true);
            const res = await client.put('/users/profile', {
                profileImage: `data:image/jpeg;base64,${base64}`
            });
            updateUserData(res.data.user);
            setUserData(prev => ({ ...prev, profileImage: res.data.user.profileImage }));
            fetchProfileData(user._id); // Refresh data with ID
            Alert.alert("Success", "Profile picture updated!");
        } catch (error) {
            console.error("Upload error details:", error.response?.data || error.message);
            Alert.alert("Upload Failed", error.response?.data?.message || "Please check your internet and try again.");
        } finally {
            setUploading(false);
        }
    };

    const pickPostImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setNewPostImage(result.assets[0]);
        }
    };

    const handleCreatePost = async () => {
        if (!newPostImage && !newPostCaption && tags.length === 0) {
            Alert.alert("Error", "Please add an image, a caption, or tag someone");
            return;
        }

        try {
            setCreatingPost(true);
            const payload = {
                caption: newPostCaption,
                image: newPostImage ? `data:image/jpeg;base64,${newPostImage.base64}` : null,
                taggedUsernames: tags,
            };
            await client.post('/posts/create', payload);
            setNewPostCaption('');
            setNewPostImage(null);
            setTags([]);
            setTagInput('');
            setIsPostModalVisible(false);
            fetchUserPosts(user._id);
            fetchProfileData(user._id);
            Alert.alert("Success", "Post created!");
        } catch (error) {
            console.error("Post creation error details:", error.response?.data || error.message);
            Alert.alert("Post Failed", error.response?.data?.message || "Failed to create post. Please try with a smaller image.");
        } finally {
            setCreatingPost(false);
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
                            fetchUserPosts(user._id);
                            fetchProfileData(user._id);
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

    const openUserList = (type) => {
        setUserListType(type);
        setUserListVisible(true);
    };

    const renderPostGrid = ({ item }) => {
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
                            {isOwner && (
                                <TouchableOpacity onPress={() => handleDeleteAdventure(item)}>
                                    <Ionicons name="trash-outline" size={18} color="#999" />
                                </TouchableOpacity>
                            )}
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
            if (taggedPosts.length === 0) {
                return (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="person-circle-outline" size={64} color="#EEE" />
                        <Text style={styles.emptyText}>No tagged posts yet</Text>
                    </View>
                );
            }
            // Re-use the post grid item style
            return (
                <TouchableOpacity
                    style={styles.postGridItem}
                    onPress={() => router.push(`/post/${item._id}`)}
                >
                    <Image
                        source={{ uri: item.image || 'https://via.placeholder.com/301' }}
                        style={styles.gridImage}
                    />
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity
                style={[
                    styles.postGridItem,
                    activeTab === 'stories' && styles.storyGridItem
                ]}
                onPress={() => {
                    if (activeTab === 'posts') {
                        router.push(`/post/${item._id}`);
                    }
                }}
                onLongPress={() => {
                    if (activeTab === 'posts' && isOwner) {
                        handleDeletePost(item._id);
                    }
                }}
            >
                <Image
                    source={{ uri: item.image || 'https://via.placeholder.com/301' }}
                    style={styles.gridImage}
                />
            </TouchableOpacity>
        );
    };

    // Render-phase protection: If user ID changed but data hasn't updated yet, show loading.
    // This prevents showing the "Friend View" (Connect buttons) for your own profile during the switch.
    const isMismatched = user && userData && userData._id && String(user._id) !== String(userData._id);
    const isOwner = userData?._id && user?._id && String(userData._id) === String(user._id);

    if (loading || (isMismatched && user?._id)) {
        return (
            <SafeScreen style={{ justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#28a745" />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen backgroundColor="#F8F9FA" statusBarStyle="dark-content">
            <View style={styles.topBar}>
                <LinearGradient
                    colors={['#F8F9FA', '#FBFBFB']}
                    style={StyleSheet.absoluteFill}
                />
                <TouchableOpacity
                    style={styles.headerTitleContainer}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setIsAccountModalVisible(true);
                    }}
                >
                    <Text style={styles.headerUsername}>{user?.username}</Text>
                    <Ionicons name="chevron-down" size={20} color="#1a1a1b" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
                <View style={styles.topActions}>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsPostModalVisible(true);
                        }}
                        style={styles.topIcon}
                    >
                        <Ionicons name="add-circle-outline" size={28} color="#1a1a1b" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/settings');
                        }}
                        style={styles.topIcon}
                    >
                        <Ionicons name="menu-outline" size={32} color="#1a1a1b" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                key={activeTab === 'trails' ? 'single' : 'grid'}
                data={activeTab === 'posts' ? posts : (activeTab === 'trails' ? userAdventures : (activeTab === 'tagged' ? taggedPosts : []))}
                numColumns={activeTab === 'trails' ? 1 : 3}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={
                    <Animated.View entering={FadeInUp.duration(600)} style={styles.headerContainer}>
                        <LinearGradient
                            colors={['#E8F5E9', '#FFFFFF']}
                            style={styles.headerGradient}
                        />
                        <View style={styles.profileRow}>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    pickProfileImage();
                                }}
                                style={styles.avatarWrapper}
                            >
                                <View style={[styles.avatarGlow, { backgroundColor: getTierGlow(userData?.tier || 'Wanderer') }]} />
                                <View style={styles.avatarContainer}>
                                    {uploading ? (
                                        <View style={[styles.avatar, styles.loadingAvatar]}>
                                            <ActivityIndicator color="#28a745" />
                                        </View>
                                    ) : (
                                        <Image
                                            source={{ uri: userData?.profileImage || 'https://via.placeholder.com/150' }}
                                            style={styles.avatar}
                                        />
                                    )}
                                    <View style={[styles.editBadge, { backgroundColor: getTierColor(userData?.tier || 'Wanderer') }]}>
                                        <Ionicons name="camera" size={14} color="#FFF" />
                                    </View>
                                </View>
                            </TouchableOpacity>

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
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setActiveTab('trails');
                                }}
                            >
                                <Text style={styles.statValue}>{userAdventures.length}</Text>
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
                                <Text style={styles.statValue}>{(userData?.followers?.length || 0)}</Text>
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
                                    {userAdventures.length > 0 && userData?.rank ? `#${userData.rank}` : '#-'}
                                </Text>
                                <Text style={styles.statLabel}>Rank</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.actionRow}>
                            {isOwner ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.editBtn]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            router.push('/edit-profile');
                                        }}
                                    >
                                        <Text style={styles.editBtnText}>Edit Profile</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.findFriendsBtn]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            openUserList('suggested');
                                        }}
                                    >
                                        <Text style={styles.findFriendsBtnText}>Find Friends</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.chatBtn]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            Alert.alert("Chat", "Coming soon!");
                                        }}
                                    >
                                        <Text style={styles.chatBtnText}>Chat</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.connectBtn]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            Alert.alert("Connect", "Connecting...");
                                        }}
                                    >
                                        <Text style={styles.connectBtnText}>Connect</Text>
                                    </TouchableOpacity>
                                </>
                            )}
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
                renderItem={renderPostGrid}
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

            {/* Account Switching Modal */}
            <Modal
                visible={isAccountModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsAccountModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.accountModalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsAccountModalVisible(false)}
                >
                    <SafeAreaProvider>
                        <SafeScreen style={styles.accountModalContent}>
                            <View style={styles.accountModalHeader}>
                                <Text style={styles.accountModalTitle}>Switch Accounts</Text>
                            </View>

                            <ScrollView style={{ maxHeight: 300 }}>
                                {accounts.map((acc, index) => {
                                    const accId = String(acc.user._id);
                                    const currentId = String(user?._id);
                                    return (
                                        <TouchableOpacity
                                            key={accId || index}
                                            style={styles.accountItem}
                                            onPress={() => {
                                                console.log(`[Profile] Account item pressed: "${accId}" (Current: "${currentId}")`);
                                                setIsAccountModalVisible(false);
                                                if (accId !== currentId) {
                                                    console.log(`[Profile] Calling switchAccount("${accId}")`);
                                                    switchAccount(accId);
                                                } else {
                                                    console.log(`[Profile] Selected same account, ignoring.`);
                                                }
                                            }}
                                        >
                                            <View style={styles.accountLeft}>
                                                <Image
                                                    source={{ uri: acc.user.profileImage || 'https://via.placeholder.com/150' }}
                                                    style={styles.accountAvatar}
                                                />
                                                <Text style={[
                                                    styles.accountUsername,
                                                    accId === currentId && styles.activeAccountText
                                                ]}>
                                                    {acc.user.username}
                                                </Text>
                                            </View>
                                            {accId === currentId && (
                                                <Ionicons name="checkmark-circle" size={24} color="#4A7C44" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <View style={styles.accountActions}>
                                <TouchableOpacity
                                    style={styles.addAccountBtn}
                                    onPress={() => {
                                        setIsAccountModalVisible(false);
                                        prepareAddAccount();
                                    }}
                                >
                                    <Ionicons name="add" size={24} color="#000" />
                                    <Text style={styles.addAccountText}>Add Account</Text>
                                </TouchableOpacity>

                                <View style={styles.accountDivider} />

                                <TouchableOpacity
                                    style={styles.logoutBtn}
                                    onPress={() => {
                                        Alert.alert(
                                            "Logout",
                                            `Log out of ${user?.username}?`,
                                            [
                                                { text: "Cancel", style: "cancel" },
                                                {
                                                    text: "Log Out",
                                                    style: "destructive",
                                                    onPress: () => {
                                                        setIsAccountModalVisible(false);
                                                        logout();
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                >
                                    <Ionicons name="log-out-outline" size={20} color="#FF3B30" style={{ marginRight: 10 }} />
                                    <Text style={styles.logoutText}>Log Out {user?.username}</Text>
                                </TouchableOpacity>

                                {accounts.length > 1 && (
                                    <TouchableOpacity
                                        style={[styles.logoutBtn, { marginTop: 10 }]}
                                        onPress={() => {
                                            Alert.alert(
                                                "Logout from All",
                                                "Are you sure you want to log out of all accounts?",
                                                [
                                                    { text: "Cancel", style: "cancel" },
                                                    {
                                                        text: "Log Out All",
                                                        style: "destructive",
                                                        onPress: () => {
                                                            setIsAccountModalVisible(false);
                                                            logoutAll();
                                                        }
                                                    }
                                                ]
                                            );
                                        }}
                                    >
                                        <Ionicons name="power-outline" size={20} color="#FF3B30" style={{ marginRight: 10 }} />
                                        <Text style={styles.logoutText}>Log Out of All Accounts</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </SafeScreen>
                    </SafeAreaProvider>
                </TouchableOpacity>
            </Modal>


            {/* Create Post Modal */}
            <Modal
                visible={isPostModalVisible}
                animationType="slide"
                transparent={false}
            >
                <SafeAreaProvider>
                    <SafeScreen style={styles.modalContainer}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={{ flex: 1 }}
                        >
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setIsPostModalVisible(false)}>
                                    <Ionicons name="close" size={30} color="#000" />
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>New Post</Text>
                                <TouchableOpacity
                                    onPress={handleCreatePost}
                                    disabled={creatingPost}
                                >
                                    {creatingPost ? (
                                        <ActivityIndicator color="#28a745" />
                                    ) : (
                                        <Text style={styles.shareText}>Share</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody}>
                                <TouchableOpacity onPress={pickPostImage} style={styles.imagePlaceholder}>
                                    {newPostImage ? (
                                        <Image source={{ uri: newPostImage.uri }} style={styles.selectedImage} />
                                    ) : (
                                        <View style={styles.placeholderContent}>
                                            <Ionicons name="image-outline" size={60} color="#CCC" />
                                            <Text style={styles.placeholderLabel}>Add Photos</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <TextInput
                                    style={[styles.captionInput, { minHeight: 100 }]}
                                    placeholder="Write a caption..."
                                    multiline
                                    value={newPostCaption}
                                    onChangeText={setNewPostCaption}
                                />
                                
                                <View style={styles.tagSection}>
                                    <Text style={styles.tagSectionTitle}>Tag People</Text>
                                    <View style={styles.tagInputRow}>
                                        <TextInput
                                            style={styles.tagInput}
                                            placeholder="username (e.g. johndoe)"
                                            value={tagInput}
                                            onChangeText={setTagInput}
                                            autoCapitalize="none"
                                            onSubmitEditing={handleAddTag}
                                        />
                                        <TouchableOpacity 
                                            style={[styles.addTagBtn, !tagInput.trim() && { opacity: 0.5 }]} 
                                            onPress={handleAddTag} 
                                            disabled={!tagInput.trim()}
                                        >
                                            <Text style={styles.addTagBtnText}>Add</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {filteredCandidates.length > 0 && (
                                        <ScrollView style={styles.tagSuggestionsBox} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                                            {filteredCandidates.slice(0, 5).map(u => (
                                                <TouchableOpacity key={u._id} style={styles.suggestionItem} onPress={() => {
                                                    setTags([...tags, u.username]);
                                                    setTagInput('');
                                                }}>
                                                    <Image source={{ uri: u.profileImage || 'https://via.placeholder.com/150' }} style={styles.suggestionAvatar} />
                                                    <Text style={styles.suggestionUsername}>{u.username}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}

                                    {tags.length > 0 && (
                                        <View style={styles.tagList}>
                                            {tags.map((tag, index) => (
                                                <View key={index} style={styles.tagPill}>
                                                    <Text style={styles.tagPillText}>@{tag}</Text>
                                                    <TouchableOpacity onPress={() => removeTag(tag)}>
                                                        <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </SafeScreen>
                </SafeAreaProvider>
            </Modal>

            {/* User List Modal */}
            <UserListModal
                visible={userListVisible}
                onClose={() => setUserListVisible(false)}
                userId={user?._id}
                type={userListType}
            />

            {/* Create Adventure Modal */}
            <Modal
                visible={isAdventureModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsAdventureModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.adventureModalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsAdventureModalVisible(false)}
                >
                    <SafeAreaProvider>
                        <SafeScreen style={styles.adventureModalContent} edges={['top']}>
                            <View style={styles.adventureModalHeader}>
                                <Text style={styles.adventureModalTitle}>New Adventure Remark</Text>
                                <TouchableOpacity onPress={() => setIsAdventureModalVisible(false)}>
                                    <Ionicons name="close" size={24} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={styles.adventureInput}
                                placeholder="What's your remark today?"
                                multiline
                                maxLength={280}
                                value={newAdventureContent}
                                onChangeText={setNewAdventureContent}
                                autoFocus
                            />

                            <View style={styles.adventureFooter}>
                                <Text style={[
                                    styles.charCount,
                                    newAdventureContent.length > 250 && { color: '#FF3B30' }
                                ]}>
                                    {newAdventureContent.length}/280
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.postAdventureBtn,
                                        !newAdventureContent.trim() && { opacity: 0.5 }
                                    ]}
                                    onPress={handleCreateAdventure}
                                    disabled={creatingAdventure || !newAdventureContent.trim()}
                                >
                                    {creatingAdventure ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <Text style={styles.postAdventureBtnText}>Post</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </SafeScreen>
                    </SafeAreaProvider>
                </TouchableOpacity>
            </Modal>

        </SafeScreen >
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
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerUsername: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1b',
        letterSpacing: -0.5,
    },
    topActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topIcon: {
        marginLeft: 20,
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
    loadingAvatar: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        borderRadius: 15,
        padding: 6,
        borderWidth: 3,
        borderColor: '#FFF',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
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
        marginTop: 5,
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
    editBtn: {
        backgroundColor: '#F0F2F5',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    editBtnText: {
        color: '#1a1a1b',
        fontSize: 14,
        fontWeight: '700',
    },
    findFriendsBtn: {
        backgroundColor: '#F0F2F5',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    findFriendsBtnText: {
        color: '#1a1a1b',
        fontSize: 14,
        fontWeight: '700',
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
    // Account Modal Styles
    accountModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    accountModalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingBottom: 20,
        maxHeight: '60%',
    },
    accountModalHeader: {
        padding: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    accountModalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1b',
    },
    accountItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        paddingHorizontal: 25,
    },
    accountLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accountAvatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        marginRight: 15,
    },
    accountUsername: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    activeAccountText: {
        color: '#28a745',
        fontWeight: '800',
    },
    accountActions: {
        paddingHorizontal: 20,
        marginTop: 10,
    },
    addAccountBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    addAccountText: {
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 10,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF3B30',
    },
    // Post Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    shareText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#28a745',
    },
    imagePlaceholder: {
        width: width,
        height: width,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedImage: {
        width: '100%',
        height: '100%',
    },
    captionInput: {
        padding: 20,
        fontSize: 16,
        minHeight: 150,
        textAlignVertical: 'top',
        color: '#333',
    },
    tagSection: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    tagSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#444',
        marginBottom: 10,
    },
    tagInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tagSuggestionsBox: {
        maxHeight: 160,
        backgroundColor: '#FFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        marginTop: 5,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    suggestionAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        backgroundColor: '#eee',
    },
    suggestionUsername: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    tagInput: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 8,
        fontSize: 14,
        color: '#222',
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    addTagBtn: {
        marginLeft: 10,
        paddingHorizontal: 18,
        paddingVertical: 12,
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
    },
    addTagBtnText: {
        fontWeight: 'bold',
        color: '#28a745',
    },
    tagList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 15,
    },
    tagPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#28a745',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        shadowColor: '#28a745',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    tagPillText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
});
