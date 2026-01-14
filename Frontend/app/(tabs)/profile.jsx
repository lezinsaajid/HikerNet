import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert, Dimensions, FlatList, Modal, TextInput } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import client from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';
import UserListModal from '../../components/UserListModal';

const { width } = Dimensions.get('window');

export default function Profile() {
    const { user, updateUserData } = useAuth();
    const router = useRouter();
    const [posts, setPosts] = useState([]);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // User List Modal State
    const [userListVisible, setUserListVisible] = useState(false);
    const [userListType, setUserListType] = useState('followers'); // 'followers', 'following', 'suggested'

    // Create Post State
    const [isPostModalVisible, setIsPostModalVisible] = useState(false);
    const [newPostCaption, setNewPostCaption] = useState('');
    const [newPostImage, setNewPostImage] = useState(null);
    const [creatingPost, setCreatingPost] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (user?._id) {
                fetchProfileData();
                fetchUserPosts();
            }
        }, [user?._id])
    );

    const fetchProfileData = async () => {
        try {
            const res = await client.get(`/users/profile/${user._id}`);
            setUserData(res.data);
            // Sync with AuthContext if data changed
            if (res.data.username !== user.username || res.data.profileImage !== user.profileImage) {
                updateUserData(res.data);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        }
    };

    const fetchUserPosts = async () => {
        try {
            setLoading(true);
            const res = await client.get(`/users/posts/${user._id}`);
            setPosts(res.data);
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    };

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

    const handleProfileUpload = async (base64) => {
        try {
            setUploading(true);
            const res = await client.put('/users/profile', {
                profileImage: `data:image/jpeg;base64,${base64}`
            });
            updateUserData(res.data.user);
            setUserData(prev => ({ ...prev, profileImage: res.data.user.profileImage }));
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
        if (!newPostImage && !newPostCaption) {
            Alert.alert("Error", "Please add an image or a caption");
            return;
        }

        try {
            setCreatingPost(true);
            const payload = {
                caption: newPostCaption,
                image: newPostImage ? `data:image/jpeg;base64,${newPostImage.base64}` : null
            };
            await client.post('/posts/create', payload);
            setNewPostCaption('');
            setNewPostImage(null);
            setIsPostModalVisible(false);
            fetchUserPosts();
            fetchProfileData();
            Alert.alert("Success", "Post created!");
        } catch (error) {
            console.error("Post creation error details:", error.response?.data || error.message);
            Alert.alert("Post Failed", error.response?.data?.message || "Failed to create post. Please try with a smaller image.");
        } finally {
            setCreatingPost(false);
        }
    };

    const openUserList = (type) => {
        setUserListType(type);
        setUserListVisible(true);
    };

    const renderPostGrid = ({ item }) => (
        <TouchableOpacity style={styles.postGridItem}>
            <Image
                source={{ uri: item.image || 'https://via.placeholder.com/301' }}
                style={styles.gridImage}
            />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.topBar}>
                <Text style={styles.headerUsername}>{user?.username}</Text>
                <View style={styles.topActions}>
                    <TouchableOpacity onPress={() => setIsPostModalVisible(true)} style={styles.topIcon}>
                        <Ionicons name="add-circle-outline" size={28} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/settings')} style={styles.topIcon}>
                        <Ionicons name="menu-outline" size={32} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={posts}
                numColumns={3}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={
                    <View style={styles.headerContainer}>
                        {/* New Profile Header Layout */}
                        <View style={styles.profileMainInfo}>
                            <TouchableOpacity onPress={pickProfileImage} style={styles.avatarContainer}>
                                {uploading ? (
                                    <View style={[styles.avatar, styles.loadingAvatar]}>
                                        <ActivityIndicator color="#4A7C44" />
                                    </View>
                                ) : (
                                    <Image
                                        source={{ uri: userData?.profileImage || 'https://via.placeholder.com/150' }}
                                        style={styles.avatar}
                                    />
                                )}
                            </TouchableOpacity>
                            <View style={styles.titleInfo}>
                                <Text style={styles.displayName}>{user?.username}</Text>
                                <View style={styles.locationRow}>
                                    <Ionicons name="location-outline" size={14} color="#666" />
                                    <Text style={styles.locationText}>{userData?.location || "Mountain Peak, CO"}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Bio Section */}
                        {userData?.bio ? (
                            <Text style={styles.bioText} numberOfLines={3}>
                                {userData.bio}
                            </Text>
                        ) : null}

                        {/* Conditional Action Buttons */}
                        <View style={styles.actionRow}>
                            {userData?._id === user?._id ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.editBtn]}
                                        onPress={() => router.push('/edit-profile')}
                                    >
                                        <Text style={styles.editBtnText}>Edit Profile</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.findFriendsBtn]}
                                        onPress={() => openUserList('suggested')}
                                    >
                                        <Text style={styles.findFriendsBtnText}>Find Friends</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.chatBtn]}
                                        onPress={() => Alert.alert("Chat", "Coming soon!")}
                                    >
                                        <Text style={styles.chatBtnText}>Chat</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.connectBtn]}
                                        onPress={() => Alert.alert("Connect", "Connecting...")}
                                    >
                                        <Text style={styles.connectBtnText}>Connect</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        {/* Bordered Stats Section */}
                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{posts.length}</Text>
                                <Text style={styles.statLabel}>Trails</Text>
                            </View>
                            <View style={styles.statsDivider} />
                            <TouchableOpacity style={styles.statItem} onPress={() => openUserList('following')}>
                                <Text style={styles.statValue}>{userData?.following?.length || 0}</Text>
                                <Text style={styles.statLabel}>Friends</Text>
                            </TouchableOpacity>
                            <View style={styles.statsDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>#{userData?.rank || '-'}</Text>
                                <Text style={styles.statLabel}>Rank</Text>
                            </View>
                        </View>

                        {/* Tabs: Snaps, Stories, Adventures */}
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

            {/* Create Post Modal */}
            <Modal
                visible={isPostModalVisible}
                animationType="slide"
                transparent={false}
            >
                <SafeAreaView style={styles.modalContainer}>
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
                                <ActivityIndicator color="#4A7C44" />
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
                            style={styles.captionInput}
                            placeholder="Write a caption..."
                            multiline
                            value={newPostCaption}
                            onChangeText={setNewPostCaption}
                        />
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* User List Modal (Followers/Following/Suggested) */}
            <UserListModal
                visible={userListVisible}
                onClose={() => setUserListVisible(false)}
                userId={user?._id}
                type={userListType}
            />
        </SafeAreaView >
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
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#FFF',
    },
    headerUsername: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000',
    },
    topActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topIcon: {
        marginLeft: 15,
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
    loadingAvatar: {
        justifyContent: 'center',
        alignItems: 'center',
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
    editBtn: {
        backgroundColor: '#403A36',
    },
    editBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    findFriendsBtn: {
        backgroundColor: '#7A4B3A',
    },
    findFriendsBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
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
    listContent: {
        backgroundColor: '#FBFBFB',
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
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    shareText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#7A4B3A',
    },
    modalBody: {
        flex: 1,
    },
    imagePlaceholder: {
        width: width,
        height: width,
        backgroundColor: '#F9F9F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedImage: {
        width: '100%',
        height: '100%',
    },
    placeholderContent: {
        alignItems: 'center',
    },
    placeholderLabel: {
        marginTop: 10,
        color: '#999',
        fontSize: 16,
    },
    captionInput: {
        padding: 20,
        fontSize: 16,
        color: '#000',
        minHeight: 120,
        textAlignVertical: 'top',
    },
});
