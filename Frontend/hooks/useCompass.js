import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

/**
 * Hook to provide smooth compass heading for map navigation using OS fused sensors
 */
export const useCompass = (isEnabled) => {
    const [heading, setHeading] = useState(0);
    const lastHeading = useRef(0);

    useEffect(() => {
        let subscription = null;

        const subscribe = async () => {
            try {
                // We assume location permissions are already granted by active-trek, but double-check
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    console.warn('[Compass] Location permission to access heading was denied');
                    return;
                }

                // Leverage iOS/Android native fused-sensors (Compass + Gyro + Accelerometer)
                // This correctly maps heading even if the phone is held upright or tilted!
                subscription = await Location.watchHeadingAsync((headingData) => {
                    const newHeading = headingData.magHeading;
                    
                    if (newHeading === undefined || newHeading === null) return;

                    // EMA Smoothing
                    const alpha = 0.15; // Smooth but responsive to 90 degree turns

                    let diff = newHeading - lastHeading.current;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;

                    // Deadzone: Ignore physical micro-shakes less than 1 degree
                    if (Math.abs(diff) < 1) {
                        return;
                    }

                    const smoothed = (lastHeading.current + alpha * diff + 360) % 360;
                    const rounded = Math.round(smoothed);

                    if (rounded !== Math.round(lastHeading.current)) {
                        lastHeading.current = smoothed;
                        setHeading(rounded);
                    }
                });
            } catch (error) {
                console.warn("[Compass] Hardware Compass isn't supported or failed:", error);
            }
        };

        if (isEnabled) {
            subscribe();
        }

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, [isEnabled]);

    return heading;
};
