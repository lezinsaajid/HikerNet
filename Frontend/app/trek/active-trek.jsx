import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, FlatList, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import NativeMap, { Polyline, Marker } from '../../components/NativeMap';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import WeatherWidget from '../../components/WeatherWidget';
import { useSmartLocation } from '../../hooks/useSmartLocation';
// icon map
const MARKER_ICONS = [
    { name: 'water', icon: 'water', color: '#007bff', label: 'Water', tags: ['river', 'lake', 'drink', 'stream', 'wet'] },
    { name: 'camera', icon: 'camera', color: '#6610f2', label: 'Viewpoint', tags: ['photo', 'view', 'picture', 'scenery', 'lookout'] },
    { name: 'danger', icon: 'warning', color: '#dc3545', label: 'Danger', tags: ['warning', 'careful', 'hazard', 'risk', 'steep'] },
    { name: 'camp', icon: 'bonfire', color: '#fd7e14', label: 'Camp', tags: ['fire', 'night', 'tent', 'sleep', 'stay'] },
    { name: 'rest', icon: 'cafe', color: '#6f42c1', label: 'Rest', tags: ['coffee', 'food', 'break', 'sit', 'eat'] },
    { name: 'mountain', icon: 'mountain', color: '#6d4c41', label: 'Peak', tags: ['summit', 'climb', 'top', 'hill', 'high'] },
    { name: 'tree', icon: 'leaf', color: '#2e7d32', label: 'Forest', tags: ['trees', 'woods', 'jungle', 'nature', 'green'] },
    { name: 'animal', icon: 'paw', color: '#ef6c00', label: 'Wildlife', tags: ['tiger', 'bear', 'deer', 'animal', 'track', 'cat', 'dog'] },
    { name: 'flag', icon: 'flag', color: '#c62828', label: 'Goal', tags: ['finish', 'end', 'destination', 'target', 'win'] },
    { name: 'info', icon: 'information-circle', color: '#00838f', label: 'Info', tags: ['help', 'details', 'note', 'guide', 'sign'] },
    { name: 'trail', icon: 'trail-sign', color: '#455a64', label: 'Trail', tags: ['path', 'road', 'way', 'direction', 'route'] },
    { name: 'rain', icon: 'rainy', color: '#0288d1', label: 'Rain', tags: ['storm', 'wet', 'weather', 'clouds', 'umbrella'] },
    { name: 'bicycle', icon: 'bicycle', color: '#311b92', label: 'Cycle', tags: ['bike', 'ride', 'wheels', 'fast', 'cyclist'] },
    { name: 'fish', icon: 'fish', color: '#03a9f4', label: 'Fishing', tags: ['water', 'sea', 'river', 'catch', 'food'] },
    { name: 'home', icon: 'home', color: '#546e7a', label: 'Shelter', tags: ['house', 'hut', 'cabin', 'stay', 'indoor'] },
    { name: 'star', icon: 'star', color: '#fbc02d', label: 'Special', tags: ['favorite', 'good', 'gold', 'best', 'star'] },
];

