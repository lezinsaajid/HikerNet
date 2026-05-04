import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { getDistance } from '../../../utils/geoUtils';
import { detectIntersectionLoop } from '../../../utils/trekUtils';
import client from '../../../api/client';

/**
 * Hook to manage leader-specific path recording and synchronization
 */
export function useGroupLeaderEngine({
    isLeader,
    isTracking,
    isTrailingBack,
    isPaused,
    trailFinished,
    validatedLocation,
    trailId,
    stats,
    setStats,
    setPathSegments,
    setRouteCoordinates,
    sync
}) {
    const lastStatsPointRef = useRef(null);
    const resumedFromPauseRef = useRef(false);
    const pathSegmentsRef = useRef([[]]);

    useEffect(() => {
        if (!isLeader || (!isTracking && !isTrailingBack) || !validatedLocation || trailFinished || isPaused) return;

        const { latitude, longitude, altitude } = validatedLocation;
        const newPoint = { latitude, longitude };
        
        // 1. Update Stats
        let distStep = 0;
        if (lastStatsPointRef.current) {
            distStep = getDistance(latitude, longitude, lastStatsPointRef.current.latitude, lastStatsPointRef.current.longitude);
        }
        
        setStats(prev => ({
            ...prev,
            distance: prev.distance + distStep,
            elevationGain: prev.elevationGain + (lastStatsPointRef.current && altitude > lastStatsPointRef.current.altitude ? altitude - lastStatsPointRef.current.altitude : 0),
            maxAltitude: Math.max(prev.maxAltitude, altitude || 0),
            avgSpeed: prev.duration > 0 ? parseFloat((( prev.distance / 1000) / (prev.duration / 3600)).toFixed(1)) : 0
        }));
        lastStatsPointRef.current = { latitude, longitude, altitude };

        // 2. Path Recording & Loop Detection
        setPathSegments(prev => {
            let updated = [...prev];
            let targetIdx = updated.length - 1;

            if (resumedFromPauseRef.current) {
                updated.push([newPoint]);
                targetIdx++;
                resumedFromPauseRef.current = false;
            } else {
                if (updated.length === 0) updated.push([]);
                targetIdx = updated.length - 1;
                
                // Advanced: Loop Detection
                const fullPath = updated.flat();
                const loop = detectIntersectionLoop(newPoint, fullPath, fullPath.length, {
                    minPoints: 30,
                    ignoreLast: 15,
                    maxDistance: 12
                });
                
                if (loop && loop.isLoop) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Pruning logic would go here if fully implemented
                }
                updated[targetIdx] = [...updated[targetIdx], newPoint];
            }
            
            // Sync new point to group
            sync.emitPointShared(newPoint, resumedFromPauseRef.current);
            pathSegmentsRef.current = updated;
            return updated;
        });

        // 3. Backend Sync (Auto-save)
        client.put(`/treks/update/${trailId}`, { 
            coordinates: [newPoint], 
            isNewSegment: resumedFromPauseRef.current,
            stats: { ...stats, distance: stats.distance + distStep } 
        }).catch(() => {});

    }, [isTracking, validatedLocation, isPaused, trailFinished, isTrailingBack, isLeader]);

    return {
        resumedFromPauseRef,
        pathSegmentsRef,
        lastStatsPointRef
    };
}
