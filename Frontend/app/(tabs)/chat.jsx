import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import SafeScreen from '../../components/SafeScreen';


export default function ChatDashboard() {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [recentChats, setRecentChats] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Fetch recent chats when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (currentUser?._id) {
                fetchRecentChats();
            }
        }, [currentUser])
    );

    const fetchRecentChats = async () => {
        setIsLoading(true);
        try {
            const res = await client.get(`/chat/user/${currentUser._id}`);
            setRecentChats(res.data);
        } catch (error) {
            console.error("Failed to load chats", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (text) => {
        setSearchQuery(text);
        if (text.length > 1) {
            setIsSearching(true);
            try {
                const res = await client.get(`/chat/search?query=${text}`);
                // Filter out self
                setSearchResults(res.data.filter(u => u._id !== currentUser?._id));
            } catch (error) {
                console.error("Search error", error);
            } finally {
                setIsSearching(false);
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleUserSelect = async (partnerId) => {
        // Create or get chat
        try {
            const res = await client.post('/chat', {
                currentUserId: currentUser._id,
                partnerId
            });
            const chat = res.data;
            router.push(`/chat/${chat._id}`);
        } catch (error) {
            console.error("Failed to start chat", error);
        }
    };

    const renderChatItem = ({ item }) => {
        // Determine partner (it's the one that is NOT the current user)
        const partner = item.participants.find(p => p._id !== currentUser._id) || item.participants[0];

        return (
            <TouchableOpacity
                style={styles.chatItem}
                onPress={() => router.push(`/chat/${item._id}`)}
            >
                <Image
                    source={{ uri: partner.profileImage || 'https://via.placeholder.com/50' }}
                    style={styles.avatar}
                />
                <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                        <Text style={styles.userName}>{partner.username}</Text>
                        <Text style={styles.time}>
                            {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                    </View>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {/* If lastMessage is populated, show content. If strictly ID, we might need better populate or check */}
                        {/* Based on my model, lastMessage is a ref, backend populates it? Wait, my backend implementation of get chats didn't populate createdBy or content deeply enough maybe? 
                            Ah, I used .populate("lastMessage"). 
                            But Message schema has `content`. So item.lastMessage.content should exist if populated. 
                         */}
                        {item.lastMessage?.content || "No messages yet"}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderUserItem = ({ item }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleUserSelect(item._id)}
        >
            <Image
                source={{ uri: item.profileImage || 'https://via.placeholder.com/50' }}
                style={styles.avatar}
            />
            <Text style={styles.userName}>{item.username}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeScreen>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chats</Text>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search profile..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            {searchQuery.length > 0 ? (
                <View style={styles.listContainer}>
                    <Text style={styles.sectionTitle}>Search Results</Text>
                    {isSearching ? (
                        <ActivityIndicator style={{ marginTop: 20 }} color="#28a745" />
                    ) : (
                        <FlatList
                            data={searchResults}
                            renderItem={renderUserItem}
                            keyExtractor={item => item._id}
                            ListEmptyComponent={<Text style={styles.emptyText}>No users found</Text>}
                        />
                    )}
                </View>
            ) : (
                <View style={styles.listContainer}>
                    {isLoading ? (
                        <ActivityIndicator style={{ marginTop: 20 }} color="#28a745" />
                    ) : (
                        <FlatList
                            data={recentChats}
                            renderItem={renderChatItem}
                            keyExtractor={item => item._id}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
                                    <Text style={styles.emptyText}>No recent chats</Text>
                                    <Text style={styles.subText}>Search for a user to start chatting!</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f3f5',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 45,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    listContainer: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        padding: 15,
        backgroundColor: '#f8f9fa',
        color: '#666',
    },
    chatItem: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
        alignItems: 'center',
    },
    userItem: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        backgroundColor: '#ddd',
    },
    chatInfo: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    time: {
        fontSize: 12,
        color: '#999',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginTop: 20,
    },
    subText: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
    },
});
