import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function PostItem({ post, onUpdate }) {
    const { user, updateUserData } = useAuth();
    const router = useRouter();

    const [likes, setLikes] = useState(post.likes || []);
    const [comments, setComments] = useState(post.comments || []);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    // Check global following status directly from context
    const isFollowing = user && user.following && user.following.includes(post.user._id);
    const isLiked = likes.includes(user?._id);

    const onProfileNavigate = () => {
        if (!user || !post.user._id) return;
        if (user._id === post.user._id) {
            router.push('/profile');
        } else {
            router.push(`/user-profile/${post.user._id}`);
        }
    };

    const handleFollow = async () => {
        // Optimistic global update
        if (!user) return;
        const newFollowing = [...(user.following || []), post.user._id];
        updateUserData({ following: newFollowing });

        try {
            await client.post(`/users/follow/${post.user._id}`);
        } catch (error) {
            console.error("Error following user:", error);
            // Revert on error
            const revertedFollowing = user.following.filter(id => id !== post.user._id);
            updateUserData({ following: revertedFollowing });
        }
    };

    const handleLike = async () => {
        // Optimistic update
        const previouslyLiked = isLiked;
        const newLikes = previouslyLiked
            ? likes.filter(id => id !== user._id)
            : [...likes, user._id];

        setLikes(newLikes);

        try {
            await client.put(`/posts/like/${post._id}`);
        } catch (error) {
            console.error("Error liking post:", error);
            // Revert on error
            setLikes(likes);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        setCommentLoading(true);
        try {
            const res = await client.post(`/posts/comment/${post._id}`, { text: newComment });
            if (res.data && res.data.comments) {
                setComments(res.data.comments);
            }
            setNewComment('');
        } catch (error) {
            console.error("Error sending comment:", error);
        } finally {
            setCommentLoading(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            const res = await client.delete(`/posts/${post._id}/comment/${commentId}`);
            if (res.data && res.data.post && res.data.post.comments) {
                setComments(res.data.post.comments);
            }
        } catch (error) {
            console.error("Error deleting comment:", error);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onProfileNavigate} style={styles.profileNavGroup}>
                    <Image source={{ uri: post.user.profileImage }} style={styles.avatar} />
                    <View style={styles.headerText}>
                        <View style={styles.nameRow}>
                            <Text style={styles.username}>{post.user.username}</Text>
                        </View>
                        {post.trek && (
                            <Text style={styles.location}>at {post.trek.name}</Text>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Follow Button stays separate so it doesn't navigate on click */}
                {!isFollowing && user && post.user._id !== user._id && (
                    <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
                        <Text style={styles.followText}>Follow</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Image */}
            {post.image && (
                <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
            )}

            {/* Content & Actions */}
            <View style={styles.content}>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                        <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={28}
                            color={isLiked ? "#e74c3c" : "black"}
                        />
                        <Text style={styles.actionText}>{likes.length > 0 ? likes.length : ''}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => setShowComments(true)}>
                        <Ionicons name="chatbubble-outline" size={26} color="black" />
                        <Text style={styles.actionText}>{comments.length > 0 ? comments.length : ''}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="paper-plane-outline" size={26} color="black" />
                    </TouchableOpacity>
                </View>

                {post.caption ? (
                    <Text style={styles.caption}>
                        <Text style={styles.usernameText} onPress={onProfileNavigate}>{post.user.username} </Text>
                        {post.caption}
                    </Text>
                ) : null}

                {comments.length > 0 && (
                    <TouchableOpacity onPress={() => setShowComments(true)}>
                        <Text style={styles.viewComments}>View all {comments.length} comments</Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.timeAgo}>{new Date(post.createdAt).toLocaleDateString()}</Text>
            </View>

            {/* Comments Modal (BottomSheet Style) */}
            <Modal visible={showComments} animationType="slide" transparent={true} onRequestClose={() => setShowComments(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Drag Handle & Header */}
                        <View style={styles.modalHeader}>
                            <View style={styles.dragIndicator} />
                            <Text style={styles.modalTitle}>Comments</Text>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowComments(false)}>
                                <Ionicons name="close-circle-outline" size={26} color="#444" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.commentList} contentContainerStyle={{ paddingBottom: 20 }}>
                            {comments.length === 0 ? (
                                <Text style={styles.noComments}>No comments yet. Start the conversation!</Text>
                            ) : (
                                comments.map((comment, index) => {
                                    const isSelf = comment.user === user?._id || comment.user?._id === user?._id || post.user._id === user?._id;
                                    return (
                                        <View key={comment._id || index} style={styles.commentItem}>
                                            <Image 
                                                source={{ uri: comment.user?.profileImage || 'https://via.placeholder.com/150' }} 
                                                style={styles.commentAvatar} 
                                            />
                                            <View style={styles.commentBubbleContainer}>
                                                <View style={styles.commentBubble}>
                                                    <Text style={styles.commentUser}>{comment.user?.username || 'User'}</Text>
                                                    <Text style={styles.commentText}>{comment.text}</Text>
                                                </View>
                                            </View>
                                            {isSelf && (
                                                <TouchableOpacity onPress={() => handleDeleteComment(comment._id)} style={styles.deleteCommentBtn}>
                                                    <Ionicons name="trash-outline" size={16} color="#bbb" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>

                        <View style={styles.inputContainer}>
                            <Image 
                                source={{ uri: user?.profileImage || 'https://via.placeholder.com/150' }} 
                                style={styles.inputAvatar} 
                            />
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Add a comment..."
                                    placeholderTextColor="#888"
                                    value={newComment}
                                    onChangeText={setNewComment}
                                    multiline
                                />
                                <TouchableOpacity 
                                    style={styles.sendButton} 
                                    onPress={handleSendComment} 
                                    disabled={commentLoading || !newComment.trim()}
                                >
                                    {commentLoading ? (
                                        <ActivityIndicator size="small" color="#28a745" />
                                    ) : (
                                        <Ionicons 
                                            name="send" 
                                            size={20} 
                                            color={newComment.trim() ? '#28a745' : '#ccc'} 
                                        />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
    },
    profileNavGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        marginRight: 10,
        backgroundColor: '#eee',
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    headerText: {
        justifyContent: 'center',
    },
    username: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#222',
    },
    location: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    followBtn: {
        backgroundColor: '#28a745',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
    },
    followText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    postImage: {
        width: '100%',
        height: 400,
        backgroundColor: '#f8f8f8',
    },
    content: {
        padding: 12,
    },
    actions: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    actionText: {
        marginLeft: 6,
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    caption: {
        fontSize: 14,
        lineHeight: 18,
        color: '#444',
    },
    usernameText: {
        fontWeight: 'bold',
        color: '#222',
    },
    viewComments: {
        color: '#888',
        fontSize: 14,
        marginTop: 6,
    },
    timeAgo: {
        color: '#aaa',
        fontSize: 12,
        marginTop: 6,
    },
    // Modal Overlay Settings
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '75%', // Dynamic Bottom Sheet feel
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    dragIndicator: {
        width: 40,
        height: 5,
        backgroundColor: '#ddd',
        borderRadius: 3,
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    closeBtn: {
        position: 'absolute',
        right: 15,
        top: 15,
    },
    commentList: {
        flex: 1,
        padding: 15,
    },
    noComments: {
        textAlign: 'center',
        color: '#888',
        marginTop: 40,
        fontSize: 15,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 18,
        alignItems: 'flex-start',
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        backgroundColor: '#eee',
    },
    commentBubbleContainer: {
        flex: 1,
    },
    commentBubble: {
        backgroundColor: '#f1f3f5',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        borderTopLeftRadius: 4,
        alignSelf: 'flex-start',
        maxWidth: '100%',
    },
    commentUser: {
        fontWeight: 'bold',
        fontSize: 13,
        marginBottom: 4,
        color: '#333',
    },
    commentText: {
        fontSize: 14,
        lineHeight: 18,
        color: '#444',
    },
    deleteCommentBtn: {
        marginLeft: 10,
        paddingTop: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    },
    inputAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 10,
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#f1f3f5',
        borderRadius: 20,
        alignItems: 'center',
        paddingHorizontal: 15,
        minHeight: 40,
        maxHeight: 100,
    },
    input: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 14,
        color: '#222',
    },
    sendButton: {
        padding: 5,
        marginLeft: 5,
    }
});
