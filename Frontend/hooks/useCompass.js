import { useState, useEffect, useRef } from 'react';
import { Magnetometer } from 'expo-sensors';

/**
 * Hook to provide smooth compass heading for map navigation
 */
export const useCompass = (isEnabled) => {
    const [heading, setHeading] = useState(0);
    const lastHeading = useRef(0);

    useEffect(() => {
        let subscription = null;

        const subscribe = async () => {
            // Set update interval to 100ms for smooth UI (10Hz)
            Magnetometer.setUpdateInterval(100);

            subscription = Magnetometer.addListener(data => {
                // Calculate heading in degrees from raw magnetometer data
                // angle = atan2(y, x) * 180 / PI
                let { x, y } = data;
                let angle = Math.atan2(y, x) * (180 / Math.PI);

                // Adjust to 0-360 range (0 is North)
                // Note: Magnetometer axes depend on device orientation, 
                // but for portrait, this is a good baseline.
                let newHeading = (angle + 360) % 360;

                // EMA Smoothing: heading = alpha * new + (1 - alpha) * old
                const alpha = 0.2; // Strong smoothing for compass

                // Fix "wrap-around" jump (e.g. 359 -> 1)
                let diff = newHeading - lastHeading.current;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;

                const smoothed = (lastHeading.current + alpha * diff + 360) % 360;

                lastHeading.current = smoothed;
                setHeading(Math.round(smoothed));
            });
        };

        if (isEnabled) {
            subscribe();
        }

        return () => {
            if (subscription) subscription.remove();
        };
    }, [isEnabled]);

    return heading;
};
