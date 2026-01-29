import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import SafeScreen from '../../components/SafeScreen';

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
    const [chatInstance, setChatInstance] = useState(null);
    const flatListRef = useRef(null);

    // Initial fetch
    useEffect(() => {
        fetchChatDetails();
        fetchMessages();
        // Poll for new messages and partner status
        const interval = setInterval(() => {
            fetchMessages();
            fetchChatDetails();
        }, 5000);
        return () => clearInterval(interval);
    }, [id]);

    const getReadStatus = (message) => {
        if (message.sender._id !== currentUser._id) return null;
        return message.readBy?.length > 1 ? "Read" : "Sent";
    };

    const fetchChatDetails = async () => {
        try {
            const res = await client.get(`/chat/${id}`);
            const chat = res.data;
            const chatPartner = chat.participants.find(p => p._id !== currentUser._id) || chat.participants[0];
            setPartner(chatPartner);
        } catch (error) {
            console.error("Failed to fetch chat details", error);
        }
    };

    const fetchMessages = async () => {
        try {
            const res = await client.get(`/chat/${id}/messages`);
            // Only update if length changed or something significant to avoid jitter
            // For simplicity, just set it for now. Optimization: compare last message ID.
            setMessages(res.data);
        } catch (error) {
            console.error("Failed to fetch messages", error);
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim()) return;

        try {
            await client.post(`/chat/${id}/messages`, {
                senderId: currentUser._id,
                content: newMessage
            });
            setNewMessage('');
            fetchMessages(); // Refresh immediately
        } catch (error) {
            console.error("Failed to send message", error);
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
                    <TouchableOpacity onPress={() => item.sender._id === currentUser._id && handleDeleteMessage(item._id)} onLongPress={() => isMe && handleDeleteMessage(item._id)} style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                            {item.content}
                        </Text>
                        <View style={styles.messageFooter}>
                            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                                {formatTime(item.createdAt)}
                            </Text>
                            {isMe && (
                                <Text style={styles.readStatusText}>
                                    {getReadStatus(item)}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeScreen backgroundColor="#f5f5f5">
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
                                <View style={[styles.chatTierBadge, { backgroundColor: getTierColor(partner?.tier) }]}>
                                    <Text style={styles.chatTierBadgeText}>{partner.tier || "Newbie"}</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.headerTitle}>Chat</Text>
                )}
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
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0} // Adjusted for better screen fit
                style={styles.inputContainer}
            >
                <TextInput
                    style={styles.input}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                    <Ionicons name="send" size={24} color="#fff" />
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        marginRight: 15,
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
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#eee',
    },
    headerPartnerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    readStatusText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        marginLeft: 5,
        fontStyle: 'italic',
    },
    chatTierBadge: {
        backgroundColor: '#e8f5e9',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
        marginLeft: 6,
    },
    chatTierBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: 'bold',
    },
    listContent: {
        padding: 15,
        paddingBottom: 80,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        alignItems: 'flex-end',
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 8,
        backgroundColor: '#ddd',
    },
    messageBubble: {
        maxWidth: '75%',
        padding: 12,
        borderRadius: 20,
        elevation: 1,
    },
    myMessage: {
        backgroundColor: '#28a745',
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
    },
    myMessageText: {
        color: '#fff',
    },
    theirMessageText: {
        color: '#333',
    },
    timeText: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    myTimeText: {
        color: 'rgba(255,255,255,0.7)',
    },
    theirTimeText: {
        color: '#999',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    input: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        maxHeight: 100,
        marginRight: 10,
        fontSize: 16,
    },
    sendButton: {
        backgroundColor: '#28a745',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateHeaderContainer: {
        alignItems: 'center',
        marginVertical: 10,
        marginBottom: 15,
    },
    dateHeaderBadge: {
        backgroundColor: 'rgba(0,0,0,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    dateHeaderText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
    },
});
