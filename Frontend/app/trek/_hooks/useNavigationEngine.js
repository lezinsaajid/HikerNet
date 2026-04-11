import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getDistance, getPointToPathDistance, calculateHeading } from '../../../utils/geoUtils';
import { TrekService } from '../_services/trekService';
import { NAVIGATION_CONFIG, ACTIONS } from '../_utils/constants';

export function useNavigationEngine(state, dispatch, location) {
    const hasAlertedOffTrack = useRef(false);
    const hasAlertedCompletion = useRef(false);

    useEffect(() => {
        if (!location) return;
        const navPoly = state.navigationPolyline;
        if (navPoly.length < 2) return;

        const currentLoc = { latitude: location.latitude, longitude: location.longitude };
        const searchIndex = state.hasJoinedTrail ? state.navigation.currentNavIndex : -1;
        const searchWindow = state.hasJoinedTrail ? 30 : -1;

        const { distance, snappedPoint, segmentIndex } = getPointToPathDistance(currentLoc, navPoly, searchIndex, searchWindow);

        const navUpdates = {
            navigation: {
                ...state.navigation,
                distanceToTrail: Math.round(distance),
            }
        };

        if (segmentIndex >= 0 && distance <= 15) {
            navUpdates.navigation.currentNavIndex = segmentIndex;
            // Midpoint check (50% through the line)
            if (segmentIndex > navPoly.length * 0.5) {
                navUpdates.hasReachedMidpoint = true;
            }
        }

        // Logic check: JOINED TRAIL vs GOTO START
        if (!state.hasJoinedTrail) {
            const startPoint = navPoly[0];
            const distToStart = getDistance(currentLoc.latitude, currentLoc.longitude, startPoint.latitude, startPoint.longitude);
            
            if (distToStart <= NAVIGATION_CONFIG.START_PROXIMITY) {
                navUpdates.navigation.guidance = "You have reached the starting point.";
                navUpdates.hasJoinedTrail = true;
                navUpdates.reroutePath = [];
                if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                // Road Rerouting integration
                if (!state.reroutePath?.length && distToStart > NAVIGATION_CONFIG.ROAD_REROUTE_MIN_DISTANCE) {
                    TrekService.fetchRoadRoute(currentLoc, startPoint).then(path => {
                        if (path) dispatch({ type: 'UI_ACTION', payload: { reroutePath: path } });
                    });
                }
                navUpdates.navigation.guidance = `Navigate to start (${Math.round(distToStart)}m)`;
                navUpdates.navigation.targetBearing = calculateHeading(currentLoc, startPoint);
            }
        } else {
            // ON-TRAIL Navigation
            if (distance > NAVIGATION_CONFIG.OFF_TRACK_THRESHOLD) {
                if (!state.navigation.offTrackWarning) {
                    navUpdates.navigation.offTrackWarning = true;
                    navUpdates.navigation.guidance = `Off trail! Head back.`;
                    if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
                navUpdates.reroutePath = [currentLoc, snappedPoint];
                navUpdates.navigation.targetBearing = calculateHeading(currentLoc, snappedPoint);
            } else if (state.navigation.offTrackWarning && distance <= NAVIGATION_CONFIG.ON_TRACK_THRESHOLD) {
                navUpdates.navigation.offTrackWarning = false;
                navUpdates.navigation.guidance = "Back on track.";
                navUpdates.reroutePath = [];
            }

            // Target Heading
            let targetIdx = Math.min(navPoly.length - 1, (segmentIndex >= 0 ? segmentIndex : state.navigation.currentNavIndex) + 1);
            const targetPoint = navPoly[targetIdx];
            if (targetPoint) {
                navUpdates.navigation.targetBearing = calculateHeading(currentLoc, targetPoint);
            }

            // Completion alerts
            const finalPoint = navPoly[navPoly.length - 1];
            const distToGoal = getDistance(currentLoc.latitude, currentLoc.longitude, finalPoint.latitude, finalPoint.longitude);
            
            if (!state.trailFinished && distToGoal < NAVIGATION_CONFIG.GOAL_PROXIMITY && state.hasReachedMidpoint && !hasAlertedCompletion.current) {
                hasAlertedCompletion.current = true;
                if (Platform.OS !== 'android') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                if (state.isTrailingBack) {
                    Alert.alert("Trek Completed", "Return journey finished.");
                    dispatch({ type: 'UI_ACTION', payload: { isTrailingBack: false, navigationPolyline: [], flowState: 'idle' } });
                } else {
                    navUpdates.trailFinished = true;
                    navUpdates.navigation.guidance = "Arrived!";
                }
            }
        }

        dispatch({ type: 'UPDATE_NAVIGATION', payload: navUpdates });

    }, [location, state.navigationPolyline, state.isTracking]);

    const retracePath = () => {
        const source = state.targetRoute.length > 0 ? state.targetRoute : state.routeCoordinates;
        if (source.length < 2) {
            Alert.alert("Error", "No path data to retrace.");
            return;
        }

        dispatch({
            type: 'TRAIL_BACK',
            payload: {
                navigationPolyline: [...source].reverse(),
                hasJoinedTrail: false,
                navigation: { ...state.navigation, guidance: "Retracing path..." }
            }
        });
    };

    return { retracePath };
}
