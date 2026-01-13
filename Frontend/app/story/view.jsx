import React, { useEffect, useState, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ProgressBarAndroid, Platform, Text, Dimensions, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function ViewStory() {
    const { userId } = useLocalSearchParams();
    const router = useRouter();
    const [stories, setStories] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        fetchUserStories();
    }, [userId]);

    const fetchUserStories = async () => {
        try {
            // In a real app, we would fetch specific stories for this user.
            // Our current backend /feed returns groups. We might need a specific endpoint or just re-fetch feed and find.
            // For simplicity/demo with current API: We will re-fetch feed and filter.
            const res = await client.get('/stories/feed');
            const group = res.data.find(g => g._id === userId);

            if (group && group.stories.length > 0) {
                setStories(group.stories);
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
                    {/* Ideally pass user info down, picking generic here */}
                    <Text style={styles.username}>User Story</Text>
                    <Text style={styles.time}>2h</Text>
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
    }
});
