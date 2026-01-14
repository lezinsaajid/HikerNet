import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ScrollView, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Settings() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout", style: "destructive", onPress: async () => {
                    await logout();
                    router.replace('/login');
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.headerNav}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.container}>
                <View style={styles.userSection}>
                    <Image source={{ uri: user?.profileImage || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                    <View>
                        <Text style={styles.username}>{user?.username}</Text>
                        <Text style={styles.email}>{user?.email}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    <TouchableOpacity style={styles.row} onPress={() => router.push('/safety')}>
                        <Ionicons name="shield-checkmark-outline" size={24} color="#dc3545" />
                        <Text style={[styles.rowText, { color: '#dc3545' }]}>Safety Center (SOS)</Text>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row}>
                        <Ionicons name="notifications-outline" size={24} color="black" />
                        <Text style={styles.rowText}>Notifications</Text>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row}>
                        <Ionicons name="lock-closed-outline" size={24} color="black" />
                        <Text style={styles.rowText}>Privacy & Security</Text>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row}>
                        <Ionicons name="help-circle-outline" size={24} color="black" />
                        <Text style={styles.rowText}>Help & Support</Text>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color="#dc3545" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    headerNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    backButton: {
        padding: 5,
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 20,
        backgroundColor: '#eee',
    },
    username: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    email: {
        color: '#666',
        fontSize: 14,
        marginTop: 2,
    },
    section: {
        marginTop: 30,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 15,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f8f8f8',
    },
    rowText: {
        flex: 1,
        marginLeft: 15,
        fontSize: 16,
        color: '#333',
    },
    logoutButton: {
        flexDirection: 'row',
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#fee',
        borderRadius: 15,
        marginBottom: 40,
    },
    logoutText: {
        color: '#dc3545',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});
