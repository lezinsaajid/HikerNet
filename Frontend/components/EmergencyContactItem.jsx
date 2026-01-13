import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EmergencyContactItem({ contact, onDelete }) {
    return (
        <View style={styles.container}>
            <View style={styles.info}>
                <Text style={styles.name}>{contact.name}</Text>
                <Text style={styles.phone}>{contact.phoneNumber}</Text>
                {contact.email && <Text style={styles.email}>{contact.email}</Text>}
            </View>
            <TouchableOpacity onPress={() => onDelete(contact._id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color="#dc3545" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#343a40',
    },
    phone: {
        fontSize: 14,
        color: '#6c757d',
        marginTop: 2,
    },
    email: {
        fontSize: 12,
        color: '#6c757d',
        marginTop: 2,
    },
    deleteBtn: {
        padding: 5,
    },
});
