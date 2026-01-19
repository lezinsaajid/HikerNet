import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
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
        <SafeAreaView style={styles.container}>
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
                <View style={styles.userInfo}>
                    <Image source={{ uri: post.user.profileImage }} style={styles.avatar} />
                    <View>
                        <Text style={styles.username}>{post.user.username}</Text>
                        <Text style={styles.date}>{new Date(post.createdAt).toLocaleDateString()}</Text>
                    </View>
                </View>

                {post.image && (
                    <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
                )}

                <View style={styles.content}>
                    <Text style={styles.caption}>
                        <Text style={styles.bold}>{post.user.username}</Text> {post.caption}
                    </Text>

                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#e91e63" : "#333"} />
                            <Text style={styles.actionText}>{post.likes.length} likes</Text>
                        </TouchableOpacity>
                        <View style={styles.actionButton}>
                            <Ionicons name="chatbubble-outline" size={26} color="#333" />
                            <Text style={styles.actionText}>{post.comments.length} comments</Text>
                        </View>
                    </View>

                    {/* Comments Section */}
                    <View style={styles.commentsSection}>
                        {post.comments.map((comment, index) => (
                            <View key={index} style={styles.commentItem}>
                                <Text style={styles.commentText}>
                                    <Text style={styles.bold}>User </Text>
                                    {comment.text}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TextInput
                    style={styles.input}
                    placeholder="Add a comment..."
                    value={commentText}
                    onChangeText={setCommentText}
                />
                <TouchableOpacity onPress={handleComment} disabled={!commentText.trim() || sendingComment}>
                    <Text style={[styles.sendText, !commentText.trim() && { color: '#ccc' }]}>Post</Text>
                </TouchableOpacity>
            </View>
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
    },
    scrollContent: {
        paddingBottom: 80,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: '#eee',
    },
    username: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    date: {
        color: '#666',
        fontSize: 12,
    },
    postImage: {
        width: '100%',
        height: 400,
        backgroundColor: '#f0f0f0',
    },
    content: {
        padding: 15,
    },
    caption: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 15,
    },
    bold: {
        fontWeight: 'bold',
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
        fontSize: 14,
        fontWeight: '600',
    },
    commentsSection: {
        marginTop: 10,
    },
    commentItem: {
        marginBottom: 8,
    },
    commentText: {
        fontSize: 14,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: 'white',
    },
    input: {
        flex: 1,
        backgroundColor: '#f1f1f1',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginRight: 10,
    },
    sendText: {
        color: '#007bff',
        fontWeight: 'bold',
    },
});
