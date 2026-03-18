import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CELL = width / 3;

export default function PostGridItem({ item, onLongPress }) {
    const router = useRouter();

    // Defensive type resolution
    const mediaUrl = item.mediaUrl || item.video || item.image;
    const content = item.content || item.caption || "";
    const isVideo = item.type === 'video' || (item.mediaUrl && item.mediaUrl.includes('video')) || !!item.video;
    const isImage = item.type === 'image' || (item.mediaUrl && !item.mediaUrl.includes('video')) || !!item.image;
    
    let resolvedType = item.type || (isVideo ? 'video' : isImage ? 'image' : 'text');
    if (!mediaUrl) resolvedType = 'text';

    // Debug log as requested by user
    console.log(`[PostGridItem] Rendering grid post ${item._id}:`, {
        type: item.type,
        resolvedType,
        mediaUrl: !!mediaUrl,
        contentLength: content.length
    });

    const onPress = () => router.push(`/post/${item._id}`);

    if (resolvedType === 'video') {
        return (
            <TouchableOpacity style={styles.cell} onPress={onPress} onLongPress={onLongPress}>
                <Image
                    source={mediaUrl || 'https://via.placeholder.com/300'}
                    style={styles.media}
                    contentFit="cover"
                    transition={200}
                />
                <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
                </View>
            </TouchableOpacity>
        );
    }

    if (resolvedType === 'image' && mediaUrl) {
        return (
            <TouchableOpacity style={styles.cell} onPress={onPress} onLongPress={onLongPress}>
                <Image
                    source={mediaUrl}
                    style={styles.media}
                    contentFit="cover"
                    transition={200}
                />
                {item.taggedUsers && item.taggedUsers.length > 0 && (
                    <View style={styles.tagBadge}>
                        <Ionicons name="person" size={10} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    }

    // Text post / "Tweet" style
    return (
        <TouchableOpacity style={styles.cell} onPress={onPress} onLongPress={onLongPress}>
            <LinearGradient
                colors={['#28a745', '#1e7e34']}
                style={styles.tweetCard}
            >
                <Text style={styles.tweetText} numberOfLines={6}>
                    {content || "No content"}
                </Text>
                <View style={styles.tweetFooter}>
                    <Ionicons name="chatbubble-outline" size={10} color="rgba(255,255,255,0.7)" />
                    {item.taggedUsers && item.taggedUsers.length > 0 && (
                        <Ionicons name="at-outline" size={10} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
                    )}
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cell: {
        width: CELL,
        height: CELL,
        padding: 2,
    },
    media: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
        backgroundColor: '#f1f3f5',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tagBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        padding: 4,
    },
    tweetCard: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tweetText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    tweetFooter: {
        position: 'absolute',
        bottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
    }
});
