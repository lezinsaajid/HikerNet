import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import NativeMap, { Marker } from '../../components/NativeMap';

export default function RendezvousFinder() {
    const [markers, setMarkers] = useState([]);
    const [midpoint, setMidpoint] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentPos, setCurrentPos] = useState(null);
    const router = useRouter();

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            let location = await Location.getCurrentPositionAsync({});
            setCurrentPos(location.coords);
        })();
    }, []);

    const handleMapPress = (e) => {
        if (midpoint) {
            setMidpoint(null);
            setMarkers([e.nativeEvent.coordinate]);
        } else {
            setMarkers([...markers, e.nativeEvent.coordinate]);
        }
    };

    const calculateRendezvous = async () => {
        if (markers.length < 2) {
            Alert.alert('Selection Required', 'Please tap on the map to add at least 2 buddy locations.');
            return;
        }

        setLoading(true);
        try {
            const res = await client.post('/safety/rendezvous', {
                locations: markers
            });
            setMidpoint({
                latitude: res.data.latitude,
                longitude: res.data.longitude
            });
        } catch (error) {
            console.error('Rendezvous Error:', error);
            Alert.alert('Error', 'Failed to calculate meeting point');
        } finally {
            setLoading(false);
        }
    };

    const clearSelection = () => {
        setMarkers([]);
        setMidpoint(null);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>Rendezvous Finder</Text>
            </View>

            <View style={styles.hintContainer}>
                <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                <Text style={styles.hintText}>
                    {midpoint ? "Meeting point found!" : "Tap the map to add your buddies' locations."}
                </Text>
            </View>

            {currentPos ? (
                <NativeMap
                    initialRegion={{
                        latitude: currentPos.latitude,
                        longitude: currentPos.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    onPress={handleMapPress}
                >
                    {markers.map((marker, index) => (
                        <Marker
                            key={index}
                            coordinate={marker}
                            pinColor="#007AFF"
                            title={`Buddy ${index + 1}`}
                        />
                    ))}
                    {midpoint && (
                        <Marker
                            coordinate={midpoint}
                            pinColor="#28a745"
                            title="Meeting Point"
                        >
                            <View style={styles.meetingMarker}>
                                <Ionicons name="people" size={24} color="#fff" />
                            </View>
                        </Marker>
                    )}
                </NativeMap>
            ) : (
                <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            )}

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.btn, styles.clearBtn]}
                    onPress={clearSelection}
                >
                    <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.btn, styles.calcBtn, loading && styles.disabledBtn]}
                    onPress={calculateRendezvous}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.calcText}>Calculate Midpoint</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    backBtn: {
        marginRight: 15,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    hintContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e7f1ff',
        padding: 10,
        marginHorizontal: 20,
        borderRadius: 10,
        marginBottom: 10,
    },
    hintText: {
        color: '#007AFF',
        fontSize: 13,
        marginLeft: 8,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
    },
    controls: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f1f3f5',
    },
    btn: {
        flex: 1,
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    clearBtn: {
        backgroundColor: '#f1f3f5',
        marginRight: 10,
    },
    calcBtn: {
        backgroundColor: '#28a745',
        marginLeft: 10,
    },
    disabledBtn: {
        opacity: 0.7,
    },
    clearText: {
        color: '#495057',
        fontWeight: 'bold',
    },
    calcText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    meetingMarker: {
        backgroundColor: '#28a745',
        padding: 5,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    }
});
