import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, FlatList, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NativeMap, { Polyline, Marker } from '../../components/NativeMap';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import WeatherWidget from '../../components/WeatherWidget';
import { useSmartLocation } from '../../hooks/useSmartLocation';
import { useCompass } from '../../hooks/useCompass';
import { getDistance, getPointToPathDistance, calculateHeading, detectIntersectionLoop } from '../../utils/geoUtils';
import { useGroupSync } from '../../hooks/useGroupSync';

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

export default function GroupTrek() {
    const router = useRouter();
    const params = useLocalSearchParams();
    useKeepAwake(); 
    const { name, description, location: initialLocation, trailId: paramTrailId, uploadedTrailId, role, leaderId } = params;

    const [location, setLocation] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [trailFinished, setTrailFinished] = useState(false); 
    const [isTrailingBack, setIsTrailingBack] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [hasJoinedTrail, setHasJoinedTrail] = useState(!uploadedTrailId);
    const [hasReachedMidpoint, setHasReachedMidpoint] = useState(false);

    const [stats, setStats] = useState({
        distance: 0,
        duration: 0,
        elevationGain: 0,
        avgSpeed: 0,
        maxAltitude: -Infinity
    });
    
    // Session ID
    const [trailId, setTrailId] = useState(String(paramTrailId));
    const [pathSegments, setPathSegments] = useState([[]]); 
    const [routeCoordinates, setRouteCoordinates] = useState([]); 
    const routeRef = useRef([]);
    const [targetRoute, setTargetRoute] = useState([]); 
    const [navigationPolyline, setNavigationPolyline] = useState([]); 
    const resumedFromPauseRef = useRef(false);
    const [currentNavIndex, setCurrentNavIndex] = useState(0);
    const [isReusingTrail, setIsReusingTrail] = useState(!!uploadedTrailId);
    const [markers, setMarkers] = useState([]); 
    const [baseWaypoints, setBaseWaypoints] = useState([]); 
    const [distanceToTrail, setDistanceToTrail] = useState(9999);
    const [offTrackWarning, setOffTrackWarning] = useState(false);
    const [navGuidance, setNavGuidance] = useState(role === 'leader' ? "Waiting to start..." : "Waiting for leader...");
    const [targetBearing, setTargetBearing] = useState(0);
    const [mapType, setMapType] = useState('standard'); 
    const [mapViewMode, setMapViewMode] = useState('top-down'); 
    const [isNavMode, setIsNavMode] = useState(false); 
    const [reroutePath, setReroutePath] = useState([]); 
    const [flowState, setFlowState] = useState('idle'); 

    // Modal State
    const [showMarkerModal, setShowMarkerModal] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(null);
    const [waypointDescription, setWaypointDescription] = useState('');
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [waypointImages, setWaypointImages] = useState([]);
    const [selectedPinDetails, setSelectedPinDetails] = useState(null);
    const [mapZoomLevel, setMapZoomLevel] = useState(18);

    const trailIdRef = useRef(trailId);
    const pathSegmentsRef = useRef([[]]);
    const hasAlertedOffTrack = useRef(false);
    const hasAlertedCompletion = useRef(false);
    const lastStatsPointRef = useRef(null);

    const { user: currentUser } = useAuth();
    const mapRef = useRef(null);

    const {
        location: validatedLocation,
        smoothedLocation,
        gpsAccuracy,
        accuracyStatus,
        error: locationError
    } = useSmartLocation(isTracking || isTrailingBack || !hasStarted);

    const userHeading = useCompass(!trailFinished); 

    // GROUP SYNC HOOK
    const { participants, emitLocation, emitControl, emitWaypoint, emitPathReplaced, emitDrift } = useGroupSync({
        trailId,
        currentUser,
        role,
        leaderId,
        baseUrl: client.defaults.baseURL,
        onControlAction: (action) => {
            if (action === 'START') {
                setHasStarted(true);
                setIsTracking(true);
                setHasJoinedTrail(true);
                setNavGuidance("Trek started by leader.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            if (action === 'TREKBACK') {
                handleTrailBack(true);
            }
            if (action === 'PAUSE') setIsPaused(true);
            if (action === 'RESUME') setIsPaused(false);
            if (action === 'STOP') {
                setTrailFinished(true);
                setIsTracking(false);
                setNavGuidance("Trek finished by leader.");
            }
        },
        onWaypointReceived: (waypoint) => {
            setMarkers(prev => [...prev, waypoint]);
        },
        onPathReceived: (path, newPoint) => {
            setPathSegments(path);
            pathSegmentsRef.current = path;
            if (newPoint) {
                setRouteCoordinates(prev => [...prev, newPoint]);
                routeRef.current = [...routeRef.current, newPoint];
            } else {
                const flat = path.flat();
                setRouteCoordinates(flat);
                routeRef.current = flat;
            }
        },
        onDriftAlert: ({ username, isOffTrail }) => {
            setNavGuidance(isOffTrail ? `${username} is off trail!` : "Group back on track.");
            if (isOffTrail) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
    });

    // React to smart location updates
    useEffect(() => {
        if (!smoothedLocation) return;
        const currentLoc = { latitude: smoothedLocation.latitude, longitude: smoothedLocation.longitude };
        
        // Sync location to group
        if (isTracking && !isPaused && !trailFinished) {
            emitLocation(currentLoc, offTrackWarning, distanceToTrail);
        }

        let displayLoc = currentLoc;

        // 1. PRE-PROCESS NAVIGATION
        let distance = Infinity;
        let snappedPoint = null;
        let segmentIndex = -1;

        if (navigationPolyline.length >= 2) {
            const result = getPointToPathDistance(currentLoc, navigationPolyline, hasJoinedTrail ? currentNavIndex : -1, hasJoinedTrail ? 30 : -1);
            distance = result.distance;
            snappedPoint = result.snappedPoint;
            segmentIndex = result.segmentIndex;
            setDistanceToTrail(Math.round(distance));

            if (segmentIndex >= 0) {
                setCurrentNavIndex(segmentIndex);
                if (segmentIndex > navigationPolyline.length * 0.5) setHasReachedMidpoint(true);
            }

            if (hasJoinedTrail && !offTrackWarning && distance > 2 && distance < 12) {
                displayLoc = {
                    latitude: currentLoc.latitude + (snappedPoint.latitude - currentLoc.latitude) * 0.5,
                    longitude: currentLoc.longitude + (snappedPoint.longitude - currentLoc.longitude) * 0.5
                };
            }
        }

        setLocation(displayLoc);

        // 2. NAVIGATION LOGIC
        if (navigationPolyline.length >= 2) {
            if (!hasJoinedTrail && (isReusingTrail || isTrailingBack)) {
                const startPoint = navigationPolyline[0];
                const distToStart = getDistance(currentLoc.latitude, currentLoc.longitude, startPoint.latitude, startPoint.longitude);
                if (distToStart <= 15) {
                    setNavGuidance("At starting point.");
                    setReroutePath([]);
                } else if (flowState === 'goto-start' && role === 'leader') {
                    if (reroutePath.length === 0 && distToStart > 50) fetchRoadRoute(currentLoc, startPoint);
                    setNavGuidance(`Go to start (${Math.round(distToStart)}m)`);
                }
                setDistanceToTrail(Math.round(distToStart));
            } else if (hasJoinedTrail) {
                if (distance > 15) {
                    if (!offTrackWarning) {
                        setOffTrackWarning(true);
                        setNavGuidance("Off trail!");
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        emitDrift(true);
                    }
                    setReroutePath([currentLoc, snappedPoint]);
                } else if (offTrackWarning && distance <= 10) {
                    setOffTrackWarning(false);
                    setNavGuidance("On track.");
                    setReroutePath([]);
                    emitDrift(false);
                }

                if (!trailFinished && navigationPolyline.length > 0) {
                    const finalPoint = navigationPolyline[navigationPolyline.length - 1];
                    const distToGoal = getDistance(currentLoc.latitude, currentLoc.longitude, finalPoint.latitude, finalPoint.longitude);
                    if (distToGoal < 10 && hasReachedMidpoint && !hasAlertedCompletion.current) {
                        hasAlertedCompletion.current = true;
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        if (role === 'leader') setNavGuidance("You have reached your destination.");
                    }
                }
            }
        }

        // 3. MAP CAMERA UPDATES
        if (mapRef.current && mapViewMode !== 'explore') {
            mapRef.current.animateCamera({
                center: displayLoc,
                pitch: mapViewMode === 'navigation' ? 45 : 0, 
                heading: mapViewMode === 'navigation' ? userHeading : 0,
                altitude: 500,
                zoom: 18
            }, { duration: 1000 });
        }
    }, [smoothedLocation, isTrailingBack, navigationPolyline, userHeading, hasJoinedTrail, offTrackWarning, trailFinished, mapViewMode]);


    useEffect(() => {
        if ((!isTracking && !isTrailingBack) || !validatedLocation || trailFinished || isPaused || role !== 'leader') return;

        const { latitude, longitude, altitude } = validatedLocation;
        const newPoint = { latitude, longitude };
        
        // Stats Calculation
        let distMeters = 0;
        if (lastStatsPointRef.current) distMeters = getDistance(latitude, longitude, lastStatsPointRef.current.latitude, lastStatsPointRef.current.longitude);
        setStats(prev => ({
            ...prev,
            distance: prev.distance + distMeters,
            elevationGain: prev.elevationGain + (lastStatsPointRef.current && altitude > lastStatsPointRef.current.altitude ? altitude - lastStatsPointRef.current.altitude : 0),
            maxAltitude: Math.max(prev.maxAltitude, altitude || 0),
            avgSpeed: prev.duration > 0 ? parseFloat((( (prev.distance + distMeters)/ 1000) / (prev.duration / 3600)).toFixed(1)) : 0
        }));
        lastStatsPointRef.current = { latitude, longitude, altitude };

        if (!isTrailingBack) {
            setRouteCoordinates(prev => {
                const updated = [...prev, newPoint];
                routeRef.current = updated;
                return updated;
            });

            if (isTracking && !isPaused && !trailFinished && role === 'leader') {
                emitPointShared(newPoint, resumedFromPauseRef.current);
            }

            setPathSegments(prev => {
                let updated = [...prev];
                let targetIdx = updated.length - 1;

                if (resumedFromPauseRef.current) {
                    updated.push([newPoint]);
                    targetIdx++;
                    resumedFromPauseRef.current = false;
                } else {
                    if (updated.length === 0) updated.push([]);
                    targetIdx = updated.length - 1;
                    
                    const fullPath = updated.flat();
                    const loopData = detectIntersectionLoop(newPoint, fullPath, fullPath.length);
                    if (loopData && loopData.isLoop) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert("Loop Removed", "Redundant trail loop removed.");
                        
                        let count = 0;
                        const pruned = [];
                        for (const seg of updated) {
                            if (count + seg.length > loopData.loopStartIndex) {
                                pruned.push(seg.slice(0, loopData.loopStartIndex - count + 1));
                                break;
                            }
                            pruned.push(seg);
                            count += seg.length;
                        }
                        updated = pruned;
                        targetIdx = updated.length - 1;
                        emitPathReplaced(updated);
                    }
                    updated[targetIdx] = [...updated[targetIdx], newPoint];
                }
                pathSegmentsRef.current = updated;
                return updated;
            });

            // Incremental sync
            client.put(`/treks/update/${trailId}`, { coordinates: [newPoint], isNewSegment: resumedFromPauseRef.current });
        }
    }, [isTracking, validatedLocation, isPaused, trailFinished, isTrailingBack]);


    useEffect(() => {
        (async () => {
            if (uploadedTrailId) {
                const res = await client.get(`/treks/${uploadedTrailId}`);
                if (res.data && res.data.path) {
                    const mapped = res.data.path.coordinates.flat().map(p => ({ latitude: p[1], longitude: p[0] }));
                    setTargetRoute(mapped);
                    setNavigationPolyline(mapped);
                    if (res.data.waypoints) setBaseWaypoints(res.data.waypoints);
                }
            } else if (trailId) {
                const res = await client.get(`/treks/${trailId}`);
                if (res.data.path) {
                    const mapped = res.data.path.coordinates.map(seg => seg.map(p => ({ latitude: p[1], longitude: p[0] })));
                    setPathSegments(mapped);
                    setRouteCoordinates(mapped.flat());
                    pathSegmentsRef.current = mapped;
                }
                if (res.data.waypoints) setMarkers(res.data.waypoints);
            }
        })();
    }, []);

    useEffect(() => {
        let timer = null;
        if (isTracking && !isPaused && !trailFinished) {
            timer = setInterval(() => setStats(prev => ({ ...prev, duration: prev.duration + 1 })), 1000);
        }
        return () => timer && clearInterval(timer);
    }, [isTracking, isPaused, trailFinished]);

    const fetchRoadRoute = async (start, end) => {
        try {
            const url = `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                setReroutePath(data.routes[0].geometry.coordinates.map(p => ({ latitude: p[1], longitude: p[0] })));
                return true;
            }
        } catch (e) {}
        return false;
    };

    const startTrail = async () => {
        if (role !== 'leader') return;
        setIsTracking(true);
        setHasStarted(true);
        setHasJoinedTrail(true);
        emitControl('START');
        setNavGuidance("Trek started.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        const startLoc = validatedLocation || location;
        if (startLoc) {
            const startMarker = { latitude: startLoc.latitude, longitude: startLoc.longitude, icon: 'flag', type: 'Start Point', timestamp: new Date() };
            setMarkers([startMarker]);
            emitWaypoint(startMarker);
        }
    };

    const handleStopTrail = () => {
        if (role !== 'leader') return;
        Alert.alert("Finish Trek?", "End session for all participants?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Yes, Finish",
                onPress: async () => {
                    setTrailFinished(true);
                    setIsTracking(false);
                    emitControl('STOP');
                    await client.put(`/treks/update/${trailId}`, { status: 'completed', stats });
                }
            }
        ]);
    };

    const handleTrailBack = (remote = false) => {
        if (!remote && role !== 'leader') return;
        const sourcePath = navigationPolyline.length > 0 ? navigationPolyline : pathSegments.flat();
        if (sourcePath.length < 2) return;
        const reversed = [...sourcePath].reverse();
        setIsTrailingBack(true);
        setNavigationPolyline(reversed);
        setCurrentNavIndex(0);
        setTrailFinished(false);
        setIsTracking(true);
        setHasStarted(true);
        if (!remote) emitControl('TREKBACK');
    };

    const handleExit = () => router.replace('/(tabs)/trek');

    const togglePause = () => {
        if (role !== 'leader') return;
        const newState = !isPaused;
        setIsPaused(newState);
        emitControl(newState ? 'PAUSE' : 'RESUME');
        if (!newState) resumedFromPauseRef.current = true;
    };

    const toggleMapType = () => {
        const types = ['standard', 'satellite', 'hybrid'];
        setMapType(types[(types.indexOf(mapType) + 1) % types.length]);
    };

    const getPolylineWidth = (zoom) => zoom >= 18 ? 8 : zoom >= 16 ? 6 : zoom >= 14 ? 4 : 3;

    const addMarker = async () => {
        if (!location || !selectedIcon) return;
        const m = { latitude: location.latitude, longitude: location.longitude, icon: selectedIcon.name, type: selectedIcon.label, description: waypointDescription.trim(), images: waypointImages, timestamp: new Date() };
        setMarkers(prev => [...prev, m]);
        emitWaypoint(m);
        setShowMarkerModal(false);
        setSelectedIcon(null);
        setWaypointImages([]);
        await client.put(`/treks/update/${trailId}`, { waypoints: [m] });
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const { visibleRoute, fadedRoute } = useMemo(() => {
        const source = navigationPolyline.length > 0 ? navigationPolyline : routeCoordinates;
        if (source.length === 0) return { visibleRoute: [], fadedRoute: [] };
        const idx = Math.max(0, Math.min(currentNavIndex, source.length - 1));
        return { fadedRoute: source.slice(0, idx + 1), visibleRoute: source.slice(idx) };
    }, [navigationPolyline, routeCoordinates, currentNavIndex]);

    return (
        <View style={styles.container}>
            {location ? (
                <View style={styles.mapContainer}>
                    <NativeMap
                        ref={mapRef}
                        initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.001, longitudeDelta: 0.001 }}
                        mapType={mapType}
                        heading={isNavMode ? userHeading : 0}
                        userHeading={userHeading}
                        onPanDrag={() => setMapViewMode('explore')}
                    >
                        {!isTrailingBack && pathSegments.map((segment, idx) => (
                            <Polyline key={`seg-${idx}`} coordinates={segment} strokeWidth={getPolylineWidth(mapZoomLevel)} strokeColor="#fc4c02" lineCap="round" lineJoin="round" geodesic zIndex={110} />
                        ))}
                        {(isTrailingBack || isReusingTrail) && visibleRoute.length > 0 && (
                            <Polyline coordinates={visibleRoute} strokeWidth={getPolylineWidth(mapZoomLevel)} strokeColor={isReusingTrail ? "#007AFF" : "#fc4c02"} lineCap="round" lineJoin="round" geodesic zIndex={100} />
                        )}
                        {(isTrailingBack || isReusingTrail) && fadedRoute.length > 0 && (
                            <Polyline coordinates={fadedRoute} strokeWidth={getPolylineWidth(mapZoomLevel)} strokeColor={isReusingTrail ? "rgba(0,122,255,0.3)" : "rgba(252,76,2,0.3)"} lineCap="round" lineJoin="round" geodesic zIndex={99} />
                        )}
                        {reroutePath.length > 0 && <Polyline coordinates={reroutePath} strokeWidth={4} strokeColor="#dc3545" lineDashPattern={[10, 10]} geodesic />}

                        {(smoothedLocation || location) && (
                            <Marker
                                coordinate={smoothedLocation || location}
                                anchor={{ x: 0.5, y: 0.5 }}
                                rotation={userHeading}
                                flat={true}
                                zIndex={999}
                            >
                                <View style={styles.userMarkerContainer}>
                                    <View style={[styles.userMarkerPulse, { transform: [{ scale: 1.2 }] }]} />
                                    <View style={[styles.userMarkerPulse, { transform: [{ scale: 1.5 }], opacity: 0.2 }]} />
                                    
                                    <View style={[styles.userMarkerContainerInner, { transform: [{ rotate: `${userHeading || 0}deg` }] }]}>
                                        <View style={styles.userMarkerDot} />
                                        <Ionicons name="caret-up" size={24} color="#007bff" style={styles.userMarkerArrow} />
                                    </View>
                                </View>
                            </Marker>
                        )}
                        
                        {Object.entries(participants).map(([uid, p]) => (
                            <Marker key={`p-${uid}`} coordinate={p.location} title={p.username} zIndex={100}>
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{ backgroundColor: p.isOffTrail ? '#dc3545' : '#28a745', padding: 2, borderRadius: 10, paddingHorizontal: 6, marginBottom: 2 }}>
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{p.username}</Text>
                                    </View>
                                    <Ionicons name="person" size={20} color={p.isOffTrail ? '#dc3545' : '#28a745'} />
                                </View>
                            </Marker>
                        ))}

                        {baseWaypoints.map((m, i) => <Marker key={`b-${i}`} coordinate={m} pinColor="indigo" />)}
                        {markers.map((m, i) => <Marker key={i} coordinate={m} pinColor={MARKER_ICONS.find(ic => ic.name === m.icon)?.color || 'red'} />)}
                    </NativeMap >

                    {offTrackWarning && (
                        <View style={styles.warningBanner}>
                            <Ionicons name="warning" size={24} color="white" />
                            <Text style={styles.warningTitle}> OFF TRAIL! ({distanceToTrail}m)</Text>
                        </View>
                    )}

                    <View style={styles.weatherOverlay}>
                        <WeatherWidget compact />
                        <View style={styles.accuracyBadge}><View style={[styles.accuracyDot, { backgroundColor: accuracyStatus === 'high' ? '#28a745' : '#ffc107' }]} /><Text style={styles.accuracyText}>{gpsAccuracy ? Math.round(gpsAccuracy) : '--'}m</Text></View>
                    </View>
                </View>
            ) : <View style={styles.centered}><ActivityIndicator size="large" color="#28a745" /></View>}

            <View style={styles.controls}>
                {!trailFinished ? (
                    <View style={styles.statsCard}>
                        <View style={styles.statsMainRow}>
                            <View style={styles.statItem}><Text style={styles.statLabel}>Time</Text><Text style={styles.statValue}>{formatTime(stats.duration)}</Text></View>
                            <View style={styles.statItem}><Text style={styles.statLabel}>Dist</Text><Text style={styles.statValue}>{(stats.distance / 1000).toFixed(2)}km</Text></View>
                            <View style={styles.statItem}><Text style={styles.statLabel}>Group</Text><Text style={styles.statValue}>{Object.keys(participants).length + 1}</Text></View>
                        </View>
                        <View style={styles.row}>
                            {role === 'leader' ? (
                                !hasStarted ? (
                                    <TouchableOpacity style={styles.startBigBtn} onPress={startTrail}><Text style={styles.actionButtonText}>Start Group Trek</Text></TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity style={[styles.button, styles.pauseBtn]} onPress={togglePause}><Ionicons name={isPaused ? "play" : "pause"} size={32} color="white" /></TouchableOpacity>
                                        <TouchableOpacity style={[styles.button, styles.stopBtn]} onPress={handleStopTrail}><Ionicons name="stop" size={32} color="white" /></TouchableOpacity>
                                    </>
                                )
                            ) : (
                                <View style={[styles.statusBadge, { width: '100%', backgroundColor: isPaused ? '#ffc107' : '#28a745' }]}><Text style={{ color: 'white', fontWeight: 'bold' }}>{isPaused ? "PAUSED BY LEADER" : "FOLLOWING LEADER"}</Text></View>
                            )}
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.exitBtn} onPress={handleExit}><Text style={styles.actionButtonText}>Finished - Exit</Text></TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    mapContainer: { flex: 1 },
    weatherOverlay: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
    warningBanner: { position: 'absolute', top: 20, left: 20, right: 20, backgroundColor: '#dc3545', flexDirection: 'row', padding: 15, borderRadius: 12, zIndex: 100 },
    warningTitle: { color: 'white', fontWeight: 'bold' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    controls: { position: 'absolute', bottom: 30, left: 20, right: 20 },
    statsCard: { backgroundColor: 'white', padding: 15, borderRadius: 20, elevation: 5 },
    statsMainRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
    statItem: { alignItems: 'center' },
    statLabel: { fontSize: 12, color: '#888' },
    statValue: { fontSize: 20, fontWeight: 'bold' },
    row: { flexDirection: 'row', justifyContent: 'center' },
    button: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 },
    stopBtn: { backgroundColor: '#dc3545' },
    pauseBtn: { backgroundColor: '#ffc107' },
    startBigBtn: { backgroundColor: '#28a745', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center' },
    exitBtn: { backgroundColor: '#28a745', padding: 15, borderRadius: 12, alignItems: 'center' },
    actionButtonText: { color: 'white', fontWeight: 'bold' },
    accuracyBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    accuracyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
    accuracyText: { fontSize: 12, fontWeight: 'bold' },
    userMarkerContainer: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60 },
    userMarkerPulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,123,255,0.4)' },
    userMarkerContainerInner: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    userMarkerDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#007bff', borderWidth: 3, borderColor: 'white' },
    userMarkerArrow: { position: 'absolute', top: -6 }
});
