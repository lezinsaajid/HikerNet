
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import client from '../../../api/client';

export function useRestMode(location) {
    const [isResting, setIsResting] = useState(false);
    const [restTimeLeft, setRestTimeLeft] = useState(0);
    const [warningMode, setWarningMode] = useState(false);
    const [warningTimeLeft, setWarningTimeLeft] = useState(15 * 60); // 15 minutes grace period
    
    const timerRef = useRef(null);
    const warningTimerRef = useRef(null);

    const stopAllTimers = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (warningTimerRef.current) clearInterval(warningTimerRef.current);
        timerRef.current = null;
        warningTimerRef.current = null;
    }, []);

    const triggerSOS = useCallback(async () => {
        try {
            console.log("[RestMode] Triggering SOS due to no response...");
            await client.post('/safety/sos', { location });
            Alert.alert(
                "Safety Alert Triggered",
                "You haven't responded in 15 minutes since your rest ended. Your emergency contacts have been notified with your last known location.",
                [{ text: "I'm OK Now", onPress: endRest }]
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (error) {
            console.error("[RestMode] Failed to trigger SOS:", error);
        }
    }, [location]);

    const startRest = useCallback((minutes) => {
        setIsResting(true);
        setRestTimeLeft(minutes * 60);
        setWarningMode(false);
        setWarningTimeLeft(15 * 60);
        
        stopAllTimers();

        timerRef.current = setInterval(() => {
            setRestTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    startWarningPeriod();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [stopAllTimers]);

    const startWarningPeriod = useCallback(() => {
        setWarningMode(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
        // Push notification
        Notifications.scheduleNotificationAsync({
            content: {
                title: "Rest Time Over! 🏔️",
                body: "Your planned rest has ended. Please confirm you are OK within 15 minutes or we will notify your emergency contacts.",
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
        });

        warningTimerRef.current = setInterval(() => {
            setWarningTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(warningTimerRef.current);
                    triggerSOS();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [triggerSOS]);

    const endRest = useCallback(() => {
        setIsResting(false);
        setWarningMode(false);
        stopAllTimers();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [stopAllTimers]);

    useEffect(() => {
        return () => stopAllTimers();
    }, [stopAllTimers]);

    return {
        isResting,
        restTimeLeft,
        warningMode,
        warningTimeLeft,
        startRest,
        endRest
    };
}
