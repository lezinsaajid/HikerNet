import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function PostDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user: currentUser } = useAuth();

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [sendingComment, setSendingComment] = useState(false);

    useEffect(() => {
        fetchPost();
    }, [id]);

    const fetchPost = async () => {
        try {
            const res = await client.get(`/posts/${id}`);
            setPost(res.data);
        } catch (error) {
            console.error("Error fetching post:", error);
            Alert.alert("Error", "Could not load post details.");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await client.delete(`/posts/${id}`);
                            Alert.alert("Deleted", "Post has been removed.");
                            router.back();
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete post.");
                        }
                    }
                }
            ]
        );
    };

    const handleLike = async () => {
        try {
            await client.put(`/posts/like/${id}`);
            fetchPost(); // Refresh to show updated likes
        } catch (error) {
            console.error(error);
        }
    };

    const handleComment = async () => {
        if (!commentText.trim()) return;
        try {
            setSendingComment(true);
            await client.post(`/posts/comment/${id}`, { text: commentText });
            setCommentText('');
            fetchPost();
        } catch (error) {
            Alert.alert("Error", "Failed to post comment");
        } finally {
            setSendingComment(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        Alert.alert(
            "Delete Comment",
            "Are you sure you want to delete this comment?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await client.delete(`/posts/${id}/comment/${commentId}`);
                            fetchPost();
                        } catch (error) {
                            console.error("Delete comment error:", error);
                            Alert.alert("Error", "Failed to delete comment");
                        }
                    }
                }
            ]
        );
    };

    const onProfileNavigate = () => {
        if (!post?.user) return;
        const targetId = post.user._id || post.user;
        if (targetId === currentUser._id) {
            router.push('/profile');
        } else {
            router.push(`/user-profile/${targetId}`);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color="#4A7C44" />
            </SafeAreaView>
        );
    }

    if (!post) return null;

    const isOwner = post.user._id === currentUser._id;
    const isLiked = post.likes.includes(currentUser._id);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Post</Text>
                    {isOwner ? (
                        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                            <Ionicons name="trash-outline" size={24} color="#dc3545" />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 24 }} /> /* Spacer */
                    )}
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity onPress={onProfileNavigate} style={styles.userInfo}>
                        <Image source={{ uri: post.user.profileImage || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                        <View>
                            <Text style={styles.username}>{post.user.username}</Text>
                            <Text style={styles.date}>{new Date(post.createdAt).toLocaleDateString()}</Text>
                        </View>
                    </TouchableOpacity>

                    {post.image && (
                        <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
                    )}

                    <View style={styles.content}>
                        <Text style={styles.caption}>
                            <Text style={styles.usernameText} onPress={onProfileNavigate}>{post.user.username} </Text>
                            {post.caption}
                        </Text>

                        <View style={styles.actionRow}>
                            <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#e74c3c" : "#333"} />
                                <Text style={styles.actionText}>{post.likes.length} likes</Text>
                            </TouchableOpacity>
                            <View style={styles.actionButton}>
                                <Ionicons name="chatbubble-outline" size={26} color="#333" />
                                <Text style={styles.actionText}>{post.comments.length} comments</Text>
                            </View>
                        </View>

                        {/* Comments Section */}
                        <View style={styles.commentsSection}>
                            {post.comments.map((comment, index) => {
                                const isCommentAuthor = comment.user?._id === currentUser._id || comment.user === currentUser._id;
                                const isPostOwner = post.user?._id === currentUser._id || post.user === currentUser._id;
                                const canDelete = isCommentAuthor || isPostOwner;

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
                                        {canDelete && (
                                            <TouchableOpacity onPress={() => handleDeleteComment(comment._id)} style={styles.deleteCommentBtn}>
                                                <Ionicons name="trash-outline" size={16} color="#bbb" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <Image 
                        source={{ uri: currentUser?.profileImage || 'https://via.placeholder.com/150' }} 
                        style={styles.inputAvatar} 
                    />
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="Add a comment..."
                            placeholderTextColor="#888"
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                        />
                        <TouchableOpacity 
                            style={styles.sendButton}
                            onPress={handleComment} 
                            disabled={!commentText.trim() || sendingComment}
                        >
                            {sendingComment ? (
                                <ActivityIndicator size="small" color="#28a745" />
                            ) : (
                                <Ionicons name="send" size={20} color={commentText.trim() ? '#28a745' : '#ccc'} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#222',
    },
    scrollContent: {
        paddingBottom: 20,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 10,
        backgroundColor: '#eee',
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    username: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#222',
    },
    usernameText: {
        fontWeight: 'bold',
        color: '#222',
    },
    date: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    postImage: {
        width: '100%',
        height: 420,
        backgroundColor: '#f0f0f0',
    },
    content: {
        padding: 15,
    },
    caption: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 15,
        color: '#333',
    },
    actionRow: {
        flexDirection: 'row',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 15,
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
    commentsSection: {
        marginTop: 5,
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
    footer: {
        flexDirection: 'row',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
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
