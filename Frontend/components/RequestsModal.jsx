import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RequestsModal({ visible, onClose, room, onAccept, onReject }) {

    // Sort logs: Pending first, then by timestamp descending
    const sortedLogs = useMemo(() => {
        if (!room || !room.joinLogs) return [];
        return [...room.joinLogs].sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    }, [room]);

    const renderItem = ({ item }) => {
        if (!item.user) return null; // Safety check

        let statusColor = '#007bff'; // Blue for pending
        let statusText = 'Pending';

        if (item.status === 'accepted') {
            statusColor = '#28a745'; // Green
            statusText = 'Accepted';
        } else if (item.status === 'rejected') {
            statusColor = '#dc3545'; // Red
            statusText = 'Rejected';
        }

        return (
            <View style={[styles.logItem, { borderLeftColor: statusColor }]}>
                <View style={styles.userInfo}>
                    <Image
                        source={{ uri: item.user.profileImage || 'https://via.placeholder.com/150' }}
                        style={styles.avatar}
                    />
                    <View>
                        <Text style={styles.username}>{item.user.username}</Text>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {statusText} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>

                {item.status === 'pending' && (
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={() => onAccept(item.user._id)} style={styles.acceptBtn}>
                            <Ionicons name="checkmark" size={20} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onReject(item.user._id)} style={styles.rejectBtn}>
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <Text style={styles.title}>Requests Section</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={sortedLogs}
                    keyExtractor={(item, index) => item._id || index.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No request history found.</Text>
                    }
                />
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 5,
    },
    listContent: {
        padding: 20,
    },
    logItem: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeftWidth: 4,
        elevation: 1,
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
        fontSize: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
    },
    acceptBtn: {
        backgroundColor: '#28a745',
        padding: 8,
        borderRadius: 20,
        marginHorizontal: 5,
    },
    rejectBtn: {
        backgroundColor: '#dc3545',
        padding: 8,
        borderRadius: 20,
        marginHorizontal: 5,
    },

    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 50,
        fontStyle: 'italic',
    }
});
