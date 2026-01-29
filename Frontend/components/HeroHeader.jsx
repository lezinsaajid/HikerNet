
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function HeroHeader() {
    return (
        <View style={styles.container}>
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80' }}
                style={styles.image}
                resizeMode="cover"
            >
                <LinearGradient
                    colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
                    style={styles.gradient}
                >
                    <View style={styles.content}>
                        <Text style={styles.brand}>HIKERNET</Text>
                        <Text style={styles.subBrand}>WITH</Text>
                        <Text style={styles.title}>FELLOW TREKKERS</Text>
                        <Text style={styles.description}>
                            Join fellow trekkers in sharing experiences, photos, and planning your next adventure together.
                        </Text>
                    </View>
                </LinearGradient>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 350,
        marginBottom: 20,
    },
    image: {
        width: width,
        height: '100%',
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    content: {
        alignItems: 'center',
        marginTop: 40,
    },
    brand: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 5,
        opacity: 0.9,
    },
    subBrand: {
        color: 'white',
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 5,
        opacity: 0.8,
    },
    title: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 5,
    },
    description: {
        color: 'white',
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.9,
        maxWidth: '80%',
    },
});
