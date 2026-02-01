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

    // Mock Active Users (In reality, could be friends who are online)
    const activeUsers = recentChats
        .map(chat => {
            const partner = chat.participants.find(p => p._id !== currentUser._id) || chat.participants[0];
            return { ...partner, id: partner._id };
        })
        .filter(u => u.isOnline)
        .slice(0, 10); // Take top 10 recent

    const renderActiveUser = ({ item }) => (
        <TouchableOpacity
            style={styles.activeUserItem}
            onPress={() => router.push(`/user-profile/${item._id}`)}
        >
            <View style={styles.activeAvatarContainer}>
                <Image
                    source={{ uri: item.profileImage || 'https://via.placeholder.com/150' }}
                    style={styles.activeAvatar}
                />
                <View style={styles.activeIndicatorRing} />
            </View>
            <Text style={styles.activeUserName} numberOfLines={1}>{item.username}</Text>
        </TouchableOpacity>
    );

    const renderChatItem = ({ item }) => {
        const partner = item.participants.find(p => p._id !== currentUser._id) || item.participants[0];
        // Logic for unread: if lastMessage readBy does NOT include current User.
        // But lastMessage populated is just ID or Object? 
        // Backend populates lastMessage. BUT `readBy` is in the message object.
        const isUnread = item.lastMessage &&
            item.lastMessage.sender !== currentUser._id &&
            !item.lastMessage.readBy?.includes(currentUser._id);

        return (
            <TouchableOpacity
                style={styles.chatRow}
                onPress={() => router.push(`/chat/${item._id}`)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    <TouchableOpacity onPress={() => router.push(`/user-profile/${partner._id}`)}>
                        <Image
                            source={{ uri: partner.profileImage || 'https://via.placeholder.com/150' }}
                            style={styles.avatar}
                        />
                        <View style={[styles.onlineDot, { backgroundColor: partner.isOnline ? '#2ecc71' : '#ff4444' }]} />
                    </TouchableOpacity>
                </View>

                <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                        <Text style={[styles.userName, isUnread && styles.unreadName]}>{partner.username}</Text>
                        <Text style={[styles.time, isUnread && styles.unreadTime]}>
                            {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                    </View>
                    <View style={styles.messageRow}>
                        <Text
                            style={[
                                styles.lastMessage,
                                (item.lastMessage?.messageType === 'image' || item.lastMessage?.messageType === 'sticker') && styles.mediaPreviewText,
                                isUnread && styles.unreadMessage
                            ]}
                            numberOfLines={1}
                        >
                            {isUnread && <Ionicons name="ellipse" size={8} color="#007bff" style={{ marginRight: 5 }} />}
                            {item.lastMessage?.messageType === 'image' ? "📷 Photo" :
                                item.lastMessage?.messageType === 'sticker' ? "✨ Sticker" :
                                    item.lastMessage?.content || "No messages yet"}
                        </Text>
                        {isUnread && <View style={styles.unreadBadge}><Text style={styles.unreadText}>1</Text></View>}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderUserItem = ({ item }) => (
        <TouchableOpacity
            style={styles.searchResultItem}
            onPress={() => handleUserSelect(item._id)}
        >
            <Image
                source={{ uri: item.profileImage || 'https://via.placeholder.com/150' }}
                style={styles.avatarSmall}
            />
            <View style={styles.searchResultInfo}>
                <Text style={styles.userNameResults}>{item.username}</Text>
                <Text style={styles.userBioResults} numberOfLines={1}>{item.bio || "No bio available"}</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={24} color="#0072ff" />
        </TouchableOpacity>
    );

    return (
        <SafeScreen backgroundColor="#fff">
            <View style={styles.headerContainer}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Messages</Text>
                    <TouchableOpacity style={styles.iconButton}>
                        <Ionicons name="create-outline" size={24} color="#333" />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search chats..."
                        placeholderTextColor="#888"
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            {searchQuery.length > 0 ? (
                // Search Results View
                <View style={styles.resultsContainer}>
                    <Text style={styles.sectionTitle}>Search Results</Text>
                    {isSearching ? (
                        <ActivityIndicator style={{ marginTop: 20 }} color="#007bff" />
                    ) : (
                        <FlatList
                            data={searchResults}
                            renderItem={renderUserItem}
                            keyExtractor={item => item._id}
                            ListEmptyComponent={<Text style={styles.emptyText}>No users found</Text>}
                            contentContainerStyle={{ padding: 15 }}
                        />
                    )}
                </View>
            ) : (
                // Main Dashboard View
                <View style={{ flex: 1 }}>
                    {!isLoading && recentChats.length > 0 && (
                        <View style={styles.activeSection}>
                            {/* <Text style={styles.sectionTitle}>Active Now</Text> */}
                            <FlatList
                                data={activeUsers}
                                renderItem={renderActiveUser}
                                keyExtractor={item => item._id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.activeUsersList}
                            />
                        </View>
                    )}

                    <View style={styles.listContainer}>
                        {isLoading ? (
                            <ActivityIndicator style={{ marginTop: 50 }} color="#007bff" />
                        ) : (
                            <FlatList
                                data={recentChats}
                                renderItem={renderChatItem}
                                keyExtractor={item => item._id}
                                contentContainerStyle={styles.listContent}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Image
                                            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2665/2665404.png' }}
                                            style={{ width: 120, height: 120, marginBottom: 20, opacity: 0.5 }}
                                        />
                                        <Text style={styles.emptyTitle}>No Chats Yet</Text>
                                        <Text style={styles.emptyText}>Start a conversation with fellow hikers!</Text>
                                    </View>
                                }
                            />
                        )}
                    </View>
                </View>
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
        backgroundColor: '#fff',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a1a1a',
        letterSpacing: -0.5,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f6f6f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        height: '100%',
    },
    activeSection: {
        paddingVertical: 15, // Reduced top padding
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    activeUsersList: {
        paddingHorizontal: 20,
    },
    activeUserItem: {
        alignItems: 'center',
        marginRight: 20,
        width: 64,
    },
    activeAvatarContainer: {
        position: 'relative',
        marginBottom: 6,
    },
    activeAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#fff',
    },
    activeIndicatorRing: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#2ecc71', // Online Green
        borderWidth: 2,
        borderColor: '#fff',
    },
    activeUserName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#333',
        textAlign: 'center',
    },
    listContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    listContent: {
        paddingVertical: 10,
    },
    chatRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    avatarContainer: {
        marginRight: 15,
        position: 'relative',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#f0f0f0',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#2ecc71',
        borderWidth: 2,
        borderColor: '#fff',
    },
    chatContent: {
        flex: 1,
        justifyContent: 'center',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    unreadName: {
        fontWeight: '800', // Bolder if unread
        color: '#000',
    },
    time: {
        fontSize: 12,
        color: '#999',
    },
    unreadTime: {
        color: '#007bff',
        fontWeight: '600',
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastMessage: {
        fontSize: 14,
        color: '#777',
        flex: 1,
        lineHeight: 20,
    },
    unreadMessage: {
        color: '#333',
        fontWeight: '500',
    },
    mediaPreviewText: {
        color: '#007bff',
        fontWeight: '500',
    },
    unreadBadge: {
        backgroundColor: '#007bff',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
        minWidth: 20,
        alignItems: 'center',
    },
    unreadText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    separator: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginLeft: 87, // Align with text start approximately
    },
    resultsContainer: {
        flex: 1,
        paddingTop: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#999',
        paddingHorizontal: 20,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    searchResultItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9',
    },
    searchResultInfo: {
        flex: 1,
    },
    userNameResults: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    userBioResults: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    avatarSmall: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 15,
        backgroundColor: '#f0f0f0',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 15,
        color: '#999',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
