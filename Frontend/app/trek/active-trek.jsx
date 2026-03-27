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
import io from 'socket.io-client';

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
    const { name, description, location: initialLocation, mode, trailId: paramTrailId, role: paramRole, leaderId, uploadedTrailId } = params;
    const role = (paramRole || 'leader').toLowerCase();

    const [location, setLocation] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [trailFinished, setTrailFinished] = useState(false); 
    const [isTrailingBack, setIsTrailingBack] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [hasJoinedTrail, setHasJoinedTrail] = useState(!uploadedTrailId && !paramTrailId);
    const [hasReachedMidpoint, setHasReachedMidpoint] = useState(false);

    const [stats, setStats] = useState({
        distance: 0,
        duration: 0,
        elevationGain: 0,
        avgSpeed: 0,
        maxAltitude: -Infinity
    });
    
    // Session ID
    const [trailId, setTrailId] = useState(paramTrailId && paramTrailId !== uploadedTrailId ? paramTrailId : null);
    const [pathSegments, setPathSegments] = useState([[]]); 
    const [routeCoordinates, setRouteCoordinates] = useState([]); 
    const routeRef = useRef([]);
    const [targetRoute, setTargetRoute] = useState([]); 
    const [navigationPolyline, setNavigationPolyline] = useState([]); // Unified path for guidance
    const resumedFromPauseRef = useRef(false);
    const [currentNavIndex, setCurrentNavIndex] = useState(0);
    const [navDirection, setNavDirection] = useState('forward'); 
    const [isReusingTrail, setIsReusingTrail] = useState(!!uploadedTrailId || !!paramTrailId);
    const [markers, setMarkers] = useState([]); 
    const [baseWaypoints, setBaseWaypoints] = useState([]); 
    const [distanceToTrail, setDistanceToTrail] = useState(9999);
    const [offTrackWarning, setOffTrackWarning] = useState(false);
    const [navGuidance, setNavGuidance] = useState("Following Trail");
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
    const [waypointImages, setWaypointImages] = useState([]); // Array of local URIs
    const [selectedPinDetails, setSelectedPinDetails] = useState(null); // Used to render the Pin info modal
    const [mapZoomLevel, setMapZoomLevel] = useState(18);

    // Timer Ref
    const timerRef = useRef(null);
    const autoFollowTimerRef = useRef(null);
    const pausedRef = useRef(false);

    const mapRef = useRef(null);
    const trailIdRef = useRef(trailId);
    const pathSegmentsRef = useRef([[]]);
    const lastLocationRef = useRef(null); // For EMA smoothing filter
    const hasAlertedOffTrack = useRef(false); // To prevent alert spam
    const hasAlertedCompletion = useRef(false); // To prevent completion alert spam
    const lastStatsPointRef = useRef(null);     // For distance/stats tracking

    const socketRef = useRef(null);
    const [participants, setParticipants] = useState({}); // { userId: { location, username, isOffTrail, distanceToTrail } }
    const { user: currentUser } = useAuth();


    const {
        location: validatedLocation,
        smoothedLocation,
        gpsAccuracy,
        accuracyStatus,
        error: locationError
    } = useSmartLocation(isTracking || isTrailingBack || (!hasStarted && role === 'leader') || (role === 'member' && !!trailId));

    const userHeading = useCompass(!trailFinished); // Ensure compass runs anytime you're tracking or preparing to track

    // React to smart location updates
    useEffect(() => {
        if (!smoothedLocation) return;

        const { latitude, longitude } = smoothedLocation;
        const currentLoc = { latitude, longitude };

        // Update current location state for UI (using smoothed coordinates for map)
        
        let displayLoc = currentLoc;

        // Logic for Navigation (Unified Engine)
        // navigationPolyline is now a state variable initialized at start/trek-back
        const navigationDirection = 'forward'; // Engine always moves forward relative to its target polyline

        // 1. PRE-PROCESS NAVIGATION (DISTANCE & SNAPPING)
        let distance = Infinity;
        let snappedPoint = null;
        let segmentIndex = -1;

        if (navigationPolyline.length >= 2) {
            // GLOBAL SEARCH if not joined, WINDOWED SEARCH if already tracking progress
            const searchIndex = hasJoinedTrail ? currentNavIndex : -1;
            const searchWindow = hasJoinedTrail ? 30 : -1;

            const result = getPointToPathDistance(
                currentLoc, 
                navigationPolyline,
                searchIndex,
                searchWindow
            );
            distance = result.distance;
            snappedPoint = result.snappedPoint;
            segmentIndex = result.segmentIndex;
            setDistanceToTrail(Math.round(distance));

            // Map user index progress
            if (segmentIndex >= 0) {
                setCurrentNavIndex(segmentIndex);
                
                // MIDPOINT GUARD: Mark if user reached 50% progress
                if (navigationDirection === 'forward' && segmentIndex > navigationPolyline.length * 0.5) {
                    setHasReachedMidpoint(true);
                } else if (navigationDirection === 'backward' && segmentIndex < navigationPolyline.length * 0.5) {
                    setHasReachedMidpoint(true);
                }
            }

            // Trail Snapping Logic - Visually pull user closer to trail if following it
            if (hasJoinedTrail && !offTrackWarning && distance > 2 && distance < 12) {
                displayLoc = {
                    latitude: currentLoc.latitude + (snappedPoint.latitude - currentLoc.latitude) * 0.5,
                    longitude: currentLoc.longitude + (snappedPoint.longitude - currentLoc.longitude) * 0.5
                };
            }
        }

        // 2. UPDATE MAP STATE (ALWAYS RUNS)
        setLocation(displayLoc);

        // 3. NAVIGATION LOGIC (STRICT FLOW CONTROL)
        if (navigationPolyline.length >= 2) {
            // PHASE 1 & 2: REACHING THE START
            if (!hasJoinedTrail && (isReusingTrail || isTrailingBack)) {
                // In pre-trek phase, we ALWAYS target the START of the trail (not just any point)
                const startPoint = navigationPolyline[navigationDirection === 'forward' ? 0 : navigationPolyline.length - 1];
                const distanceToRealStart = getDistance(currentLoc.latitude, currentLoc.longitude, startPoint.latitude, startPoint.longitude);
                
                if (distanceToRealStart <= 15) {
                    // REACHED START
                    setNavGuidance("You have reached the starting point.");
                    setReroutePath([]);
                    if (flowState === 'goto-start') {
                         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                } else if (flowState === 'goto-start') {
                    // NAVIGATING TO START
                    if (reroutePath.length === 0 && distanceToRealStart > 50) {
                        fetchRoadRoute(currentLoc, startPoint);
                    }
                    setNavGuidance(`Navigate to the starting point (${Math.round(distanceToRealStart)}m).`);
                    const bearing = calculateHeading(currentLoc, startPoint);
                    setTargetBearing(bearing);
                } else {
                    // IDLE
                    setNavGuidance(`You are ${Math.round(distanceToRealStart)} meters away from the starting point.`);
                    setReroutePath([]); 
                }
                setDistanceToTrail(Math.round(distanceToRealStart)); // Update state for UI
                return; // No progress tracking until joined
            }

            // PHASE 3 & 4: TREKKING / TREKBACK
            if (hasJoinedTrail) {
                // DRIFT DETECTION
                if (distance > 15) {
                    if (!offTrackWarning) {
                        setOffTrackWarning(true);
                        setNavGuidance(`Off trail! Head back to the path.`);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                    setReroutePath([currentLoc, snappedPoint]);
                    const bearing = calculateHeading(currentLoc, snappedPoint);
                    setTargetBearing(bearing);
                } else if (offTrackWarning && distance <= 10) {
                    setOffTrackWarning(false);
                    setNavGuidance("Back on track.");
                    setReroutePath([]);
                }

                // SUB-PHASE: DESTINATION REACHED?
                if (!trailFinished && navigationPolyline.length > 0) {
                    const finalPoint = navigationPolyline[navigationPolyline.length - 1];
                    if (finalPoint) {
                        const distToGoal = getDistance(currentLoc.latitude, currentLoc.longitude, finalPoint.latitude, finalPoint.longitude);
                        
                        if (distToGoal < 10 && hasReachedMidpoint && !hasAlertedCompletion.current) {
                            hasAlertedCompletion.current = true;
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                            if (isTrailingBack) {
                                Alert.alert("Trek Completed", "You have reached the starting point of the trail.");
                                setIsTrailingBack(false);
                                setNavigationPolyline([]);
                                setFlowState('idle');
                                setNavGuidance("Trek Completed!");
                            } else {
                                setNavGuidance("You have reached your destination.");
                                setTrailFinished(true); 
                            }
                        }
                    }
                }

                // UPDATE BEARING TO NEXT POINT
                let targetIdx = navigationDirection === 'forward' ? segmentIndex + 1 : segmentIndex - 1;
                targetIdx = Math.max(0, Math.min(navigationPolyline.length - 1, targetIdx));
                const targetPoint = navigationPolyline[targetIdx];
                if (targetPoint) {
                    const bearing = calculateHeading(currentLoc, targetPoint);
                    setTargetBearing(bearing);
                }
            }
        }

        // 4. MAP CAMERA UPDATES (CENTRALIZED)
        if (mapRef.current && mapViewMode !== 'explore') {
            const cameraOptions = {
                center: displayLoc,
                pitch: mapViewMode === 'navigation' ? 45 : 0, // Tilt for 3D navigation look
                heading: mapViewMode === 'navigation' ? userHeading : 0,
                altitude: 500, // Zoom detail
                zoom: 18
            };
            
            // Smoother animations during walking
            mapRef.current.animateCamera(cameraOptions, { duration: 1000 });
        }

        // 5. GROUP TREK: REPORT LOCATION & DRIFT
        const isOffTrail = distance > 10;
        
        // Broadcast location to room (All Roles)
        if (mode === 'group' && socketRef.current) {
            socketRef.current.emit('participant-location-update', {
                trekId: trailId,
                userId: currentUser?._id,
                username: currentUser?.username,
                location: { latitude: currentLoc.latitude, longitude: currentLoc.longitude },
                isOffTrail,
                distanceToTrail: Math.round(distance)
            });
        }

        if (isOffTrail && !hasAlertedOffTrack.current) {
            hasAlertedOffTrack.current = true;
            if (role === 'member') {
                setNavGuidance("You have moved away from the trail");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            socketRef.current.emit('drift-notification', {
                trekId: trailId,
                userId: currentUser?._id,
                username: currentUser?.username,
                isOffTrail: true
            });
        } else if (!isOffTrail) {
            hasAlertedOffTrack.current = false;
        }
    }, [smoothedLocation, isTrailingBack, navigationPolyline, routeCoordinates, isNavMode, userHeading, hasJoinedTrail, offTrackWarning, trailFinished, mapViewMode, trailId]);


    useEffect(() => {
        // Allow stats tracking during trek-back even if isTracking is false
        if ((!isTracking && !isTrailingBack) || !validatedLocation || trailFinished || isPaused || role !== 'leader') return;

        const { latitude, longitude, altitude } = validatedLocation;
        const newPoint = { latitude, longitude };
        
        // 1. STATS CALCULATION
        let distMeters = 0;
        const lastPoint = lastStatsPointRef.current;
        if (lastPoint) {
            distMeters = getDistance(latitude, longitude, lastPoint.latitude, lastPoint.longitude);
        }

        setStats(prev => {
            const newDistance = prev.distance + distMeters;
            let elevationGain = prev.elevationGain;
            if (lastPoint && altitude && lastPoint.altitude && altitude > lastPoint.altitude) {
                elevationGain += (altitude - lastPoint.altitude);
            }
            return {
                ...prev,
                distance: newDistance,
                elevationGain: elevationGain,
                maxAltitude: (prev.maxAltitude === -Infinity) ? (altitude || 0) : Math.max(prev.maxAltitude, altitude || 0),
                avgSpeed: prev.duration > 0 ? parseFloat(((newDistance / 1000) / (prev.duration / 3600)).toFixed(1)) : 0
            };
        });
        
        lastStatsPointRef.current = { latitude, longitude, altitude };

        // 2. PATH STORAGE & SEGMENT MANAGEMENT (Skip if trekking back to prevent overlapping new points)
        if (!isTrailingBack) {
            setRouteCoordinates(prev => {
                const updated = [...prev, newPoint];
                routeRef.current = updated;
                return updated;
            });

            const segments = pathSegmentsRef.current;
            const lastSeg = segments[segments.length - 1];
            let isNewSegment = false;
            
            if (lastSeg && lastSeg.length > 0) {
                const lastPathPoint = lastSeg[lastSeg.length - 1];
                const distFromLastPath = getDistance(latitude, longitude, lastPathPoint.latitude, lastPathPoint.longitude);
                
                if (resumedFromPauseRef.current) {
                    if (distFromLastPath > 20) {
                        Alert.alert("Resumed Tracking", `You are ${Math.round(distFromLastPath)}m away from the previous trail point. Starting a new trail segment.`);
                        isNewSegment = true;
                    }
                    resumedFromPauseRef.current = false;
                }
            } else if (segments.length === 0 || (segments.length === 1 && segments[0].length === 0)) {
                 isNewSegment = true; // First ever point
            }

            setPathSegments(prev => {
                let updated = [...prev];
                let targetSegmentIndex = updated.length - 1;

                if (isNewSegment && updated.length > 0 && updated[updated.length - 1].length > 0) {
                    updated.push([newPoint]);
                    targetSegmentIndex++;
                } else {
                    if(updated.length === 0) {
                        updated.push([]);
                        targetSegmentIndex = 0;
                    }
                    
                    const currentSegment = [...updated[targetSegmentIndex]];
                    
                    // Advanced Global Loop Detection
                    // We check the new point against the ENTIRE flattened path history
                    const fullPath = updated.flat();
                    const loopData = detectIntersectionLoop(newPoint, fullPath, fullPath.length);
                    
                    if (loopData && loopData.isLoop) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert(
                            "⚠️ Loop Detected",
                            "Redundant trail loop safely removed to maintain path integrity.",
                            [{ text: "OK" }]
                        );
                        
                        // We need to trim the correct segment
                        // This is tricky if it spans multiple segments, but usually it's in the current one
                        // For now, we trim the current segment to avoid complex cross-segment deletion
                        const relativeIndex = loopData.loopStartIndex - (fullPath.length - currentSegment.length);
                        if (relativeIndex >= 0) {
                            currentSegment.splice(relativeIndex + 1);
                        }
                    }

                    currentSegment.push(newPoint);
                    updated[targetSegmentIndex] = currentSegment;
                }
                pathSegmentsRef.current = updated;
                return updated;
            });

            // 3. INCREMENTAL SYNC TO BACKEND & SOCKET (LEADER ONLY)
            if (trailIdRef.current && role === 'leader') {
                 // Sync to DB
                client.put(`/treks/update/${trailIdRef.current}`, {
                    coordinates: [newPoint],
                    isNewSegment: isNewSegment
                }).catch(e => console.error("Incremental sync error", e));

                // Sync to Socket
                if (socketRef.current) {
                    socketRef.current.emit('trail-point-shared', {
                        trekId: trailIdRef.current,
                        point: newPoint,
                        isNewSegment: isNewSegment
                    });
                }
            }
        }
    }, [isTracking, validatedLocation, isPaused, trailFinished, role, isTrailingBack, isReusingTrail, trailId]);


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
                        let mappedSegments = [];
                        if (data.path.type === 'MultiLineString') {
                            mappedSegments = data.path.coordinates.map(segment => 
                                segment.map(p => ({ latitude: p[1], longitude: p[0] }))
                            );
                        } else {
                            // Legacy LineString
                            mappedSegments = [data.path.coordinates.map(p => ({
                                latitude: p[1],
                                longitude: p[0]
                            }))];
                        }
                        setPathSegments(mappedSegments);
                        setRouteCoordinates(mappedSegments.flat());
                        routeRef.current = mappedSegments.flat();
                        setTargetRoute(mappedSegments.flat());
                        setNavigationPolyline(mappedSegments.flat());
                        pathSegmentsRef.current = mappedSegments;
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
                    setTrailId(null);
                    trailIdRef.current = null;
                }
            }
        })();
    }, []);


    useEffect(() => {
        if (!trailId) return;

        const socketUrl = client.defaults.baseURL.replace('/api', '');
        const socket = io(socketUrl, {
            transports: ['websocket'],
            jsonp: false
        });
        socketRef.current = socket;

        socket.emit('join-trek', { trekId: trailId, userId: currentUser?._id, username: currentUser?.username });

        socket.on('trail-point-received', ({ point, isNewSegment }) => {
            if (role === 'member') {
                setPathSegments(prev => {
                    const updated = [...prev];
                    const targetSegmentIndex = isNewSegment || updated.length === 0 ? updated.length : updated.length - 1;
                    
                    if (isNewSegment || updated.length === 0) {
                        updated.push([point]);
                    } else {
                        updated[targetSegmentIndex] = [...updated[targetSegmentIndex], point];
                    }
                    pathSegmentsRef.current = updated;
                    return updated;
                });
                setRouteCoordinates(prev => [...prev, point]);
                routeRef.current = [...routeRef.current, point];
            }
        });

        socket.on('participant-joined', ({ username }) => {
            if (role === 'leader') {
                Alert.alert("New Participant", `${username} has joined the trek.`);
            }
        });

        socket.on('participant-left', ({ username }) => {
            if (role === 'leader') {
                Alert.alert("Participant Left", `${username} has left the trek.`);
            }
            setParticipants(prev => {
                const updated = { ...prev };
                // Find and remove by username or we might need userId from server
                return updated;
            });
        });

        socket.on("participant-location-received", ({ userId, username, location: ploc, isOffTrail, distanceToTrail }) => {
            setParticipants(prev => ({
                ...prev,
                [userId]: { username, location: ploc, isOffTrail, distanceToTrail, lastUpdate: Date.now() }
            }));

            // Auto-follow leader for members
            const currentLeaderId = leaderId || trailId; // Fallback to trailId if leaderId not passed
            if (role === 'member' && userId === currentLeaderId && mapViewMode === 'navigation') {
                mapRef.current?.animateToRegion({
                    latitude: ploc.latitude,
                    longitude: ploc.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005
                }, 1000);
            }
        });

        socket.on('trek-control-received', ({ action }) => {
            if (role === 'member') {
                if (action === 'START') {
                    setHasStarted(true);
                    setIsTracking(true);
                    setNavGuidance("Trek started by leader.");
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                if (action === 'TREKBACK') {
                    handleTrailBack(true); // Call with remote flag
                }
                if (action === 'PAUSE') setIsPaused(true);
                if (action === 'RESUME') setIsPaused(false);
                if (action === 'STOP') {
                    setTrailFinished(true);
                    setIsTracking(false);
                    setNavGuidance("Trek finished by leader.");
                }
            }
        });

        socket.on('drift-notification', ({ userId: driftUserId, username: driftUser, isOffTrail }) => {
            if (driftUserId === currentUser?._id) return; // Self alert handled locally

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (role === 'leader') {
                setNavGuidance(`${driftUser} has moved away from the trail!`);
            } else {
                setNavGuidance(`${driftUser} is off the trail.`);
            }
        });

        socket.on('waypoint-received', ({ waypoint }) => {
            setMarkers(prev => [...prev, waypoint]);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [trailId]);

    useEffect(() => {
        trailIdRef.current = trailId;
    }, [trailId]);

    useEffect(() => {
        pathSegmentsRef.current = pathSegments;
    }, [pathSegments]);


    // Fetch Uploaded (Reusable) Trail Details
    useEffect(() => {
        if (!uploadedTrailId) return;

        const loadUploadedTrail = async () => {
            try {
                const res = await client.get(`/treks/${uploadedTrailId}`);
                if (res.data) {
                    const data = res.data;
                    
                    // Mount existing polylines
                    if (data.path && data.path.coordinates) {
                        let mappedRoute = [];
                        if (data.path.type === 'MultiLineString') {
                            mappedRoute = data.path.coordinates.map(segment => 
                                segment.map(p => ({ latitude: p[1], longitude: p[0] }))
                            ).flat();
                        } else {
                            mappedRoute = data.path.coordinates.map(p => ({
                                latitude: p[1], longitude: p[0]
                            }));
                        }
                        setTargetRoute(mappedRoute);
                        
                        // Frame the base trail location immediately
                        if (mappedRoute.length > 0 && mapRef.current) {
                            mapRef.current.animateCamera({
                                center: mappedRoute[0],
                                altitude: 2000,
                                zoom: 16
                            }, { duration: 1500 });
                        }
                    }

                    // Mount existing read-only waypoints
                    if (data.waypoints && data.waypoints.length > 0) {
                        setBaseWaypoints(data.waypoints);
                    }
                }
            } catch (err) {
                console.error("Failed to load base trail", err);
                Alert.alert("Base Trail Error", "Could not load the original trail data.");
            }
        };

        loadUploadedTrail();
    }, [uploadedTrailId]);

    // NEW: Real-world road routing to trail start
    const fetchRoadRoute = async (start, end) => {
        try {
            // Using OSRM Foot routing for walkable paths/roads
            const url = `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map(p => ({
                    latitude: p[1],
                    longitude: p[0]
                }));
                setReroutePath(coords);
                setNavGuidance("Following roads to trail start.");
                return true;
            }
            return false;
        } catch (e) {
            console.error("OSRM Routing Error:", e);
            return false;
        }
    };

    // Helper to calculate distance









    const startTrail = async () => {
        try {
            setIsTracking(true);
            setIsPaused(false);
            setTrailFinished(false);
            setHasStarted(true);
            pausedRef.current = false;
            
            // RESET NAVIGATION ENGINE
            hasAlertedCompletion.current = false;
            setCurrentNavIndex(0);
            setNavDirection('forward');
            setNavigationPolyline(isReusingTrail ? targetRoute : []);
            setHasJoinedTrail(false);
            setHasReachedMidpoint(false);
            setOffTrackWarning(false);
            setNavGuidance("Initializing...");

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
                console.log("[ActiveTrek] New session created:", newId);

                // Start Trail Activation
                setHasJoinedTrail(true);
                setFlowState('trekking');
                setMapViewMode('navigation');
                setNavGuidance("Trek started.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Emit START action to room
                if (socketRef.current) {
                    socketRef.current.emit('trek-control', { trekId: newId, action: 'START' });
                }
            } else {
                 // If already has trailId (e.g. from params), just start and emit
                 if (socketRef.current) {
                    socketRef.current.emit('trek-control', { trekId: trailId, action: 'START' });
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
                    setMapViewMode('explore'); // Stop aggressive zoom
                    if (timerRef.current) clearInterval(timerRef.current);

                    // Re-frame camera to show full trail encompassing Start & End
                    if (mapRef.current && pathSegmentsRef.current.length > 0) {
                        const allCoords = pathSegmentsRef.current.flat();
                        if (allCoords.length > 0) {
                            // Using bottom 400 padding to account for the large 'Destination Reached' overlay
                            mapRef.current.fitToCoordinates(allCoords, {
                                edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
                                animated: true,
                            });
                        }
                    }
                    if (trailId) {
                        try {
                            // Emit Stop action to room
                            if (socketRef.current) {
                                socketRef.current.emit('trek-control', { trekId: trailId, action: 'STOP' });
                            }
                    // AUTOMATIC END POINT handled visually via endPoint marker
                    // We no longer push a redundant "End Point" to waypoints DB

                            await client.put(`/treks/update/${trailId}`, { 
                                status: 'completed',
                                stats: stats
                            });

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

    const handleTrailBack = (isRemote = false) => {
        // Snapshot the current path for trek-back
        let sourcePath = [];
        if (isReusingTrail && targetRoute.length > 0) {
            sourcePath = [...targetRoute];
        } else if (routeCoordinates.length > 0) {
            sourcePath = [...routeCoordinates];
        } else if (pathSegments.flat().length > 0) {
            sourcePath = pathSegments.flat();
        }

        if (sourcePath.length < 2) {
            if (!isRemote) Alert.alert("Trek Back Error", "Not enough trail data to generate a return journey.");
            return;
        }

        const reversedPath = [...sourcePath].reverse();
        
        setIsTrailingBack(true);
        setNavDirection('forward'); 
        setFlowState('trekback');
        setNavigationPolyline(reversedPath);
        setCurrentNavIndex(0); 
        
        setStats({
            distance: 0,
            duration: 0,
            elevationGain: 0,
            avgSpeed: 0,
            maxAltitude: -Infinity
        });
        lastStatsPointRef.current = null;

        hasAlertedOffTrack.current = false;
        hasAlertedCompletion.current = false;
        setHasJoinedTrail(true); 
        setTrailFinished(false); 
        setIsPaused(false); 
        setIsTracking(true);
        setHasStarted(true);
        setNavGuidance(isRemote ? "Leader started Trek Back." : "Trek back mode active. Follow the path back.");
        
        pausedRef.current = false; 

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (!pausedRef.current && !trailFinished) {
                setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
            }
        }, 1000);

        // Emit to room if I am the leader and this wasn't a remote call
        if (!isRemote && role === 'leader' && socketRef.current && trailId) {
            socketRef.current.emit('trek-control', {
                trekId: trailId,
                action: 'TREKBACK'
            });
        }
    };

    const handleExit = () => {
        router.replace('/(tabs)/trek');
    };

    const togglePause = () => {
        const newPausedState = !isPaused;
        setIsPaused(newPausedState);
        pausedRef.current = newPausedState;

        // Emit Pause/Resume action
        if (socketRef.current && trailId) {
            socketRef.current.emit('trek-control', {
                trekId: trailId,
                action: newPausedState ? 'PAUSE' : 'RESUME'
            });
        }

        if (!newPausedState) {
            // Unpausing
            resumedFromPauseRef.current = true;
        }
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

    const compressImage = async (uri) => {
        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1080 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return manipResult.uri;
        } catch (error) {
            console.error("Compression error:", error);
            return uri; // Fallback to original
        }
    };

    const handlePickImage = async () => {
        if (waypointImages.length >= 10) {
            Alert.alert("Limit Reached", "You can attach a maximum of 10 photos per waypoint.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1, // Using 1, compression is handled by ImageManipulator
        });

        if (!result.canceled) {
            const compressedUri = await compressImage(result.assets[0].uri);
            setWaypointImages(prev => [...prev, compressedUri]);
        }
    };

    const handleTakePhoto = async () => {
        if (waypointImages.length >= 10) {
            Alert.alert("Limit Reached", "You can attach a maximum of 10 photos per waypoint.");
            return;
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required to take photos. Enable it in settings.');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            const compressedUri = await compressImage(result.assets[0].uri);
            setWaypointImages(prev => [...prev, compressedUri]);
        }
    };

    // Helper to determine polyline thickness dynamically
    const getPolylineWidth = (zoom) => {
        if (zoom >= 18) return 8;
        if (zoom >= 16) return 6;
        if (zoom >= 14) return 4;
        return 3;
    };

    const addMarker = async () => {
        if (!location || !selectedIcon) return;

        const newMarker = {
            latitude: location.latitude,
            longitude: location.longitude,
            icon: selectedIcon.name,
            type: selectedIcon.label,
            description: waypointDescription.trim(),
            images: waypointImages,
            timestamp: new Date()
        };

        setMarkers(prev => [...prev, newMarker]);
        setShowMarkerModal(false);
        setSelectedIcon(null);
        setWaypointDescription('');
        setIconSearchQuery('');
        setWaypointImages([]);

        // Save to backend
        if (trailId) {
            try {
                // Emit to room
                if (socketRef.current) {
                    socketRef.current.emit('waypoint-added', { trekId: trailId, waypoint: newMarker });
                }

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

    const { visibleRoute, fadedRoute } = useMemo(() => {
        const sourcePolyline = navigationPolyline.length > 0 ? navigationPolyline : routeCoordinates;
        
        if (sourcePolyline.length === 0) {
            return { visibleRoute: [], fadedRoute: [] };
        }
        
        const safeIndex = Math.max(0, Math.min(currentNavIndex, sourcePolyline.length - 1));
        
        // Fading is always relative to currentNavIndex on the active navigationPolyline
        return {
            fadedRoute: sourcePolyline.slice(0, safeIndex + 1),
            visibleRoute: sourcePolyline.slice(safeIndex)
        };
    }, [isTrailingBack, isReusingTrail, navigationPolyline, routeCoordinates, currentNavIndex]);

    // Explicit markers for Start/End
    const startPoint = isReusingTrail && targetRoute.length > 0 
        ? targetRoute[0] 
        : (pathSegments.length > 0 && pathSegments[0].length > 0 ? pathSegments[0][0] : null);

    const endPoint = isReusingTrail && targetRoute.length > 0
        ? targetRoute[targetRoute.length - 1]
        : (trailFinished && pathSegments.length > 0 && pathSegments[pathSegments.length - 1].length > 0 
            ? pathSegments[pathSegments.length - 1][pathSegments[pathSegments.length - 1].length - 1] 
            : null);

    return (
        <View style={styles.container}>
            {location ? (
                <View style={styles.mapContainer}>
                    <NativeMap
                        ref={mapRef}
                        initialRegion={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                            latitudeDelta: 0.001, // Reverted to standard zoom
                            longitudeDelta: 0.001,
                        }}
                        mapType={mapType}
                        heading={isNavMode ? userHeading : 0}
                        userHeading={userHeading}
                        showsUserLocation={false} // Disable buggy OS native dot
                        followsUserLocation={false}
                        pitchEnabled={true}
                        scrollEnabled={true}
                        zoomEnabled={true}
                        onPanDrag={() => setMapViewMode('explore')}
                        onRegionChangeComplete={(region, gesture) => {
                            if (gesture && gesture.isGesture && mapViewMode !== 'explore') {
                                setMapViewMode('explore');
                            }
                        }}
                    >
                        {!isReusingTrail && !isTrailingBack && pathSegments.map((segment, idx) => (
                            segment.length > 0 ? (
                                <Polyline
                                    key={`seg-${idx}`}
                                    coordinates={segment}
                                    strokeWidth={getPolylineWidth(mapZoomLevel)}
                                    strokeColor="#fc4c02" // Strava Orange
                                    lineCap="round"
                                    lineJoin="round"
                                    geodesic={true}
                                    zIndex={100} // Force on top of tiles
                                />
                            ) : null
                        ))}

                        {/* Unified Navigation Polyline (Faded/Visible) */}
                        {(isTrailingBack || isReusingTrail) && visibleRoute.length > 0 && (
                            <Polyline
                                coordinates={visibleRoute}
                                strokeWidth={getPolylineWidth(mapZoomLevel)}
                                strokeColor={isReusingTrail ? "#007AFF" : "#fc4c02"} // Blue for reused, Orange for recorded
                                lineCap="round"
                                lineJoin="round"
                                geodesic={true}
                                zIndex={100}
                            />
                        )}
                        {(isTrailingBack || isReusingTrail) && fadedRoute.length > 0 && (
                            <Polyline
                                coordinates={fadedRoute}
                                strokeWidth={getPolylineWidth(mapZoomLevel)}
                                strokeColor={isReusingTrail ? "rgba(0, 122, 255, 0.3)" : "rgba(252, 76, 2, 0.3)"}
                                lineCap="round"
                                lineJoin="round"
                                geodesic={true}
                                zIndex={99}
                            />
                        )}
                        
                        {/* Hardware Compass User Marker */}
                        {location && (
                            <Marker
                                coordinate={location}
                                anchor={{ x: 0.5, y: 0.5 }}
                                rotation={userHeading} // Some iOS devices respect this natively
                                flat={true}
                                zIndex={999}
                            >
                                <View style={[styles.userMarkerContainer, { transform: [{ rotate: `${userHeading || 0}deg` }] }]}>
                                    <View style={styles.userMarkerDot} />
                                    <Ionicons name="caret-up" size={24} color="#007bff" style={styles.userMarkerArrow} />
                                </View>
                            </Marker>
                        )}
                        
                        {startPoint && (
                            <Marker coordinate={startPoint} anchor={{x: 0.5, y: 1}}>
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{ backgroundColor: '#28a745', padding: 4, borderRadius: 4, marginBottom: 2 }}>
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>Start</Text>
                                    </View>
                                    <Ionicons name="location" size={30} color="#28a745" />
                                </View>
                            </Marker>
                        )}
                        {endPoint && (
                            <Marker coordinate={endPoint} anchor={{x: 0.5, y: 1}}>
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{ backgroundColor: '#dc3545', padding: 4, borderRadius: 4, marginBottom: 2 }}>
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>End</Text>
                                    </View>
                                    <Ionicons name="location" size={30} color="#dc3545" />
                                </View>
                            </Marker>
                        )}
                        {/* Reroute Path */}
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

                        {/* Legacy targetRoute render removed - handled by unified engine above */}

                        {/* Render Base Waypoints (Read Only) */}
                        {
                            baseWaypoints.filter(m => m.title !== "Start Point" && m.title !== "End Point").map((m, i) => (
                                <Marker
                                    key={`base-${i}`}
                                    coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                                    pinColor="indigo" // Different color mapped for base pins
                                    onPress={() => setSelectedPinDetails(m)}
                                />
                            ))
                        }

                        {
                            markers.filter(m => m.title !== "Start Point" && m.title !== "End Point").map((m, i) => (
                                <Marker
                                    key={i}
                                    coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                                    pinColor={MARKER_ICONS.find(ic => ic.name === m.icon)?.color || 'red'}
                                    onPress={() => setSelectedPinDetails({ ...m, isSessionNew: true })}
                                />
                            ))
                        }

                        {/* Participant Markers - Visible to All */}
                        {Object.entries(participants).map(([uid, p]) => (
                            <Marker
                                key={`participant-${uid}`}
                                coordinate={p.location}
                                title={p.username}
                                description={p.isOffTrail ? `OFF TRAIL (${p.distanceToTrail}m)` : "On Trail"}
                                zIndex={100}
                            >
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{ backgroundColor: p.isOffTrail ? '#dc3545' : '#28a745', padding: 4, borderRadius: 10, paddingHorizontal: 8, marginBottom: 2 }}>
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{p.username}</Text>
                                    </View>
                                    <Ionicons name="person" size={24} color={p.isOffTrail ? '#dc3545' : '#28a745'} />
                                    {p.isOffTrail && (
                                        <View style={{ position: 'absolute', top: 15, right: -5, backgroundColor: '#dc3545', borderRadius: 10, padding: 2, borderWidth: 1, borderColor: 'white' }}>
                                            <Ionicons name="warning" size={10} color="white" />
                                        </View>
                                    )}
                                </View>
                            </Marker>
                        ))}
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

            {mapViewMode === 'explore' && location && (
                <TouchableOpacity 
                    style={styles.recenterBtn} 
                    onPress={() => setMapViewMode(isNavMode ? 'navigation' : 'top-down')}
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
                        
                        {!hasJoinedTrail && uploadedTrailId && (
                            <TouchableOpacity 
                                style={{ marginTop: 5, backgroundColor: 'rgba(255,255,255,0.2)', padding: 5, borderRadius: 5, alignSelf: 'flex-start' }}
                                onPress={() => {
                                    if (targetRoute.length > 0) {
                                        setReroutePath([location, targetRoute[0]]);
                                        setNavGuidance("Navigating to Trail Start Point");
                                    }
                                }}
                            >
                                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>Navigate to Start Point instead?</Text>
                            </TouchableOpacity>
                        )}
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
                isTracking && !trailFinished && role === 'leader' && (
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
                            style={[styles.mapIconButton, mapViewMode === 'navigation' && styles.mapIconButtonActive]}
                            onPress={() => {
                                const newMode = mapViewMode === 'navigation' ? 'top-down' : 'navigation';
                                setMapViewMode(newMode);
                                setIsNavMode(newMode === 'navigation'); // Sync legacy state if needed elsewhere
                            }}
                        >
                            <Ionicons
                                name={mapViewMode === 'navigation' ? "compass" : "compass-outline"}
                                size={28}
                                color={mapViewMode === 'navigation' ? "white" : "#28a745"}
                            />
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Controls Overlay */}
            <View style={styles.controls}>
                {!trailFinished ? (
                    <>
                        {hasStarted && (
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
                        )}

                        <View style={styles.row}>
                            {role === 'leader' ? (
                                !hasStarted ? (
                                    // PHASE 1 & 2: STARTING
                                    isReusingTrail && distanceToTrail > 10 ? (
                                        <TouchableOpacity 
                                            style={[styles.actionButton, styles.trailBackBtn, { width: '100%' }]} 
                                            onPress={() => setFlowState('goto-start')}
                                            disabled={flowState === 'goto-start'}
                                        >
                                            <Ionicons name="navigate" size={24} color="white" style={{ marginRight: 10 }} />
                                            <Text style={styles.actionButtonText}>
                                                {flowState === 'goto-start' ? `Navigating to Start...` : 'Go to Start'}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : (
                                        // PHASE 3: AT START
                                        <TouchableOpacity 
                                            style={[styles.startBigBtn, { width: '100%', flexDirection: 'row', justifyContent: 'center' }]} 
                                            onPress={startTrail}
                                            disabled={!gpsAccuracy || gpsAccuracy > 30}
                                        >
                                            <Ionicons name="play-circle" size={24} color="white" style={{ marginRight: 10 }} />
                                            <Text style={styles.startBigBtnText}>
                                                {!gpsAccuracy || gpsAccuracy > 30 ? 'Waiting for GPS...' : (isTrailingBack ? 'Start Trek Back' : 'Start Trail')}
                                            </Text>
                                        </TouchableOpacity>
                                    )
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
                            ) : (
                                <View style={{ width: '100%', alignItems: 'center', padding: 10, backgroundColor: isPaused ? '#ffc107' : '#28a745', borderRadius: 12 }}>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                        {isPaused ? "LEADER HAS PAUSED TREK" : "FOLLOWING LEADER LIVE"}
                                    </Text>
                                </View>
                            )}
                        </View>

                    </>
                ) : (
                    // Trail Finished / Trail Back Mode
                    <View style={styles.finishedContainer}>
                        {!isTrailingBack ? (
                            <>
                                <Text style={styles.finishedTitle}>You have reached your destination.</Text>
                                <View style={styles.row}>
                                    <TouchableOpacity style={[styles.actionButton, styles.trailBackBtn]} onPress={handleTrailBack}>
                                        <Ionicons name="arrow-undo" size={24} color="white" style={{ marginRight: 8 }} />
                                        <Text style={styles.actionButtonText}>Start Trek Back</Text>
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
                    setWaypointImages([]);
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
                                        
                                        <View style={styles.mediaButtonsRow}>
                                            <TouchableOpacity style={styles.mediaBtn} onPress={handleTakePhoto}>
                                                <Ionicons name="camera" size={20} color="white" />
                                                <Text style={styles.mediaBtnText}>Camera</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.mediaBtn, { backgroundColor: '#007bff' }]} onPress={handlePickImage}>
                                                <Ionicons name="images" size={20} color="white" />
                                                <Text style={styles.mediaBtnText}>Gallery</Text>
                                            </TouchableOpacity>
                                        </View>
                                        
                                        {waypointImages.length > 0 && (
                                            <FlatList
                                                data={waypointImages}
                                                horizontal
                                                keyExtractor={(item, index) => index.toString()}
                                                renderItem={({ item }) => (
                                                    <Image source={{ uri: item }} style={styles.waypointThumbnail} />
                                                )}
                                                style={{ marginTop: 10, maxHeight: 80 }}
                                            />
                                        )}

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
                                        setWaypointImages([]);
                                    }}
                                >
                                    <Text style={styles.closeText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Pin Details View Modal */}
            <Modal visible={!!selectedPinDetails} transparent animationType="slide">
                <TouchableWithoutFeedback onPress={() => setSelectedPinDetails(null)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                {selectedPinDetails && (
                                    <>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                            <Ionicons name={selectedPinDetails.icon} size={28} color={MARKER_ICONS.find(ic => ic.name === selectedPinDetails.icon)?.color || '#333'} />
                                            <Text style={[styles.modalTitle, { marginBottom: 0, marginLeft: 10 }]}>{selectedPinDetails.type}</Text>
                                        </View>
                                        
                                        {selectedPinDetails.description ? (
                                            <Text style={styles.pinDescText}>{selectedPinDetails.description}</Text>
                                        ) : null}

                                        <View style={styles.coordBox}>
                                            <Ionicons name="location-outline" size={16} color="#666" />
                                            <Text style={styles.coordText}>
                                                {selectedPinDetails.latitude.toFixed(5)}, {selectedPinDetails.longitude.toFixed(5)}
                                            </Text>
                                        </View>

                                        {selectedPinDetails.images && selectedPinDetails.images.length > 0 && (
                                            <View>
                                                <Text style={{ marginTop: 15, fontSize: 12, color: '#888', fontWeight: 'bold' }}>PHOTOS ({selectedPinDetails.images.length})</Text>
                                                <FlatList
                                                    data={selectedPinDetails.images}
                                                    horizontal
                                                    keyExtractor={(_, idx) => idx.toString()}
                                                    renderItem={({ item }) => (
                                                        <Image source={{ uri: item }} style={styles.pinDetailThumbnail} />
                                                    )}
                                                    showsHorizontalScrollIndicator={false}
                                                    style={{ marginTop: 5, maxHeight: 120 }}
                                                />
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            style={[styles.closeModal, { marginTop: 20 }]}
                                            onPress={() => setSelectedPinDetails(null)}
                                        >
                                            <Text style={styles.closeText}>Close</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </TouchableWithoutFeedback>
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
    mediaButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
    },
    mediaBtn: {
        flexDirection: 'row',
        backgroundColor: '#6c757d',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        flex: 0.48,
        justifyContent: 'center'
    },
    mediaBtnText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    waypointThumbnail: {
        width: 70,
        height: 70,
        borderRadius: 8,
        marginRight: 10,
    },
    pinDetailThumbnail: {
        width: 120,
        height: 120,
        borderRadius: 8,
        marginRight: 10,
    },
    pinDescText: {
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
        marginBottom: 10,
    },
    coordBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e9ecef',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
        alignSelf: 'flex-start',
    },
    coordText: {
        marginLeft: 5,
        fontSize: 13,
        color: '#555',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    userMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
    },
    userMarkerDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#007bff',
        borderWidth: 3,
        borderColor: 'white',
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    userMarkerArrow: {
        position: 'absolute',
        top: -4,
    }
});
