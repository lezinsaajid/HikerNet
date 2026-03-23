import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');

const ImagePost = ({ mediaUrl, content }) => {
    return (
        <View style={styles.container}>
            {mediaUrl && (
                <Image 
                    source={mediaUrl} 
                    style={styles.image} 
                    contentFit="cover"
                    transition={300}
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
    image: {
        width: width,
        height: width * 1.25, // 4:5 aspect ratio
        backgroundColor: '#f1f3f5',
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

export default ImagePost;
