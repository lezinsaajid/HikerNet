import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TextPost = ({ content }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>{content}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 15,
        paddingHorizontal: 15,
        backgroundColor: '#fff',
    },
    text: {
        fontSize: 18,
        lineHeight: 26,
        color: '#1a1a1b',
        fontWeight: '500',
        letterSpacing: -0.2,
    },
});

export default TextPost;
