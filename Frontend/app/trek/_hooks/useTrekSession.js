import { useReducer, useEffect, useRef, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import { trekReducer, INITIAL_STATE } from '../_store/trekReducer';
import { TrekService } from '../_services/trekService';
import { useSmartLocation } from '../../../hooks/useSmartLocation';
import { useCompass } from '../../../hooks/useCompass';

// Sub-hooks
import { useTrackingEngine } from './useTrackingEngine';
import { useNavigationEngine } from './useNavigationEngine';
import { usePathProcessor } from './usePathProcessor';
import { useSimulationEngine } from './useSimulationEngine';
import { useTrekBack } from './useTrekBack';
import { useOffTrailAlerts } from './useOffTrailAlerts';
import { TREK_CONFIG, ACTIONS } from '../_utils/constants';
import { getRegionForCoordinates } from '../../../utils/geoUtils';

export function useTrekSession(params) {
    const [state, dispatch] = useReducer(trekReducer, {
        ...INITIAL_STATE,
        trailId: params.trailId && params.trailId !== params.uploadedTrailId ? String(params.trailId) : null,
        hasJoinedTrail: !params.uploadedTrailId && !params.trailId,
    });

    const mapRef = useRef(null);

    // 1. Unified Location Logic
    const { 
        location: validatedLocation, 
        smoothedLocation, 
        gpsAccuracy, 
        accuracyStatus,
        error: locationError
    } = useSmartLocation(state.isTracking || state.isTrailingBack || !state.hasStarted);
    
    const userHeading = useCompass(!state.trailFinished);
    
    // Choose Source Location
    const activeLocation = useMemo(() => {
        return state.simulation.isActive ? state.simulation.location : smoothedLocation;
    }, [state.simulation.isActive, state.simulation.location, smoothedLocation]);

    // 2. Load Existing Trail Data (Initialization)
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                return Alert.alert('Permission to access location was denied');
            }

            if (params.trailId) {
                try {
                    const data = await TrekService.getTrek(params.trailId);
                    let mappedSegments = [];
                    if (data.path && data.path.coordinates) {
                        if (data.path.type === 'MultiLineString') {
                            mappedSegments = data.path.coordinates.map(segment => 
                                segment.map(p => ({ latitude: p[1], longitude: p[0] }))
                            );
                        } else {
                            mappedSegments = [data.path.coordinates.map(p => ({ latitude: p[1], longitude: p[0] }))];
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
    }, [params.trailId]);

    // 3. Load Uploaded Base Trail (Reference)
    useEffect(() => {
        if (!params.uploadedTrailId) return;

        const loadUploadedTrail = async () => {
            try {
                const data = await TrekService.getTrek(params.uploadedTrailId);
                if (data.path && data.path.coordinates) {
                    let mappedRoute = [];
                    if (data.path.type === 'MultiLineString') {
                        mappedRoute = data.path.coordinates.map(segment => segment.map(p => ({ latitude: p[1], longitude: p[0] }))).flat();
                    } else {
                        mappedRoute = data.path.coordinates.map(p => ({ latitude: p[1], longitude: p[0] }));
                    }
                    dispatch({ type: ACTIONS.UI_ACTION, payload: { targetRoute: mappedRoute, navigationPolyline: mappedRoute } });
                    
                    if (mappedRoute.length > 0 && mapRef.current) {
                        mapRef.current.animateCamera({ center: mappedRoute[0], zoom: 16 }, { duration: 1500 });
                    }
                }
                if (data.waypoints) dispatch({ type: ACTIONS.UI_ACTION, payload: { baseWaypoints: data.waypoints } });
            } catch (err) {
                console.error("Failed to load base trail", err);
            }
        };
        loadUploadedTrail();
    }, [params.uploadedTrailId]);

    // 4. Attach Engine Hooks
    useTrackingEngine(state, dispatch, activeLocation);
    usePathProcessor(state, dispatch, activeLocation);
    const { retracePath } = useNavigationEngine(state, dispatch, activeLocation);
    const { toggleSimulation } = useSimulationEngine(state, dispatch);
    
    // Feature Hooks (Separated as requested)
    useTrekBack(state, dispatch);
    useOffTrailAlerts(state);

    // 5. Shared UI Updates (Location Sync)
    useEffect(() => {
        if (!activeLocation) return;
        dispatch({ 
            type: ACTIONS.UI_ACTION, 
            payload: { location: { latitude: activeLocation.latitude, longitude: activeLocation.longitude } } 
        });
    }, [activeLocation]);

    // 6. Camera & Map Interactions
    useEffect(() => {
        if (!activeLocation || !mapRef.current) return;

        if (state.trailFinished) {
            const fullPath = state.pathSegments.flat();
            if (fullPath.length > 0) {
                mapRef.current.fitToCoordinates(fullPath, {
                    edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                    animated: true
                });
            }
            return;
        }

        if (state.mapViewMode !== 'explore') {
             mapRef.current.animateCamera({
                center: { latitude: activeLocation.latitude, longitude: activeLocation.longitude },
                pitch: state.mapViewMode === 'navigation' ? 45 : 0, 
                heading: state.mapViewMode === 'navigation' ? userHeading : 0,
                altitude: 500,
                zoom: 18
            }, { duration: 1000 });
        }
    }, [activeLocation, state.mapViewMode, userHeading, state.trailFinished]);

    // 6. Master Functional Logic
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
            if (isSimulating) toggleSimulation(activeLocation);
            if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) { console.error(e); }
    };

    const stopTrek = async () => {
        Alert.alert("Finish Trail?", "Ready to end?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Finish",
                onPress: async () => {
                    dispatch({ type: ACTIONS.STOP_TREK });
                    if (state.trailId && !state.simulation.isActive) {
                       await TrekService.updateTrek(state.trailId, { isCompleted: true, stats: state.stats, endTime: new Date() });
                    }
                }
            }
        ]);
    };

    const togglePause = () => {
        const paused = !state.isPaused;
        dispatch({ type: paused ? ACTIONS.PAUSE_TREK : ACTIONS.RESUME_TREK });
        // Set resume ref flag to cause new segment (handled in Tracking Engine)
        if (!paused) dispatch({ type: ACTIONS.UI_ACTION, payload: { resumedFromPause: true } });
    };

    // Auto-start Simulation logic for orchestrator
    useEffect(() => {
        if (params.simulate === 'true' && !state.hasStarted) {
             setTimeout(startTrek, TREK_CONFIG.AUTO_START_DELAY);
        }
    }, [params.simulate]);

    return {
        state,
        dispatch,
        mapRef,
        userHeading,
        accuracyStatus,
        locationError,
        startTrek,
        stopTrek,
        togglePause,
        retracePath
    };
}
