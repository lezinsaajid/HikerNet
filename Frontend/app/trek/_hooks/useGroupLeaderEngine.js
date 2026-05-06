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
    sync,
    showMessage
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
            avgSpeed: prev.duration > 0 ? parseFloat(((prev.distance / 1000) / (prev.duration / 3600)).toFixed(1)) : 0
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
                    minPoints: 13,
                    ignoreLast: 10,
                    maxDistance: 18,
                    maxHeadingDiff: 120
                });

                if (loop && loop.isLoop) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    const loopStart = loop.loopStartIndex;
                    let acc = 0;
                    const pruned = [];
                    let ghost = [];

                    for (const s of updated) {
                        const end = acc + s.length;
                        if (end <= loopStart) pruned.push(s);
                        else if (acc < loopStart) {
                            pruned.push(s.slice(0, loopStart - acc + 1));
                            ghost = ghost.concat(s.slice(loopStart - acc + 1));
                        } else ghost = ghost.concat(s);
                        acc = end;
                    }

                    updated = pruned;
                    if (updated.length === 0) updated.push([]);
                    targetIdx = updated.length - 1;
                    sync.emitControl({ type: 'LOOP_DETECTED', pruned, ghost });
                }
                updated[targetIdx] = [...updated[targetIdx], newPoint];
            }

            // Sync new point to group
            sync.emitPointShared(newPoint, resumedFromPauseRef.current);
            pathSegmentsRef.current = updated;
            return updated;
        });

        // 3. Backend Sync (Auto-save)
        if (trailId) {
            client.put(`/treks/update/${trailId}`, {
                coordinates: [newPoint],
                isNewSegment: resumedFromPauseRef.current,
                stats: { ...stats, distance: stats.distance + distStep }
            }).catch(() => { });
        }

    }, [isTracking, validatedLocation, isPaused, trailFinished, isTrailingBack, isLeader]);

    return {
        resumedFromPauseRef,
        pathSegmentsRef,
        lastStatsPointRef
    };
}
