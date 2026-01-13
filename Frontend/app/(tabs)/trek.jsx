import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';
import WeatherWidget from '../../components/WeatherWidget';

export default function TrekScreen() {
    const [location, setLocation] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [trekId, setTrekId] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [stats, setStats] = useState({ distance: 0, duration: 0 });

    // Timer Ref
    const timerRef = useRef(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }

            let currentLocation = await Location.getCurrentPositionAsync({});
            setLocation(currentLocation.coords);
        })();
    }, []);

    const startTrek = async () => {
        try {
            const res = await client.post('/treks/start', { name: `Hike on ${new Date().toLocaleDateString()}` });
            setTrekId(res.data._id);
            setIsTracking(true);
            setRouteCoordinates([]);
            setStats({ distance: 0, duration: 0 });

            // Start Timer
            timerRef.current = setInterval(() => {
                setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
            }, 1000);

            // Start Location Updates
            const subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (newLocation) => {
                    const { latitude, longitude, altitude } = newLocation.coords;
                    const newPoint = { latitude, longitude };

                    setRouteCoordinates(prev => {
                        const newPath = [...prev, newPoint];
                        return newPath;
                    });

                    setLocation(newLocation.coords);

                    // Sync to Backend
                    client.put(`/treks/update/${res.data._id}`, {
                        coordinates: [{ latitude, longitude, altitude }]
                    }).catch(console.error);
                }
            );
        } catch (error) {
            console.error("Error starting trek", error);
            Alert.alert("Error", "Could not start trek");
        }
    };

    const stopTrek = async () => {
        if (!trekId) return;

        try {
            await client.put(`/treks/update/${trekId}`, { status: 'completed' });
            setIsTracking(false);
            clearInterval(timerRef.current);
            Alert.alert("Trek Completed!", "Your hike has been saved.");
            setTrekId(null);
        } catch (error) {
            console.error("Error stopping trek", error);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <View style={styles.container}>
            {location ? (
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_DEFAULT}
                        initialRegion={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                        showsUserLocation={true}
                        followsUserLocation={true}
                    >
                        {routeCoordinates.length > 0 && (
                            <Polyline coordinates={routeCoordinates} strokeWidth={4} strokeColor="#28a745" />
                        )}
                    </MapView>
                    <View style={styles.weatherOverlay}>
                        <WeatherWidget compact={true} />
                    </View>
                </View>
            ) : (
                <View style={styles.centered}>
                    <Text>Loading Map...</Text>
                </View>
            )}

            {/* Controls Overlay */}
            <View style={styles.controls}>
                <View style={styles.statsCard}>
                    <Text style={styles.statLabel}>Duration</Text>
                    <Text style={styles.statValue}>{formatTime(stats.duration)}</Text>
                </View>

                {isTracking ? (
                    <TouchableOpacity style={[styles.button, styles.stopBtn]} onPress={stopTrek}>
                        <Ionicons name="stop" size={32} color="white" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.button, styles.startBtn]} onPress={startTrek}>
                        <Text style={styles.startText}>GO</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mapContainer: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    weatherOverlay: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controls: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    statsCard: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 10,
        borderRadius: 10,
        marginBottom: 20,
        alignItems: 'center',
        minWidth: 100,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    button: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    startBtn: {
        backgroundColor: '#28a745',
    },
    stopBtn: {
        backgroundColor: '#dc3545',
    },
    startText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
});
