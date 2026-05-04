import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { ACTIONS } from '../_utils/constants';
import { getDistance, getPointToPathDistance } from '../../../utils/geoUtils';
import client from '../../../api/client';

/**
 * Hook to handle navigation, drift detection, and completion alerts for Group Treks
 */
export function useGroupNavigationEngine(state, dispatch, location, sync) {
    const hasAlertedCompletion = useRef(false);

    useEffect(() => {
        if (!location || !state.navigationPolyline || state.navigationPolyline.length < 2) return;

        const currentLoc = { latitude: location.latitude, longitude: location.longitude };
        
        // 1. Calculate proximity to planned trail
        const results = getPointToPathDistance(
            currentLoc, 
            state.navigationPolyline, 
            state.hasJoinedTrail ? state.navigation.currentNavIndex : -1, 
            30
        );
        
        const currentDist = Math.round(results.distance);
        
        // 2. Navigation State Update
        dispatch({
            type: ACTIONS.UPDATE_NAVIGATION,
            payload: {
                navigation: {
                    ...state.navigation,
                    distanceToTrail: currentDist,
                    currentNavIndex: results.segmentIndex >= 0 ? results.segmentIndex : state.navigation.currentNavIndex
                },
                hasReachedMidpoint: state.hasReachedMidpoint || (results.segmentIndex > state.navigationPolyline.length * 0.5)
            }
        });

        // 3. Drift Detection (Off-Trail Alerts)
        const DRIFT_THRESHOLD = 20;
        if (state.hasJoinedTrail && currentDist > DRIFT_THRESHOLD) {
            if (!state.navigation.offTrackWarning) {
                dispatch({ type: ACTIONS.UPDATE_NAVIGATION, payload: { navigation: { ...state.navigation, offTrackWarning: true, guidance: "Off trail!" } } });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                sync.emitDrift(true);
            }
            dispatch({ type: ACTIONS.UI_ACTION, payload: { reroutePath: [currentLoc, results.snappedPoint] } });
        } else if (state.navigation.offTrackWarning && currentDist <= 10) {
            dispatch({ type: ACTIONS.UPDATE_NAVIGATION, payload: { navigation: { ...state.navigation, offTrackWarning: false, guidance: "Back on trail." } } });
            dispatch({ type: ACTIONS.UI_ACTION, payload: { reroutePath: [] } });
            sync.emitDrift(false);
        }

        // 4. Completion Detection
        if (!state.trailFinished && state.hasReachedMidpoint && !hasAlertedCompletion.current) {
            const finalPoint = state.navigationPolyline[state.navigationPolyline.length - 1];
            const distToGoal = getDistance(currentLoc.latitude, currentLoc.longitude, finalPoint.latitude, finalPoint.longitude);
            
            if (distToGoal < 15) {
                hasAlertedCompletion.current = true;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                dispatch({ type: ACTIONS.UI_ACTION, payload: { groupMessage: { text: "Destination Reached!", type: 'success' } } });
            }
        }

    }, [location, state.navigationPolyline, state.hasJoinedTrail, state.trailFinished]);
}
