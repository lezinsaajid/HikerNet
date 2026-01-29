import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useRouter } from 'expo-router';
import SafeScreen from './SafeScreen';

export default function UserListModal({ visible, onClose, userId, type, mode = 'view', onInvite }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [cooldowns, setCooldowns] = useState({}); // { userId: expiryTimestamp }
    const [now, setNow] = useState(Date.now()); // Tick for UI updates

    useEffect(() => {
        // Timer to update countdowns
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (visible) {
            fetchUsers();
        }
    }, [visible, type]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            let res;
            if (type === 'followers') {
                res = await client.get(`/users/followers/${userId}`);
            } else if (type === 'following') {
                res = await client.get(`/users/following/${userId}`);
            } else {
                // Find people / Suggested
                res = await client.get('/users/suggested');
            }
            setUsers(res.data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const { user, updateUserData } = useAuth();
    const router = useRouter();

    const handleUserPress = (targetUser) => {
        onClose();
        router.push(`/user-profile/${targetUser._id}`);
    };

    const handleFollow = async (targetUserId) => {
        try {
            await client.post(`/users/follow/${targetUserId}`);
            // Update local user state
            const updatedFollowing = [...user.following, targetUserId];
            updateUserData({ ...user, following: updatedFollowing });

            // Optionally update the local users list visually if needed, but checking user.following in render is enough
        } catch (error) {
            console.error("Error following:", error);
            Alert.alert("Error", "Could not follow user");
        }
    };

    const handleRemove = async (targetUserId) => {
        try {
            await client.post(`/users/follow/${targetUserId}`); // Toggle off
            const updatedFollowing = user.following.filter(f => (typeof f === 'object' ? f._id : f) !== targetUserId);
            updateUserData({ ...user, following: updatedFollowing });
        } catch (error) {
            console.error("Error removing friend:", error);
            Alert.alert("Error", "Could not remove friend");
        }
    };

    const handleBlock = async (targetUserId) => {
        try {
            await client.post(`/users/block/${targetUserId}`);
            const updatedFollowing = user.following.filter(f => (typeof f === 'object' ? f._id : f) !== targetUserId);
            updateUserData({ ...user, following: updatedFollowing });
            Alert.alert("Blocked", "User has been blocked");
        } catch (error) {
            console.error("Error blocking:", error);
            Alert.alert("Error", "Could not block user");
        }
    };

    const showFriendOptions = (targetUserId) => {
        Alert.alert(
            "Friend Options",
            "Select an action",
            [
                { text: "Remove Friend", onPress: () => handleRemove(targetUserId) },
                { text: "Block User", style: "destructive", onPress: () => handleBlock(targetUserId) },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const renderUserItem = ({ item }) => {
        // Robust check for following status (handles mixed array of strings/objects)
        const isFollowing = user.following.some(f => (typeof f === 'object' ? f._id : f) === item._id);
        const isSelf = user._id === item._id;

        return (
            <TouchableOpacity style={styles.userItem} onPress={() => handleUserPress(item)}>
                <Image
                    source={{ uri: item.profileImage || 'https://via.placeholder.com/150' }}
                    style={styles.avatar}
                />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    {item.location ? (
                        <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={12} color="#888" />
                            <Text style={styles.locationText}>{item.location}</Text>
                        </View>
                    ) : null}
                    {item.bio ? <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text> : null}
                </View>
                {!isSelf && (
                    <TouchableOpacity
                        style={[
                            (isFollowing || mode === 'invite') ? styles.friendsButton : styles.followButton,
                            (mode === 'invite' && cooldowns[item._id] > now) && styles.disabledButton
                        ]}
                        disabled={mode === 'invite' && cooldowns[item._id] > now}
                        onPress={async () => {
                            if (mode === 'invite') {
                                // Await success
                                const success = await onInvite(item);
                                if (success) {
                                    setCooldowns(prev => ({
                                        ...prev,
                                        [item._id]: Date.now() + 30000 // 30s from now
                                    }));
                                }
                            } else {
                                isFollowing ? showFriendOptions(item._id) : handleFollow(item._id);
                            }
                        }}
                    >
                        <Text style={isFollowing || mode === 'invite' ? styles.friendsButtonText : styles.followButtonText}>
                            {mode === 'invite'
                                ? (cooldowns[item._id] > now
                                    ? `${Math.ceil((cooldowns[item._id] - now) / 1000)}s`
                                    : "Invite")
                                : (isFollowing ? "Friends" : "Follow")
                            }
                        </Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <SafeScreen edges={['top', 'left', 'right', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.title}>
                        {type === 'followers' ? 'Followers' : type === 'following' ? 'Following' : 'Find Friends'}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#999" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search users..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color="#4A7C44" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredUsers}
                        keyExtractor={(item) => item._id}
                        renderItem={renderUserItem}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <Text style={styles.emptyText}>No users found</Text>
                            </View>
                        }
                    />
                )}
            </SafeScreen>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: '#EEE',
    },
    backButton: {
        padding: 5,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFEFEF',
        margin: 15,
        paddingHorizontal: 15,
        borderRadius: 10,
        height: 40,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F0F0F0',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EEE',
    },
    userInfo: {
        flex: 1,
        marginLeft: 15,
    },
    username: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    bio: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    locationText: {
        fontSize: 12,
        color: '#888',
        marginLeft: 3,
    },
    disabledButton: {
        backgroundColor: '#e9ecef',
        borderColor: '#dee2e6',
    },
    followButton: {
        backgroundColor: '#0095f6',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 5,
    },
    followButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    friendsButton: {
        backgroundColor: '#EFEFEF',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#CCC',
    },
    friendsButtonText: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 14,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        color: '#999',
        fontSize: 16,
    },
});
