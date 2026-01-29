
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function StoryView() {
    const { userId } = useLocalSearchParams();
    const [stories, setStories] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchStories();
    }, [userId]);

    const fetchStories = async () => {
        try {
            // Fetch ALL stories for this user (or we could fetch via feed logic if needed)
            // But simpler is utilizing /stories/user/:userId which returns all for that user
            // We might want to filter for active ones only
            const res = await client.get(`/stories/user/${userId}`);
            // Filter active
            const active = res.data.filter(s => new Date(s.expiresAt) > new Date());
            setStories(active);
        } catch (error) {
            console.error("Error fetching stories:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            router.back();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else {
            router.back();
        }
    };

    // Mark as viewed when index changes
    useEffect(() => {
        if (stories[currentIndex]) {
            client.post(`/stories/view/${stories[currentIndex]._id}`).catch(err => console.error(err));
        }
    }, [currentIndex, stories]);

    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator color="#fff" /></View>;
    }

    if (stories.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={{ color: 'white', textAlign: 'center', marginTop: 100 }}>No active stories</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: '#28a745', textAlign: 'center' }}>Close</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const currentStory = stories[currentIndex];

    return (
        <View style={styles.container}>
            <Image source={{ uri: currentStory.media }} style={styles.image} resizeMode="cover" />

            <SafeAreaView style={styles.overlay}>
                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    {stories.map((_, idx) => (
                        <View key={idx} style={[styles.progressBar, idx <= currentIndex ? styles.activeBar : styles.inactiveBar]} />
                    ))}
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Image source={{ uri: currentStory.user?.profileImage }} style={styles.avatar} />
                    <Text style={styles.username}>{currentStory.user?.username}</Text>
                    <Text style={styles.time}>{new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 'auto' }}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tappable Areas */}
                <View style={styles.tapContainer}>
                    <TouchableOpacity style={styles.tapArea} onPress={handlePrev} />
                    <TouchableOpacity style={styles.tapArea} onPress={handleNext} />
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: width,
        height: height,
        position: 'absolute',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.1)'
    },
    progressContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingTop: 10,
        height: 3,
        marginBottom: 10,
    },
    progressBar: {
        flex: 1,
        height: 2,
        borderRadius: 1,
        marginHorizontal: 2,
    },
    activeBar: {
        backgroundColor: 'white',
    },
    inactiveBar: {
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginTop: 10,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    username: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        marginRight: 10,
    },
    time: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    tapContainer: {
        flex: 1,
        flexDirection: 'row',
        marginTop: 20,
    },
    tapArea: {
        flex: 1,
    }
});
