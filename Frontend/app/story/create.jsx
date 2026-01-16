import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

export default function CreateStory() {
    const [image, setImage] = useState(null);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);
    const router = useRouter();

    const pickImage = async () => {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert("Permission Required", "You need to allow access to your photos to create a story.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, // Video support could be added
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    const handlePost = async () => {
        if (!image) return;

        setUploading(true);
        try {
            // Upload to Cloudinary (Frontend Direct or Backend Proxy?)
            // For this quick impl, we'll assume we send to backend, but usually we need Multipart form data.
            // Simplified: We will mock upload or send base64 if small, but let's try multipart.

            const payload = {
                media: `data:image/jpeg;base64,${image.base64}`,
                type: 'image'
            };

            await client.post('/stories/create', payload);

            Alert.alert("Success", "Story posted!");
            router.back();

        } catch (error) {
            console.error("Error posting story", error);
            Alert.alert("Error", "Could not post story");
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        pickImage(); // Auto open picker on load
    }, []);

    return (
        <View style={styles.container}>
            {image ? (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: image.uri }} style={styles.preview} />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setImage(null)}>
                        <Ionicons name="close-circle" size={32} color="white" />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.emptyContainer}>
                    <Text style={styles.text}>Pick an image to share</Text>
                    <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
                        <Text style={styles.btnText}>Open Gallery</Text>
                    </TouchableOpacity>
                </View>
            )}

            {image && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={uploading}>
                        {uploading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Share to Story</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    previewContainer: {
        flex: 1,
    },
    preview: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    closeBtn: {
        position: 'absolute',
        top: 40,
        left: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: 'white',
        marginBottom: 20,
    },
    pickBtn: {
        backgroundColor: '#333',
        padding: 15,
        borderRadius: 8,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        width: '100%',
        alignItems: 'center',
    },
    postBtn: {
        backgroundColor: '#28a745',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 30,
    },
    btnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
