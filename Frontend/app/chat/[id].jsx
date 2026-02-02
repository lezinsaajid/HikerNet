import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import client from '../../api/client';
import SafeScreen from '../../components/SafeScreen';
import { LinearGradient } from 'expo-linear-gradient';
import { encryptMessage, decryptMessage } from '../../utils/encryption';

const getDateHeaderLabel = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Helper to check if it's the same calendar day
    const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    // Helper to check if it's yesterday
    const isYesterday = (d1, d2) => {
        const yesterday = new Date(d2);
        yesterday.setDate(yesterday.getDate() - 1);
        return isSameDay(d1, yesterday);
    };

    if (isSameDay(date, now)) {
        return "Today";
    } else if (isYesterday(date, now)) {
        return "Yesterday";
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'long' });
    } else {
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
};

const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};


const getTierColor = (tier) => {
    switch (tier) {
        case 'Trail Master': return '#ff922b'; // Orange
        case 'Pathfinder': return '#5c7cfa'; // Blue
        case 'Explorer': return '#28a745'; // Green
        case 'Wanderer': return '#94d82d'; // Lime
        default: return '#adb5bd'; // Gray
    }
};

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [partner, setPartner] = useState(null);
    const [sending, setSending] = useState(false);
    const [showStickers, setShowStickers] = useState(false);
    const flatListRef = useRef(null);

    const STICKERS = [
        { id: 's1', url: 'https://cdn-icons-png.flaticon.com/512/2928/2928811.png', label: 'Mountain' },
        { id: 's2', url: 'https://cdn-icons-png.flaticon.com/512/2928/2928842.png', label: 'Tent' },
        { id: 's3', url: 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png', label: 'Backpack' },
        { id: 's4', url: 'https://cdn-icons-png.flaticon.com/512/2990/2990526.png', label: 'Bigfoot' },
        { id: 's5', url: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', label: 'Hiker Hunger' },
        { id: 's6', url: 'https://cdn-icons-png.flaticon.com/512/91/91380.png', label: 'Laughing' },
        { id: 's7', url: 'https://cdn-icons-png.flaticon.com/512/1043/1043009.png', label: 'Ghosted' },
        { id: 's8', url: 'https://cdn-icons-png.flaticon.com/512/7504/7504364.png', label: 'Party' },
        { id: 's9', url: 'https://cdn-icons-png.flaticon.com/512/356/356740.png', label: 'Exhausted' },
        { id: 's10', url: 'https://cdn-icons-png.flaticon.com/512/2219/2219904.png', label: 'Compass' },
        { id: 's11', url: 'https://cdn-icons-png.flaticon.com/512/2928/2928929.png', label: 'Bonfire' },
        { id: 's12', url: 'https://cdn-icons-png.flaticon.com/512/2311/2311818.png', label: 'Bear' }
    ];

    const partnerRef = useRef(null);

    // Initial fetch & Mark Read
    useEffect(() => {
        fetchChatDetails().then((p) => {
            // Fetch messages immediate after getting partner to ensure decryption works on first load
            if (p) fetchMessages();
        });
        markAsRead();

        // Poll for new messages and partner status
        const interval = setInterval(() => {
            fetchMessages();
            fetchChatDetails();
        }, 3000); // Faster polling for real-time feel
        return () => clearInterval(interval);
    }, [id]);

    const markAsRead = async () => {
        try {
            await client.put(`/chat/${id}/read`);
        } catch (e) { console.warn("Failed to mark read", e); }
    };

    const renderReadStatus = (message) => {
        if (message.sender._id !== currentUser._id) return null;
        const isRead = message.readBy && message.readBy.some(id => id !== currentUser._id);

        return (
            <Ionicons
                name={isRead ? "checkmark-done-outline" : "checkmark-outline"}
                size={14}
                color={isRead ? "#fff" : "rgba(255,255,255,0.7)"}
                style={{ marginLeft: 2 }}
            />
        );
    };

    const fetchChatDetails = async () => {
        try {
            const res = await client.get(`/chat/${id}`);
            const chat = res.data;
            const chatPartner = chat.participants.find(p => p._id !== currentUser._id) || chat.participants[0];
            setPartner(chatPartner);
            partnerRef.current = chatPartner; // Update Ref
            return chatPartner;
        } catch (error) {
            console.error("Failed to fetch chat details", error);
            return null;
        }
    };

    const fetchMessages = async () => {
        try {
            // Use REF to get latest partner in interval closure
            let currentPartner = partnerRef.current;

            const res = await client.get(`/chat/${id}/messages`);
            let rawMessages = res.data;

            if (currentPartner?.publicKey) {
                const decryptedMsgs = await Promise.all(rawMessages.map(async (msg) => {
                    // Try to decrypt text
                    if (msg.messageType === 'text' && msg.content) {
                        // Decrypt using Partner's public Key
                        try {
                            const plain = await decryptMessage(msg.content, currentPartner.publicKey);
                            msg.content = plain;
                        } catch (e) {
                            // msg.content = "⚠️ Encrypted Message";
                        }
                    }
                    return msg;
                }));
                // Only update if different? (Optional optimization, but for now just set)
                setMessages(decryptedMsgs);
            } else {
                setMessages(rawMessages);
            }
        } catch (error) {
            console.error("Failed to fetch messages", error);
        }
    };

    const handleSend = async (type = "text", mediaData = null) => {
        if (type === "text" && !newMessage.trim()) return;

        try {
            setSending(true);

            let contentToSend = "";

            if (type === "text") {
                if (!partner?.publicKey) {
                    Alert.alert("E2EE Error", "Partner has no encryption key. Cannot send safe message.");
                    setSending(false);
                    return;
                }
                contentToSend = await encryptMessage(newMessage, partner.publicKey);
            }

            await client.post(`/chat/${id}/messages`, {
                messageType: type,
                content: contentToSend, // E2EE encrypted
                media: mediaData
            });
            if (type === "text") setNewMessage('');
            if (type === "sticker") setShowStickers(false);
            fetchMessages();
        } catch (error) {
            console.error("Failed to send message", error);
            Alert.alert("Error", "Failed to send message");
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
            base64: true,
        });

        if (!result.canceled) {
            handleSend("image", `data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        Alert.alert(
            "Delete Message",
            "Are you sure you want to delete this message?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await client.delete(`/chat/${id}/messages/${messageId}`);
                            fetchMessages();
                        } catch (error) {
                            console.error("Failed to delete message", error);
                            Alert.alert("Error", "Could not delete message");
                        }
                    }
                }
            ]
        );
    };

    const renderMessage = ({ item, index }) => {
        const isMe = item.sender._id === currentUser._id;
        const isSticker = item.messageType === 'sticker';
        const isImage = item.messageType === 'image';

        // Date Header Logic
        let showDateHeader = false;
        if (index === 0) {
            showDateHeader = true;
        } else {
            const prevDate = new Date(messages[index - 1].createdAt);
            const currDate = new Date(item.createdAt);

            if (prevDate.getDate() !== currDate.getDate() ||
                prevDate.getMonth() !== currDate.getMonth() ||
                prevDate.getFullYear() !== currDate.getFullYear()) {
                showDateHeader = true;
            }
        }

        return (
            <View>
                {showDateHeader && (
                    <View style={styles.dateHeaderContainer}>
                        <View style={styles.dateHeaderBadge}>
                            <Text style={styles.dateHeaderText}>
                                {getDateHeaderLabel(item.createdAt)}
                            </Text>
                        </View>
                    </View>
                )}
                <View style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.theirMessageContainer]}>
                    {!isMe && (
                        <TouchableOpacity onPress={() => router.push(`/user-profile/${item.sender._id}`)}>
                            <Image
                                source={{ uri: item.sender.profileImage || 'https://via.placeholder.com/30' }}
                                style={styles.avatar}
                            />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={() => item.sender._id === currentUser._id && handleDeleteMessage(item._id)}
                        onLongPress={() => isMe && handleDeleteMessage(item._id)}
                        activeOpacity={0.9}
                        style={{ maxWidth: '75%' }}
                    >
                        {isMe ? (
                            <LinearGradient
                                colors={['#00c6ff', '#0072ff']} // Blue Gradient
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.messageBubble, styles.myMessageGradient, isImage && styles.imageBubble, isSticker && styles.stickerBubble]}
                            >
                                {isSticker ? (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.stickerImage} />
                                ) : isImage ? (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
                                ) : (
                                    <Text style={styles.myMessageText}>{item.content}</Text>
                                )}

                                <View style={[styles.messageFooter, (isSticker || isImage) && styles.mediaFooter]}>
                                    <Text style={[styles.myTimeText, (isSticker || isImage) && styles.mediaTimeText]}>
                                        {formatTime(item.createdAt)}
                                    </Text>
                                    <View style={{ marginLeft: 4 }}>
                                        {renderReadStatus(item)}
                                    </View>
                                </View>
                            </LinearGradient>
                        ) : (
                            <View style={[styles.messageBubble, styles.theirMessage, isImage && styles.imageBubble, isSticker && styles.stickerBubble]}>
                                {isSticker ? (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.stickerImage} />
                                ) : isImage ? (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
                                ) : (
                                    <Text style={styles.theirMessageText}>{item.content}</Text>
                                )}
                                <View style={[styles.messageFooter, (isSticker || isImage) && styles.mediaFooter]}>
                                    <Text style={[styles.theirTimeText, (isSticker || isImage) && styles.mediaTimeText]}>
                                        {formatTime(item.createdAt)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeScreen backgroundColor="#f0f2f5">
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                {partner ? (
                    <TouchableOpacity
                        style={styles.headerPartnerInfo}
                        onPress={() => router.push(`/user-profile/${partner._id}`)}
                    >
                        <Image
                            source={{ uri: partner.profileImage || 'https://via.placeholder.com/40' }}
                            style={styles.headerAvatar}
                        />
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.headerPartnerName}>{partner.username}</Text>
                                <View style={[styles.chatTierBadge, { backgroundColor: getTierColor(partner?.tier), opacity: 0.9 }]}>
                                    <Text style={styles.chatTierBadgeText}>{partner.tier || "Newbie"}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: partner.isOnline ? '#2ecc71' : '#ff4444', marginRight: 6 }} />
                                <Text style={[styles.headerStatus, { color: partner.isOnline ? '#2ecc71' : '#999' }]}>
                                    {partner.isOnline ? "Online" : `Last seen ${partner.lastSeen ? formatTime(partner.lastSeen) : 'recently'}`}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.headerTitle}>Chat</Text>
                )}
                {/* Optional: Options Button */}
                <TouchableOpacity style={{ padding: 5 }}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#333" />
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                style={{ flex: 1 }}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                style={styles.keyboardView}
            >
                {/* Sticker Tray */}
                {showStickers && (
                    <View style={styles.stickerTray}>
                        <FlatList
                            data={STICKERS}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={s => s.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.stickerItem}
                                    onPress={() => handleSend("sticker", item.url)}
                                >
                                    <Image source={{ uri: item.url }} style={styles.stickerPreview} />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                <View style={styles.inputWrapper}>
                    <View style={styles.inputContainer}>
                        <TouchableOpacity style={styles.attachButton} onPress={() => setShowStickers(!showStickers)}>
                            <MaterialCommunityIcons name="sticker-emoji" size={24} color={showStickers ? "#0072ff" : "#888"} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
                            <Ionicons name="image-outline" size={24} color="#888" />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            value={newMessage}
                            onChangeText={setNewMessage}
                            multiline
                            maxLength={500}
                        />

                        {newMessage.trim() ? (
                            <TouchableOpacity
                                style={styles.sendButton}
                                onPress={() => handleSend("text")}
                                disabled={sending}
                            >
                                <LinearGradient
                                    colors={['#00c6ff', '#0072ff']}
                                    style={styles.sendGradient}
                                >
                                    <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.micButton}>
                                <Ionicons name="mic" size={22} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        zIndex: 10,
    },
    backButton: {
        marginRight: 10,
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    headerPartnerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        marginRight: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    headerPartnerName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#222',
        letterSpacing: 0.3,
    },
    headerStatus: {
        fontSize: 12,
        color: '#2ecc71', // Green for online
        fontWeight: '500',
    },
    chatTierBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 8,
    },
    chatTierBadgeText: {
        fontSize: 9,
        color: '#fff',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    listContent: {
        padding: 15,
        paddingBottom: 20,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        backgroundColor: '#e1e1e1',
    },
    messageBubble: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 22,
        elevation: 1,
    },
    myMessageGradient: {
        borderBottomRightRadius: 4,
        shadowColor: "#0072ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    theirMessage: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    myMessageText: {
        color: '#fff',
        fontSize: 16,
        lineHeight: 22,
    },
    theirMessageText: {
        color: '#333',
        fontSize: 16,
        lineHeight: 22,
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    timeText: { fontSize: 10 },
    myTimeText: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
    theirTimeText: { color: '#adb5bd', fontSize: 10 },
    readStatusText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.9)',
        marginLeft: 5,
    },
    dateHeaderContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    dateHeaderBadge: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    dateHeaderText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
    },
    keyboardView: {
        width: '100%',
    },
    inputWrapper: {
        padding: 10,
        backgroundColor: 'transparent',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 30,
        paddingHorizontal: 10,
        paddingVertical: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        marginHorizontal: 10,
        marginBottom: 5,
    },
    input: {
        flex: 1,
        fontSize: 16,
        maxHeight: 100,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#333',
    },
    attachButton: {
        padding: 8,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0072ff',
        overflow: 'hidden',
        marginLeft: 5,
        elevation: 2,
    },
    micButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#00c6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 5,
    },
    sendGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stickerTray: {
        backgroundColor: '#f8f9fa',
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    stickerItem: {
        marginHorizontal: 8,
    },
    stickerPreview: {
        width: 60,
        height: 60,
    },
    stickerBubble: {
        backgroundColor: 'transparent',
        padding: 0,
        elevation: 0,
        shadowOpacity: 0,
    },
    stickerImage: {
        width: 140,
        height: 140,
        resizeMode: 'contain',
    },
    imageBubble: {
        padding: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    messageImage: {
        width: 220,
        height: 160,
        borderRadius: 8,
        backgroundColor: '#eee',
    },
    mediaFooter: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    mediaTimeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
