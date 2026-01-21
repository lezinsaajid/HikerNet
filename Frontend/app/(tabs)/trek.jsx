import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TrekDashboard() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Explore Treks</Text>
            </View>

            <View style={styles.content}>
                <TouchableOpacity style={styles.card} onPress={() => router.push('/trek/create')}>
                    <View style={[styles.cardImage, { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="add" size={50} color="#28a745" />
                    </View>
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardTitle}>Create New Trail</Text>
                            <Text style={styles.cardDistance}>Start tracking a new trek</Text>
                        </View>
                        <View style={[styles.ratingContainer, { backgroundColor: '#e8f5e9' }]}>
                            <Ionicons name="walk" size={16} color="#28a745" />
                        </View>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.card, { marginTop: 15 }]} onPress={() => router.push('/trek/nearby')}>
                    <View style={[styles.cardImage, { backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="map" size={50} color="#007bff" />
                    </View>
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardTitle}>Nearby Locations</Text>
                            <Text style={styles.cardDistance}>Find treks near you</Text>
                        </View>
                        <View style={[styles.ratingContainer, { backgroundColor: '#e3f2fd' }]}>
                            <Ionicons name="location" size={16} color="#007bff" />
                        </View>
                    </View>
                </TouchableOpacity>
            </View>

        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 15,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardImage: {
        width: '100%',
        height: 150,
    },
    cardContent: {
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    cardDistance: {
        fontSize: 14,
        color: '#666',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fcc419',
        marginLeft: 4,
    },
});
