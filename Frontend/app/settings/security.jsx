import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from '../../components/SafeScreen';
import { getKeys, encryptPrivateKey } from '../../utils/encryption';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function SecuritySettings() {
    const router = useRouter();
    const { user, updateUserData } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasBackup, setHasBackup] = useState(false);

    useEffect(() => {
        // Check if user already has backup
        // We can check user object if we populated it accurately, or fetch profile.
        // Assuming user object has it if updated.
        if (user?.encryptedPrivateKey) {
            setHasBackup(true);
        } else {
            // Optional: Fetch fresh profile to be sure
            checkBackupStatus();
        }
    }, [user]);

    const checkBackupStatus = async () => {
        try {
            const res = await client.get(`/users/profile/${user._id}`);
            if (res.data.encryptedPrivateKey) {
                setHasBackup(true);
                // Update local user context if needed, but handled by AuthContext usually
                updateUserData({ encryptedPrivateKey: res.data.encryptedPrivateKey });
            }
        } catch (e) {
            console.log("Failed to check backup status");
        }
    };

    const handleBackup = async () => {
        if (!password) {
            Alert.alert("Error", "Please enter a recovery password");
            return;
        }
        if (password.length < 6) {
            Alert.alert("Error", "Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Get Private Key
            const keys = await getKeys();
            if (!keys.secretKey) {
                Alert.alert("Error", "No encryption keys found on this device to backup. Try logging out and in.");
                setIsLoading(false);
                return;
            }

            // 2. Encrypt It
            const { encryptedPrivateKey, salt } = await encryptPrivateKey(keys.secretKey, password);

            // 3. Upload
            await client.put('/users/keys/backup', {
                encryptedPrivateKey,
                keyBackupSalt: salt
            });

            // 4. Success
            await updateUserData({ encryptedPrivateKey, keyBackupSalt: salt });
            setHasBackup(true);
            Alert.alert("Success", "Your specialized keys have been securely backed up.");
            setPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error("Backup failed", error);
            Alert.alert("Error", "Backup failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeScreen>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Security</Text>
            </View>

            <View style={styles.container}>
                <View style={styles.section}>
                    <Ionicons name="lock-closed" size={48} color="#28a745" style={{ alignSelf: 'center', marginBottom: 20 }} />
                    <Text style={styles.title}>Encrypted Backup</Text>
                    <Text style={styles.description}>
                        Back up your encryption keys so you can access your messages on other devices.
                        Your keys will be encrypted with a password that ONLY YOU know.
                        We cannot recover this password in any way.
                    </Text>

                    {hasBackup && (
                        <View style={styles.successBadge}>
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            <Text style={styles.successText}>Backup Active</Text>
                        </View>
                    )}
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Set Recovery Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter password"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm password"
                        secureTextEntry
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                    />

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleBackup}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>{hasBackup ? "Update Backup" : "Create Backup"}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    description: {
        textAlign: 'center',
        color: '#666',
        lineHeight: 20,
        marginBottom: 20,
    },
    successBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#28a745',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    successText: {
        color: '#fff',
        marginLeft: 5,
        fontWeight: 'bold',
    },
    form: {
        backgroundColor: '#f9f9f9',
        padding: 20,
        borderRadius: 12,
    },
    label: {
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#007bff',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#a0cfff',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
