import { useState, useEffect, useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { getDistance, getPointToPathDistance } from '../../../utils/geoUtils';
import client from '../../../api/client';

/**
 * Hook to manage Group-specific navigation and safety logic
 */
export function useGroupNavigation({
    smoothedLocation,
    navigationPolyline,
    hasJoinedTrail,
    isLeader,
    currentUser,
    leaderId,
    sync,
    mapRef,
    isFollowingLeader,
    setIsFollowingLeader,
    isTrailingBack
}) {
    const [distanceToTrail, setDistanceToTrail] = useState(9999);
    const [offTrackWarning, setOffTrackWarning] = useState(false);
    const [navGuidance, setNavGuidance] = useState(isLeader ? "Waiting to start..." : "Waiting for leader...");
    const [currentNavIndex, setCurrentNavIndex] = useState(0);
    const [hasReachedMidpoint, setHasReachedMidpoint] = useState(false);
    const [reroutePath, setReroutePath] = useState([]);
    const [groupCentroid, setGroupCentroid] = useState(null);
    const [trackingUserId, setTrackingUserId] = useState(null);

    const hasAlertedCompletion = useRef(false);

    // 1. Navigation & Drift Detection
    useEffect(() => {
        if (!smoothedLocation || !navigationPolyline || navigationPolyline.length < 2) return;
        
        const currentLoc = { latitude: smoothedLocation.latitude, longitude: smoothedLocation.longitude };
        const results = getPointToPathDistance(currentLoc, navigationPolyline, hasJoinedTrail ? currentNavIndex : -1, 30);
        
        setDistanceToTrail(Math.round(results.distance));
        
        if (results.segmentIndex >= 0 && results.distance <= 15) {
            setCurrentNavIndex(results.segmentIndex);
            if (results.segmentIndex > navigationPolyline.length * 0.5) setHasReachedMidpoint(true);
        }

        // Drift Detection Logic
        const offTrackThreshold = 20;
        if (hasJoinedTrail && results.distance > offTrackThreshold) {
            if (!offTrackWarning) {
                setOffTrackWarning(true);
                setNavGuidance("Off trail!");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                sync.emitDrift(true);
            }
            setReroutePath([currentLoc, results.snappedPoint]);
        } else if (offTrackWarning && results.distance <= 10) {
            setOffTrackWarning(false);
            setNavGuidance("Back on trail.");
            setReroutePath([]);
            sync.emitDrift(false);
        }

        // Completion Detection
        if (hasReachedMidpoint && !hasAlertedCompletion.current) {
            const finalPoint = navigationPolyline[navigationPolyline.length - 1];
            const distToGoal = getDistance(currentLoc.latitude, currentLoc.longitude, finalPoint.latitude, finalPoint.longitude);
            if (distToGoal < 15) {
                hasAlertedCompletion.current = true;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (isLeader && isTrailingBack && sync.emitControl) {
                    sync.emitControl('FINISH_TREK_BACK');
                }
            }
        }
    }, [smoothedLocation, navigationPolyline, hasJoinedTrail, offTrackWarning, isTrailingBack, hasReachedMidpoint]);

    // 1.5. Navigation Guidance & Reset logic
    useEffect(() => {
        if (hasJoinedTrail && (navGuidance === "Waiting for leader..." || navGuidance === "Waiting to start...")) {
            setNavGuidance("Follow the trail...");
        }
    }, [hasJoinedTrail, navGuidance]);

    useEffect(() => {
        setHasReachedMidpoint(false);
        hasAlertedCompletion.current = false;
        setCurrentNavIndex(0);
    }, [navigationPolyline]);

    // 2. Auto-follow leader logic for members
    useEffect(() => {
        if (!isLeader && isFollowingLeader && sync.participants[leaderId]?.location?.latitude) {
            mapRef.current?.animateToRegion({
                ...sync.participants[leaderId].location,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002
            }, 1000);
        }
    }, [isFollowingLeader, sync.participants[leaderId]?.location, isLeader, leaderId]);

    return {
        distanceToTrail,
        offTrackWarning,
        navGuidance,
        setNavGuidance,
        currentNavIndex,
        hasReachedMidpoint,
        reroutePath,
        setReroutePath,
        groupCentroid,
        setGroupCentroid,
        trackingUserId,
        setTrackingUserId,
        hasAlertedCompletion
    };
}
