import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { getDistance } from '../utils/geoUtils';

export const useSmartLocation = (isTracking) => {
    const [location, setLocation] = useState(null); // Validated location for recording
    const [smoothedLocation, setSmoothedLocation] = useState(null); // EMA smoothed for map display
    const [isWalking, setIsWalking] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState(0);
    const [error, setError] = useState(null);

    const getAccuracyStatus = (acc) => {
        if (acc === 0) return 'locating';
        if (acc < 0) return 'invalid';
        if (acc <= 20) return 'high';
        if (acc <= 50) return 'medium';
        return 'low';
    };

    const accuracyStatus = getAccuracyStatus(gpsAccuracy);

    // Refs for logic
    const lastValidatedLoc = useRef(null);
    const lastRawLoc = useRef(null);
    const stepCount = useRef(0);
    const lastStepTime = useRef(0);

    useEffect(() => {
        let locationSub = null;
        let pedometerSub = null;
        let walkTimer;

        const startTracking = async () => {
            try {
                // 1. Permission Check
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setError('Permission to access location was denied');
                    return;
                }

                // 2. Pedometer Subscription
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

                // 3. Location Subscription
                locationSub = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.BestForNavigation,
                        timeInterval: 1000, // 1 second
                        distanceInterval: 0,
                    },
                    (newLoc) => {
                        const { latitude, longitude, accuracy, altitude } = newLoc.coords;
                        setGpsAccuracy(accuracy || 0);

                        // --- ADVANCED GEOLOCATION PIPELINE ---

                        // 1. Pre-Filter (Accuracy Gate)
                        // If accuracy is too poor, don't even process movement logic
                        if (accuracy > 30) return;

                        // 2. Dynamics Filter (Speed Spike Rejection)
                        // Mountainous terrain can have multipath errors causing 100m jumps in 1s.
                        if (lastRawLoc.current) {
                            const timeDiff = (newLoc.timestamp - lastRawLoc.current.timestamp) / 1000;
                            const dist = getDistance(lastRawLoc.current.latitude, lastRawLoc.current.longitude, latitude, longitude);
                            const calcSpeed = dist / (timeDiff || 1);

                            // 15m/s (54km/h) is the limit for a trekker. Reject spikes.
                            if (calcSpeed > 15 && timeDiff > 0) {
                                console.log(`[SmartLocation] SPIKE REJECT: ${calcSpeed.toFixed(1)}m/s`);
                                return;
                            }
                        }
                        lastRawLoc.current = { latitude, longitude, timestamp: newLoc.timestamp };

                        // 3. EMA Smoothing (For Visual Map Positioning)
                        setSmoothedLocation(prev => {
                            if (!prev) return { latitude, longitude, accuracy };
                            const alpha = 0.5; // Smoothing factor
                            return {
                                latitude: alpha * latitude + (1 - alpha) * prev.latitude,
                                longitude: alpha * longitude + (1 - alpha) * prev.longitude,
                                accuracy
                            };
                        });

                        // 4. Movement Gating (Recording Logic)
                        const distFromLast = lastValidatedLoc.current
                            ? getDistance(lastValidatedLoc.current.latitude, lastValidatedLoc.current.longitude, latitude, longitude)
                            : Infinity;

                        // Initial lock requirement: accuracy <= 50m (Medium/High)
                        const isInitialLock = !lastValidatedLoc.current && accuracy <= 50;

                        if (isInitialLock || (lastValidatedLoc.current && distFromLast >= 3)) {
                            const validPoint = { latitude, longitude, accuracy, altitude, timestamp: newLoc.timestamp };
                            console.log(`[SmartLocation] VALIDATED: ${isInitialLock ? 'Start' : distFromLast.toFixed(1) + 'm'} move.`);
                            lastValidatedLoc.current = validPoint;
                            setLocation(validPoint);
                        }
                    }
                );
            } catch (err) {
                console.error('[SmartLocation] Error:', err);
                setError(err.message);
            }
        };

        if (isTracking) {
            startTracking();
        }

        return () => {
            if (locationSub) locationSub.remove();
            if (pedometerSub) pedometerSub.remove();
            if (walkTimer) clearTimeout(walkTimer);
        };
    }, [isTracking]); // Only restart if tracking status changes

    return { location, smoothedLocation, isWalking, gpsAccuracy, accuracyStatus, error };
};
