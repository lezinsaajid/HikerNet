import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NAVIGATION_CONFIG } from '../_utils/constants';

/**
 * Hook to handle off-trail warnings and haptic feedback.
 * Requirement: If the person is >15m away, haptics with warning should be provided.
 */
export function useOffTrailAlerts(state) {
    const lastAlertTime = useRef(0);
    const ALERT_COOLDOWN = 10000; // 10 seconds between haptic alerts to avoid annoyance

    useEffect(() => {
        if (!state.isTracking || state.trailFinished || state.isPaused) return;
        
        // We only care about off-trail alerts when navigating or trailing back
        const isNavigating = state.navigationPolyline && state.navigationPolyline.length > 0;
        if (!isNavigating) return;

        const distance = state.navigation.distanceToTrail;
        const OFF_TRAIL_CRITICAL_THRESHOLD = 15; // 15 meters as per user request

        if (distance > OFF_TRAIL_CRITICAL_THRESHOLD) {
            const now = Date.now();
            if (now - lastAlertTime.current > ALERT_COOLDOWN) {
                lastAlertTime.current = now;
                
                // Provide haptic feedback
                if (Platform.OS !== 'android') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }

                // The warning message is already handled by useNavigationEngine (guidance)
                // but we can add an extra alert if it's really far or just rely on the UI.
                // The user specifically asked for "haptics with warning".
                console.log(`Off trail warning: ${distance}m away`);
            }
        }
    }, [state.navigation.distanceToTrail, state.isTracking, state.isPaused]);
}
