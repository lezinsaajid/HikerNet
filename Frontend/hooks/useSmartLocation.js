import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';

export const useSmartLocation = (isTracking) => {
    const [location, setLocation] = useState(null);
    const [isWalking, setIsWalking] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState(0);

    // Refs for logic
    const lastLocation = useRef(null);
    const stepCount = useRef(0);
    const lastStepTime = useRef(0);

    useEffect(() => {
        let locationSub = null;
        let pedometerSub = null;

        const startTracking = async () => {
            // 1. Pedometer Subscription
            const isPedometerAvailable = await Pedometer.isAvailableAsync();
            if (isPedometerAvailable) {
                pedometerSub = Pedometer.watchStepCount(result => {
                    stepCount.current = result.steps;
                    lastStepTime.current = Date.now();
                    setIsWalking(true);

                    // Auto-reset "walking" state if no steps for 3 seconds
                    if (walkTimer) clearTimeout(walkTimer);
                    walkTimer = setTimeout(() => setIsWalking(false), 3000);
                });
            }

            // 2. Location Subscription
            locationSub = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000, // 1 second
                    distanceInterval: 0,
                },
                (newLoc) => {
                    const { latitude, longitude, accuracy } = newLoc.coords;
                    setGpsAccuracy(accuracy);

                    console.log(`[SmartLocation] Raw update: acc=${accuracy.toFixed(1)}m, walking=${isWalking}, steps=${stepCount.current}`);

                    // --- SENSOR FUSION LOGIC ---

                    // 1. Accuracy Filter (Relaxed for Indoors)
                    if (accuracy > 100) { // Increased to 100m to allow indoor signals
                        console.log(`[SmartLocation] REJECT: Poor Accuracy (${accuracy} > 100)`);
                        return;
                    }

                    // 2. Stationary Filter (Pedometer Gating)
                    // If Pedometer is available but says "Not Walking", reject small movements
                    // (Unless the movement is HUGE, implying a car/bike)
                    if (isPedometerAvailable && !isWalking) {
                        // Check distance from last point
                        if (lastLocation.current) {
                            const dist = getDistance(
                                lastLocation.current.latitude,
                                lastLocation.current.longitude,
                                latitude,
                                longitude
                            );

                            // Log distance check
                            console.log(`[SmartLocation] Stationary Check: dist=${dist.toFixed(2)}m`);

                            // If moved < 0.5 meters while "Stationary", ignore it (lowered to 0.5m for extreme precision)
                            if (dist < 0.5) {
                                console.log(`[SmartLocation] REJECT: Stationary Drift (< 0.5m)`);
                                return;
                            }
                        }
                    }

                    // 3. Acceptance
                    const validPoint = { latitude, longitude, accuracy, timestamp: newLoc.timestamp };

                    // Only update state if it actually changed significantly or first point
                    if (!lastLocation.current ||
                        getDistance(lastLocation.current.latitude, lastLocation.current.longitude, latitude, longitude) > 0.5) {
                        console.log(`[SmartLocation] ACCEPT: Valid Point`);
                        lastLocation.current = validPoint;
                        setLocation(validPoint);
                    }
                }
            );
        };

        if (isTracking) {
            startTracking();
        }

        let walkTimer;

        return () => {
            if (locationSub) locationSub.remove();
            if (pedometerSub) pedometerSub.remove();
            if (walkTimer) clearTimeout(walkTimer);
        };
    }, [isTracking]); // Only restart if tracking status changes, not walking status

    return { location, isWalking, gpsAccuracy };
};

// Simple Haversine for internal use
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
