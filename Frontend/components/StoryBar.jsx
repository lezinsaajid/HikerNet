import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function StoryBar() {
    const [stories, setStories] = useState([]);
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        fetchStories();
    }, []);

    const fetchStories = async () => {
        try {
            const res = await client.get('/stories/feed');
            setStories(res.data);
        } catch (error) {
            console.error("Error fetching stories", error);
        }
    };

    const handleCreate = () => {
        router.push('/story/create');
    };

    const handleView = (userId) => {
        router.push({ pathname: '/story/view', params: { userId } });
    };

    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {/* Add Story Button */}
                <TouchableOpacity style={styles.item} onPress={handleCreate}>
                    <View style={[styles.ring, styles.addRing]}>
                        <Image source={{ uri: user?.profileImage }} style={styles.avatar} />
                        <View style={styles.plusBadge}>
                            <Ionicons name="add" size={12} color="white" />
                        </View>
                    </View>
                    <Text style={styles.username}>My Story</Text>
                </TouchableOpacity>

                {/* Friend Stories */}
                {stories.map((storyGroup) => (
                    <TouchableOpacity key={storyGroup.user._id} style={styles.item} onPress={() => handleView(storyGroup.user._id)}>
                        <View style={[styles.ring, styles.activeRing]}>
                            <Image source={{ uri: storyGroup.user.profileImage }} style={styles.avatar} />
                        </View>
                        <Text style={styles.username} numberOfLines={1}>
                            {storyGroup.user.username}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingVertical: 10,
    },
    scroll: {
        paddingHorizontal: 15,
    },
    item: {
        alignItems: 'center',
        marginRight: 15,
        width: 70,
    },
    ring: {
        padding: 3,
        borderRadius: 40,
        marginBottom: 5,
    },
    activeRing: {
        borderWidth: 2,
        borderColor: '#28a745', // Brand color
    },
    addRing: {
        borderWidth: 0,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#eee',
    },
    plusBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#007AFF',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    username: {
        fontSize: 12,
        textAlign: 'center',
    },
});
