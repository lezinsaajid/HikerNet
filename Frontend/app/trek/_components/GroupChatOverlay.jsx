import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export default function GroupChatOverlay({ visible, onClose, messages, onSendMessage, currentUser }) {
    const [text, setText] = useState('');
    const slideAnim = useRef(new Animated.Value(600)).current;
    const flatListRef = useRef(null);

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 600,
                duration: 250,
                useNativeDriver: true
            }).start();
        }
    }, [visible]);

    const handleSend = () => {
        if (text.trim()) {
            onSendMessage(text.trim());
            setText('');
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = item.userId === currentUser?._id;
        return (
            <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
                {!isMe && (
                    <Image 
                        source={{ uri: item.profileImage || 'https://via.placeholder.com/150' }} 
                        style={styles.avatar} 
                    />
                )}
                <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    {!isMe && <Text style={styles.senderName}>{item.username}</Text>}
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {item.text}
                    </Text>
                    <Text style={styles.timestamp}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    if (!visible && slideAnim._value === 600) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={90} tint="dark" style={styles.blur}>
                <View style={styles.header}>
                    <View style={styles.handle} />
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Group Chat</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    onLayout={() => flatListRef.current?.scrollToEnd()}
                />

                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                >
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Message group..."
                            placeholderTextColor="#aaa"
                            value={text}
                            onChangeText={setText}
                            multiline
                        />
                        <TouchableOpacity 
                            onPress={handleSend} 
                            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
                            disabled={!text.trim()}
                        >
                            <Ionicons name="send" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </BlurView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
        zIndex: 1000,
    },
    blur: {
        flex: 1,
    },
    header: {
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 3,
        marginBottom: 10,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    closeButton: {
        padding: 5,
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        maxWidth: '85%',
    },
    myMessage: {
        alignSelf: 'flex-end',
    },
    theirMessage: {
        alignSelf: 'flex-start',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        alignSelf: 'flex-end',
    },
    messageBubble: {
        padding: 12,
        borderRadius: 18,
    },
    myBubble: {
        backgroundColor: '#28a745',
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderBottomLeftRadius: 4,
    },
    senderName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#28a745',
        marginBottom: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    myMessageText: {
        color: 'white',
    },
    theirMessageText: {
        color: 'white',
    },
    timestamp: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 35 : 15,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: 'white',
        marginRight: 10,
        maxHeight: 100,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#28a745',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(40,167,69,0.5)',
    }
});
