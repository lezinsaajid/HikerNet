import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import client from '../../api/client';
import { Ionicons } from '@expo/vector-icons';
import WeatherWidget from '../../components/WeatherWidget';
import NativeMap, { Polyline } from '../../components/NativeMap';

export default function ActiveTrekScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { name, description, location: initialLocation, mode, trekId: paramTrekId } = params;

    const [location, setLocation] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [stats, setStats] = useState({ distance: 0, duration: 0 });
    const [trekId, setTrekId] = useState(paramTrekId || null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);

    // Timer Ref
    const timerRef = useRef(null);
    const pausedRef = useRef(false);
    const locationSubscription = useRef(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }

            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc.coords);

            // If we have a trekId (resuming) OR a name (new trek), start tracking
            if (paramTrekId || name) {
                startTrek();
            }
        })();

        return () => {
            stopTracking();
        };
    }, []);

    const trekIdRef = useRef(trekId); // Keep ref in sync for callbacks

    useEffect(() => {
        trekIdRef.current = trekId;
    }, [trekId]);

    const startLocationTracking = async () => {
        // Clear existing if any
        if (locationSubscription.current) {
            locationSubscription.current.remove();
        }

        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
            },
            (newLocation) => {
                if (pausedRef.current) return;

                const { latitude, longitude, altitude } = newLocation.coords;
                const newPoint = { latitude, longitude };

                setRouteCoordinates(prev => {
                    const newPath = [...prev, newPoint];
                    return newPath;
                });

                setLocation(newLocation.coords);

                // Sync to Backend using ref to avoid stale closure
                if (trekIdRef.current) {
                    client.put(`/treks/update/${trekIdRef.current}`, {
                        coordinates: [{ latitude, longitude, altitude }]
                    }).catch(console.error);
                }
            }
        );
    };

    const stopLocationTracking = () => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };

    const stopTracking = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        stopLocationTracking();
    };

    const startTrek = async () => {
        try {
            setIsTracking(true);
            setIsPaused(false);
            pausedRef.current = false;

            // Start timer
            timerRef.current = setInterval(() => {
                if (!pausedRef.current) {
                    setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
                }
            }, 1000);

            // Create trek on backend if starting new
            if (!trekId) {
                const res = await client.post('/treks/start', {
                    name: name || `New Trek ${new Date().toLocaleDateString()}`,
                    description: description || '',
                    location: initialLocation || '',
                    mode: mode || 'solo'
                });
                setTrekId(res.data._id);
            }

            // Start location tracking AFTER ID is set (or at least ref will be updated by effect soon)
            // Ideally we wait for setTrekId to trigger effect, but startLocationTracking uses ref.
            // If we start tracking immediately, the first few points might trigger before ref updates? 
            // In React state updates are batched. 
            // Safer to just start tracking. The ref will update on next render.
            await startLocationTracking();

        } catch (error) {
            console.error("Failed to start trek", error);
            Alert.alert("Error", "Failed to start trek session");
            setIsTracking(false);
        }
    };

    const stopTrek = async () => {
        if (!trekId) return;

        try {
            await client.put(`/treks/update/${trekId}`, { status: 'completed' });
            setIsTracking(false);
            clearInterval(timerRef.current);
            Alert.alert("Trek Completed!", "Your hike has been saved.", [
                { text: "OK", onPress: () => router.replace('/(tabs)/trek') } // Navigate back to dashboard
            ]);
            setTrekId(null);
        } catch (error) {
            console.error("Error stopping trek", error);
            Alert.alert("Error", "Failed to save trek");
        }
    };

    const togglePause = () => {
        const newPausedState = !isPaused;
        setIsPaused(newPausedState);
        pausedRef.current = newPausedState;
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
                    <NativeMap
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
                    </NativeMap>
                    <View style={styles.weatherOverlay}>
                        <WeatherWidget compact={true} />
                    </View>
                </View>
            ) : (
                <View style={styles.centered}>
                    <Text>Initializing Trek...</Text>
                </View>
            )}

            {/* UI Overlay */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)/trek')}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            {/* Controls Overlay */}
            <View style={styles.controls}>
                <View style={styles.statsCard}>
                    <Text style={styles.statLabel}>Duration</Text>
                    <Text style={styles.statValue}>{formatTime(stats.duration)}</Text>
                </View>

                <View style={styles.row}>
                    <TouchableOpacity style={[styles.button, styles.pauseBtn]} onPress={togglePause}>
                        <Ionicons name={isPaused ? "play" : "pause"} size={32} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.stopBtn]} onPress={() => {
                        stopTrek();
                        // Reset timer UI immediately for feedback, though stopTrek handles logic
                        setStats({ distance: 0, duration: 0 });
                    }}>
                        <Ionicons name="stop" size={32} color="white" />
                    </TouchableOpacity>
                </View>
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
    weatherOverlay: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
    },
    backButton: {
        position: 'absolute',
        top: 50, // Adjust for status bar
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 5,
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
    row: {
        flexDirection: 'row',
        gap: 20
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
    stopBtn: {
        backgroundColor: '#dc3545',
    },
    pauseBtn: {
        backgroundColor: '#ffc107',
    },
});
