import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import TextPost from '../../components/posts/TextPost';
import ImagePost from '../../components/posts/ImagePost';
import VideoPost from '../../components/posts/VideoPost';

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
        Alert.alert("Delete Post", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    try {
                        await client.delete(`/posts/${id}`);
                        router.back();
                    } catch {
                        Alert.alert("Error", "Failed to delete post.");
                    }
                }
            }
        ]);
    };

    const handleLike = async () => {
        try {
            await client.put(`/posts/like/${id}`);
            fetchPost();
        } catch (e) { console.error(e); }
    };

    const handleComment = async () => {
        if (!commentText.trim()) return;
        setSendingComment(true);
        try {
            const res = await client.post(`/posts/comment/${id}`, { text: commentText });
            setPost(res.data);
            setCommentText('');
        } catch {
            Alert.alert("Error", "Failed to post comment");
        } finally {
            setSendingComment(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        Alert.alert("Delete Comment", "Remove this comment?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    try {
                        await client.delete(`/posts/${id}/comment/${commentId}`);
                        fetchPost();
                    } catch {
                        Alert.alert("Error", "Failed to delete comment");
                    }
                }
            }
        ]);
    };

    const onProfileNavigate = () => {
        if (!post?.user) return;
        const targetId = post.user._id || post.user;
        if (String(targetId) === String(currentUser._id)) {
            router.push('/profile');
        } else {
            router.push(`/user-profile/${targetId}`);
        }
    };

    const onTaggedUserPress = (taggedUser) => {
        if (!taggedUser?._id) return;
        if (String(taggedUser._id) === String(currentUser._id)) {
            router.push('/profile');
        } else {
            router.push(`/user-profile/${taggedUser._id}`);
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

    const isOwner = String(post.user._id) === String(currentUser._id);
    const isLiked = post.likes.includes(currentUser._id);
    const taggedUsers = post.taggedUsers || [];
    const resolvedType = post.type || (post.mediaUrl ? (post.mediaUrl.includes('video') ? 'video' : 'image') : (post.video ? 'video' : post.image ? 'image' : 'text'));

    // Debug log as requested by user
    console.log(`[PostDetail] Rendering post ${post._id}:`, {
        type: post.type,
        resolvedType,
        content: post.content || post.caption,
        mediaUrl: post.mediaUrl || post.video || post.image,
    });

    const renderPostContent = () => {
        const content = post.content || post.caption || "";
        const mediaUrl = post.mediaUrl || post.video || post.image;

        switch (resolvedType) {
            case 'image':
                return <ImagePost mediaUrl={mediaUrl} content={content} />;
            case 'video':
                return <VideoPost mediaUrl={mediaUrl} content={content} />;
            case 'text':
            default:
                return <TextPost content={content} />;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Post</Text>
                    {isOwner ? (
                        <TouchableOpacity onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={24} color="#dc3545" />
                        </TouchableOpacity>
                    ) : <View style={{ width: 24 }} />}
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Author */}
                    <TouchableOpacity onPress={onProfileNavigate} style={styles.userInfo}>
                        <Image source={{ uri: post.user.profileImage || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                        <View>
                            <Text style={styles.username}>{post.user.username}</Text>
                            <Text style={styles.date}>{new Date(post.createdAt).toLocaleDateString()}</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Modular Post Content (Image, Video, or Text) */}
                    {renderPostContent()}

                    <View style={styles.contentBox}>

                        {/* Tagged Users */}
                        {taggedUsers.length > 0 && (
                            <View style={styles.taggedSection}>
                                <Ionicons name="person-circle-outline" size={16} color="#888" />
                                <Text style={styles.taggedLabel}>Tagged: </Text>
                                <View style={styles.tagChips}>
                                    {taggedUsers.map(u => (
                                        <TouchableOpacity key={u._id} style={styles.tagChip} onPress={() => onTaggedUserPress(u)}>
                                            <Text style={styles.tagChipText}>@{u.username}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Actions */}
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

                        {/* Comments */}
                        <View style={styles.commentsSection}>
                            {post.comments.map((comment, index) => {
                                const isCommentAuthor = String(comment.user?._id) === String(currentUser._id);
                                const canDelete = isCommentAuthor || isOwner;
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

                {/* Comment Input */}
                <View style={styles.footer}>
                    <Image source={{ uri: currentUser?.profileImage || 'https://via.placeholder.com/150' }} style={styles.inputAvatar} />
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="Add a comment..."
                            placeholderTextColor="#888"
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                        />
                        <TouchableOpacity style={styles.sendButton} onPress={handleComment} disabled={!commentText.trim() || sendingComment}>
                            {sendingComment
                                ? <ActivityIndicator size="small" color="#28a745" />
                                : <Ionicons name="send" size={20} color={commentText.trim() ? '#28a745' : '#ccc'} />
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee',
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
    scrollContent: { paddingBottom: 20 },
    userInfo: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10, backgroundColor: '#eee' },
    username: { fontWeight: 'bold', fontSize: 16, color: '#222' },
    usernameText: { fontWeight: 'bold', color: '#222' },
    date: { color: '#666', fontSize: 12, marginTop: 2 },
    postImage: { width: '100%', height: 420, backgroundColor: '#f0f0f0' },
    contentBox: { padding: 15 },
    caption: { fontSize: 15, lineHeight: 22, marginBottom: 12, color: '#333' },
    taggedSection: {
        flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap',
        marginBottom: 14, backgroundColor: '#f9fafb', padding: 10, borderRadius: 10,
    },
    taggedLabel: { fontSize: 13, color: '#888', marginRight: 4 },
    tagChips: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
    tagChip: {
        backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 14, marginRight: 6, marginBottom: 4,
        borderWidth: 1, borderColor: '#c8e6c9',
    },
    tagChipText: { color: '#28a745', fontSize: 13, fontWeight: '600' },
    actionRow: {
        flexDirection: 'row', marginBottom: 15,
        borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 15,
    },
    actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    actionText: { marginLeft: 6, fontSize: 15, fontWeight: '600', color: '#333' },
    commentsSection: { marginTop: 5 },
    commentItem: { flexDirection: 'row', marginBottom: 18, alignItems: 'flex-start' },
    commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: '#eee' },
    commentBubbleContainer: { flex: 1 },
    commentBubble: {
        backgroundColor: '#f1f3f5', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 18, borderTopLeftRadius: 4, alignSelf: 'flex-start',
    },
    commentUser: { fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#333' },
    commentText: { fontSize: 14, lineHeight: 18, color: '#444' },
    deleteCommentBtn: { marginLeft: 10, paddingTop: 10 },
    footer: {
        flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#eee',
        alignItems: 'center', backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    },
    inputAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
    inputWrapper: {
        flex: 1, flexDirection: 'row', backgroundColor: '#f1f3f5',
        borderRadius: 20, alignItems: 'center', paddingHorizontal: 15,
        minHeight: 40, maxHeight: 100,
    },
    input: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#222' },
    sendButton: { padding: 5, marginLeft: 5 },
});
