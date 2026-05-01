import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import client from '../../../api/client';
import { useSmartLocation } from '../../../hooks/useSmartLocation';
import { useCompass } from '../../../hooks/useCompass';
import { useGroupSync } from '../../../hooks/useGroupSync';
import { useTrackingEngine } from './useTrackingEngine';
import { useNavigationEngine } from './useNavigationEngine';
import { ACTIONS } from '../_utils/constants';

export function useGroupTrekLogic(params, currentUser) {
    const { trailId: paramTrailId, uploadedTrailId, role, leaderId } = params;

    // 1. Local State (Syncing with useTrackingEngine/useNavigationEngine via state/dispatch)
    // For GroupTrek, we'll keep it simple and use standard state first, 
    // but ideally we'd use a reducer like solo-trek.
    // For now, let's extract the core logic from group-trek.jsx
    
    const [trailId, setTrailId] = useState(String(paramTrailId));
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [trailFinished, setTrailFinished] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    
    // We'll use a local "state" object to satisfy the engines
    const [mockState, setMockState] = useState({
        isTracking: false,
        isPaused: false,
        trailFinished: false,
        pathSegments: [[]],
        stats: { distance: 0, duration: 0, elevationGain: 0, avgSpeed: 0, maxAltitude: -Infinity },
        navigationPolyline: [],
        targetRoute: [],
        currentNavIndex: 0,
        hasJoinedTrail: !uploadedTrailId
    });

    const dispatch = useCallback((action) => {
        // A minimal dispatcher to keep engines happy
        if (action.type === ACTIONS.UPDATE_LOCATION) {
            setMockState(prev => ({ ...prev, ...action.payload }));
        } else if (action.type === ACTIONS.UPDATE_STATS) {
            setMockState(prev => ({ ...prev, stats: { ...prev.stats, ...action.payload } }));
        } else if (action.type === ACTIONS.UPDATE_NAVIGATION) {
            setMockState(prev => ({ ...prev, ...action.payload }));
        }
    }, []);

    const { location: validatedLocation, smoothedLocation } = useSmartLocation(isTracking || !hasStarted);
    const userHeading = useCompass(!trailFinished);

    // 2. Group Sync Engine
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
                setMockState(prev => ({ ...prev, isTracking: true }));
            }
            if (action === 'PAUSE') setIsPaused(true);
            if (action === 'RESUME') setIsPaused(false);
            if (action === 'STOP') {
                setTrailFinished(true);
                setIsTracking(false);
            }
        },
        onWaypointReceived: (waypoint) => {
            // handle waypoints
        }
    });

    // 3. Feature Engines
    useTrackingEngine(mockState, dispatch, smoothedLocation);
    const { retracePath } = useNavigationEngine(mockState, dispatch, smoothedLocation);

    // 4. Group Specific Effects
    useEffect(() => {
        if (isTracking && !isPaused && !trailFinished) {
            emitLocation(smoothedLocation, mockState.navigation?.offTrackWarning, mockState.navigation?.distanceToTrail);
        }
    }, [smoothedLocation, isTracking, isPaused, trailFinished]);

    const startTrek = () => {
        if (role !== 'leader') return;
        setIsTracking(true);
        setHasStarted(true);
        emitControl('START');
    };

    return {
        state: mockState,
        location: smoothedLocation,
        userHeading,
        participants,
        startTrek,
        stopTrek: () => emitControl('STOP'),
        togglePause: () => {
            const newState = !isPaused;
            setIsPaused(newState);
            emitControl(newState ? 'PAUSE' : 'RESUME');
        }
    };
}
