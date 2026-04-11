import { useEffect } from 'react';
import { ACTIONS } from '../_utils/constants';

/**
 * Hook to handle the "fading" logic of the covered trail during a trek-back.
 * Requirement: When the user pin traces back a covered trail, that portion should be faded.
 * Requirement: Only if the person is within 5m of the path, the fading should happen.
 */
export function useTrekBack(state, dispatch) {
    useEffect(() => {
        // Only run if we are in "trailing back" mode
        if (!state.isTrailingBack || !state.isTracking || state.isPaused) return;

        const { currentNavIndex, distanceToTrail } = state.navigation;
        const navigationPolyline = state.navigationPolyline;

        if (!navigationPolyline || navigationPolyline.length === 0) return;

        // FADING THRESHOLD: 5 meters as per user request
        const FADING_THRESHOLD = 5;

        // If the user is within 5m of the path, we mark the current point (and everything before it) as faded
        if (distanceToTrail <= FADING_THRESHOLD && currentNavIndex > state.retraceFadedIndex) {
            dispatch({
                type: ACTIONS.UPDATE_TREK_BACK_PROGRESS,
                payload: { index: currentNavIndex }
            });
        }
    }, [state.isTrailingBack, state.navigation.currentNavIndex, state.navigation.distanceToTrail, state.isTracking]);
}
