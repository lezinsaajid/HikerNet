import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import { decryptPrivateKey, saveKeys } from '../../utils/encryption';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function RestoreKeys() {
    const router = useRouter();
    const { user, updateUserData } = useAuth();
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRestore = async () => {
        if (!password) {
            Alert.alert("Error", "Please enter your recovery password");
            return;
        }

        setIsLoading(true);
        try {
            if (!user.encryptedPrivateKey || !user.keyBackupSalt) {
                Alert.alert("Error", "No backup found on server.");
                return;
            }

            // 1. Decrypt
            const secretKey = await decryptPrivateKey(user.encryptedPrivateKey, user.keyBackupSalt, password);

            // 2. Save to Secure Store
            await saveKeys({
                publicKey: user.publicKey,
                secretKey: secretKey
            });

            Alert.alert("Success", "Keys restored! You can now access your encrypted messages.");
            router.replace('/(tabs)');
        } catch (error) {
            console.error("Restore failed", error);
            Alert.alert("Error", "Incorrect password or corrupted backup.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = () => {
        Alert.alert(
            "Skip Restoration?",
            "If you skip, you will generate NEW keys. You will NOT be able to read old encrypted messages. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Skip & Generate New",
                    style: "destructive",
                    onPress: async () => {
                        // Logic to generate new keys is handled by AuthContext if we just go home?
                        // Or we force it here?
                        // If we go to home, AuthContext might verify keys again?
                        // Let's manually trigger key generation or just route home and let the context handle "No keys found -> Generate".
                        router.replace('/(tabs)');
                    }
                }
            ]
        );
    };

    return (
        <SafeScreen>
            <View style={styles.container}>
                <Ionicons name="key" size={64} color="#007bff" style={{ marginBottom: 20 }} />
                <Text style={styles.title}>Restore Encryption Keys</Text>
                <Text style={styles.description}>
                    We found a backup of your encryption keys.
                    Enter your recovery password to restore them and access your message history.
                </Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Recovery Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter password"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleRestore}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Restore Keys</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                        <Text style={styles.skipText}>Skip (Lose History)</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#333',
    },
    description: {
        textAlign: 'center',
        color: '#666',
        marginBottom: 30,
        lineHeight: 22,
    },
    form: {
        width: '100%',
    },
    label: {
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#007bff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 15,
    },
    buttonDisabled: {
        backgroundColor: '#a0cfff',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    skipButton: {
        padding: 15,
        alignItems: 'center',
    },
    skipText: {
        color: '#dc3545',
        fontSize: 14,
    },
});
