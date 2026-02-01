import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import SafeScreen from '../../components/SafeScreen';
import { decryptMessage } from '../../utils/encryption';


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
            let chats = res.data;

            // Decrypt last messages E2EE
            const decryptedChats = await Promise.all(chats.map(async (chat) => {
                if (chat.lastMessage?.messageType === 'text' && chat.lastMessage?.content) {
                    // Try to decrypt. We need the sender's public key if it was sent by them.
                    // Actually, for E2EE with Box:
                    // Sender used: box(message, nonce, TheirPubKey, MyPrivKey)
                    // Receiver uses: box.open(message, nonce, SenderPubKey, MyPrivKey)
                    // So we always need the Sender's Public Key.

                    const sender = chat.lastMessage.sender === currentUser._id
                        ? currentUser // It was sent by me, so I need MY public key? No wait. 
                        // If I sent it, I encrypted it for THEM. I can't decrypt it with MY private key unless I encrypted it for MYSELF too?
                        // Standard Signal protocol encrypts to self-device too. 
                        // Simplified TweetNaCl Box: I cannot decrypt what I sent unless I saved a copy or encrypted it for myself.
                        // BUG IN PLAN: If I just box it for receiver, I can't read my own sent messages on other devices or even this device if I don't store plain text locally.
                        // BUT, assuming the backend returns the "content" I sent. 
                        // Use Case: Last Message Preview. 
                        // If I sent it, I probably know what it is? Or we just show "You sent a message".
                        // Let's see if we can just decrypt using the partner's key? No.
                        // Shared Secret (Me+Partner) is same either direction?
                        // box(m, n, pkB, skA) can be opened with box.open(c, n, pkA, skB).
                        // If I am A, I have skA. I need pkB to create the shared key.
                        // Yes! Shared Key = skA * pkB == skB * pkA.
                        // So I can decrypt my own message if I have the recipient's public key.

                        // Who is the "Partner"?
                        : chat.participants.find(p => p._id === chat.lastMessage.sender) || chat.participants.find(p => p._id !== currentUser._id); // Sender object might be populated?

                    // Wait, lastMessage.sender is an ID usually unless populated. 
                    // In fetching all chats, we popualted lastMessage? 
                    // Backend: .populate("lastMessage") -> .populate("sender") inside it?
                    // User check backend: 
                    // .populate("lastMessage")
                    // NO recursive populate in `get /user/:userId`? 
                    // lastMessage schema has sender ref. 
                    // Backend code did: `.populate("lastMessage")` but did NOT populate sender inside lastMessage.
                    // So lastMessage.sender is just an ID.

                    // We need to find the participant object that matches the OTHER person to get their key?
                    // Or if I am sender, I need receiver's key. 
                    // IF I am receiver, I need sender's key.
                    // In 1-on-1 chat, the "other" participant is the key holder we need to mix with our Private Key.

                    const otherPart = chat.participants.find(p => p._id !== currentUser._id);
                    if (otherPart?.publicKey) {
                        try {
                            const decrypted = await decryptMessage(chat.lastMessage.content, otherPart.publicKey);
                            chat.lastMessage.content = decrypted;
                        } catch (e) { console.log("Failed to decrypt preview", e); }
                    }
                }
                return chat;
            }));

            setRecentChats(decryptedChats);
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
                <TouchableOpacity onPress={() => router.push(`/user-profile/${partner._id}`)}>
                    <Image
                        source={{ uri: partner.profileImage || 'https://via.placeholder.com/50' }}
                        style={styles.avatar}
                    />
                </TouchableOpacity>
                <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                        <Text style={styles.userName}>{partner.username}</Text>
                        <Text style={styles.time}>
                            {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                    </View>
                    <View style={styles.chatFooter}>
                        <Text
                            style={[
                                styles.lastMessage,
                                (item.lastMessage?.messageType === 'image' || item.lastMessage?.messageType === 'sticker') && styles.mediaPreviewText
                            ]}
                            numberOfLines={1}
                        >
                            {item.lastMessage?.messageType === 'image' ? "📷 Photo" :
                                item.lastMessage?.messageType === 'sticker' ? "✨ Sticker" :
                                    item.lastMessage?.content || "No messages yet"}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderUserItem = ({ item }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleUserSelect(item._id)}
        >
            <TouchableOpacity onPress={() => router.push(`/user-profile/${item._id}`)}>
                <Image
                    source={{ uri: item.profileImage || 'https://via.placeholder.com/50' }}
                    style={styles.avatar}
                />
            </TouchableOpacity>
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
        flex: 1,
    },
    mediaPreviewText: {
        color: '#28a745',
        fontWeight: '600',
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
