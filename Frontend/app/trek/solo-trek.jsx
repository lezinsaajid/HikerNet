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

export default function SoloTrek() {
    const router = useRouter();
    const params = useLocalSearchParams();
    useKeepAwake(); // Prevent screen from sleeping while tracking
    const { name, description, location: initialLocation, trailId: paramTrailId, uploadedTrailId } = params;

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
    const [trailId, setTrailId] = useState(paramTrailId && paramTrailId !== uploadedTrailId ? String(paramTrailId) : null);
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
    const autoFollowTimerRef = useRef(null);
    const pausedRef = useRef(false);

    const trailIdRef = useRef(trailId);
    const pathSegmentsRef = useRef([[]]);
    const lastLocationRef = useRef(null); // For EMA smoothing filter
    const hasAlertedOffTrack = useRef(false); // To prevent alert spam
    const hasAlertedCompletion = useRef(false); // To prevent completion alert spam
    const lastStatsPointRef = useRef(null);     // For distance/stats tracking

    const { user: currentUser } = useAuth();

    const {
        location: validatedLocation,
        smoothedLocation,
        gpsAccuracy,
        accuracyStatus,
        error: locationError
    } = useSmartLocation(isTracking || isTrailingBack || !hasStarted);

    const userHeading = useCompass(!trailFinished); 

    // React to smart location updates
    useEffect(() => {
        if (!smoothedLocation) return;

        const { latitude, longitude } = smoothedLocation;
        const currentLoc = { latitude, longitude };

        let displayLoc = currentLoc;

        // Logic for Navigation (Unified Engine)
        const navigationDirection = 'forward'; 

        // 1. PRE-PROCESS NAVIGATION (DISTANCE & SNAPPING)
        let distance = Infinity;
        let snappedPoint = null;
        let segmentIndex = -1;

        if (navigationPolyline.length >= 2) {
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
            if (segmentIndex >= 0 && distance <= 15) {
                setCurrentNavIndex(segmentIndex);
                
                // MIDPOINT GUARD: Mark if user reached 50% progress
                if (navigationDirection === 'forward' && segmentIndex > navigationPolyline.length * 0.5) {
                    setHasReachedMidpoint(true);
                } else if (navigationDirection === 'backward' && segmentIndex < navigationPolyline.length * 0.5) {
                    setHasReachedMidpoint(true);
                }
            }

            // Trail Snapping Logic
            if (hasJoinedTrail && !offTrackWarning && distance > 2 && distance < 12 && !isTrailingBack) {
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
            if (!hasJoinedTrail && (isReusingTrail || isTrailingBack)) {
                const startPoint = navigationPolyline[navigationDirection === 'forward' ? 0 : navigationPolyline.length - 1];
                const distanceToRealStart = getDistance(currentLoc.latitude, currentLoc.longitude, startPoint.latitude, startPoint.longitude);
                
                if (distanceToRealStart <= 15) {
                    setNavGuidance("You have reached the starting point.");
                    setReroutePath([]);
                    if (flowState === 'goto-start') {
                         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                } else if (flowState === 'goto-start') {
                    if (reroutePath.length === 0 && distanceToRealStart > 50) {
                        fetchRoadRoute(currentLoc, startPoint);
                    }
                    setNavGuidance(`Navigate to the starting point (${Math.round(distanceToRealStart)}m).`);
                    const bearing = calculateHeading(currentLoc, startPoint);
                    setTargetBearing(bearing);
                } else {
                    setNavGuidance(`You are ${Math.round(distanceToRealStart)} meters away from the starting point.`);
                    setReroutePath([]); 
                }
                setDistanceToTrail(Math.round(distanceToRealStart));
                return;
            }

            if (hasJoinedTrail) {
                const offTrackThreshold = 15;
                const onTrackThreshold = 10;
                
                if (distance > offTrackThreshold) {
                    if (!offTrackWarning) {
                        setOffTrackWarning(true);
                        setNavGuidance(`Off trail! Head back to the path.`);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                    setReroutePath([currentLoc, snappedPoint]);
                    const bearing = calculateHeading(currentLoc, snappedPoint);
                    setTargetBearing(bearing);
                } else if (offTrackWarning && distance <= onTrackThreshold) {
                    setOffTrackWarning(false);
                    setNavGuidance("Back on track.");
                    setReroutePath([]);
                }

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

                let targetIdx = navigationDirection === 'forward' ? segmentIndex + 1 : segmentIndex - 1;
                targetIdx = Math.max(0, Math.min(navigationPolyline.length - 1, targetIdx));
                const targetPoint = navigationPolyline[targetIdx];
                if (targetPoint) {
                    const bearing = calculateHeading(currentLoc, targetPoint);
                    setTargetBearing(bearing);
                }
            }
        }

        // 4. MAP CAMERA UPDATES
        if (mapRef.current && mapViewMode !== 'explore') {
            const cameraOptions = {
                center: displayLoc,
                pitch: mapViewMode === 'navigation' ? 45 : 0, 
                heading: mapViewMode === 'navigation' ? userHeading : 0,
                altitude: 500,
                zoom: 18
            };
            mapRef.current.animateCamera(cameraOptions, { duration: 1000 });
        }

        // 5. DRIFT ALERTS (Local only for solo)
        const isOffTrail = distance > 15;
        if (isOffTrail && !hasAlertedOffTrack.current) {
            hasAlertedOffTrack.current = true;
            setNavGuidance("You have moved away from the trail");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (!isOffTrail) {
            hasAlertedOffTrack.current = false;
        }
    }, [smoothedLocation, isTrailingBack, navigationPolyline, routeCoordinates, isNavMode, userHeading, hasJoinedTrail, offTrackWarning, trailFinished, mapViewMode, trailId]);


    useEffect(() => {
        if ((!isTracking && !isTrailingBack) || !validatedLocation || trailFinished || isPaused) return;

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

        // 2. PATH STORAGE & SEGMENT MANAGEMENT
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
                  isNewSegment = true; 
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
                    
                    const fullPath = updated.flat();
                    const loopData = isTrailingBack ? null : detectIntersectionLoop(newPoint, fullPath, fullPath.length);
                    
                    if (loopData && loopData.isLoop) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert(
                            "⚠️ Loop Detected",
                            "Redundant trail loop safely removed to maintain path integrity.",
                            [{ text: "OK" }]
                        );
                        
                        const loopStartGlobal = loopData.loopStartIndex;
                        let count = 0;
                        const prunedSegments = [];
                        for (const seg of updated) {
                            if (count + seg.length > loopStartGlobal) {
                                const relativeIdx = loopStartGlobal - count;
                                prunedSegments.push(seg.slice(0, relativeIdx + 1));
                                break; 
                            }
                            prunedSegments.push(seg);
                            count += seg.length;
                        }
                        
                        updated = prunedSegments;
                        targetSegmentIndex = updated.length - 1;

                        if (trailIdRef.current) {
                            client.put(`/treks/update/${trailIdRef.current}`, {
                                path: { type: 'MultiLineString', coordinates: updated.map(seg => seg.map(p => [p.longitude, p.latitude])) }
                            }).catch(e => console.error("Full path sync error", e));
                        }
                    }

                    currentSegment.push(newPoint);
                    updated[targetSegmentIndex] = currentSegment;
                }
                pathSegmentsRef.current = updated;
                return updated;
            });

            // 3. INCREMENTAL SYNC TO BACKEND
            if (trailIdRef.current) {
                client.put(`/treks/update/${trailIdRef.current}`, {
                    coordinates: [newPoint],
                    isNewSegment: isNewSegment
                }).catch(e => console.error("Incremental sync error", e));
            }
        }
    }, [isTracking, validatedLocation, isPaused, trailFinished, isTrailingBack, isReusingTrail, trailId]);


    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }

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
    }, [])

    useEffect(() => {
        let timer = null;
        if (isTracking && !isPaused && !trailFinished) {
            timer = setInterval(() => {
                setStats(prev => ({ ...prev, duration: (prev.duration || 0) + 1 }));
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isTracking, isPaused, trailFinished]);

    useEffect(() => {
        trailIdRef.current = trailId;
    }, [trailId]);

    useEffect(() => {
        pathSegmentsRef.current = pathSegments;
    }, [pathSegments]);


    // Uploaded Trail details
    useEffect(() => {
        if (!uploadedTrailId) return;

        const loadUploadedTrail = async () => {
            try {
                const res = await client.get(`/treks/${uploadedTrailId}`);
                if (res.data) {
                    const data = res.data;
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
                        if (mappedRoute.length > 0 && mapRef.current) {
                            mapRef.current.animateCamera({
                                center: mappedRoute[0],
                                altitude: 2000,
                                zoom: 16
                            }, { duration: 1500 });
                        }
                    }
                    if (data.waypoints && data.waypoints.length > 0) {
                        setBaseWaypoints(data.waypoints);
                    }
                }
            } catch (err) {
                console.error("Failed to load base trail", err);
            }
        };
        loadUploadedTrail();
    }, [uploadedTrailId]);

    const fetchRoadRoute = async (start, end) => {
        try {
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
            return false;
        }
    };

    const startTrail = async () => {
        try {
            setIsTracking(true);
            setIsPaused(false);
            setTrailFinished(false);
            setHasStarted(true);
            pausedRef.current = false;
            
            hasAlertedCompletion.current = false;
            setCurrentNavIndex(0);
            setNavDirection('forward');
            setNavigationPolyline(isReusingTrail ? targetRoute : []);
            setHasJoinedTrail(false);
            setHasReachedMidpoint(false);
            setOffTrackWarning(false);
            setNavGuidance("Initializing...");

            if (!trailId) {
                const res = await client.post('/treks/start', {
                    name: name || `New Trail ${new Date().toLocaleDateString()}`,
                    description: description || '',
                    location: initialLocation || '',
                    mode: 'solo'
                });
                const newId = res.data._id;
                setTrailId(newId);
                trailIdRef.current = newId;
                setStats(prev => ({ ...prev, startName: res.data.name }));
                
                setHasJoinedTrail(true);
                setFlowState('trekking');
                setMapViewMode('navigation');
                setNavGuidance("Trek started.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                const startLoc = validatedLocation || location;
                if (startLoc) {
                    const startMarker = {
                        latitude: startLoc.latitude,
                        longitude: startLoc.longitude,
                        icon: 'flag',
                        type: 'Start Point',
                        description: 'Trek Started Here',
                        timestamp: new Date()
                    };
                    setMarkers([startMarker]);
                }
            }
        } catch (error) {
            console.error("Failed to start trail", error);
            setIsTracking(false);
        }
    };

    const handleStopTrail = async () => {
        Alert.alert("Finish Trail?", "Have you reached your destination?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Yes, Finish",
                onPress: async () => {
                    setTrailFinished(true); 
                    setIsTracking(false);
                    setMapViewMode('explore');
                    if (mapRef.current && pathSegmentsRef.current.length > 0) {
                        const allCoords = pathSegmentsRef.current.flat();
                        if (allCoords.length > 0) {
                            mapRef.current.fitToCoordinates(allCoords, {
                                edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
                                animated: true,
                            });
                        }
                    }
                    if (trailId) {
                        try {
                            await client.put(`/treks/update/${trailId}`, { 
                                status: 'completed',
                                stats: stats
                            });
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
                                            } catch (e) {}
                                        }
                                    }
                                ]
                            );
                        } catch (e) {}
                    }
                }
            }
        ]);
    };

    const handleTrailBack = () => {
        let sourcePath = [];
        if (isReusingTrail && targetRoute.length > 0) {
            sourcePath = [...targetRoute];
        } else if (routeCoordinates.length > 0) {
            sourcePath = [...routeCoordinates];
        } else if (pathSegments.flat().length > 0) {
            sourcePath = pathSegments.flat();
        }

        if (sourcePath.length < 2) {
            Alert.alert("Trek Back Error", "Not enough trail data to generate a return journey.");
            return;
        }

        const reversedPath = [...sourcePath].reverse();
        
        setIsTrailingBack(true);
        setNavDirection('forward'); 
        // UI and tracking states
        setFlowState('trekback');
        setMapViewMode('navigation');
        setIsNavMode(true);
        setNavigationPolyline(reversedPath);
        setCurrentNavIndex(0); 
        
        setStats({
            distance: 0,
            duration: 0,
            avgSpeed: 0,
            elevationGain: 0,
            lastElevation: null
        });

        setIsTracking(true);
        setHasStarted(true);
        setHasJoinedTrail(true); 
        setTrailFinished(false);
        setIsPaused(false);
        setNavGuidance("Trek back mode active. Follow the path back.");
        pausedRef.current = false; 
    };

    const handleExit = () => {
        router.replace('/(tabs)/trek');
    };

    const togglePause = () => {
        const newPausedState = !isPaused;
        setIsPaused(newPausedState);
        pausedRef.current = newPausedState;
        if (!newPausedState) {
            resumedFromPauseRef.current = true;
        }
    };

    const mapRef = useRef(null);

    const toggleMapType = () => {
        const types = ['standard', 'satellite', 'hybrid'];
        const nextIndex = (types.indexOf(mapType) + 1) % types.length;
        setMapType(types[nextIndex]);
    };

    const handleSelectIcon = (iconData) => {
        setSelectedIcon(iconData);
        setIconSearchQuery('');
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
            return uri;
        }
    };

    const handlePickImage = async () => {
        if (waypointImages.length >= 10) {
            Alert.alert("Limit Reached", "You can attach a maximum of 10 photos.");
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });
        if (!result.canceled) {
            const compressedUri = await compressImage(result.assets[0].uri);
            setWaypointImages(prev => [...prev, compressedUri]);
        }
    };

    const handleTakePhoto = async () => {
        if (waypointImages.length >= 10) {
            Alert.alert("Limit Reached", "You can attach a maximum of 10 photos.");
            return;
        }
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required.');
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
        if (trailId) {
            try {
                await client.put(`/treks/update/${trailId}`, { waypoints: [newMarker] });
            } catch (e) {}
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const { visibleRoute, fadedRoute } = useMemo(() => {
        const sourcePolyline = navigationPolyline.length > 0 ? navigationPolyline : routeCoordinates;
        if (sourcePolyline.length === 0) return { visibleRoute: [], fadedRoute: [] };
        const safeIndex = Math.max(0, Math.min(currentNavIndex, sourcePolyline.length - 1));
        return {
            fadedRoute: sourcePolyline.slice(0, safeIndex + 1),
            visibleRoute: sourcePolyline.slice(safeIndex)
        };
    }, [isTrailingBack, isReusingTrail, navigationPolyline, routeCoordinates, currentNavIndex]);

    const startPoint = isReusingTrail && targetRoute.length > 0 
        ? targetRoute[0] 
        : (pathSegments.length > 0 && pathSegments[0].length > 0 ? pathSegments[0][0] : null);

    const endPoint = isReusingTrail && targetRoute.length > 0
        ? targetRoute[targetRoute.length - 1]
        : ((trailFinished || isTrailingBack) && pathSegments.length > 0 && pathSegments[pathSegments.length - 1].length > 0 
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
                            latitudeDelta: 0.001,
                            longitudeDelta: 0.001,
                        }}
                        mapType={mapType}
                        heading={isNavMode ? userHeading : 0}
                        userHeading={userHeading}
                        showsUserLocation={false}
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
                        {!isTrailingBack && pathSegments.map((segment, idx) => (
                            segment.length > 0 ? (
                                <Polyline
                                    key={`seg-${idx}`}
                                    coordinates={segment}
                                    strokeWidth={getPolylineWidth(mapZoomLevel)}
                                    strokeColor="#fc4c02"
                                    lineCap="round"
                                    lineJoin="round"
                                    geodesic={true}
                                    zIndex={110}
                                />
                            ) : null
                        ))}

                        {(isTrailingBack || isReusingTrail) && visibleRoute.length > 0 && (
                            <Polyline
                                coordinates={visibleRoute}
                                strokeWidth={getPolylineWidth(mapZoomLevel)}
                                strokeColor={isReusingTrail ? "#007AFF" : "#fc4c02"} 
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
                        
                        {(smoothedLocation || location) && (
                            <Marker
                                coordinate={smoothedLocation || location || { latitude: 0, longitude: 0 }}
                                anchor={{ x: 0.5, y: 0.5 }}
                                rotation={userHeading || 0}
                                flat={true}
                                zIndex={9999}
                            >
                                <View style={styles.userMarkerContainer}>
                                    <View style={[styles.userMarkerPulse, { transform: [{ scale: 1.2 }] }]} />
                                    <View style={[styles.userMarkerPulse, { transform: [{ scale: 1.5 }], opacity: 0.2 }]} />
                                    
                                    <View style={styles.userMarkerContainerInner}>
                                        <View style={styles.userMarkerDot} />
                                        <Ionicons name="caret-up" size={24} color="#007bff" style={styles.userMarkerArrow} />
                                    </View>
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
                        {reroutePath.length > 0 && (
                            <Polyline
                                coordinates={reroutePath}
                                strokeWidth={getPolylineWidth(mapZoomLevel)}
                                strokeColor="#9c27b0"
                                geodesic={true}
                                zIndex={150}
                            />
                        )}

                        {baseWaypoints.filter(m => m.type !== "Start Point" && m.type !== "End Point").map((m, i) => (
                            <Marker
                                key={`base-${i}`}
                                coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                                pinColor="indigo"
                                onPress={() => setSelectedPinDetails(m)}
                            />
                        ))}

                        {markers.filter(m => m.type !== "Start Point" && m.type !== "End Point").map((m, i) => (
                            <Marker
                                key={i}
                                coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                                pinColor={MARKER_ICONS.find(ic => ic.name === m.icon)?.color || 'red'}
                                onPress={() => setSelectedPinDetails({ ...m, isSessionNew: true })}
                            />
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
                                <Text style={styles.warningSubtitle}>Return to path ({distanceToTrail}m away)</Text>
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
                    <ActivityIndicator size="large" color="#28a745" />
                    <Text style={{ marginTop: 10 }}>Initializing Map...</Text>
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

            {(isTrailingBack || targetRoute.length > 0) && (
                <View style={[styles.navBanner, offTrackWarning && styles.navBannerAlert, !hasJoinedTrail && distanceToTrail > 10 && {backgroundColor: '#17a2b8'}]}>
                    <View style={styles.navIconContainer}>
                        <Ionicons name={offTrackWarning ? "warning" : "navigate-circle"} size={32} color="white" />
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
                        <TouchableOpacity style={styles.navClose} onPress={() => setIsTrailingBack(false)}>
                            <Ionicons name="close-circle" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {isTracking && !trailFinished && (
                <View style={styles.topButtonsContainer}>
                    <TouchableOpacity style={styles.mapIconButton} onPress={() => setShowMarkerModal(true)}>
                        <Ionicons name="add-circle" size={32} color="#28a745" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mapIconButton} onPress={toggleMapType}>
                        <Ionicons name={mapType === 'standard' ? 'map' : mapType === 'satellite' ? 'image' : 'layers'} size={28} color="#28a745" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mapIconButton, mapViewMode === 'navigation' && styles.mapIconButtonActive]}
                        onPress={() => {
                            const newMode = mapViewMode === 'navigation' ? 'top-down' : 'navigation';
                            setMapViewMode(newMode);
                            setIsNavMode(newMode === 'navigation');
                        }}
                    >
                        <Ionicons name={mapViewMode === 'navigation' ? "compass" : "compass-outline"} size={28} color={mapViewMode === 'navigation' ? "white" : "#28a745"} />
                    </TouchableOpacity>
                </View>
            )}

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
                            {!hasStarted ? (
                                isReusingTrail && distanceToTrail > 10 ? (
                                    <TouchableOpacity 
                                        style={[styles.actionButton, styles.trailBackBtn, { width: '100%' }]} 
                                        onPress={() => setFlowState('goto-start')}
                                    >
                                        <Ionicons name="navigate" size={24} color="white" style={{ marginRight: 10 }} />
                                        <Text style={styles.actionButtonText}>Go to Start</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        style={[styles.startBigBtn, { width: '100%', flexDirection: 'row', justifyContent: 'center' }]} 
                                        onPress={startTrail}
                                        disabled={!gpsAccuracy || gpsAccuracy > 30}
                                    >
                                        <Ionicons name="play-circle" size={24} color="white" style={{ marginRight: 10 }} />
                                        <Text style={styles.startBigBtnText}>
                                            {!gpsAccuracy || gpsAccuracy > 30 ? 'Waiting for GPS...' : 'Start Trail'}
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
                                    {isPaused && !isTrailingBack && (
                                        <TouchableOpacity style={[styles.button, styles.trailBackBtn]} onPress={handleTrailBack}>
                                            <Ionicons name="arrow-undo" size={32} color="white" />
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={styles.finishedContainer}>
                        {!isTrailingBack ? (
                            <>
                                <Text style={styles.finishedTitle}>Trek Completed!</Text>
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
                                <TouchableOpacity style={[styles.actionButton, styles.exitBtn, { marginTop: 15 }]} onPress={handleExit}>
                                    <Text style={styles.actionButtonText}>End Session</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>

            <Modal visible={showMarkerModal} transparent animationType="slide">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>{selectedIcon ? `Pin ${selectedIcon.label}` : 'Select Waypoint Icon'}</Text>
                                {!selectedIcon ? (
                                    <>
                                        <View style={styles.searchContainer}>
                                            <TextInput style={styles.searchInput} placeholder="Search icons..." value={iconSearchQuery} onChangeText={setIconSearchQuery} />
                                        </View>
                                        <FlatList
                                            data={MARKER_ICONS.filter(item => item.label.toLowerCase().includes(iconSearchQuery.toLowerCase()))}
                                            numColumns={3}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity style={styles.iconOption} onPress={() => handleSelectIcon(item)}>
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
                                        <TextInput style={styles.descriptionInput} placeholder="Add a note..." value={waypointDescription} onChangeText={setWaypointDescription} multiline />
                                        <View style={styles.mediaButtonsRow}>
                                            <TouchableOpacity style={styles.mediaBtn} onPress={handleTakePhoto}><Text style={styles.mediaBtnText}>Camera</Text></TouchableOpacity>
                                            <TouchableOpacity style={[styles.mediaBtn, { backgroundColor: '#007bff' }]} onPress={handlePickImage}><Text style={styles.mediaBtnText}>Gallery</Text></TouchableOpacity>
                                        </View>
                                        {waypointImages.length > 0 && <FlatList data={waypointImages} horizontal renderItem={({ item }) => <Image source={{ uri: item }} style={styles.waypointThumbnail} />} style={{ marginTop: 10, maxHeight: 80 }} />}
                                        <TouchableOpacity style={[styles.actionButton, styles.exitBtn, { marginTop: 20, justifyContent: 'center' }]} onPress={addMarker}><Text style={styles.actionButtonText}>Pin Waypoint</Text></TouchableOpacity>
                                    </View>
                                )}
                                <TouchableOpacity style={styles.closeModal} onPress={() => setShowMarkerModal(false)}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            <Modal visible={!!selectedPinDetails} transparent animationType="slide">
                <TouchableWithoutFeedback onPress={() => setSelectedPinDetails(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            {selectedPinDetails && (
                                <>
                                    <Text style={styles.modalTitle}>{selectedPinDetails.type}</Text>
                                    <Text style={styles.pinDescText}>{selectedPinDetails.description}</Text>
                                    {selectedPinDetails.images && (
                                        <FlatList data={selectedPinDetails.images} horizontal renderItem={({ item }) => <Image source={{ uri: item }} style={styles.pinDetailThumbnail} />} style={{ maxHeight: 120 }} />
                                    )}
                                    <TouchableOpacity style={styles.closeModal} onPress={() => setSelectedPinDetails(null)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    mapContainer: { flex: 1 },
    weatherOverlay: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
    statusOverlay: { position: 'absolute', top: 80, width: '100%', alignItems: 'center', zIndex: 20 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusText: { marginLeft: 6, fontSize: 14, fontWeight: 'bold', color: '#007bff' },
    warningBanner: { position: 'absolute', top: 20, left: 20, right: 20, backgroundColor: '#dc3545', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, zIndex: 100 },
    warningTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    warningSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
    topButtonsContainer: { position: 'absolute', top: 110, left: 20, zIndex: 10 },
    mapIconButton: { backgroundColor: 'white', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center', elevation: 5, marginBottom: 10 },
    mapIconButtonActive: { backgroundColor: '#28a745' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    controls: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
    statsCard: { backgroundColor: 'rgba(255,255,255,0.95)', padding: 15, borderRadius: 20, marginBottom: 20, width: '100%', elevation: 5 },
    statsMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    statItem: { alignItems: 'center', flex: 1 },
    statDivider: { width: 1, height: '70%', backgroundColor: '#e0e0e0' },
    statsSecondaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12 },
    statDetail: { flexDirection: 'row', alignItems: 'center' },
    statDetailText: { fontSize: 14, color: '#444', fontWeight: '600', marginLeft: 6 },
    statLabel: { fontSize: 12, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
    statValue: { fontSize: 26, fontWeight: 'bold', color: '#28a745' },
    unitText: { fontSize: 14, color: '#666' },
    row: { flexDirection: 'row' },
    button: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, elevation: 8 },
    stopBtn: { backgroundColor: '#dc3545' },
    pauseBtn: { backgroundColor: '#ffc107' },
    finishedContainer: { backgroundColor: 'white', padding: 20, borderRadius: 20, width: '100%', alignItems: 'center', elevation: 10 },
    finishedTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    actionButton: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
    trailBackBtn: { backgroundColor: '#17a2b8' },
    exitBtn: { backgroundColor: '#28a745' },
    actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    trailBackMode: { alignItems: 'center' },
    trailBackTitle: { fontSize: 22, fontWeight: 'bold', color: '#17a2b8' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 400 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    iconOption: { flex: 1, alignItems: 'center', marginBottom: 20 },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    iconLabel: { fontSize: 12, color: '#333', marginTop: 5 },
    closeModal: { marginTop: 20, padding: 15, alignItems: 'center' },
    closeText: { color: '#666', fontSize: 16 },
    descriptionSection: { padding: 5 },
    descriptionInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 15, fontSize: 16, minHeight: 80 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f3f5', borderRadius: 12, marginBottom: 20, paddingHorizontal: 10 },
    searchInput: { flex: 1, height: 45 },
    keyboardAvoidingView: { width: '100%' },
    startBigBtn: { backgroundColor: '#28a745', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 15 },
    accuracyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    accuracyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    accuracyText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
    navBanner: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: '#007bff', borderRadius: 15, padding: 15, zIndex: 1001, flexDirection: 'row' },
    navBannerAlert: { backgroundColor: '#dc3545' },
    navIconContainer: { marginRight: 15 },
    navTextContainer: { flex: 1 },
    navDistance: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    navUnit: { fontSize: 12, fontWeight: 'normal' },
    navStatus: { color: 'white', fontSize: 14 },
    navClose: { padding: 5 },
    recenterBtn: { position: 'absolute', bottom: 270, right: 20, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 6 },
    mediaButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    mediaBtn: { backgroundColor: '#6c757d', padding: 10, borderRadius: 8, flex: 0.48, alignItems: 'center' },
    mediaBtnText: { color: 'white', fontWeight: 'bold' },
    waypointThumbnail: { width: 70, height: 70, borderRadius: 8, marginRight: 10 },
    pinDetailThumbnail: { width: 120, height: 120, borderRadius: 8, marginRight: 10 },
    pinDescText: { fontSize: 15, color: '#444', marginBottom: 10 },
    userMarkerContainer: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60 },
    userMarkerPulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,123,255,0.4)' },
    userMarkerContainerInner: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    userMarkerDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#007bff', borderWidth: 3, borderColor: 'white' },
    userMarkerArrow: { position: 'absolute', top: -6 }
});
