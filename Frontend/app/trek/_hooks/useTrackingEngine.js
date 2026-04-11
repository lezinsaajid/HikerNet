import { useEffect, useRef } from 'react';
import { getDistance } from '../../../utils/geoUtils';
import { TrekService } from '../_services/trekService';
import { TREK_CONFIG, ACTIONS } from '../_utils/constants';

export function useTrackingEngine(state, dispatch, location) {
    const lastStatsPointRef = useRef(null);
    const lastSyncRef = useRef(0);
    const startTimeRef = useRef(Date.now());

    // 🔥 STATE REF (prevents stale state issues)
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // 1. Stats Counter
    useEffect(() => {
        let timer = null;

        if (state.isTracking && !state.isPaused && !state.trailFinished) {
            timer = setInterval(() => {
                dispatch({
                    type: ACTIONS.UPDATE_STATS,
                    payload: {
                        duration: stateRef.current.stats.duration + 1
                    }
                });
            }, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [state.isTracking, state.isPaused, state.trailFinished]);

    // 2. Tracking Core
    useEffect(() => {
        const currentState = stateRef.current;

        if (
            !currentState.isTracking ||
            currentState.isPaused ||
            currentState.trailFinished ||
            currentState.isTrailingBack
        ) return;

        if (!location) return;

        const { latitude, longitude, altitude } = location;
        const newPoint = { latitude, longitude };

        // 🔥 Stabilization phase (ignore first 5s)
        if (Date.now() - startTimeRef.current < 5000) {
            lastStatsPointRef.current = { latitude, longitude, altitude };
            return;
        }

        // 🔥 Deep clone segments
        let segments = currentState.pathSegments.map(seg => [...seg]);

        // 🔥 Handle empty segments safely
        if (segments.length === 0) {
            segments = [[newPoint]];
        }

        const lastSegIdx = segments.length - 1;
        const lastSeg = segments[lastSegIdx];

        let isNewSegment = false;

        if (lastSeg.length > 0) {
            const lastPoint = lastSeg[lastSeg.length - 1];

            const dist = getDistance(
                latitude,
                longitude,
                lastPoint.latitude,
                lastPoint.longitude
            );

            if (
                currentState.resumedFromPause &&
                dist > TREK_CONFIG.NEW_SEGMENT_THRESHOLD
            ) {
                isNewSegment = true;

                dispatch({
                    type: ACTIONS.UI_ACTION,
                    payload: { resumedFromPause: false }
                });
            }
        }

        // 🔥 Segment update
        if (isNewSegment) {
            segments.push([newPoint]);
        } else {
            segments[lastSegIdx] = [...lastSeg, newPoint];
        }

        // 🔥 Stats calculation
        const newStats = { ...currentState.stats };

        let distM = 0;

        if (lastStatsPointRef.current) {
            distM = getDistance(
                latitude,
                longitude,
                lastStatsPointRef.current.latitude,
                lastStatsPointRef.current.longitude
            );
        }

        // 🔥 JITTER FILTER (CRITICAL)
        if (distM > 2) {
            newStats.distance += distM;
        }

        // 🔥 Altitude-safe logic
        if (
            altitude != null &&
            lastStatsPointRef.current?.altitude != null &&
            altitude > lastStatsPointRef.current.altitude
        ) {
            newStats.elevationGain +=
                altitude - lastStatsPointRef.current.altitude;
        }

        newStats.maxAltitude = Math.max(
            newStats.maxAltitude,
            altitude || 0
        );

        // 🔥 Avg speed
        newStats.avgSpeed =
            newStats.duration > 0
                ? parseFloat(
                    (
                        (newStats.distance / 1000) /
                        (newStats.duration / 3600)
                    ).toFixed(1)
                )
                : 0;

        lastStatsPointRef.current = { latitude, longitude, altitude };

        dispatch({
            type: ACTIONS.UPDATE_LOCATION,
            payload: {
                pathSegments: segments,
                routeCoordinates: segments.flat(),
                stats: newStats
            }
        });

        // 🔥 THROTTLED BACKEND SYNC (every 5 sec)
        const now = Date.now();

        if (
            currentState.trailId &&
            !currentState.simulation?.isActive &&
            now - lastSyncRef.current > 5000
        ) {
            lastSyncRef.current = now;

            TrekService.updateTrek(currentState.trailId, {
                coordinates: [newPoint],
                isNewSegment
            }).catch((e) =>
                console.error('Tracking sync error', e)
            );
        }

    }, [location]);

    return {};
}