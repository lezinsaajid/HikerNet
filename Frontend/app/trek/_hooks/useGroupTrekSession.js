import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Alert, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import client from '../../../api/client';
import { useSmartLocation } from '../../../hooks/useSmartLocation';
import { useCompass } from '../../../hooks/useCompass';
import { useGroupSync } from '../../../hooks/useGroupSync';
import { useRestMode } from './useRestMode';
import { useGroupNavigation } from './useGroupNavigation';
import { useGroupLeaderEngine } from './useGroupLeaderEngine';

/**
 * Orchestrator hook for Group Trek sessions
 */
export function useGroupTrekSession({ trailId: initialTrailId, currentUser, leaderId, uploadedTrailId, router }) {
    const isLeader = leaderId === currentUser?._id;

    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [trailFinished, setTrailFinished] = useState(false); 
    const [isTrailingBack, setIsTrailingBack] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [hasJoinedTrail, setHasJoinedTrail] = useState(!uploadedTrailId);
    const [trailId, setTrailId] = useState(initialTrailId);
    
    const [stats, setStats] = useState({
        distance: 0,
        duration: 0,
        elevationGain: 0,
        avgSpeed: 0,
        maxAltitude: -Infinity
    });

    const [pathSegments, setPathSegments] = useState([[]]); 
    const [routeCoordinates, setRouteCoordinates] = useState([]); 
    const [navigationPolyline, setNavigationPolyline] = useState([]); 
    const [markers, setMarkers] = useState([]); 
    const [baseWaypoints, setBaseWaypoints] = useState([]); 
    const [mapType, setMapType] = useState('standard'); 
    const [mapViewMode, setMapViewMode] = useState('top-down'); 
    const [totalExpected, setTotalExpected] = useState(1);
    const [retraceFadedIndex, setRetraceFadedIndex] = useState(-1);
    const [isFollowingLeader, setIsFollowingLeader] = useState(false);
    const [groupMessage, setGroupMessage] = useState(null);
    const [messages, setMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [chatVisible, setChatVisible] = useState(false);
    const [ghostSegments, setGhostSegments] = useState([]);
    const [showMarkerModal, setShowMarkerModal] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(null);
    const [waypointDescription, setWaypointDescription] = useState('');
    const [waypointImages, setWaypointImages] = useState([]);
    const [selectedPinDetails, setSelectedPinDetails] = useState(null);
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [showRestModal, setShowRestModal] = useState(false);

    const mapRef = useRef(null);
    const messageAnim = useRef(new Animated.Value(-100)).current;

    // 1. Core Engines
    const {
        location: validatedLocation,
        smoothedLocation,
        gpsAccuracy,
        accuracyStatus,
        error: locationError
    } = useSmartLocation(isTracking || isTrailingBack || !hasStarted);

    const locationRef = useRef(smoothedLocation);
    useEffect(() => {
        locationRef.current = smoothedLocation;
    }, [smoothedLocation]);

    const userHeading = useCompass(!trailFinished); 

    const {
        isResting,
        restTimeLeft,
        warningMode,
        warningTimeLeft,
        startRest,
        endRest
    } = useRestMode(smoothedLocation);

    // 2. Messaging Logic
    const showMessage = useCallback((msg, duration = 5000, type = 'info') => {
        setGroupMessage({ text: msg, type });
        Animated.spring(messageAnim, { toValue: 0, useNativeDriver: true }).start();
        setTimeout(() => {
            Animated.timing(messageAnim, { toValue: -100, duration: 500, useNativeDriver: true }).start(() => {
                setGroupMessage(null);
            });
        }, duration);
    }, [messageAnim]);

    const completeTrekBack = (remote = false) => {
        setIsTrailingBack(false);
        setNavigationPolyline([]);
        setTrailFinished(true);
        setIsTracking(false);
        setMapViewMode('explore');
        if (!remote && isLeader) {
            sync.emitControl('FINISH_TREK_BACK');
        }
        Alert.alert("Trek Completed", "Return journey finished.");
    };

    // 3. Sync Logic
    const sync = useGroupSync({
        trailId,
        currentUser,
        isLeader,
        leaderId,
        baseUrl: client.defaults.baseURL,
        onControlAction: (payload) => {
            const action = typeof payload === 'string' ? payload : payload.action;
            const data = typeof payload === 'object' ? payload : {};

            if (action === 'START') {
                setHasStarted(true);
                setIsTracking(true);
                setHasJoinedTrail(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (action === 'PAUSE') {
                setIsPaused(true);
                if (data.reason === 'SAFETY_DEVIATION') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    showMessage(`AUTO-PAUSE: ${data.username} is too far! Waiting for regroup.`, 8000, 'danger');
                }
            } else if (action === 'RESUME') {
                setIsPaused(false);
                if (data.reason === 'SAFETY_DEVIATION') showMessage("Group regathered. Resuming trek.", 3000, 'info');
            } else if (action === 'STOP') {
                setTrailFinished(true);
                setIsTracking(false);
                showMessage("Trek Completed! Leader is reviewing summary.", 10000, 'success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (action === 'EXIT') {
                router.replace('/(tabs)/trek');
            } else if (action === 'TREKBACK') {
                initiateTrekBack(true);
            } else if (action === 'FINISH_TREK_BACK') {
                completeTrekBack(true);
            } else if (typeof action === 'object') {
                if (action.type === 'FINISH_TREK_BACK') {
                    completeTrekBack(true);
                } else if (action.type === 'LOOP_DETECTED') {
                    setPathSegments(action.pruned);
                    setRouteCoordinates(action.pruned.flat());
                    setGhostSegments(prev => [...prev, action.ghost]);
                }
            }
            
            if (payload.type === 'CENTROID') setGroupCentroid(payload.centroid);
            if (payload.type === 'SAFETY_ALERT') {
                if (payload.userId === currentUser?._id) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    showMessage(`SAFETY: You've deviated ${payload.deviation}m! Returning to group...`, 8000, 'danger');
                    if (payload.anchor && locationRef.current) {
                        client.get(`https://router.project-osrm.org/route/v1/foot/${locationRef.current.longitude},${locationRef.current.latitude};${payload.anchor.longitude},${payload.anchor.latitude}?overview=full&geometries=geojson`)
                            .then(res => {
                                if (res.data.routes?.[0]) setReroutePath(res.data.routes[0].geometry.coordinates.map(p => ({ latitude: p[1], longitude: p[0] })));
                            });
                    }
                } else if (isLeader) showMessage(`${payload.username} has deviated ${payload.deviation}m!`, 5000, 'warning');
            }
        },
        onWaypointReceived: (waypoint) => setMarkers(prev => [...prev, waypoint]),
        onPathReceived: (path, newPoint) => {
            setPathSegments(path);
            if (newPoint) setRouteCoordinates(prev => [...prev, newPoint]);
            else setRouteCoordinates(path.flat());
        },
        onDriftAlert: ({ username, isLeft }) => {
            if (isLeft) showMessage(`Member Left: ${username} has disconnected.`);
        },
        onChatMessage: (message) => {
            setMessages(prev => [...prev, message]);
            if (!chatVisible) setUnreadCount(c => c + 1);
            if (message.userId !== currentUser?._id) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    });

    // 4. Navigation Engine
    const {
        distanceToTrail,
        offTrackWarning,
        navGuidance,
        setNavGuidance,
        currentNavIndex,
        reroutePath,
        setReroutePath,
        groupCentroid,
        setGroupCentroid,
        trackingUserId,
        setTrackingUserId
    } = useGroupNavigation({
        smoothedLocation,
        navigationPolyline,
        hasJoinedTrail,
        isLeader,
        currentUser,
        leaderId,
        sync,
        mapRef,
        isFollowingLeader,
        setIsFollowingLeader,
        isTrailingBack,
        onFinishTrekBack: completeTrekBack
    });

    // 5. Leader Engine
    const { resumedFromPauseRef } = useGroupLeaderEngine({
        isLeader, isTracking, isTrailingBack, isPaused, trailFinished, validatedLocation, trailId,
        stats, setStats, setPathSegments, setRouteCoordinates, sync, showMessage
    });

    // 5.1 Timer Engine (For both Leader and Member)
    useEffect(() => {
        let timer = null;
        if (isTracking && !isPaused && !trailFinished && !offTrackWarning) {
            timer = setInterval(() => {
                setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
            }, 1000);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [isTracking, isPaused, trailFinished, offTrackWarning]);

    // 5.5 Emit Location
    useEffect(() => {
        if (!smoothedLocation || trailFinished) return;
        sync.emitLocation(smoothedLocation, offTrackWarning, distanceToTrail);
        const interval = setInterval(() => {
            sync.emitLocation(smoothedLocation, offTrackWarning, distanceToTrail);
        }, 3000);
        return () => clearInterval(interval);
    }, [smoothedLocation, trailFinished, offTrackWarning, distanceToTrail]);

    // 5.6 Trek Back Fading Logic
    useEffect(() => {
        if (!isTrailingBack || !isTracking || isPaused) return;
        if (distanceToTrail <= 15 && currentNavIndex > retraceFadedIndex) {
            setRetraceFadedIndex(currentNavIndex);
        }
    }, [isTrailingBack, isTracking, isPaused, distanceToTrail, currentNavIndex, retraceFadedIndex]);

    // 5.7 Camera & Map Interactions
    useEffect(() => {
        if (!smoothedLocation || !mapRef.current) return;

        if (trailFinished) {
            const fullPath = pathSegments.flat();
            if (fullPath.length > 0) {
                mapRef.current.fitToCoordinates(fullPath, {
                    edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                    animated: true
                });
            }
            return;
        }

        if (mapViewMode !== 'explore') {
             mapRef.current.animateCamera({
                center: { latitude: smoothedLocation.latitude, longitude: smoothedLocation.longitude },
                pitch: mapViewMode === 'navigation' ? 45 : 0, 
                heading: mapViewMode === 'navigation' ? userHeading : 0,
                altitude: 500,
                zoom: 20
            }, { duration: 1000 });
        }
    }, [smoothedLocation, mapViewMode, userHeading, trailFinished]);

    // Actions
    const startTrek = async () => {
        if (!isLeader) return;
        setIsTracking(true);
        setHasStarted(true);
        setHasJoinedTrail(true);
        setMapViewMode('navigation');
        sync.emitControl('START');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const startLoc = validatedLocation || smoothedLocation;
        if (startLoc) {
            const m = { latitude: startLoc.latitude, longitude: startLoc.longitude, icon: 'flag', type: 'Start Point', timestamp: new Date() };
            setMarkers([m]);
            sync.emitWaypoint(m);
        }
    };

    const togglePause = () => {
        if (!isLeader) return;
        const newState = !isPaused;
        setIsPaused(newState);
        sync.emitControl(newState ? 'PAUSE' : 'RESUME');
        if (!newState) resumedFromPauseRef.current = true;
    };

    const initiateTrekBack = (remote = false) => {
        const source = navigationPolyline.length > 0 ? navigationPolyline : pathSegments.flat();
        const validSource = source.filter(p => p && typeof p.latitude === 'number' && !isNaN(p.latitude) && typeof p.longitude === 'number' && !isNaN(p.longitude));
        if (validSource.length < 5) return showMessage("Not enough data to Trek-Back yet.", 3000, 'warning');
        setNavigationPolyline([...validSource].reverse());
        setIsTrailingBack(true);
        setHasJoinedTrail(true);
        setTrailFinished(false);
        setIsTracking(true);
        setMapViewMode('navigation');
        setRetraceFadedIndex(-1);
        if (!remote) sync.emitControl('TREKBACK');
    };

    return {
        state: {
            isTracking, isPaused, trailFinished, isTrailingBack, hasStarted, hasJoinedTrail,
            stats, pathSegments, routeCoordinates, navigationPolyline, markers, baseWaypoints,
            mapType, mapViewMode, totalExpected, isFollowingLeader, groupMessage, messages,
            unreadCount, chatVisible, distanceToTrail, offTrackWarning, navGuidance,
            reroutePath, groupCentroid, trackingUserId, gpsAccuracy, accuracyStatus, locationError,
            showMarkerModal, selectedIcon, waypointDescription, waypointImages, selectedPinDetails,
            iconSearchQuery, showRestModal, retraceFadedIndex, ghostSegments
        },
        actions: {
            setIsTracking, setIsPaused, setTrailFinished, setIsTrailingBack, setHasStarted,
            setHasJoinedTrail, setStats, setPathSegments, setRouteCoordinates, setNavigationPolyline,
            setMarkers, setBaseWaypoints, setMapType, setMapViewMode, setTotalExpected,
            setIsFollowingLeader, showMessage, setMessages, setUnreadCount, setChatVisible,
            setNavGuidance, setReroutePath, setGroupCentroid, setTrackingUserId,
            startTrek, togglePause, initiateTrekBack,
            setShowMarkerModal, setSelectedIcon, setWaypointDescription, setWaypointImages, setSelectedPinDetails,
            setIconSearchQuery, setShowRestModal
        },
        sync,
        mapRef,
        messageAnim,
        smoothedLocation,
        userHeading,
        isResting,
        restTimeLeft,
        warningMode,
        warningTimeLeft,
        startRest,
        endRest
    };
}
