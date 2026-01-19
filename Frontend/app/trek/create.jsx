import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function CreateTrekScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Initialize with searchQuery if available
    const [name, setName] = useState(params.initialName || '');
    const [description, setDescription] = useState('');
    const [locationName, setLocationName] = useState('Detecting location...');
    const [isLocating, setIsLocating] = useState(true);

    useEffect(() => {
        detectLocation();
    }, []);

    const detectLocation = async () => {
        setIsLocating(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationName("Permission denied");
                setIsLocating(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest
            });
            let reverseGeocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            const place = reverseGeocode[0];
            // Google Maps style: [Name/Number] [Street], [City], [Region] [PostalCode], [Country]
            const streetInfo = [place.streetNumber, place.street].filter(Boolean).join(' ');
            const cityInfo = place.city || place.subregion || place.district;
            const regionInfo = place.region;
            const parts = [
                place.name !== streetInfo ? place.name : null, // Avoid duplicating if name == street
                streetInfo,
                cityInfo,
                regionInfo,
                place.country
            ].filter(Boolean);

            const locString = parts.join(', ');
            setLocationName(locString || "Unknown Location");
        } catch (error) {
            console.error("Location error:", error);
            setLocationName("Location unavailable");
        } finally {
            setIsLocating(false);
        }
    };

    const handleStart = (mode) => {
        if (mode === 'solo' && !name.trim()) {
            Alert.alert("Missing Information", "Please enter a trek name.");
            return;
        }

        router.push({
            pathname: '/trek/active',
            params: {
                name,
                description,
                location: locationName,
                mode // 'solo' or 'group'
            }
        });
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Trek</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Trek Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Morning Hike"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Describe the trail..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Location</Text>
                    <View style={styles.locationContainer}>
                        <Ionicons name="location" size={20} color="#666" />
                        {isLocating ? (
                            <ActivityIndicator size="small" color="#28a745" style={{ marginLeft: 10 }} />
                        ) : (
                            <Text style={styles.locationText}>{locationName}</Text>
                        )}
                        <TouchableOpacity onPress={detectLocation} style={{ marginLeft: 'auto' }}>
                            <Ionicons name="refresh" size={20} color="#28a745" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.sectionHeader}>Start Trekking</Text>

                <TouchableOpacity
                    style={[styles.actionButton, styles.soloButton]}
                    onPress={() => handleStart('solo')}
                >
                    <Ionicons name="person" size={24} color="white" />
                    <View style={styles.buttonContent}>
                        <Text style={styles.buttonTitle}>Solo Trek</Text>
                        <Text style={styles.buttonSubtitle}>Just you and the trail</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.groupButton]}
                    onPress={() => router.push({
                        pathname: '/trek/group-menu',
                        params: {
                            name,
                            description,
                            location: locationName
                        }
                    })}
                >
                    <Ionicons name="people" size={24} color="white" />
                    <View style={styles.buttonContent}>
                        <Text style={styles.buttonTitle}>Group Trek</Text>
                        <Text style={styles.buttonSubtitle}>Invite friends to join</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </ScrollView>
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
        marginTop: 30,
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    form: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: '#333',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f5e9',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#c3e6cb',
    },
    locationText: {
        fontSize: 16,
        color: '#2e7d32',
        fontWeight: '500',
        marginLeft: 10,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 10,
        marginBottom: 15,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    soloButton: {
        backgroundColor: '#28a745',
    },
    groupButton: {
        backgroundColor: '#17a2b8',
    },
    buttonContent: {
        marginLeft: 15,
    },
    buttonTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    buttonSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
    },
});
