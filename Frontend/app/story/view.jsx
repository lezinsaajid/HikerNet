import React, { useEffect, useState, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ProgressBarAndroid, Platform, Text, Dimensions, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Modal, ScrollView } from 'react-native';

const { width } = Dimensions.get('window');

export default function ViewStory() {
    const { userId } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const [stories, setStories] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [showViewers, setShowViewers] = useState(false);
    const [groupUser, setGroupUser] = useState(null);

    useEffect(() => {
        fetchUserStories();
    }, [userId]);

    const fetchUserStories = async () => {
        try {
            // In a real app, we would fetch specific stories for this user.
            // Our current backend /feed returns groups. We might need a specific endpoint or just re-fetch feed and find.
            // For simplicity/demo with current API: We will re-fetch feed and filter.
            const res = await client.get('/stories/feed');
            const group = res.data.find(g => {
                const gId = g.user?._id ? String(g.user._id) : String(g.user);
                return gId === String(userId);
            });

            if (group && group.stories?.length > 0) {
                setStories(group.stories);
                setGroupUser(group.user);
            } else {
                router.back(); // No stories found
            }
        } catch (error) {
            console.error("Error", error);
        } finally {
            setLoading(false);
        }
    };

    // Auto Advance Logic
    useEffect(() => {
        if (!stories.length) return;

        const duration = 5000; // 5 seconds per story
        const start = Date.now();

        const timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const p = elapsed / duration;

            if (p >= 1) {
                nextStory();
                clearInterval(timer);
            } else {
                setProgress(p);
            }
        }, 50);

        return () => clearInterval(timer);
    }, [currentIndex, stories]);

    // Track Viewers
    useEffect(() => {
        if (stories[currentIndex] && String(groupUser?._id) !== String(user?._id)) {
            markAsViewed(stories[currentIndex]._id);
        }
    }, [currentIndex, stories, groupUser]);

    const markAsViewed = async (storyId) => {
        try {
            await client.post(`/stories/view/${storyId}`);
        } catch (error) {
            console.error("Error marking story as viewed", error);
        }
    };

    const nextStory = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            router.back();
        }
    };

    const prevStory = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
        }
    };

    if (loading || !stories[currentIndex]) return <View style={styles.container} />;

    return (
        <View style={styles.container}>
            {/* Progress Bar (Custom simple bar since default one varies by OS) */}
            <View style={styles.progressContainer}>
                {stories.map((_, index) => (
                    <View key={index} style={styles.barBackground}>
                        <View style={[
                            styles.barFill,
                            {
                                width: index === currentIndex ? `${progress * 100}%` : index < currentIndex ? '100%' : '0%'
                            }
                        ]} />
                    </View>
                ))}
            </View>

            {/* Header info */}
            <SafeAreaView style={styles.header}>
                <View style={styles.userInfo}>
                    <Image source={{ uri: groupUser?.profileImage }} style={styles.headerAvatar} />
                    <View>
                        <Text style={styles.username}>{groupUser?.username || 'User'}</Text>
                        <Text style={styles.time}>{new Date(stories[currentIndex].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Main Content */}
            <Image
                source={{ uri: stories[currentIndex].media }}
                style={styles.image}
                resizeMode="cover"
            />

            {/* Tap Zones */}
            <View style={styles.touchContainer}>
                <TouchableOpacity style={styles.touchSide} onPress={prevStory} />
                <TouchableOpacity style={styles.touchSide} onPress={nextStory} />
            </View>

            {/* Viewer Count (Only for owner) */}
            {String(groupUser?._id) === String(user?._id) && (
                <TouchableOpacity style={styles.viewerFooter} onPress={() => setShowViewers(true)}>
                    <Ionicons name="eye-outline" size={20} color="white" />
                    <Text style={styles.viewerCount}>{stories[currentIndex].viewers?.length || 0} Viewers</Text>
                </TouchableOpacity>
            )}

            {/* Viewer List Modal */}
            <Modal visible={showViewers} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Viewed by</Text>
                            <TouchableOpacity onPress={() => setShowViewers(false)}>
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {stories[currentIndex].viewers?.map((viewer) => (
                                <View key={viewer._id} style={styles.viewerItem}>
                                    <Image source={{ uri: viewer.profileImage }} style={styles.viewerAvatar} />
                                    <Text style={styles.viewerName}>{viewer.username}</Text>
                                </View>
                            ))}
                            {(!stories[currentIndex].viewers || stories[currentIndex].viewers.length === 0) && (
                                <Text style={styles.noViewers}>No views yet</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    progressContainer: {
        position: 'absolute',
        top: 50,
        flexDirection: 'row',
        zIndex: 10,
        width: '100%',
        paddingHorizontal: 10,
        height: 3,
    },
    barBackground: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
        height: 3,
        marginHorizontal: 2,
        borderRadius: 2,
        overflow: 'hidden',
    },
    barFill: {
        backgroundColor: 'white',
        height: '100%',
    },
    header: {
        position: 'absolute',
        top: 60,
        width: '100%',
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    username: {
        color: 'white',
        fontWeight: 'bold',
        marginRight: 10,
    },
    time: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    touchContainer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
    },
    touchSide: {
        flex: 1,
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 10,
    },
    viewerFooter: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    viewerCount: {
        color: 'white',
        fontSize: 12,
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    viewerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    viewerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 15,
    },
    viewerName: {
        fontSize: 16,
        fontWeight: '500',
    },
    noViewers: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
    }
});
