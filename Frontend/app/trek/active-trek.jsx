import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, FlatList, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NativeMap, { Polyline, Marker } from '../../components/NativeMap';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import WeatherWidget from '../../components/WeatherWidget';
import { useSmartLocation } from '../../hooks/useSmartLocation';
import { useCompass } from '../../hooks/useCompass';
import { getDistance, getPointToPathDistance, calculateHeading } from '../../utils/geoUtils';
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
    const [hasJoinedTrail, setHasJoinedTrail] = useState(false);

    const [stats, setStats] = useState({
        distance: 0,
        duration: 0,
        elevationGain: 0,
        avgSpeed: 0,
        maxAltitude: -Infinity
    });
    const [trailId, setTrailId] = useState(paramTrailId || null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [targetRoute, setTargetRoute] = useState([]); // The reference trail being followed
    const [currentTrekBackIndex, setCurrentTrekBackIndex] = useState(0);
    const [markers, setMarkers] = useState([]); // [{latitude, longitude, icon, type}]
    const [distanceToTrail, setDistanceToTrail] = useState(0);
    const [offTrackWarning, setOffTrackWarning] = useState(false);
    const [navGuidance, setNavGuidance] = useState("Following Trail");
    const [targetBearing, setTargetBearing] = useState(0);
    const [mapType, setMapType] = useState('standard'); // 'standard', 'satellite', 'hybrid'
    const [isFollowingUser, setIsFollowingUser] = useState(true);
    const [isNavMode, setIsNavMode] = useState(false); // Map rotates with compass
    const [reroutePath, setReroutePath] = useState([]); // Temporary guidance line

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
    const hasAlertedCompletion = useRef(false); // To prevent completion alert spam

    const {
        location: validatedLocation,
        smoothedLocation,
        gpsAccuracy,
        accuracyStatus,
        error: locationError
    } = useSmartLocation(isTracking || isTrailingBack || (!hasStarted && role === 'leader'));

    const userHeading = useCompass(isNavMode || isTrailingBack);

    // React to smart location updates
    useEffect(() => {
        if (!smoothedLocation) return;

        const { latitude, longitude } = smoothedLocation;
        const currentLoc = { latitude, longitude };

        // Update current location state for UI (using smoothed coordinates for map)
        
        let displayLoc = currentLoc;

        // Logic for Navigation (Trailing Back or Following Uploaded Trail)
        const activeTarget = isTrailingBack ? [...routeCoordinates].reverse() : targetRoute;

        if (activeTarget.length > 2) {
            // Advanced Drift Detection using point-to-segment algorithm
            const { distance, snappedPoint, segmentIndex } = getPointToPathDistance(currentLoc, activeTarget);
            setDistanceToTrail(Math.round(distance));

            // Trail Snapping Logic - Visually pull user closer to trail if following it
            if (hasJoinedTrail && !offTrackWarning && distance > 1 && distance < 10) {
                // Snap 50% towards the nearest point on the path
                displayLoc = {
                    latitude: currentLoc.latitude + (snappedPoint.latitude - currentLoc.latitude) * 0.5,
                    longitude: currentLoc.longitude + (snappedPoint.longitude - currentLoc.longitude) * 0.5
                };
            }

            // TREK BACK COMPLETION LOGIC
            if (isTrailingBack && !hasAlertedCompletion.current) {
                const originalStartPoint = activeTarget[activeTarget.length - 1]; // Last point of reversed route = original start
                if (originalStartPoint) {
                    const distanceToStart = getDistance(currentLoc.latitude, currentLoc.longitude, originalStartPoint.latitude, originalStartPoint.longitude);
                    if (distanceToStart <= 10) {
                        hasAlertedCompletion.current = true;
                        Alert.alert("Trek Completed", "You have reached the starting point of the trail.");
                        setIsTrailingBack(false);
                        setReroutePath([]);
                        return; // Stop further nav processing
                    }
                }
            }

            if (!hasJoinedTrail) {
                // TRAIL JOINING LOGIC
                if (distance > 10) {
                    setReroutePath([currentLoc, snappedPoint]);
                    setNavGuidance("Head to nearest trail point");
                    setOffTrackWarning(false);
                } else {
                    setHasJoinedTrail(true);
                    setReroutePath([]);
                    setNavGuidance("On Track");
                    Alert.alert("Trail Joined", "You are now on the trail.");
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } else {
                // TRAIL FOLLOWING MODE & OFF-TRAIL RECOVERY
                if (offTrackWarning) {
                    // We are currently off track, require getting within 5 meters to recover
                    if (distance <= 5) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setOffTrackWarning(false);
                        setReroutePath([]);
                        setNavGuidance("On Track");
                    } else {
                        // Still off track, keep rerouting to nearest point
                        setReroutePath([currentLoc, snappedPoint]);
                        setNavGuidance("Return to Path");
                    }
                } else {
                    // We are on track, trigger warning if drifting > 10m
                    if (distance > 10) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        setOffTrackWarning(true);
                        setReroutePath([currentLoc, snappedPoint]);
                        setNavGuidance("Return to Path");
                    } else {
                        setReroutePath([]);
                        setNavGuidance("On Track");
                    }
                }
            }

            // Calculate bearing to next point in trail
            if (segmentIndex >= 0) {
                const targetPoint = activeTarget[segmentIndex + 1] || activeTarget[segmentIndex];
                if (targetPoint) {
                    const bearing = calculateHeading(currentLoc, targetPoint);
                    setTargetBearing(bearing);
                }
            }

            // Record backtrack progress if trailing back
            if (isTrailingBack && segmentIndex >= 0) {
                setCurrentTrekBackIndex(segmentIndex);
            }
        }

        setLocation(displayLoc);

        // Animate Camera (Moved tracking logic after displayLoc calculation so we frame the snapped point)
        if (mapRef.current && isFollowingUser) {
            mapRef.current.animateToRegion({
                latitude: displayLoc.latitude,
                longitude: displayLoc.longitude,
                latitudeDelta: 0.001,
                longitudeDelta: 0.001,
            }, 500);
            
            if (isNavMode) {
                mapRef.current.animateCamera({ heading: userHeading }, { duration: 500 });
            }
        }
    }, [smoothedLocation, isFollowingUser, isTrailingBack, routeCoordinates, targetRoute, isNavMode, userHeading, hasJoinedTrail, offTrackWarning, trailFinished]);

    // React to validated location updates for RECORDING
    useEffect(() => {
        if (!isTracking || !validatedLocation || trailFinished || isPaused || role !== 'leader' || isTrailingBack) return;

        const { latitude, longitude, altitude } = validatedLocation;
        const newPoint = { latitude, longitude };
        const path = routeRef.current;

        let dist = 0;
        if (path.length > 0) {
            const lastPoint = path[path.length - 1];
            dist = getDistance(latitude, longitude, lastPoint.latitude, lastPoint.longitude);
        }

        // Threshold 3m already enforced by hook, but we double check here if needed
        setRouteCoordinates(prev => {
            const updated = [...prev, newPoint];
            routeRef.current = updated;
            return updated;
        });

        setStats(prev => {
            const newDistance = prev.distance + dist;
            const updatedStats = {
                ...prev,
                distance: newDistance,
                maxAltitude: (prev.maxAltitude === -Infinity) ? altitude : Math.max(prev.maxAltitude, altitude),
                avgSpeed: prev.duration > 0 ? parseFloat(((newDistance / 1000) / (prev.duration / 3600)).toFixed(1)) : 0
            };

            if (trailIdRef.current) {
                client.put(`/treks/update/${trailIdRef.current}`, {
                    coordinates: [{ latitude, longitude, altitude }],
                    stats: updatedStats
                }).catch(console.error);
            }
            return updatedStats;
        });

    }, [validatedLocation, trailFinished, isPaused, role, isTrailingBack]);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }

            // Removed stale getCurrentPositionAsync to avoid jumping from inaccurate initial fix.
            // Map will center once useSmartLocation provides a high-accuracy point.

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
                        setTargetRoute(mappedRoute);
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

                // AUTOMATIC START POINT - Using high accuracy validated location
                const startPoint = validatedLocation || location;
                if (startPoint) {
                    try {
                        await client.put(`/treks/update/${newId}`, {
                            waypoints: [{
                                latitude: startPoint.latitude,
                                longitude: startPoint.longitude,
                                title: "Start Point",
                                description: "Trek started here",
                                icon: "play-circle"
                            }]
                        });
                        console.log("[ActiveTrek] Automatic Start point marked using accurate location");
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
        hasAlertedCompletion.current = false;
        setHasJoinedTrail(false);
        setCurrentTrekBackIndex(0);

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

    // Calculate faded and visible paths for trek-back
    const { visibleRoute, fadedRoute } = useMemo(() => {
        if (!isTrailingBack || routeCoordinates.length === 0) {
            return { visibleRoute: routeCoordinates, fadedRoute: [] };
        }
        
        const reversedRoute = [...routeCoordinates].reverse();
        // The user starts at index 0 of reversedRoute and moves forward
        const safeIndex = Math.max(0, Math.min(currentTrekBackIndex, reversedRoute.length - 1));
        
        // fadedRoute is the path already traversed (from start of trek-back to current position)
        const faded = reversedRoute.slice(0, safeIndex + 1);
        
        // visibleRoute is the path yet to be traversed (from current position to end)
        const visible = reversedRoute.slice(safeIndex);
        
        return { visibleRoute: visible, fadedRoute: faded };
    }, [isTrailingBack, routeCoordinates, currentTrekBackIndex]);

    return (
        <View style={styles.container}>
            {location ? (
                <View style={styles.mapContainer}>
                    <NativeMap
                        ref={mapRef}
                        initialRegion={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                            latitudeDelta: 0.001, // Tighter default zoom for trail navigation
                            longitudeDelta: 0.001,
                        }}
                        mapType={mapType}
                        heading={isNavMode ? userHeading : 0}
                        userHeading={userHeading}
                        showsUserLocation={true}
                        followsUserLocation={false}
                        pitchEnabled={true}
                        scrollEnabled={true}
                        zoomEnabled={true}
                        onPanDrag={() => setIsFollowingUser(false)}
                        onRegionChangeComplete={(region, gesture) => {
                            if (gesture && gesture.isGesture) {
                                setIsFollowingUser(false);
                            }
                        }}
                    >
                        {!isTrailingBack && routeCoordinates.length > 0 && (
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
                        {isTrailingBack && visibleRoute.length > 0 && (
                            <Polyline
                                coordinates={visibleRoute}
                                strokeWidth={6}
                                strokeColor="#fc4c02"
                                lineCap="round"
                                lineJoin="round"
                                geodesic={true}
                                zIndex={100}
                            />
                        )}
                        {isTrailingBack && fadedRoute.length > 0 && (
                            <Polyline
                                coordinates={fadedRoute}
                                strokeWidth={6}
                                strokeColor="rgba(252, 76, 2, 0.3)" // Faded Strava Orange
                                lineCap="round"
                                lineJoin="round"
                                geodesic={true}
                                zIndex={99}
                            />
                        )}
                        {
                            reroutePath.length > 0 && (
                                <Polyline
                                    coordinates={reroutePath}
                                    strokeWidth={4}
                                    strokeColor="#dc3545" // Red for reroute
                                    lineDashPattern={[10, 10]} // Dashed line for guidance
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
                        <View style={[styles.accuracyBadge, { marginTop: 10, borderColor: locationError ? '#dc3545' : '#ccc', borderWidth: locationError ? 1 : 0 }]}>
                            <View style={[styles.accuracyDot, { backgroundColor: locationError ? '#dc3545' : accuracyStatus === 'high' ? '#28a745' : accuracyStatus === 'medium' ? '#ffc107' : accuracyStatus === 'locating' ? '#666' : '#dc3545' }]} />
                            <Text style={[styles.accuracyText, { color: locationError ? '#dc3545' : '#333' }]}>{locationError ? 'Error' : (gpsAccuracy ? Math.round(gpsAccuracy) : '--') + 'm'}</Text>
                        </View>
                    </View>
                </View>
            ) : (
                <View style={styles.centered}>
                    <Text>Initializing Trail...</Text>
                </View>
            )}

            {!isFollowingUser && location && (
                <TouchableOpacity 
                    style={styles.recenterBtn} 
                    onPress={() => setIsFollowingUser(true)}
                >
                    <Ionicons name="locate" size={24} color="#007bff" />
                </TouchableOpacity>
            )}

            {/* Navigation Guidance Banner */}
            {(isTrailingBack || targetRoute.length > 0) && (
                <View style={[styles.navBanner, offTrackWarning && styles.navBannerAlert, !hasJoinedTrail && distanceToTrail > 10 && {backgroundColor: '#17a2b8'}]}>
                    <View style={styles.navIconContainer}>
                        <Ionicons
                            name={offTrackWarning ? "warning" : "navigate-circle"}
                            size={32}
                            color="white"
                        />
                    </View>
                    <View style={styles.navTextContainer}>
                        <Text style={styles.navDistance}>{distanceToTrail}m <Text style={styles.navUnit}>to {hasJoinedTrail ? 'trail' : 'nearest point'}</Text></Text>
                        <Text style={styles.navStatus}>{navGuidance}</Text>
                    </View>
                    {isTrailingBack && (
                        <TouchableOpacity
                            style={styles.navClose}
                            onPress={() => setIsTrailingBack(false)}
                        >
                            <Ionicons name="close-circle" size={24} color="white" />
                        </TouchableOpacity>
                    )}
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

                        <TouchableOpacity
                            style={[styles.mapIconButton, isNavMode && styles.mapIconButtonActive]}
                            onPress={() => setIsNavMode(!isNavMode)}
                        >
                            <Ionicons
                                name={isNavMode ? "compass" : "compass-outline"}
                                size={28}
                                color={isNavMode ? "white" : "#28a745"}
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
                                !hasStarted ? (
                                    <TouchableOpacity 
                                        style={[styles.startBigBtn, { width: '100%', flexDirection: 'row', justifyContent: 'center' }]} 
                                        onPress={startTrail}
                                        disabled={!gpsAccuracy || gpsAccuracy > 30}
                                    >
                                        <Ionicons name="play" size={24} color="white" style={{ marginRight: 10 }} />
                                        <Text style={styles.startBigBtnText}>
                                            {(!gpsAccuracy || gpsAccuracy > 30) ? 'Waiting for GPS Lock...' : 'Start Trek'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity style={[styles.button, styles.pauseBtn]} onPress={togglePause}>
                                            <Ionicons name={isPaused ? "play" : "pause"} size={32} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.button, styles.stopBtn]} onPress={handleStopTrail}>
                                            <Ionicons name="stop" size={32} color="white" />
                                        </TouchableOpacity>
                                    </>
                                )
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
    mapIconButtonActive: {
        backgroundColor: '#28a745',
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
    disabledBtn: {
        backgroundColor: '#ccc',
        elevation: 0,
    },
    startBigBtnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    lockStatusContainer: {
        marginVertical: 20,
        alignItems: 'center',
    },
    accuracyIndicator: {
        borderWidth: 2,
        borderRadius: 50,
        paddingHorizontal: 20,
        paddingVertical: 10,
        alignItems: 'center',
        minWidth: 120,
    },
    accuracyValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    accuracyLabel: {
        fontSize: 10,
        color: '#888',
        textTransform: 'uppercase',
    },
    lockInfo: {
        marginTop: 10,
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    accuracyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        elevation: 3,
        alignSelf: 'flex-end',
    },
    accuracyDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    accuracyText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
    },
    waitingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    waitingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 14,
        fontStyle: 'italic',
    },
    navBanner: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: '#007bff',
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        zIndex: 1001,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    navBannerAlert: {
        backgroundColor: '#dc3545',
    },
    navIconContainer: {
        marginRight: 15,
    },
    navTextContainer: {
        flex: 1,
    },
    navDistance: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    navUnit: {
        fontSize: 12,
        fontWeight: 'normal',
        opacity: 0.8,
    },
    navStatus: {
        color: 'white',
        fontSize: 14,
        opacity: 0.9,
    },
    navClose: {
        padding: 5,
    },
    recenterBtn: {
        position: 'absolute',
        bottom: 270,
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        zIndex: 50,
    },
});
