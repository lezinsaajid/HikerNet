import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import SafeScreen from '../../components/SafeScreen';

export default function CreateTrailScreen() {
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

            // Try reverse geocoding with timeout
            try {
                const geocodePromise = Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });

                // Add 8-second timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Geocoding timeout')), 8000)
                );

                let reverseGeocode = await Promise.race([geocodePromise, timeoutPromise]);

                const place = reverseGeocode[0];
                if (place) {
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
                } else {
                    // Fallback to coordinates
                    setLocationName(`${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);
                }
            } catch (geocodeError) {
                // If geocoding fails or times out, use coordinates
                console.log("Geocoding failed, using coordinates:", geocodeError.message);
                setLocationName(`${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);
            }
        } catch (error) {
            console.error("Location error:", error);
            setLocationName("Location unavailable");
        } finally {
            setIsLocating(false);
        }
    };

    const handleStart = (mode, simulate = false) => {
        if (!simulate && mode === 'solo' && !name.trim()) {
            Alert.alert("Missing Information", "Please enter a trail name.");
            return;
        }

        router.push({
            pathname: '/trek/active-trek',
            params: {
                name: simulate ? "Test Simulation" : name,
                description: simulate ? "Automated test tour" : description,
                location: locationName,
                mode,
                simulate: simulate ? 'true' : 'false'
            }
        });
    };

    return (
        <SafeScreen backgroundColor="#f8f9fa">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>New Trail</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Trail Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="E.g. Morning Hike"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Trail Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Tell others about this trail..."
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

                        <Text style={styles.sectionHeader}>Start Trailing</Text>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.soloButton]}
                            onPress={() => handleStart('solo')}
                        >
                            <Ionicons name="person" size={24} color="white" />
                            <View style={styles.buttonContent}>
                                <Text style={styles.buttonTitle}>Solo Trail</Text>
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
                                <Text style={styles.buttonTitle}>Group Trail</Text>
                                <Text style={styles.buttonSubtitle}>Invite friends to join</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.simButton]}
                            onPress={() => handleStart('solo', true)}
                        >
                            <Ionicons name="flask" size={24} color="white" />
                            <View style={styles.buttonContent}>
                                <Text style={styles.buttonTitle}>Simulate Trek</Text>
                                <Text style={styles.buttonSubtitle}>Run automated test tour</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
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
    simButton: {
        backgroundColor: '#6f42c1', // Purple for simulation
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

