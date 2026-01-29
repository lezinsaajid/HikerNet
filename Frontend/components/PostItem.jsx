
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function PostItem({ post, onUpdate }) {
    const { user, updateUserData } = useAuth();
    const [likes, setLikes] = useState(post.likes || []);
    const [comments, setComments] = useState(post.comments || []);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    // Check global following status directly from context
    const isFollowing = user && user.following && user.following.includes(post.user._id);

    const isLiked = likes.includes(user?._id);

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
            // API returns the updated post object usually, or we can just append locally if we trust the backend return
            // Based on postRoutes.js, it returns the updated post.
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
                <Image source={{ uri: post.user.profileImage }} style={styles.avatar} />
                <View style={styles.headerText}>
                    <View style={styles.nameRow}>
                        <Text style={styles.username}>{post.user.username}</Text>
                        {!isFollowing && user && post.user._id !== user._id && (
                            <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
                                <Text style={styles.followText}>• Follow</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {post.trek && (
                        <Text style={styles.location}>at {post.trek.name}</Text>
                    )}
                </View>
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
                        <Text style={styles.usernameText}>{post.user.username} </Text>
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

            {/* Comments Modal */}
            <Modal visible={showComments} animationType="slide" onRequestClose={() => setShowComments(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Comments</Text>
                        <TouchableOpacity onPress={() => setShowComments(false)}>
                            <Ionicons name="close" size={28} color="black" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.commentList}>
                        {comments.length === 0 ? (
                            <Text style={styles.noComments}>No comments yet. Be the first!</Text>
                        ) : (
                            comments.map((comment, index) => (
                                <View key={comment._id || index} style={styles.commentItem}>
                                    <Text style={styles.commentText}>
                                        <Text style={styles.commentUser}>User </Text>
                                        {comment.text}
                                    </Text>
                                    {(comment.user === user?._id || post.user._id === user?._id) && (
                                        <TouchableOpacity onPress={() => handleDeleteComment(comment._id)}>
                                            <Ionicons name="trash-outline" size={16} color="red" style={{ marginLeft: 10 }} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))
                        )}
                    </ScrollView>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Add a comment..."
                            value={newComment}
                            onChangeText={setNewComment}
                        />
                        <TouchableOpacity onPress={handleSendComment} disabled={commentLoading || !newComment.trim()}>
                            <Text style={[styles.postButton, { color: newComment.trim() ? '#28a745' : '#ccc' }]}>Post</Text>
                        </TouchableOpacity>
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
        alignItems: 'center',
        padding: 10,
    },
    avatar: {
        width: 35,
        height: 35,
        borderRadius: 17.5,
        marginRight: 10,
        backgroundColor: '#eee',
    },
    headerText: {
        justifyContent: 'center',
    },
    username: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    location: {
        fontSize: 12,
        color: '#666',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    followBtn: {
        marginLeft: 10,
    },
    followText: {
        color: '#3498db',
        fontWeight: 'bold',
        fontSize: 14,
    },
    postImage: {
        width: '100%',
        height: 400, // Instagram style square-ish
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
        marginLeft: 5,
        fontSize: 16,
        fontWeight: '600',
    },
    caption: {
        fontSize: 14,
        lineHeight: 18,
    },
    usernameText: {
        fontWeight: 'bold',
    },
    viewComments: {
        color: '#888',
        fontSize: 14,
        marginTop: 5,
    },
    timeAgo: {
        color: '#aaa',
        fontSize: 12,
        marginTop: 5,
    },
    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'ios' ? 40 : 0,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    commentList: {
        flex: 1,
        padding: 15,
    },
    noComments: {
        textAlign: 'center',
        color: '#888',
        marginTop: 50,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 15,
        alignItems: 'flex-start',
    },
    commentText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    commentUser: {
        fontWeight: 'bold',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        marginRight: 10,
    },
    postButton: {
        fontWeight: 'bold',
        fontSize: 16,
    }
});
