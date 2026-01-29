
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from '../../components/SafeScreen';
import client from '../../api/client';

export default function CreateStory() {
    const [hasPermission, setHasPermission] = useState(null);
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    const uploadStory = async () => {
        if (!image) return;
        setLoading(true);
        try {
            await client.post('/stories/create', {
                media: `data:image/jpeg;base64,${image.base64}`,
                type: 'image'
            });
            Alert.alert("Success", "Story added!");
            router.back();
        } catch (error) {
            console.error("Error uploading story:", error);
            Alert.alert("Error", "Failed to upload story");
        } finally {
            setLoading(false);
        }
    };

    if (hasPermission === null) {
        return <View />;
    }
    if (hasPermission === false) {
        return <Text>No access to camera/gallery</Text>;
    }

    return (
        <SafeScreen style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={30} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>Add to Story</Text>
                <View style={{ width: 30 }} />
            </View>

            <View style={styles.content}>
                {image ? (
                    <Image source={{ uri: image.uri }} style={styles.preview} />
                ) : (
                    <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
                        <Ionicons name="image" size={60} color="#fff" />
                        <Text style={styles.pickText}>Select from Gallery</Text>
                    </TouchableOpacity>
                )}
            </View>

            {image && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.uploadButton} onPress={uploadStory} disabled={loading}>
                        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.uploadText}>Share to Story</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        alignItems: 'center',
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    preview: {
        width: '100%',
        height: '80%',
        borderRadius: 20,
    },
    pickButton: {
        alignItems: 'center',
    },
    pickText: {
        color: 'white',
        marginTop: 10,
        fontSize: 16,
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    uploadButton: {
        backgroundColor: 'white',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
    },
    uploadText: {
        fontWeight: 'bold',
        fontSize: 16,
    }
});
