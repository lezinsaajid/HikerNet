import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Image, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import UserListModal from '../../components/UserListModal';
import RequestsModal from '../../components/RequestsModal';

export default function RoomLobby() {
    const router = useRouter();
    const { roomId, role } = useLocalSearchParams(); // role: 'leader' | 'member'
    const { user: currentUser } = useAuth();

    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [requestsModalVisible, setRequestsModalVisible] = useState(false);

    // Joiner State
    const [joinCooldown, setJoinCooldown] = useState(0); // seconds
    const joinTimerRef = useRef(null);

    // Polling Ref
    const pollingRef = useRef(null);

    useEffect(() => {
        fetchRoom();

        // Start polling every 3 seconds (Only if NOT dummy)
        if (roomId !== 'dummy-room') {
            pollingRef.current = setInterval(fetchRoom, 3000);
        }

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const fetchRoom = async () => {
        if (roomId === 'dummy-room') {
            // Mock Data Flow
            // Avoid re-initializing if already set (check state setter or ref)
            // Since this runs on mount, the state is null.
            // We use a functional check inside setRoom or just run once since polling is disabled.
            if (!room) {
                const mockRoom = {
                    _id: 'dummy-room',
                    code: 'DUMMY',
                    leader: { _id: 'leader-123', username: 'Guide Dave', profileImage: null },
                    members: [
                        { user: { _id: 'leader-123', username: 'Guide Dave', profileImage: null }, isReady: true }
                    ],
                    requests: [],
                    joinLogs: [],
                    trailName: 'Demo Trail',
                    trailDescription: 'Just a demo'
                };
                setRoom(mockRoom);
                setLoading(false);

                // Simulate Acceptance after 3 seconds
                setTimeout(() => {
                    setRoom(prev => ({
                        ...prev,
                        members: [
                            ...prev.members,
                            { user: currentUser, isReady: false }
                        ]
                    }));
                    Alert.alert("Accepted!", "Guide Dave accepted your request.");
                }, 3000);
            }
            return;
        }

        try {
            const res = await client.get(`/rooms/${roomId}`);
            const data = res.data;
            setRoom(data);
            setLoading(false);

            // If trail has started (trailId exists), navigate everyone there
            if (data.trekId) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                router.replace({
                    pathname: '/trek/active',
                    params: {
                        trailId: data.trekId,
                        role: role
                    }
                });
            }

            // Check if current user is Removed (if they were a member but no longer in list)
            if (role === 'member' && !loading) { // Avoid check on first load
                const isMember = data.members.some(m => m.user._id === currentUser._id);
                // Also check requests to see if we are still requested
                const isRequested = data.requests.some(r => r.user._id === currentUser._id);
                // Only alert if we are NEITHER member NOR requested (and purely removed)
                // But wait, initially we are neither.
                // We need to know if we *were* a member? Or just rely on "Loading" check.
                // If loading is false, and we are not in member list AND not in request list...
                // But initially we might just be joining.
                // Let's rely on simple 404 or backend logic generally.
            }

        } catch (error) {
            console.error("Fetch room error:", error);
            // If 404/closed
            if (error.response?.status === 404) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                Alert.alert("Room Closed", "The room has been closed.");
                router.replace('/trek/group-menu');
            }
        }
    };

    const handleAccept = async (userId) => {
        try {
            await client.post('/rooms/accept', { roomId, userId });
            fetchRoom();
        } catch (error) {
            Alert.alert("Error", "Failed to accept user");
        }
    };

    const handleReject = async (userId) => {
        try {
            await client.post('/rooms/reject', { roomId, userId });
            fetchRoom();
        } catch (error) {
            Alert.alert("Error", "Failed to reject user");
        }
    };

    const handleRemove = async (userId) => {
        try {
            await client.post('/rooms/leave', { roomId, userId });
            fetchRoom();
        } catch (error) {
            Alert.alert("Error", "Failed to remove user");
        }
    };

    const handleToggleReady = async () => {
        // Handle Dummy Mode
        if (roomId === 'dummy-room') {
            setRoom(prev => {
                const updatedMembers = prev.members.map(m => {
                    if (m.user._id === currentUser._id) {
                        return { ...m, isReady: !m.isReady };
                    }
                    return m;
                });
                return { ...prev, members: updatedMembers };
            });
            return;
        }

        try {
            const me = room.members.find(m => m.user._id === currentUser._id);
            if (!me) return;

            await client.post('/rooms/ready', {
                roomId,
                isReady: !me.isReady
            });
            fetchRoom();
        } catch (error) {
            Alert.alert("Error", "Failed to update status");
        }
    };

    const handleStartTrail = async () => {
        try {
            const allReady = room.members.every(m => m.isReady);
            if (!allReady) {
                Alert.alert("Wait!", "Not all members are ready.");
                return;
            }

            await client.post('/rooms/start', { roomId });
            // Navigation handled by polling check
        } catch (error) {
            console.error(error);
            Alert.alert("Error", error.response?.data?.message || "Failed to start trail");
        }
    };

    const handleResendJoin = async () => {
        try {
            await client.post('/rooms/join', { code: room.code });
            Alert.alert("Sent", "Request resent!");
            setJoinCooldown(60);
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Failed to resend");
        }
    };

    // Cooldown Timer Effect
    useEffect(() => {
        if (joinCooldown > 0) {
            joinTimerRef.current = setTimeout(() => setJoinCooldown(c => c - 1), 1000);
        }
        return () => clearTimeout(joinTimerRef.current);
    }, [joinCooldown]);

    const handleShareCode = async () => {
        try {
            await Share.share({
                message: `Join my Trail on HikerNet! Room Code: ${room.code}`,
            });
        } catch (error) {
            console.log(error);
        }
    };

    const handleInviteUser = async (userToInvite) => {
        try {
            await client.post('/rooms/invite', {
                roomId: room._id,
                targetUserId: userToInvite._id
            });
            // Success: No alert needed, return true to start timer
            return true;
        } catch (error) {
            if (error.response?.status === 429) {
                Alert.alert("Cooldown", "Please wait 30s before inviting this user again.");
            } else {
                Alert.alert("Error", error.response?.data?.message || "Failed to invite user");
            }
            return false;
        }
    };

    if (loading || !room) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#28a745" />
                <Text style={{ marginTop: 10 }}>Connecting to room...</Text>
            </View>
        );
    }

    const isLeader = role === 'leader';
    const me = room.members.find(m => m.user._id === currentUser._id);
    const isMember = !!me;

    // Waiting View (Exclusive)
    if (!isLeader && !isMember) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Request Sent</Text>
                </View>

                <View style={styles.center}>
                    <View style={styles.waitingCard}>
                        <Ionicons name="hourglass-outline" size={60} color="#007bff" />
                        <Text style={styles.waitingTitle}>Waiting for Approval</Text>
                        <Text style={styles.waitingDesc}>We&apos;ve sent your request to {room.leader.username}. You&apos;ll join the room once they accept.</Text>
                        <ActivityIndicator size="large" color="#007bff" style={{ marginVertical: 20 }} />

                        {joinCooldown > 0 ? (
                            <Text style={styles.cooldownText}>Resend available in {joinCooldown}s</Text>
                        ) : (
                            <TouchableOpacity onPress={handleResendJoin} style={styles.resendBtn}>
                                <Text style={styles.resendText}>Resend Request</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lobby</Text>
            </View>

            <View style={styles.codeCard}>
                {isLeader && (
                    <TouchableOpacity
                        style={styles.bellButton}
                        onPress={() => setRequestsModalVisible(true)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <View>
                            <Ionicons name="notifications" size={28} color="#007bff" />
                            {room.requests.length > 0 && (
                                <View style={styles.bellBadge}>
                                    <Text style={styles.bellBadgeText}>{room.requests.length}</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
                <Text style={styles.codeLabel}>ROOM CODE</Text>
                <TouchableOpacity onPress={handleShareCode} style={styles.codeContainer}>
                    <Text style={styles.codeText}>{room.code}</Text>
                    <Ionicons name="copy-outline" size={20} color="#007bff" style={{ marginLeft: 10 }} />
                </TouchableOpacity>
                <Text style={styles.codeSub}>Share this code with your friends</Text>
            </View>

            <View style={styles.listContainer}>
                <Text style={styles.sectionTitle}>Members ({room.members.length})</Text>
                <FlatList
                    data={room.members}
                    keyExtractor={item => item.user._id}
                    renderItem={({ item }) => (
                        <View style={styles.memberItem}>
                            <View style={styles.userInfo}>
                                <Image source={{ uri: item.user.profileImage || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                                <View>
                                    <Text style={styles.username}>
                                        {item.user.username} {item.user._id === room.leader._id && <Text style={{ color: '#fcc419' }}> (Leader)</Text>}
                                    </Text>
                                    <Text style={[styles.statusText, item.isReady ? styles.statusReady : styles.statusNot]}>
                                        {item.isReady ? "READY" : "WAITING"}
                                    </Text>
                                </View>
                            </View>
                            {isLeader && item.user._id !== room.leader._id && (
                                <TouchableOpacity onPress={() => handleRemove(item.user._id)}>
                                    <Ionicons name="trash-outline" size={20} color="#dc3545" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                />
            </View>

            <View style={styles.footer}>
                {isLeader && (
                    <TouchableOpacity style={styles.inviteButton} onPress={() => setInviteModalVisible(true)}>
                        <Ionicons name="person-add" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.inviteButtonText}>Invite Friends</Text>
                    </TouchableOpacity>
                )}
                {!isLeader && isMember && (
                    <TouchableOpacity
                        style={[styles.mainButton, me.isReady ? styles.readyBtn : styles.notReadyBtn]}
                        onPress={handleToggleReady}
                    >
                        <Text style={styles.mainButtonText}>
                            {me.isReady ? "READY" : "NOT READY"}
                        </Text>
                    </TouchableOpacity>
                )}

                {isLeader && (
                    <TouchableOpacity
                        style={[
                            styles.mainButton,
                            (room.members.every(m => m.isReady) && room.members.length > 1) ? styles.startBtn : styles.disabledBtn
                        ]}
                        onPress={handleStartTrail}
                        disabled={!room.members.every(m => m.isReady) || room.members.length < 1}
                    >
                        <Text style={styles.mainButtonText}>
                            {room.members.length < 2
                                ? "WAITING FOR FRIEND..."
                                : (!room.members.every(m => m.isReady) ? "WAITING FOR READY..." : "START TRAIL")
                            }
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Invite Modal */}
            <UserListModal
                visible={inviteModalVisible}
                onClose={() => setInviteModalVisible(false)}
                userId={currentUser?._id}
                type="following" // Show friends list
                mode="invite"
                onInvite={handleInviteUser}
            />

            <RequestsModal
                visible={requestsModalVisible}
                onClose={() => setRequestsModalVisible(false)}
                room={room}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 15,
    },
    codeCard: {
        backgroundColor: 'white',
        margin: 20,
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 2,
    },
    codeLabel: {
        fontSize: 12,
        color: '#666',
        letterSpacing: 2,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
        backgroundColor: '#f1f3f5',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    codeText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        letterSpacing: 4,
    },
    codeSub: {
        fontSize: 12,
        color: '#999',
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 15,
        marginBottom: 10,
    },
    requestItem: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    memberItem: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eee',
        marginRight: 10,
    },
    username: {
        fontWeight: 'bold',
        color: '#333',
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 2,
    },
    statusReady: {
        color: '#28a745',
    },
    statusNot: {
        color: '#dc3545',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    acceptBtn: {
        backgroundColor: '#28a745',
        padding: 5,
        borderRadius: 20,
    },
    rejectBtn: {
        backgroundColor: '#dc3545',
        padding: 5,
        borderRadius: 20,
    },
    footer: {
        padding: 20,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    mainButton: {
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    startBtn: {
        backgroundColor: '#28a745',
    },
    readyBtn: {
        backgroundColor: '#28a745', // Green
        borderWidth: 2,
        borderColor: '#1e7e34',
    },
    notReadyBtn: {
        backgroundColor: '#dc3545', // Red
        borderWidth: 2,
        borderColor: '#bd2130',
    },
    disabledBtn: {
        backgroundColor: '#ccc',
    },
    mainButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    waitingText: {
        textAlign: 'center',
        color: '#666',
        fontStyle: 'italic',
    },
    inviteButton: {
        flexDirection: 'row',
        backgroundColor: '#6c757d', // Different color for generic invite
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    requestsButton: {
        flexDirection: 'row',
        backgroundColor: '#007bff',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'space-between', // For badge
        marginBottom: 10,
        paddingHorizontal: 20,
    },
    badge: {
        backgroundColor: '#dc3545',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    resendBtn: {
        marginTop: 10,
        padding: 10,
    },
    resendText: {
        color: '#007bff',
        fontWeight: 'bold',
    },
    cooldownText: {
        color: '#999',
    },
    waitingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    bellButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
    },
    bellBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#dc3545',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
    },
    bellBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    }
});
