import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

const { width } = Dimensions.get('window');

const VideoPost = ({ mediaUrl, content }) => {
    return (
        <View style={styles.container}>
            {mediaUrl && (
                <Video
                    source={{ uri: mediaUrl }}
                    style={styles.video}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    isLooping={false}
                />
            )}
            {content ? (
                <View style={styles.captionContainer}>
                    <Text style={styles.caption}>{content}</Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
    },
    video: {
        width: width,
        height: width * (9 / 16), // 16:9 aspect ratio
        backgroundColor: '#000',
    },
    captionContainer: {
        padding: 15,
    },
    caption: {
        fontSize: 15,
        lineHeight: 22,
        color: '#333',
    },
});

export default VideoPost;
