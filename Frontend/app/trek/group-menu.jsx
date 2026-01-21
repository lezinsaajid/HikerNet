import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

export default function GroupMenu() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    // Setup Room State
    const [isSetupVisible, setIsSetupVisible] = useState(false);
    const [roomName, setRoomName] = useState(params.name || '');
    const [roomDesc, setRoomDesc] = useState(params.description || '');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateRoomPress = () => {
        // If name already provided from previous screen, we could use it, 
        // but user asked to "ask for details in next screen". 
        // So let's open modal to confirm/edit details.
        setIsSetupVisible(true);
    };

    const confirmCreateRoom = async () => {
        if (!roomName.trim()) {
            Alert.alert("Missing Details", "Please provide a name for the group trail.");
            return;
        }

        try {
            setIsCreating(true);
            const res = await client.post('/rooms/create', {
                trekName: roomName,
                trekDescription: roomDesc,
                startLocation: params.location // Use detected location passed from prev screen
            });

            setIsSetupVisible(false);
            router.push({
                pathname: '/trek/room-lobby',
                params: { roomId: res.data._id, role: 'leader' }
            });
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to create room");
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!joinCode.trim()) {
            Alert.alert("Required", "Please enter a room code");
            return;
        }

        if (joinCode.toUpperCase() === 'DUMMY') {
            router.push({
                pathname: '/trek/room-lobby',
                params: { roomId: 'dummy-room', role: 'member' }
            });
            return;
        }

        if (joinCode.length !== 7) {
            Alert.alert("Invalid Code", "Room code must be exactly 7 characters.");
            return;
        }

        try {
            setIsJoining(true);
            const res = await client.post('/rooms/join', { code: joinCode });
            // res.data should contain roomId
            router.push({
                pathname: '/trek/room-lobby',
                params: { roomId: res.data.roomId, role: 'member' }
            });
        } catch (error) {
            console.error(error);
            Alert.alert("Error", error.response?.data?.message || "Failed to join room");
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Group Trail</Text>
            </View>

            <View style={styles.content}>
                {/* Create Room Section */}
                <View style={styles.section}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="add-circle" size={50} color="#28a745" />
                    </View>
                    <Text style={styles.sectionTitle}>Start a New Group</Text>
                    <Text style={styles.sectionDesc}>Create a room and invite your friends via code.</Text>
                    <TouchableOpacity style={styles.createButton} onPress={handleCreateRoomPress}>
                        <Text style={styles.createButtonText}>Create a Room</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.line} />
                </View>

                {/* Join Room Section */}
                <View style={styles.section}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="enter" size={50} color="#007bff" />
                    </View>
                    <Text style={styles.sectionTitle}>Join Existing Group</Text>
                    <Text style={styles.sectionDesc}>Enter the code shared by your trail leader.</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Enter 7-character code"
                        value={joinCode}
                        onChangeText={setJoinCode}
                        autoCapitalize="none"
                        maxLength={7}
                    />

                    <TouchableOpacity
                        style={[styles.joinButton, isJoining && styles.disabledBtn]}
                        onPress={handleJoinRoom}
                        disabled={isJoining}
                    >
                        <Text style={styles.joinButtonText}>{isJoining ? "Joining..." : "Join Room"}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Room Setup Modal */}
            <Modal
                visible={isSetupVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsSetupVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Set Up Group</Text>

                        <Text style={styles.label}>Trail Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Weekend Hike"
                            value={roomName}
                            onChangeText={setRoomName}
                        />

                        {params.location && (
                            <View style={styles.locationInfo}>
                                <Ionicons name="location" size={16} color="#28a745" />
                                <Text style={styles.locationInfoText}>{params.location}</Text>
                            </View>
                        )}

                        <Text style={styles.label}>Description (Optional)</Text>
                        <TextInput
                            style={[styles.modalInput, styles.modalTextArea]}
                            placeholder="Brief plan..."
                            value={roomDesc}
                            onChangeText={setRoomDesc}
                            multiline
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsSetupVisible(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={confirmCreateRoom}
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Create Group</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    section: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    iconContainer: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#333',
    },
    sectionDesc: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
    },
    createButton: {
        backgroundColor: '#28a745',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
    },
    createButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#ccc',
    },
    orText: {
        marginHorizontal: 10,
        color: '#999',
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#f1f3f5',
        width: '100%',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ced4da',
        marginBottom: 10,
        fontSize: 16,
        textAlign: 'center',
        letterSpacing: 2,
    },
    joinButton: {
        backgroundColor: '#007bff',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
    },
    joinButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    disabledBtn: {
        backgroundColor: '#a0a0a0',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 5,
        color: '#333',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    modalTextArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    confirmButton: {
        backgroundColor: '#28a745',
    },
    cancelButtonText: {
        color: '#333',
        fontWeight: '600',
    },
    confirmButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: '#e8f5e9',
        padding: 10,
        borderRadius: 8,
    },
    locationInfoText: {
        color: '#28a745',
        marginLeft: 5,
        fontSize: 14,
        flex: 1,
    },
});
