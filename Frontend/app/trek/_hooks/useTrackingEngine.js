import { useEffect, useRef } from 'react';
import { getDistance } from '../../../utils/geoUtils';
import { TrekService } from '../_services/trekService';
import { TREK_CONFIG, ACTIONS } from '../_utils/constants';

export function useTrackingEngine(state, dispatch, location) {
    const lastStatsPointRef = useRef(null);

    // 1. Stats Counter Effect
    useEffect(() => {
        let timer = null;

        if (state.isTracking && !state.isPaused && !state.trailFinished) {
            timer = setInterval(() => {
                dispatch({
                    type: ACTIONS.UPDATE_STATS,
                    payload: { duration: state.stats.duration + 1 }
                });
            }, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [state.isTracking, state.isPaused, state.trailFinished, state.stats.duration]);

    // 2. Tracking Core Effect
    useEffect(() => {
        if (!state.isTracking || state.isPaused || state.trailFinished || state.isTrailingBack) return;
        if (!location) return;

        const { latitude, longitude, altitude } = location;
        const newPoint = { latitude, longitude };

        // Clone segments safely
        let segments = [...state.pathSegments];
        const lastSegIdx = segments.length - 1;
        const lastSeg = segments[lastSegIdx] || [];

        let isNewSegment = false;

        if (lastSeg.length > 0) {
            const lastPoint = lastSeg[lastSeg.length - 1];
            const dist = getDistance(
                latitude,
                longitude,
                lastPoint.latitude,
                lastPoint.longitude
            );

            // Use config instead of hardcoded value
            if (state.resumedFromPause && dist > TREK_CONFIG.NEW_SEGMENT_THRESHOLD) {
                isNewSegment = true;

                dispatch({
                    type: ACTIONS.UI_ACTION,
                    payload: { resumedFromPause: false }
                });
            }
        }

        // Segment handling
        if (isNewSegment || (segments.length === 1 && segments[0].length === 0)) {
            if (segments.length === 1 && segments[0].length === 0) {
                segments[0] = [newPoint];
            } else {
                segments.push([newPoint]);
            }
        } else {
            segments[lastSegIdx] = [...lastSeg, newPoint];
        }

        // Stats calculation
        const newStats = { ...state.stats };

        let distM = 0;

        if (lastStatsPointRef.current) {
            distM = getDistance(
                latitude,
                longitude,
                lastStatsPointRef.current.latitude,
                lastStatsPointRef.current.longitude
            );
        }

        newStats.distance += distM;

        if (
            lastStatsPointRef.current &&
            altitude > lastStatsPointRef.current.altitude
        ) {
            newStats.elevationGain +=
                altitude - lastStatsPointRef.current.altitude;
        }

        newStats.maxAltitude = Math.max(newStats.maxAltitude, altitude || 0);

        newStats.avgSpeed =
            newStats.duration > 0
                ? parseFloat(
                    ((newStats.distance / 1000) /
                        (newStats.duration / 3600)).toFixed(1)
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

        // Backend sync
        if (state.trailId && !state.simulation?.isActive) {
            TrekService.updateTrek(state.trailId, {
                coordinates: [newPoint],
                isNewSegment
            }).catch((e) =>
                console.error('Tracking sync error', e)
            );
        }
    }, [
        location,
        state.isTracking,
        state.isPaused,
        state.trailFinished,
        state.isTrailingBack,
        state.resumedFromPause,
        state.pathSegments
    ]);

    return {};
}