export default function ActiveTrek() {
    const router = useRouter();
    const params = useLocalSearchParams();
    useKeepAwake(); // Prevent screen from sleeping while tracking
    const { name, description, location: initialLocation, mode, trailId: paramTrailId, role = 'leader' } = params;

    const [location, setLocation] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [trailFinished, setTrailFinished] = useState(false); // New state for "Stop" -> "Trail Back"
    const [isTrailingBack, setIsTrailingBack] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    const [stats, setStats] = useState({
        distance: 0,
        duration: 0,
        elevationGain: 0,
        avgSpeed: 0,
        maxAltitude: -Infinity
    });
    const [trailId, setTrailId] = useState(paramTrailId || null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [backtrackCoordinates, setBacktrackCoordinates] = useState([]);
    const [markers, setMarkers] = useState([]); // [{latitude, longitude, icon, type}]
    const [distanceToTrail, setDistanceToTrail] = useState(0);
    const [offTrackWarning, setOffTrackWarning] = useState(false);
    const [mapType, setMapType] = useState('standard'); // 'standard', 'satellite', 'hybrid'
    const [isFollowingUser, setIsFollowingUser] = useState(true);

    // Modal State
    const [showMarkerModal, setShowMarkerModal] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(null);
    const [waypointDescription, setWaypointDescription] = useState('');
    const [iconSearchQuery, setIconSearchQuery] = useState('');

    // Timer Ref
    const timerRef = useRef(null);
    const autoFollowTimerRef = useRef(null);
    const pausedRef = useRef(false);

    const mapRef = useRef(null);
    const trailIdRef = useRef(trailId);
    const routeRef = useRef([]);
    const lastLocationRef = useRef(null); // For EMA smoothing filter
    const hasAlertedOffTrack = useRef(false); // To prevent alert spam

    const { location: smartLocation } = useSmartLocation(isTracking || isTrailingBack);

    // React to smart location updates
    useEffect(() => {
        if (!smartLocation) return;

        let { latitude, longitude, altitude } = smartLocation;

        // --- EMA SMOOTHING FILTER ---
        // Only smooth if we already have a point
        if (lastLocationRef.current) {
            const alpha = 0.5; // Smoothing factor (0.1 to 0.9). 0.5 is a good balance for trails.
            latitude = alpha * latitude + (1 - alpha) * lastLocationRef.current.latitude;
            longitude = alpha * longitude + (1 - alpha) * lastLocationRef.current.longitude;
        }

        // Update current location state for UI
        const newPoint = { latitude, longitude };
        lastLocationRef.current = newPoint;
        setLocation(newPoint);

        // Animate Camera
        if (mapRef.current && isFollowingUser) {
            mapRef.current.animateCamera({
                center: { latitude, longitude }
            }, { duration: 500 });
        }

        // Logic for Backtracking
        if (isTrailingBack) {
            setBacktrackCoordinates(prev => [...prev, newPoint]);
            checkOffTrack(latitude, longitude);
        }
        // Logic for Recording
        else if (!trailFinished && !isPaused && role === 'leader') {
            // Manual Distance Threshold Check for RECORDING
            const path = routeRef.current;
            let shouldRecord = false;
            let dist = 0;

            if (path.length === 0) {
                shouldRecord = true;
                console.log("[ActiveTrek] First point recorded");
            } else {
                const lastPoint = path[path.length - 1];
                dist = calculateDistance(latitude, longitude, lastPoint.latitude, lastPoint.longitude);
                console.log(`[ActiveTrek] Dist from last: ${dist.toFixed(2)}m`);

                // --- RECORDING FILTER ---
                // Relaxed to 0.5m for detailed movement. 
                // However, with EMA, we might want slightly higher threshold to avoid drifting while stationary.
                if (dist >= 1.0) {
                    shouldRecord = true;
                } else {
                    console.log("[ActiveTrek] REJECT: < 1.0m movement after smoothing");
                }
            }

            if (shouldRecord) {
                setRouteCoordinates(prev => {
                    const updated = [...prev, newPoint];
                    routeRef.current = updated;
                    return updated;
                });

                setStats(prev => {
                    const newDistance = prev.distance + dist;
                    const newDuration = prev.duration; // Timer handles duration

                    // Elevation Calculation
                    let newElevationGain = prev.elevationGain;
                    let newMaxAltitude = prev.maxAltitude;

                    if (altitude !== undefined) {
                        if (altitude > newMaxAltitude && newMaxAltitude !== -Infinity) {
                            const gain = altitude - newMaxAltitude;
                            if (gain > 0.5) { // Sensitivity threshold
                                newElevationGain += gain;
                            }
                        }
                        newMaxAltitude = Math.max(newMaxAltitude, altitude);
                    }

                    // Average Speed (km/h)
                    // duration is in seconds
                    const speed = newDuration > 0 ? (newDistance / 1000) / (newDuration / 3600) : 0;

                    const updatedStats = {
                        ...prev,
                        distance: newDistance,
                        elevationGain: newElevationGain,
                        maxAltitude: newMaxAltitude,
                        avgSpeed: parseFloat(speed.toFixed(1))
                    };

                    // Sync to backend
                    if (trailIdRef.current) {
                        client.put(`/treks/update/${trailIdRef.current}`, {
                            coordinates: [{ latitude, longitude, altitude }],
                            stats: updatedStats
                        }).catch(console.error);
                    }

                    return updatedStats;
                });
            }
        }
    }, [smartLocation, isTrailingBack, trailFinished, isPaused, role, isFollowingUser]); // Added missing dependencies to avoid stale closures

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }

            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc.coords);

            // Fetch existing trek if trailId provided (resuming or leader joining)
            if (paramTrailId) {
                try {
                    const res = await client.get(`/treks/${paramTrailId}`);
                    const data = res.data;

                    if (data.path && data.path.coordinates) {
                        // GeoJSON is [lng, lat], our state is [{latitude, longitude}]
                        const mappedRoute = data.path.coordinates.map(p => ({
                            latitude: p[1],
                            longitude: p[0]
                        }));
                        setRouteCoordinates(mappedRoute);
                        routeRef.current = mappedRoute;
                    }

                    if (data.waypoints) setMarkers(data.waypoints);
                    if (data.stats) setStats(prev => ({ ...prev, ...data.stats }));

                    if (data.status === 'ongoing') {
                        setIsTracking(true);
                        setHasStarted(true);
                    } else if (data.status === 'completed') {
                        setTrailFinished(true);
                        setHasStarted(true);
                    }
                } catch (e) {
                    console.error("Failed to load existing trek data", e);
                }
            }

            // If we have a trailId (resuming) OR a name (new trail), start tracking
            if (paramTrailId || name) {
                if (role === 'leader') {
                    // Manual start required unless resuming with a specific trailId
                } else {
                    // Member Mode: Start polling
                    setHasStarted(true); // Members don't "start", they just join
                    startMemberMode();
                }
            }
        })();

        return () => {
            if (memberPollRef.current) clearInterval(memberPollRef.current);
        };
    }, []);

    const memberPollRef = useRef(null);

    const startMemberMode = () => {
        // Poll for updates
        memberPollRef.current = setInterval(async () => {
            if (!trailId && paramTrailId) setTrailId(paramTrailId);
            const currentTrailId = trailId || paramTrailId;

            if (currentTrailId) {
                try {
                    const res = await client.get(`/treks/${currentTrailId}`);
                    const data = res.data;

                    // Sync state from leader
                    if (data.status === 'completed') {
                        setTrailFinished(true);
                        clearInterval(memberPollRef.current);
                    }

                    // Path synchronization for members
                    if (data.path && data.path.coordinates) {
                        const mappedRoute = data.path.coordinates.map(p => ({
                            latitude: p[1],
                            longitude: p[0]
                        }));
                        setRouteCoordinates(mappedRoute);
                    }

                    // Sync Waypoints/Markers
                    if (data.waypoints) {
                        setMarkers(data.waypoints);
                    }

                    // Sync Stats
                    if (data.stats) {
                        setStats(prev => ({ ...prev, ...data.stats }));
                    }

                } catch (e) {
                    console.error("Polling error", e);
                }
            }
        }, 5000); // 5 seconds is safer for polling frequency
    };

    useEffect(() => {
        trailIdRef.current = trailId;
    }, [trailId]);

    useEffect(() => {
        routeRef.current = routeCoordinates;
    }, [routeCoordinates]);

    // Helper to calculate distance
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const d = R * c; // in metres
        return d;
    };



    const checkOffTrack = (lat, lon) => {
        // Find minimum distance to any point in the recorded path
        const path = routeRef.current;
        if (!path || path.length === 0) return;

        let minDistance = Infinity;
        for (let point of path) {
            const d = calculateDistance(lat, lon, point.latitude, point.longitude);
            if (d < minDistance) minDistance = d;
        }

        setDistanceToTrail(Math.round(minDistance));

        // Threshold: 20 meters for strict navigation
        if (minDistance > 20) {
            setOffTrackWarning(true);

            // Show Alert if not already alerted
            if (!hasAlertedOffTrack.current) {
                hasAlertedOffTrack.current = true;
                Alert.alert(
                    "Wrong Path!",
                    "You have strayed from the trail. Please return to the orange path.",
                    [{ text: "OK" }]
                );
            }
        } else {
            setOffTrackWarning(false);
            hasAlertedOffTrack.current = false; // Reset when back on track
        }
    };






    const startTrail = async () => {
        try {
            setIsTracking(true);
            setIsPaused(false);
            setTrailFinished(false);
            setHasStarted(true);
            pausedRef.current = false;

            // Start timer
            timerRef.current = setInterval(() => {
                if (!pausedRef.current && !trailFinished) {
                    setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
                }
            }, 1000);

            // Create trail on backend if starting new
            if (!trailId) {
                const res = await client.post('/treks/start', {
                    name: name || `New Trail ${new Date().toLocaleDateString()}`,
                    description: description || '',
                    location: initialLocation || '',
                    mode: mode || 'solo'
                });
                const newId = res.data._id;
                setTrailId(newId);
                trailIdRef.current = newId;
                setStats(prev => ({ ...prev, startName: res.data.name }));

                // AUTOMATIC START POINT
                if (location) {
                    try {
                        await client.put(`/treks/update/${newId}`, {
                            waypoints: [{
                                latitude: location.latitude,
                                longitude: location.longitude,
                                title: "Start Point",
                                description: "Trek started here",
                                icon: "play-circle"
                            }]
                        });
                        console.log("[ActiveTrek] Automatic Start point marked");
                    } catch (e) {
                        console.error("Failed to mark start point", e);
                    }
                }
            }

            // await startLocationTracking(); // Handled by hook

        } catch (error) {
            console.error("Failed to start trail", error);
            Alert.alert("Error", "Failed to start trail session");
            setIsTracking(false);
        }
    };

    const handleStopTrail = async () => {
        // Just pause/stop recording, verify completion
        Alert.alert("Finish Trail?", "Have you reached your destination?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Yes, Finish",
                onPress: async () => {
                    setTrailFinished(true); // Switch UI
                    setIsTracking(false);
                    if (timerRef.current) clearInterval(timerRef.current);

                    if (trailId) {
                        try {
                            // AUTOMATIC END POINT
                            if (location) {
                                await client.put(`/treks/update/${trailId}`, {
                                    waypoints: [{
                                        latitude: location.latitude,
                                        longitude: location.longitude,
                                        title: "End Point",
                                        description: "Trek finished here",
                                        icon: "flag"
                                    }]
                                });
                                console.log("[ActiveTrek] Automatic End point marked");
                            }

                            await client.put(`/treks/update/${trailId}`, { status: 'completed' });

                            // Share Prompt
                            Alert.alert(
                                "Share Trail?",
                                "Would you like to share this achievement to your feed?",
                                [
                                    { text: "Later", style: "cancel" },
                                    {
                                        text: "Share Now",
                                        onPress: async () => {
                                            try {
                                                await client.post('/posts/create', {
                                                    caption: `Just finished trailing "${name || 'a new path'}"! 🏔️`,
                                                    trekId: trailId
                                                });
                                                Alert.alert("Shared!", "Your trail is now on the feed.");
                                            } catch (e) {
                                                console.error("Share error", e);
                                            }
                                        }
                                    }
                                ]
                            );
                        } catch (e) {
                            console.error("Finish error", e);
                        }
                    }
                }
            }
        ]);
    };

    const handleTrailBack = () => {
        setIsTrailingBack(true);
        hasAlertedOffTrack.current = false;

        // Initialize backtrack with current location if available
        if (location) {
            setBacktrackCoordinates([location]);
        }

        // Ensure tracking is active but in "back" mode
        pausedRef.current = true; // Stop recording original path points
        // But we need to listen to location updates for off-track logic
        // re-enable listener if it was stopped (it wasn't strictly stopped in handleStopTrail, just state changed)
        // Check if subscription exists

    };

    const handleExit = () => {
        router.replace('/(tabs)/trek');
    };

    const togglePause = () => {
        const newPausedState = !isPaused;
        setIsPaused(newPausedState);
        pausedRef.current = newPausedState;
    };

    const toggleMapType = () => {
        const types = ['standard', 'satellite', 'hybrid'];
        const nextIndex = (types.indexOf(mapType) + 1) % types.length;
        setMapType(types[nextIndex]);
    };

    const handleSelectIcon = (iconData) => {
        setSelectedIcon(iconData);
        setIconSearchQuery(''); // Reset search when icon selected
    };

    const addMarker = async () => {
        if (!location || !selectedIcon) return;

        const newMarker = {
            latitude: location.latitude,
            longitude: location.longitude,
            icon: selectedIcon.name,
            type: selectedIcon.label,
            description: waypointDescription.trim(),
            timestamp: new Date()
        };

        setMarkers(prev => [...prev, newMarker]);
        setShowMarkerModal(false);
        setSelectedIcon(null);
        setWaypointDescription('');
        setIconSearchQuery('');

        // Save to backend
        if (trailId) {
            try {
                await client.put(`/treks/update/${trailId}`, {
                    waypoints: [newMarker]
                });
            } catch (e) {
                console.error(e);
            }
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
                    <NativeMap
                        ref={mapRef}
                        initialRegion={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                            latitudeDelta: 0.005, // Slightly wider initial zoom
                            longitudeDelta: 0.005,
                        }}
                        mapType={mapType}
                        showsUserLocation={true}
                        followsUserLocation={false}
                        onPanDrag={() => {
                            setIsFollowingUser(false);
                            if (autoFollowTimerRef.current) clearTimeout(autoFollowTimerRef.current);
                            autoFollowTimerRef.current = setTimeout(() => {
                                setIsFollowingUser(true);
                            }, 10000); // Resume following after 10 seconds of no panning
                        }}
                        onRegionChange={(region, isGesture) => {
                            if (isGesture?.isGesture) {
                                setIsFollowingUser(false);
                                if (autoFollowTimerRef.current) clearTimeout(autoFollowTimerRef.current);
                                autoFollowTimerRef.current = setTimeout(() => {
                                    setIsFollowingUser(true);
                                }, 10000);
                            }
                        }}
                    >
                        {routeCoordinates.length > 0 && (
                            <Polyline
                                coordinates={routeCoordinates}
                                strokeWidth={6} // Thicker for visibility
                                strokeColor="#fc4c02" // Strava Orange
                                lineCap="round"
                                lineJoin="round"
                                geodesic={true}
                                zIndex={100} // Force on top of tiles
                            />
                        )}
                        {
                            backtrackCoordinates.length > 0 && (
                                <Polyline
                                    coordinates={backtrackCoordinates}
                                    strokeWidth={6}
                                    strokeColor="#28a745" // Always green for backtrack progress
                                    lineCap="round"
                                    lineJoin="round"
                                    geodesic={true}
                                />
                            )
                        }
                        {
                            markers.map((m, i) => (
                                <Marker
                                    key={i}
                                    coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                                    title={m.type}
                                    description={m.description}
                                    pinColor={MARKER_ICONS.find(ic => ic.name === m.icon)?.color || 'red'}
                                />
                            ))
                        }
                    </NativeMap >

                    {isTrailingBack && (
                        <View style={[styles.statusOverlay, { top: offTrackWarning ? 120 : 80 }]}>
                            <View style={styles.statusBadge}>
                                <Ionicons name="navigate" size={16} color="#007bff" />
                                <Text style={styles.statusText}>{distanceToTrail}m to Trail</Text>
                            </View>
                        </View>
                    )}

                    {offTrackWarning && (
                        <View style={styles.warningBanner}>
                            <Ionicons name="warning" size={24} color="white" />
                            <View style={{ marginLeft: 10 }}>
                                <Text style={styles.warningTitle}>OFF TRACK!</Text>
                                <Text style={styles.warningSubtitle}>Return to the orange path ({distanceToTrail}m away)</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.weatherOverlay}>
                        <WeatherWidget compact={true} />
                    </View>
                </View>
            ) : (
                <View style={styles.centered}>
                    <Text>Initializing Trail...</Text>
                </View>
            )}

            {/* Top Left Add Icon Button */}
            {
                !trailFinished && role === 'leader' && (
                    <View style={styles.topButtonsContainer}>
                        <TouchableOpacity style={styles.mapIconButton} onPress={() => setShowMarkerModal(true)}>
                            <Ionicons name="add-circle" size={32} color="#28a745" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.mapIconButton} onPress={toggleMapType}>
                            <Ionicons
                                name={mapType === 'standard' ? 'map' : mapType === 'satellite' ? 'image' : 'layers'}
                                size={28}
                                color="#28a745"
                            />
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Controls Overlay */}
            <View style={styles.controls}>
                {!trailFinished ? (
                    <>
                        <View style={styles.statsCard}>
                            <View style={styles.statsMainRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statLabel}>Duration</Text>
                                    <Text style={styles.statValue}>{formatTime(stats.duration)}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statLabel}>Distance</Text>
                                    <Text style={styles.statValue}>{(stats.distance / 1000).toFixed(2)} <Text style={styles.unitText}>km</Text></Text>
                                </View>
                            </View>

                            <View style={styles.statsSecondaryRow}>
                                <View style={styles.statDetail}>
                                    <Ionicons name="trending-up" size={16} color="#666" />
                                    <Text style={styles.statDetailText}>{Math.round(stats.elevationGain || 0)}m Gain</Text>
                                </View>
                                <View style={styles.statDetail}>
                                    <Ionicons name="speedometer" size={16} color="#666" />
                                    <Text style={styles.statDetailText}>{stats.avgSpeed || 0} km/h</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.row}>
                            {role === 'leader' && (
                                <>
                                    <TouchableOpacity style={[styles.button, styles.pauseBtn]} onPress={togglePause}>
                                        <Ionicons name={isPaused ? "play" : "pause"} size={32} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.button, styles.stopBtn]} onPress={handleStopTrail}>
                                        <Ionicons name="stop" size={32} color="white" />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </>
                ) : (
                    // Trail Finished / Trail Back Mode
                    <View style={styles.finishedContainer}>
                        {!isTrailingBack ? (
                            <>
                                <Text style={styles.finishedTitle}>Destination Reached</Text>
                                <View style={styles.row}>
                                    <TouchableOpacity style={[styles.actionButton, styles.trailBackBtn]} onPress={handleTrailBack}>
                                        <Ionicons name="arrow-undo" size={24} color="white" style={{ marginRight: 8 }} />
                                        <Text style={styles.actionButtonText}>Trail Back</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.actionButton, styles.exitBtn]} onPress={handleExit}>
                                        <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 8 }} />
                                        <Text style={styles.actionButtonText}>Finish & Exit</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <View style={styles.trailBackMode}>
                                <Text style={styles.trailBackTitle}>Trailing Back...</Text>
                                <Text style={styles.trailBackSub}>Follow your path back. We'll alert you if you stray.</Text>
                                <TouchableOpacity style={[styles.actionButton, styles.exitBtn, { marginTop: 15 }]} onPress={handleExit}>
                                    <Text style={styles.actionButtonText}>End Session</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Marker Modal */}
            <Modal
                visible={showMarkerModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setShowMarkerModal(false);
                    setSelectedIcon(null);
                    setWaypointDescription('');
                    setIconSearchQuery('');
                }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={styles.keyboardAvoidingView}
                        >
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>
                                    {selectedIcon ? `Pin ${selectedIcon.label}` : 'Select Waypoint Icon'}
                                </Text>

                                {!selectedIcon ? (
                                    <>
                                        <View style={styles.searchContainer}>
                                            <Ionicons name="search" size={20} color="#666" style={{ marginLeft: 10 }} />
                                            <TextInput
                                                style={styles.searchInput}
                                                placeholder="Search for icon (e.g. tiger, peak...)"
                                                value={iconSearchQuery}
                                                onChangeText={setIconSearchQuery}
                                                maxLength={30}
                                            />
                                            {iconSearchQuery.length > 0 && (
                                                <TouchableOpacity onPress={() => setIconSearchQuery('')}>
                                                    <Ionicons name="close-circle" size={20} color="#666" style={{ marginRight: 10 }} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <FlatList
                                            data={MARKER_ICONS.filter(item =>
                                                item.label.toLowerCase().includes(iconSearchQuery.toLowerCase()) ||
                                                item.tags.some(tag => tag.toLowerCase().includes(iconSearchQuery.toLowerCase()))
                                            )}
                                            numColumns={3}
                                            keyExtractor={item => item.name}
                                            ListEmptyComponent={(
                                                <View style={styles.noResults}>
                                                    <Ionicons name="search-outline" size={40} color="#ccc" />
                                                    <Text style={styles.noResultsText}>No icons found for "{iconSearchQuery}"</Text>
                                                </View>
                                            )}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity
                                                    style={styles.iconOption}
                                                    onPress={() => {
                                                        handleSelectIcon(item);
                                                        Keyboard.dismiss();
                                                    }}
                                                >
                                                    <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                                                        <Ionicons name={item.icon} size={24} color="white" />
                                                    </View>
                                                    <Text style={styles.iconLabel}>{item.label}</Text>
                                                </TouchableOpacity>
                                            )}
                                        />
                                    </>
                                ) : (
                                    <View style={styles.descriptionSection}>
                                        <View style={[styles.iconCircle, { backgroundColor: selectedIcon.color, alignSelf: 'center', marginBottom: 20 }]}>
                                            <Ionicons name={selectedIcon.icon} size={32} color="white" />
                                        </View>
                                        <Text style={styles.label}>Add more details (optional)</Text>
                                        <TextInput
                                            style={styles.descriptionInput}
                                            placeholder="e.g. Spotted a rare bird here!"
                                            value={waypointDescription}
                                            onChangeText={setWaypointDescription}
                                            multiline
                                            autoFocus
                                            onSubmitEditing={Keyboard.dismiss}
                                        />
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.exitBtn, { marginTop: 20 }]}
                                            onPress={addMarker}
                                        >
                                            <Text style={styles.actionButtonText}>Pin Waypoint</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.closeModal, { borderTopWidth: 0 }]}
                                            onPress={() => setSelectedIcon(null)}
                                        >
                                            <Text style={styles.closeText}>Change Icon</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.closeModal}
                                    onPress={() => {
                                        setShowMarkerModal(false);
                                        setSelectedIcon(null);
                                        setWaypointDescription('');
                                        setIconSearchQuery('');
                                    }}
                                >
                                    <Text style={styles.closeText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Start Trail Overlay */}
            {
                !hasStarted && role === 'leader' && (
                    <View style={styles.startOverlay}>
                        <View style={styles.startCard}>
                            <Ionicons name="location" size={60} color="#28a745" />
                            <Text style={styles.startTitle}>Ready to Trail?</Text>
                            <Text style={styles.startSub}>Position yourself and click below to begin recording.</Text>
                            <TouchableOpacity style={styles.startBigBtn} onPress={startTrail}>
                                <Text style={styles.startBigBtnText}>Start Trail Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )
            }

        </View >
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
        top: 40,
        right: 20,
        zIndex: 10,
    },
    statusOverlay: {
        position: 'absolute',
        top: 80,
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        zIndex: 20,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    statusText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#007bff',
    },
    warningBanner: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        backgroundColor: '#dc3545',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
        zIndex: 100, // Top priority
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    warningTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    warningSubtitle: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 12,
    },
    topButtonsContainer: {
        position: 'absolute',
        top: 110,
        left: 20,
        zIndex: 10,
    },
    mapIconButton: {
        backgroundColor: 'white',
        borderRadius: 25,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        marginBottom: 10,
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
        backgroundColor: 'rgba(255,255,255,0.95)',
        padding: 15,
        borderRadius: 20,
        marginBottom: 20,
        width: '100%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    statsMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statDivider: {
        width: 1,
        height: '70%',
        backgroundColor: '#e0e0e0',
    },
    statsSecondaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 12,
    },
    statDetail: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statDetailText: {
        fontSize: 14,
        color: '#444',
        fontWeight: '600',
        marginLeft: 6,
    },
    statLabel: {
        fontSize: 12,
        color: '#888',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#28a745',
    },
    unitText: {
        fontSize: 14,
        color: '#666',
        fontWeight: 'normal',
    },
    row: {
        flexDirection: 'row',
    },
    button: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
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
    finishedContainer: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 20,
        width: '100%',
        alignItems: 'center',
        elevation: 10,
    },
    finishedTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    actionButton: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    trailBackBtn: {
        backgroundColor: '#17a2b8',
    },
    exitBtn: {
        backgroundColor: '#28a745',
    },
    actionButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    trailBackMode: {
        alignItems: 'center',
    },
    trailBackTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#17a2b8',
        marginBottom: 8,
    },
    trailBackSub: {
        textAlign: 'center',
        color: '#666',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        minHeight: 300,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    iconOption: {
        flex: 1,
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconLabel: {
        fontSize: 12,
        color: '#333',
    },
    closeModal: {
        marginTop: 20,
        padding: 15,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    closeText: {
        color: '#666',
        fontSize: 16,
    },
    descriptionSection: {
        padding: 5,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    descriptionInput: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: '#333',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f3f5',
        borderRadius: 12,
        marginBottom: 20,
        marginHorizontal: 10,
    },
    searchInput: {
        flex: 1,
        height: 45,
        fontSize: 16,
        color: '#333',
        paddingHorizontal: 10,
    },
    noResults: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    noResultsText: {
        color: '#666',
        marginTop: 10,
        fontSize: 14,
    },
    keyboardAvoidingView: {
        width: '100%',
        justifyContent: 'flex-end',
    },
    startOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    startCard: {
        backgroundColor: 'white',
        padding: 40,
        borderRadius: 30,
        alignItems: 'center',
        width: '85%',
        elevation: 20,
    },
    startTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
        color: '#333',
    },
    startSub: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    startBigBtn: {
        backgroundColor: '#28a745',
        paddingVertical: 18,
        paddingHorizontal: 40,
        borderRadius: 15,
        elevation: 5,
    },
    startBigBtnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
