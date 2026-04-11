import { useEffect, useReducer, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { trekReducer, INITIAL_STATE, ACTIONS } from '../_store/trekReducer';
import { TrekService } from '../_services/trekService';
import { useSmartLocation } from '../../../hooks/useSmartLocation';
import { useCompass } from '../../../hooks/useCompass';
import { getDistance, getPointToPathDistance, calculateHeading } from '../../../utils/geoUtils';
import { detectIntersectionLoop } from '../../../utils/trekUtils';
import { TREK_CONFIG, NAVIGATION_CONFIG } from '../_utils/constants';

export function useTrekLogic(params) {
    const [state, dispatch] = useReducer(trekReducer, {
        ...INITIAL_STATE,
        trailId: params.trailId && params.trailId !== params.uploadedTrailId ? String(params.trailId) : null,
        hasJoinedTrail: !params.uploadedTrailId && !params.trailId,
    });

    const { name, description, location: initialLocation, trailId: paramTrailId, uploadedTrailId } = params;

    const mapRef = useRef(null);
    const lastStatsPointRef = useRef(null);
    const resumedFromPauseRef = useRef(false);
    const loopCooldownRef = useRef(0);
    const hasAlertedOffTrack = useRef(false);
    const hasAlertedCompletion = useRef(false);
    const simIntervalRef = useRef(null);

    // Context Hooks
    const { 
        location: validatedLocation, 
        smoothedLocation, 
        gpsAccuracy, 
        accuracyStatus 
    } = useSmartLocation(state.isTracking || state.isTrailingBack || !state.hasStarted);
    
    const userHeading = useCompass(!state.trailFinished);

    // 1. Initial Load Effect
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }

            if (paramTrailId) {
                try {
                    const data = await TrekService.getTrek(paramTrailId);
                    
                    let mappedSegments = [];
                    if (data.path && data.path.coordinates) {
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
                    }

                    dispatch({
                        type: ACTIONS.INITIALIZE_TREK_DATA,
                        payload: {
                            pathSegments: mappedSegments,
                            routeCoordinates: mappedSegments.flat(),
                            targetRoute: mappedSegments.flat(),
                            navigationPolyline: mappedSegments.flat(),
                            markers: data.waypoints || [],
                            stats: { ...state.stats, ...(data.stats || {}) },
                            isTracking: data.status === 'ongoing',
                            hasStarted: data.status === 'ongoing' || data.status === 'completed',
                            trailFinished: data.status === 'completed',
                        }
                    });
                } catch (e) {
                    console.error("Failed to load existing trek data", e);
                }
            }
        })();
    }, [paramTrailId]);

    // 2. Uploaded Trail Load Effect
    useEffect(() => {
        if (!uploadedTrailId) return;

        const loadUploadedTrail = async () => {
            try {
                const data = await TrekService.getTrek(uploadedTrailId);
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
                    dispatch({ type: ACTIONS.UI_ACTION, payload: { targetRoute: mappedRoute, navigationPolyline: mappedRoute } });
                    
                    if (mappedRoute.length > 0 && mapRef.current) {
                        mapRef.current.animateCamera({
                            center: mappedRoute[0],
                            altitude: 2000,
                            zoom: 16
                        }, { duration: 1500 });
                    }
                }
                if (data.waypoints) {
                    dispatch({ type: ACTIONS.UI_ACTION, payload: { baseWaypoints: data.waypoints } });
                }
            } catch (err) {
                console.error("Failed to load base trail", err);
            }
        };
        loadUploadedTrail();
    }, [uploadedTrailId]);

    // 3. Navigation Update Logic
    useEffect(() => {
        const rawLoc = state.simulation.isActive ? state.simulation.location : smoothedLocation;
        if (!rawLoc) return;
        const currentLoc = { latitude: rawLoc.latitude, longitude: rawLoc.longitude };
        
        let displayLoc = currentLoc;
        const navPoly = state.navigationPolyline;

        if (navPoly.length >= 2) {
            const searchIndex = state.hasJoinedTrail ? state.navigation.currentNavIndex : -1;
            const searchWindow = state.hasJoinedTrail ? 30 : -1;

            const result = getPointToPathDistance(currentLoc, navPoly, searchIndex, searchWindow);
            const { distance, snappedPoint, segmentIndex } = result;

            // Progress tracking
            const navUpdates = {
                navigation: {
                    ...state.navigation,
                    distanceToTrail: Math.round(distance),
                }
            };

            if (segmentIndex >= 0 && distance <= 15) {
                navUpdates.navigation.currentNavIndex = segmentIndex;
                if (segmentIndex > navPoly.length * 0.5) {
                    navUpdates.hasReachedMidpoint = true;
                }
            }

            // JOIN TRAIL check (if close to start/any point)
            if (!state.hasJoinedTrail) {
                const startPoint = navPoly[0];
                const distToStart = getDistance(currentLoc.latitude, currentLoc.longitude, startPoint.latitude, startPoint.longitude);
                
                if (distToStart <= NAVIGATION_CONFIG.START_PROXIMITY) {
                   navUpdates.navigation.guidance = "You have reached the starting point.";
                   navUpdates.hasJoinedTrail = true;
                   if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                   navUpdates.reroutePath = [];
                } else {
                   if (!state.reroutePath?.length && distToStart > NAVIGATION_CONFIG.ROAD_REROUTE_MIN_DISTANCE) {
                       TrekService.fetchRoadRoute(currentLoc, startPoint).then(path => {
                           if (path) dispatch({ type: ACTIONS.UI_ACTION, payload: { reroutePath: path } });
                       });
                   }
                   navUpdates.navigation.guidance = `Navigate to start (${Math.round(distToStart)}m).`;
                   navUpdates.navigation.targetBearing = calculateHeading(currentLoc, startPoint);
                }
            } else {
                // OFF TRAIL check
                if (distance > NAVIGATION_CONFIG.OFF_TRACK_THRESHOLD) {
                    if (!state.navigation.offTrackWarning) {
                        navUpdates.navigation.offTrackWarning = true;
                        navUpdates.navigation.guidance = `Off trail! Head back.`;
                        if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                    navUpdates.reroutePath = [currentLoc, snappedPoint];
                    navUpdates.navigation.targetBearing = calculateHeading(currentLoc, snappedPoint);
                } else if (state.navigation.offTrackWarning && distance <= NAVIGATION_CONFIG.ON_TRACK_THRESHOLD) {
                    navUpdates.navigation.offTrackWarning = false;
                    navUpdates.navigation.guidance = "Back on track.";
                    navUpdates.reroutePath = [];
                }

                // TARGET BEARING update
                let targetIdx = Math.min(navPoly.length - 1, (segmentIndex >= 0 ? segmentIndex : state.navigation.currentNavIndex) + 1);
                const targetPoint = navPoly[targetIdx];
                if (targetPoint) {
                    navUpdates.navigation.targetBearing = calculateHeading(currentLoc, targetPoint);
                }

                // FINISH check
                if (!state.trailFinished) {
                    const finalPoint = navPoly[navPoly.length - 1];
                    const distToGoal = getDistance(currentLoc.latitude, currentLoc.longitude, finalPoint.latitude, finalPoint.longitude);
                    if (distToGoal < NAVIGATION_CONFIG.GOAL_PROXIMITY && state.hasReachedMidpoint && !hasAlertedCompletion.current) {
                        hasAlertedCompletion.current = true;
                        if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        
                        if (state.isTrailingBack) {
                            Alert.alert("Trek Completed", "Return journey finished.");
                            dispatch({ type: ACTIONS.UI_ACTION, payload: { isTrailingBack: false, navigationPolyline: [], flowState: 'idle' } });
                        } else {
                            navUpdates.trailFinished = true;
                            navUpdates.navigation.guidance = "Arrived!";
                        }
                    }
                }
            }
            dispatch({ type: ACTIONS.UPDATE_NAVIGATION, payload: navUpdates });
        }

        // Camera Update
        if (mapRef.current && state.mapViewMode !== 'explore') {
            mapRef.current.animateCamera({
                center: displayLoc,
                pitch: state.mapViewMode === 'navigation' ? 45 : 0, 
                heading: state.mapViewMode === 'navigation' ? userHeading : 0,
                altitude: 500,
                zoom: 18
            }, { duration: 1000 });
        }

        dispatch({ type: ACTIONS.UI_ACTION, payload: { location: displayLoc } });

    }, [smoothedLocation, state.simulation.location, state.simulation.isActive, state.isTracking, state.isTrailingBack, state.navigationPolyline, state.mapViewMode, userHeading]);

    // 5. Simulation Logic
    useEffect(() => {
        if (!state.simulation.isActive || !state.isTracking || state.isPaused || state.trailFinished) {
            if (simIntervalRef.current) clearInterval(simIntervalRef.current);
            return;
        }

        const runSim = () => {
            const path = state.isTrailingBack ? state.navigationPolyline : state.targetRoute;
            if (!path || path.length === 0) return;

            const stepSize = 1; 
            const currentIndex = state.navigation.currentNavIndex;
            const nextIdx = Math.min(path.length - 1, currentIndex + stepSize);
            const nextLoc = path[nextIdx];

            dispatch({ 
                type: ACTIONS.SET_SIMULATION, 
                payload: { 
                    location: { ...nextLoc, altitude: 100, timestamp: Date.now() },
                    phase: state.isTrailingBack ? "Simulating Return..." : "Simulating Forward..."
                } 
            });
        };

        simIntervalRef.current = setInterval(runSim, 1000);
        return () => simIntervalRef.current && clearInterval(simIntervalRef.current);
    }, [state.simulation.isActive, state.isTracking, state.isPaused, state.trailFinished, state.isTrailingBack, state.navigationPolyline, state.targetRoute, state.navigation.currentNavIndex]);

    // 4. Tracking and Stats Recording
    useEffect(() => {
        if ((!state.isTracking && !state.isTrailingBack) || state.trailFinished || state.isPaused) return;
        
        const activeLocation = state.simulation.isActive ? state.simulation.location : validatedLocation;
        if (!activeLocation) return;

        const { latitude, longitude, altitude } = activeLocation;
        const newPoint = { latitude, longitude };

        // Process Update
        const segments = [...state.pathSegments];
        const lastSegIdx = segments.length - 1;
        const lastSeg = segments[lastSegIdx];
        
        let isNewSegment = false;
        if (lastSeg && lastSeg.length > 0) {
            const lastPathPoint = lastSeg[lastSeg.length - 1];
            const dist = getDistance(latitude, longitude, lastPathPoint.latitude, lastPathPoint.longitude);
            if (resumedFromPauseRef.current && dist > TREK_CONFIG.NEW_SEGMENT_THRESHOLD) {
                isNewSegment = true;
                resumedFromPauseRef.current = false;
            }
        }

        // Add point
        if (isNewSegment) {
            segments.push([newPoint]);
        } else {
            segments[lastSegIdx] = [...(segments[lastSegIdx] || []), newPoint];
        }

        // Stats CALC
        const newStats = { ...state.stats };
        if (!state.isTrailingBack) {
            let distM = 0;
            if (lastStatsPointRef.current) {
                distM = getDistance(latitude, longitude, lastStatsPointRef.current.latitude, lastStatsPointRef.current.longitude);
            }
            newStats.distance += distM;
            if (lastStatsPointRef.current && altitude > lastStatsPointRef.current.altitude) {
                newStats.elevationGain += (altitude - lastStatsPointRef.current.altitude);
            }
            newStats.maxAltitude = Math.max(newStats.maxAltitude, altitude || 0);
            newStats.avgSpeed = newStats.duration > 0 ? parseFloat(((newStats.distance / 1000) / (newStats.duration / 3600)).toFixed(1)) : 0;
            
            lastStatsPointRef.current = { latitude, longitude, altitude };
        }

        // Loop detection
        if (!isNewSegment && loopCooldownRef.current <= 0) {
             const fullPath = segments.flat();
             const loopData = detectIntersectionLoop(newPoint, fullPath, fullPath.length, TREK_CONFIG.LOOP_DETECTION);
             if (loopData && loopData.isLoop) {
                 // simplified pruning
                 const loopStart = loopData.loopStartIndex;
                 let acc = 0;
                 const pruned = [];
                 let ghost = [];
                 for (const s of segments) {
                     const end = acc + s.length;
                     if (end <= loopStart) pruned.push(s);
                     else if (acc < loopStart) { 
                         pruned.push(s.slice(0, loopStart - acc + 1));
                         ghost = ghost.concat(s.slice(loopStart - acc + 1));
                     } else ghost = ghost.concat(s);
                     acc = end;
                 }
                 dispatch({ type: ACTIONS.DETECT_LOOP, payload: { pathSegments: pruned, routeCoordinates: pruned.flat(), ghostPart: ghost } });
                 loopCooldownRef.current = TREK_CONFIG.LOOP_COOLDOWN;
                 return;
             }
        }

        if (loopCooldownRef.current > 0) loopCooldownRef.current--;

        dispatch({ 
            type: ACTIONS.UPDATE_LOCATION, 
            payload: { 
                pathSegments: segments, 
                routeCoordinates: segments.flat(),
                stats: newStats
            } 
        });

        // Backend Sync
        if (state.trailId && !state.simulation.isActive) {
            TrekService.updateTrek(state.trailId, { coordinates: [newPoint], isNewSegment });
        }

    }, [validatedLocation, state.simulation.location, state.isTracking]);

    // TIMER Effect
    useEffect(() => {
        let timer = null;
        if (state.isTracking && !state.isPaused && !state.trailFinished) {
            timer = setInterval(() => {
                dispatch({ type: ACTIONS.UPDATE_STATS, payload: { duration: state.stats.duration + 1 } });
            }, 1000);
        }
        return () => timer && clearInterval(timer);
    }, [state.isTracking, state.isPaused, state.trailFinished, state.stats.duration]);

    // ACTION Handlers
    const startTrek = async () => {
        try {
            const isSimulating = params.simulate === 'true';
            let trekId = state.trailId;
            let startName = state.stats.startName || params.name;

            if (!trekId && !isSimulating) {
                const data = await TrekService.startTrek({
                    name: params.name || `New Trail ${new Date().toLocaleDateString()}`,
                    description: params.description || '',
                    location: params.location || '',
                    mode: 'solo'
                });
                trekId = data._id;
                startName = data.name;
            }

            dispatch({
                type: ACTIONS.START_TREK,
                payload: {
                    trailId: trekId || (isSimulating ? 'sim-session' : null),
                    navigationPolyline: state.targetRoute || [],
                    hasJoinedTrail: !state.targetRoute.length,
                    guidance: isSimulating ? "Simulation Mode" : "Trek Started",
                    startName: startName
                }
            });

            if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error(e);
        }
    };

    const stopTrek = async () => {
        Alert.alert("Finish Trail?", "Ready to end?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Finish",
                onPress: async () => {
                    dispatch({ type: ACTIONS.STOP_TREK });
                    if (state.trailId && !state.simulation.isActive) {
                       await TrekService.updateTrek(state.trailId, { 
                           isCompleted: true, 
                           stats: state.stats,
                           endTime: new Date()
                       });
                    }
                }
            }
        ]);
    };

    const retracePath = () => {
        const source = state.targetRoute.length > 0 ? state.targetRoute : state.routeCoordinates;
        if (source.length < 2) return;
        
        dispatch({
            type: ACTIONS.TRAIL_BACK,
            payload: {
                navigationPolyline: [...source].reverse(),
                hasJoinedTrail: false,
                navigation: { ...state.navigation, guidance: "Retracing path..." }
            }
        });
    };

    const handleSimulation = useCallback((location) => {
         dispatch({ type: ACTIONS.SET_SIMULATION, payload: { isActive: true, location } });
    }, []);

    // 6. Auto-start Simulation
    useEffect(() => {
        if (params.simulate === 'true' && !state.hasStarted) {
            setTimeout(() => {
                dispatch({ type: ACTIONS.SET_SIMULATION, payload: { isActive: true } });
                startTrek();
            }, TREK_CONFIG.AUTO_START_DELAY);
        }
    }, [params.simulate]);

    return {
        state,
        dispatch,
        mapRef,
        validatedLocation,
        smoothedLocation,
        gpsAccuracy,
        accuracyStatus,
        userHeading,
        startTrek,
        stopTrek,
        retracePath,
        handleSimulation,
        togglePause: () => {
            const paused = !state.isPaused;
            dispatch({ type: paused ? ACTIONS.PAUSE_TREK : ACTIONS.RESUME_TREK });
            if (!paused) resumedFromPauseRef.current = true;
        }
    };
}
