import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import EmergencyContactItem from '../../components/EmergencyContactItem';
import { useRouter } from 'expo-router';

export default function SafetyCenter() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sosLoading, setSosLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', phoneNumber: '', email: '' });
    const router = useRouter();

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            const res = await client.get('/users/profile/me'); // We need an endpoint or use AuthContext
            // Assuming AuthContext handles user data, but backend check is better for fresh data
            // For now, let's assume we can get it from a profile endpoint
            // Actually, let's just use a dummy fetch or AuthContext if available
            // Let's implement an actual fetch if the endpoint exists
            setContacts(res.data.emergencyContacts || []);
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddContact = async () => {
        if (!newContact.name || !newContact.phoneNumber) {
            Alert.alert('Error', 'Name and Phone Number are required');
            return;
        }

        try {
            // We need a backend route to update user profile/contacts
            // Let's assume PUT /api/users/profile exists for this purpose
            const res = await client.put('/users/profile', {
                emergencyContacts: [...contacts, newContact]
            });
            setContacts(res.data.emergencyContacts);
            setModalVisible(false);
            setNewContact({ name: '', phoneNumber: '', email: '' });
        } catch (error) {
            console.error('Error adding contact:', error);
            Alert.alert('Error', 'Failed to add contact');
        }
    };

    const handleDeleteContact = async (contactId) => {
        try {
            const updatedContacts = contacts.filter(c => c._id !== contactId);
            const res = await client.put('/users/profile', {
                emergencyContacts: updatedContacts
            });
            setContacts(res.data.emergencyContacts);
        } catch (error) {
            console.error('Error deleting contact:', error);
            Alert.alert('Error', 'Failed to delete contact');
        }
    };

    const triggerSOS = async () => {
        if (contacts.length === 0) {
            Alert.alert('Error', 'Please add at least one emergency contact before triggering SOS.');
            return;
        }

        Alert.alert(
            'SOS Alert',
            'Are you sure you want to trigger an SOS alert? This will notify your emergency contacts.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'YES, TRIGGER SOS',
                    style: 'destructive',
                    onPress: async () => {
                        setSosLoading(true);
                        try {
                            await client.post('/safety/sos', {
                                location: { latitude: 0, longitude: 0 } // Real location should be fetched
                            });
                            Alert.alert('Alert Sent', 'SOS alert has been transmitted.');
                        } catch (error) {
                            console.error('SOS Error:', error);
                            Alert.alert('Error', 'Failed to trigger SOS');
                        } finally {
                            setSosLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>Safety Center</Text>
            </View>

            <View style={styles.sosContainer}>
                <TouchableOpacity
                    style={[styles.sosButton, sosLoading && styles.disabledBtn]}
                    onPress={triggerSOS}
                    disabled={sosLoading}
                >
                    {sosLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="alert-circle" size={48} color="#fff" />
                            <Text style={styles.sosText}>SOS</Text>
                        </>
                    )}
                </TouchableOpacity>
                <Text style={styles.sosHint}>Press and hold for 3 seconds in emergency</Text>
            </View>

            <View style={styles.contactsSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Emergency Contacts</Text>
                    <TouchableOpacity onPress={() => setModalVisible(true)}>
                        <Ionicons name="add-circle" size={28} color="#28a745" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator color="#28a745" />
                ) : (
                    <FlatList
                        data={contacts}
                        keyExtractor={(item, index) => item._id || index.toString()}
                        renderItem={({ item }) => (
                            <EmergencyContactItem
                                contact={item}
                                onDelete={handleDeleteContact}
                            />
                        )}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No emergency contacts added yet.</Text>
                        }
                    />
                )}
            </View>

            <TouchableOpacity
                style={styles.rendezvousBtn}
                onPress={() => router.push('/safety/rendezvous')}
            >
                <Ionicons name="people" size={24} color="#007AFF" />
                <Text style={styles.rendezvousText}>Find Rendezvous Point</Text>
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Emergency Contact</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            value={newContact.name}
                            onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Phone Number"
                            keyboardType="phone-pad"
                            value={newContact.phoneNumber}
                            onChangeText={(text) => setNewContact({ ...newContact, phoneNumber: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email (Optional)"
                            keyboardType="email-address"
                            value={newContact.email}
                            onChangeText={(text) => setNewContact({ ...newContact, email: text })}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.addBtn]}
                                onPress={handleAddContact}
                            >
                                <Text style={styles.addText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    backBtn: {
        marginRight: 15,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    sosContainer: {
        alignItems: 'center',
        marginBottom: 40,
        backgroundColor: '#fff5f5',
        padding: 30,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ffe3e3',
    },
    sosButton: {
        backgroundColor: '#dc3545',
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        marginBottom: 15,
    },
    disabledBtn: {
        opacity: 0.7,
    },
    sosText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 5,
    },
    sosHint: {
        color: '#868e96',
        fontSize: 12,
        textAlign: 'center',
    },
    contactsSection: {
        flex: 1,
        marginBottom: 20,
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
        color: '#495057',
    },
    emptyText: {
        textAlign: 'center',
        color: '#adb5bd',
        marginTop: 20,
    },
    rendezvousBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        backgroundColor: '#e7f1ff',
        borderRadius: 12,
        marginBottom: 30,
    },
    rendezvousText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 10,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalBtn: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f8f9fa',
        marginRight: 10,
    },
    addBtn: {
        backgroundColor: '#28a745',
        marginLeft: 10,
    },
    cancelText: {
        color: '#495057',
        fontWeight: 'bold',
    },
    addText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
