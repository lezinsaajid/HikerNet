import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfile() {
    const { user, updateUserData } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [username, setUsername] = useState(user?.username || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [profileImage, setProfileImage] = useState(user?.profileImage || '');
    const [emergencyContacts, setEmergencyContacts] = useState(user?.emergencyContacts || []);
    const [medicalInfo, setMedicalInfo] = useState(user?.medicalInfo || '');
    const [location, setLocation] = useState(user?.location || '');
    const [uploading, setUploading] = useState(false);

    const handleSave = async () => {
        try {
            setLoading(true);
            const res = await client.put('/users/profile', {
                username,
                bio,
                emergencyContacts,
                medicalInfo,
                location,
            });
            updateUserData(res.data.user);
            Alert.alert("Success", "Profile updated successfully!");
            router.back();
        } catch (error) {
            console.error("Error updating profile:", error);
            Alert.alert("Error", "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled) {
            handleImageUpload(result.assets[0].base64);
        }
    };

    const handleImageUpload = async (base64) => {
        try {
            setUploading(true);
            const res = await client.put('/users/profile', {
                profileImage: `data:image/jpeg;base64,${base64}`
            });
            updateUserData(res.data.user);
            setProfileImage(res.data.user.profileImage);
        } catch (error) {
            console.error("Image upload error:", error);
            Alert.alert("Error", "Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    const addEmergencyContact = () => {
        setEmergencyContacts([...emergencyContacts, { name: '', phoneNumber: '' }]);
    };

    const updateContact = (index, field, value) => {
        const updated = [...emergencyContacts];
        updated[index][field] = value;
        setEmergencyContacts(updated);
    };

    const removeContact = (index) => {
        setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator size="small" color="#0095f6" /> : <Text style={styles.doneText}>Done</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
                        <Image source={{ uri: profileImage || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                        {uploading && <View style={styles.avatarLoading}><ActivityIndicator color="#FFF" /></View>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickImage}>
                        <Text style={styles.changePhotoText}>Change Profile Photo</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Username"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Location</Text>
                    <TextInput
                        style={styles.input}
                        value={location}
                        onChangeText={setLocation}
                        placeholder="e.g. Denver, CO"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                        style={[styles.input, styles.bioInput]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="About you..."
                        multiline
                    />
                </View>

                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                    <Text style={styles.label}>Medical Information (Allergies, Blood Group, etc.)</Text>
                    <TextInput
                        style={[styles.input, styles.bioInput]}
                        value={medicalInfo}
                        onChangeText={setMedicalInfo}
                        placeholder="e.g. Blood Group O+, No allergies..."
                        multiline
                    />
                </View>

                <View style={styles.divider} />

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Emergency Contacts</Text>
                    <TouchableOpacity onPress={addEmergencyContact} style={styles.addButton}>
                        <Ionicons name="add-circle" size={24} color="#4A7C44" />
                        <Text style={styles.addButtonText}>Add Contact</Text>
                    </TouchableOpacity>
                </View>

                {emergencyContacts.map((contact, index) => (
                    <View key={index} style={styles.contactItem}>
                        <View style={styles.contactInputs}>
                            <TextInput
                                style={styles.contactInput}
                                value={contact.name}
                                onChangeText={(val) => updateContact(index, 'name', val)}
                                placeholder="Contact Name"
                            />
                            <TextInput
                                style={styles.contactInput}
                                value={contact.phoneNumber}
                                onChangeText={(val) => updateContact(index, 'phoneNumber', val)}
                                placeholder="Phone Number"
                                keyboardType="phone-pad"
                            />
                        </View>
                        <TouchableOpacity onPress={() => removeContact(index)} style={styles.removeButton}>
                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                    </View>
                ))}

                <View style={styles.safetyInfo}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#666" />
                    <Text style={styles.safetyText}>
                        Your emergency contacts will be notified automatically if an emergency alert is triggered during a trek.
                    </Text>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#DBDBDB',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelText: {
        fontSize: 16,
        color: '#262626',
    },
    doneText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0095f6',
    },
    content: {
        flex: 1,
        padding: 15,
    },
    avatarSection: {
        alignItems: 'center',
        marginVertical: 20,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 10,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0F0F0',
    },
    avatarLoading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    changePhotoText: {
        color: '#0095f6',
        fontSize: 14,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 12,
        color: '#8e8e8e',
        marginBottom: 5,
    },
    input: {
        fontSize: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: '#DBDBDB',
        paddingVertical: 8,
    },
    bioInput: {
        minHeight: 60,
        textAlignVertical: 'top',
    },
    divider: {
        height: 0.5,
        backgroundColor: '#DBDBDB',
        marginVertical: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#262626',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addButtonText: {
        color: '#4A7C44',
        fontWeight: '600',
        marginLeft: 5,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    contactInputs: {
        flex: 1,
    },
    contactInput: {
        fontSize: 15,
        paddingVertical: 5,
    },
    removeButton: {
        padding: 10,
    },
    safetyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F7F0',
        padding: 15,
        borderRadius: 12,
        marginTop: 20,
    },
    safetyText: {
        fontSize: 13,
        color: '#4A7C44',
        flex: 1,
        marginLeft: 10,
        lineHeight: 18,
    },
});
