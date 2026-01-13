import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
    const { user, logout } = useAuth();

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: logout }
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Image source={{ uri: user?.profileImage }} style={styles.avatar} />
                <Text style={styles.username}>{user?.username}</Text>
                <Text style={styles.email}>{user?.email}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settings</Text>

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
                    <Ionicons name="shield-checkmark-outline" size={24} color="black" />
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
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
        backgroundColor: '#eee',
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    email: {
        color: '#666',
        marginTop: 5,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    rowText: {
        flex: 1,
        marginLeft: 15,
        fontSize: 16,
    },
    logoutButton: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#fee',
        borderRadius: 10,
        alignItems: 'center',
    },
    logoutText: {
        color: '#dc3545',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
