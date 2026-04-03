import { useEffect, useRef } from 'react';
import { getDistance } from '../../../utils/geoUtils';
import { TrekService } from '../services/trekService';
import { TREK_CONFIG, ACTIONS } from '../utils/constants';

export function useTrackingEngine(state, dispatch, location) {
    const lastStatsPointRef = useRef(null);
    const resumedFromPauseRef = useRef(false);

    // 1. Stats Counter Effect
    useEffect(() => {
        let timer = null;
        if (state.isTracking && !state.isPaused && !state.trailFinished) {
            timer = setInterval(() => {
                dispatch({ 
                    type: 'UPDATE_STATS', 
                    payload: { duration: state.stats.duration + 1 } 
                });
            }, 1000);
        }
        return () => timer && clearInterval(timer);
    }, [state.isTracking, state.isPaused, state.trailFinished, state.stats.duration]);

    // 2. Tracking Core Effect
    useEffect(() => {
        if (!state.isTracking || state.isPaused || state.trailFinished) return;
        if (!location) return;

        const { latitude, longitude, altitude } = location;
        const newPoint = { latitude, longitude };

        // Handle Segment Logic
        const segments = [...state.pathSegments];
        const lastSegIdx = segments.length - 1;
        const lastSeg = segments[lastSegIdx];
        
        let isNewSegment = false;
        if (lastSeg && lastSeg.length > 0) {
            const lastPathPoint = lastSeg[lastSeg.length - 1];
            const dist = getDistance(latitude, longitude, lastPathPoint.latitude, lastPathPoint.longitude);
            
            // Check for manual resume from pause (NEW_SEGMENT_THRESHOLD = 20m)
            if (state.resumedFromPause && dist > 20) {
                isNewSegment = true;
                dispatch({ type: 'UI_ACTION', payload: { resumedFromPause: false } });
            }
        }

        // Add point to segments
        if (isNewSegment || (segments.length === 1 && segments[0].length === 0)) {
            if (segments.length === 1 && segments[0].length === 0) {
                segments[0] = [newPoint];
            } else {
                segments.push([newPoint]);
            }
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

        dispatch({ 
            type: 'UPDATE_LOCATION', 
            payload: { 
                pathSegments: segments, 
                routeCoordinates: segments.flat(),
                stats: newStats
            } 
        });

        // Backend Sync (Skip for simulation)
        if (state.trailId && !state.simulation.isActive) {
            TrekService.updateTrek(state.trailId, { 
                coordinates: [newPoint], 
                isNewSegment 
            }).catch(e => console.error("Tracking sync error", e));
        }

    }, [location, state.isTracking, state.isPaused, state.trailFinished]);

    return {
        setResumed: (val) => { resumedFromPauseRef.current = val; }
    };
}
