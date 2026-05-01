import { useEffect, useReducer, useRef, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { trekReducer, INITIAL_STATE, ACTIONS } from '../_store/trekReducer';
import { TrekService } from '../_services/trekService';
import { useSmartLocation } from '../../../hooks/useSmartLocation';
import { useCompass } from '../../../hooks/useCompass';

// Feature-specific engines (The "one function/hook per feature" approach)
import { useTrackingEngine } from './useTrackingEngine';
import { useNavigationEngine } from './useNavigationEngine';
import { useSimulationEngine } from './useSimulationEngine';
import { useRestMode } from './useRestMode';

import { TREK_CONFIG } from '../_utils/constants';

export function useTrekLogic(params) {
    const [state, dispatch] = useReducer(trekReducer, {
        ...INITIAL_STATE,
        trailId: params.trailId && params.trailId !== params.uploadedTrailId ? String(params.trailId) : null,
        hasJoinedTrail: !params.uploadedTrailId && !params.trailId,
    });

    const mapRef = useRef(null);
    const resumedFromPauseRef = useRef(false);
    const hasAlertedCompletion = useRef(false);

    // 1. Context Hooks
    const { 
        location: validatedLocation, 
        smoothedLocation, 
        gpsAccuracy, 
        accuracyStatus 
    } = useSmartLocation(state.isTracking || state.isTrailingBack || !state.hasStarted);
    
    const userHeading = useCompass(!state.trailFinished);

    // Determine current active location (Real vs Simulated)
    const activeLocation = useMemo(() => 
        state.simulation.isActive ? state.simulation.location : validatedLocation,
    [state.simulation.isActive, state.simulation.location, validatedLocation]);

    // 2. Specialized Engines (Delegating features to specific hooks)
    useTrackingEngine(state, dispatch, activeLocation);
    const { retracePath } = useNavigationEngine(state, dispatch, activeLocation);
    const { toggleSimulation } = useSimulationEngine(state, dispatch);
    const { startRest, stopRest } = useRestMode(state, dispatch);

    // 3. Initial Load Effects
    useEffect(() => {
        const loadInitialData = async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location access is required for trekking.');
                return;
            }

            if (params.trailId) {
                try {
                    const data = await TrekService.getTrek(params.trailId);
                    dispatch({ type: ACTIONS.INITIALIZE_TREK_DATA, payload: mapBackendTrekToState(data, state) });
                } catch (e) {
                    console.error("Failed to load trek data", e);
                }
            }
        };
        loadInitialData();
    }, [params.trailId]);

    useEffect(() => {
        if (!params.uploadedTrailId) return;
        const loadUploadedTrail = async () => {
            try {
                const data = await TrekService.getTrek(params.uploadedTrailId);
                const mapped = mapBackendTrekToState(data, state);
                dispatch({ type: ACTIONS.UI_ACTION, payload: { targetRoute: mapped.targetRoute, navigationPolyline: mapped.navigationPolyline, baseWaypoints: mapped.markers } });
                
                if (mapped.targetRoute.length > 0 && mapRef.current) {
                    mapRef.current.animateCamera({ center: mapped.targetRoute[0], altitude: 2000, zoom: 16 }, { duration: 1500 });
                }
            } catch (err) {
                console.error("Failed to load base trail", err);
            }
        };
        loadUploadedTrail();
    }, [params.uploadedTrailId]);

    // 4. Camera & UI Sync
    useEffect(() => {
        if (!activeLocation) return;
        
        if (mapRef.current && state.mapViewMode !== 'explore') {
            mapRef.current.animateCamera({
                center: activeLocation,
                pitch: state.mapViewMode === 'navigation' ? 45 : 0, 
                heading: state.mapViewMode === 'navigation' ? userHeading : 0,
                altitude: 500,
                zoom: 18
            }, { duration: 1000 });
        }

        dispatch({ type: ACTIONS.UI_ACTION, payload: { location: activeLocation } });
    }, [activeLocation, state.mapViewMode, userHeading]);

    // 5. Action Handlers
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

    const togglePause = () => {
        const paused = !state.isPaused;
        dispatch({ type: paused ? ACTIONS.PAUSE_TREK : ACTIONS.RESUME_TREK });
        if (!paused) {
            resumedFromPauseRef.current = true;
            dispatch({ type: ACTIONS.UI_ACTION, payload: { resumedFromPause: true } });
        }
    };

    // 6. Auto-start Simulation
    useEffect(() => {
        if (params.simulate === 'true' && !state.hasStarted) {
            setTimeout(() => {
                toggleSimulation(activeLocation);
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
        handleSimulation: toggleSimulation,
        togglePause,
        startRest,
        stopRest
    };
}

// --- Helpers ---

function mapBackendTrekToState(data, currentState) {
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

    const flatPath = mappedSegments.flat();
    return {
        pathSegments: mappedSegments,
        routeCoordinates: flatPath,
        targetRoute: flatPath,
        navigationPolyline: flatPath,
        markers: data.waypoints || [],
        stats: { ...currentState.stats, ...(data.stats || {}) },
        isTracking: data.status === 'ongoing',
        hasStarted: data.status === 'ongoing' || data.status === 'completed',
        trailFinished: data.status === 'completed',
    };
}

