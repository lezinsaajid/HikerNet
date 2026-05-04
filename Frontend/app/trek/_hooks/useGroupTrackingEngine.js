import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { ACTIONS } from '../_utils/constants';
import { getDistance } from '../../../utils/geoUtils';
import { detectIntersectionLoop } from '../../../utils/trekUtils';
import client from '../../../api/client';

/**
 * Hook to handle path recording for the Group Leader
 */
export function useGroupTrackingEngine(state, dispatch, location, isLeader, trailId) {
    const lastStatsPointRef = useRef(null);
    const loopCooldownRef = useRef(0);

    useEffect(() => {
        if (!isLeader || !state.isTracking || state.isPaused || state.trailFinished || !location) return;

        const { latitude, longitude, altitude } = location;
        const newPoint = { latitude, longitude };
        
        // Cooldown decrement
        if (loopCooldownRef.current > 0) loopCooldownRef.current--;

        // 1. Update Distance & Stats
        let distStep = 0;
        if (lastStatsPointRef.current) {
            distStep = getDistance(latitude, longitude, lastStatsPointRef.current.latitude, lastStatsPointRef.current.longitude);
        }
        
        // Jitter filter for stats
        if (distStep > 2 || !lastStatsPointRef.current) {
            const updatedStats = {
                ...state.stats,
                distance: state.stats.distance + distStep,
                elevationGain: state.stats.elevationGain + (lastStatsPointRef.current && altitude > lastStatsPointRef.current.altitude ? altitude - lastStatsPointRef.current.altitude : 0),
                maxAltitude: Math.max(state.stats.maxAltitude, altitude || 0),
                avgSpeed: state.stats.duration > 0 ? parseFloat((( (state.stats.distance + distStep) / 1000) / (state.stats.duration / 3600)).toFixed(1)) : 0
            };

            dispatch({ type: ACTIONS.UPDATE_STATS, payload: updatedStats });
            lastStatsPointRef.current = { latitude, longitude, altitude };

            // 2. Path Recording with Segment Logic
            const updatedSegments = state.pathSegments.map(s => [...s]);
            let targetIdx = updatedSegments.length - 1;

            if (state.resumedFromPause) {
                updatedSegments.push([newPoint]);
                targetIdx++;
                dispatch({ type: ACTIONS.UI_ACTION, payload: { resumedFromPause: false } });
            } else {
                if (updatedSegments.length === 0) updatedSegments.push([]);
                targetIdx = updatedSegments.length - 1;
                
                // Loop Detection with Cooldown
                if (loopCooldownRef.current <= 0) {
                    const fullPath = updatedSegments.flat();
                    const loop = detectIntersectionLoop(newPoint, fullPath, fullPath.length, TREK_CONFIG.LOOP_DETECTION);

                    if (loop && loop.isLoop) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        dispatch({ type: ACTIONS.UI_ACTION, payload: { groupMessage: { text: "Trail Loop Detected & Optimized", type: 'warning' } } });
                        loopCooldownRef.current = TREK_CONFIG.LOOP_COOLDOWN;
                        
                        // We don't prune in Group Trek to avoid desync, but we alert the leader
                    }
                }

                updatedSegments[targetIdx] = [...updatedSegments[targetIdx], newPoint];
            }

            dispatch({ 
                type: ACTIONS.UPDATE_LOCATION, 
                payload: { 
                    pathSegments: updatedSegments,
                    routeCoordinates: updatedSegments.flat()
                } 
            });

            // 3. Backend Sync (Throttled or per-point)
            client.put(`/treks/update/${trailId}`, { 
                coordinates: [newPoint], 
                isNewSegment: state.resumedFromPause,
                stats: updatedStats 
            }).catch(() => {});
        }
    }, [location, state.isTracking, state.isPaused, state.trailFinished, isLeader]);
}
