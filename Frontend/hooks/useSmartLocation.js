import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { getDistance } from '../utils/geoUtils';

export const useSmartLocation = (isTracking) => {
    const [location, setLocation] = useState(null);
    const [smoothedLocation, setSmoothedLocation] = useState(null);
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

    // Refs
    const lastValidatedLoc = useRef(null);
    const lastRawLoc = useRef(null);
    const stepCount = useRef(0);
    const lastStepTime = useRef(0);
    const isGpsLocked = useRef(false); // 🔥 NEW

    useEffect(() => {
        let locationSub = null;
        let pedometerSub = null;
        let walkTimer;

        const startTracking = async () => {
            try {
                // 1. Permission
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setError('Permission denied');
                    return;
                }

                // 2. Pedometer
                const isPedometerAvailable = await Pedometer.isAvailableAsync();
                if (isPedometerAvailable) {
                    pedometerSub = Pedometer.watchStepCount(result => {
                        stepCount.current = result.steps;
                        lastStepTime.current = Date.now();
                        setIsWalking(true);

                        if (walkTimer) clearTimeout(walkTimer);
                        walkTimer = setTimeout(() => setIsWalking(false), 3000);
                    });
                }

                // 3. Location tracking
                locationSub = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.BestForNavigation, // 🔥 IMPORTANT
                        timeInterval: 1000,
                        distanceInterval: 0,
                    },
                    (newLoc) => {
                        const { latitude, longitude, accuracy, altitude } = newLoc.coords;
                        setGpsAccuracy(accuracy || 0);

                        console.log(`[GPS] acc=${accuracy?.toFixed(1)}`);

                        // 🔥 Detect GPS lock
                        if (accuracy <= 25) {
                            isGpsLocked.current = true;
                        }

                        // 1. Pre-filter
                        if (accuracy > 1000) return;

                        // 2. Speed spike rejection
                        if (lastRawLoc.current) {
                            const timeDiff = (newLoc.timestamp - lastRawLoc.current.timestamp) / 1000;
                            const dist = getDistance(
                                lastRawLoc.current.latitude,
                                lastRawLoc.current.longitude,
                                latitude,
                                longitude
                            );

                            const speed = dist / (timeDiff || 1);

                            if (speed > 25 && accuracy < 50) {
                                console.log(`[REJECT] Spike: ${speed.toFixed(1)} m/s`);
                                return;
                            }
                        }

                        lastRawLoc.current = { latitude, longitude, timestamp: newLoc.timestamp };

                        // 🔥 FIRST POINT (CRITICAL FIX)
                        if (!lastValidatedLoc.current) {
                            const firstPoint = {
                                latitude,
                                longitude,
                                accuracy,
                                altitude,
                                timestamp: newLoc.timestamp
                            };

                            lastValidatedLoc.current = firstPoint;
                            setLocation(firstPoint);
                        }

                        // 3. EMA smoothing (map only)
                        setSmoothedLocation(prev => {
                            if (!prev) return { latitude, longitude, accuracy };

                            const drift = getDistance(prev.latitude, prev.longitude, latitude, longitude);
                            const deadzone = accuracy > 50 ? 5 : 1;

                            if (drift < deadzone) return prev;

                            const alpha = accuracy > 50 ? 0.2 : 0.4;

                            return {
                                latitude: alpha * latitude + (1 - alpha) * prev.latitude,
                                longitude: alpha * longitude + (1 - alpha) * prev.longitude,
                                accuracy
                            };
                        });

                        // 4. Movement gating
                        const distFromLast = lastValidatedLoc.current
                            ? getDistance(
                                lastValidatedLoc.current.latitude,
                                lastValidatedLoc.current.longitude,
                                latitude,
                                longitude
                            )
                            : Infinity;

                        // 🔥 Relaxed accuracy until GPS lock
                        const isHighAccuracy = isGpsLocked.current
                            ? accuracy <= 30
                            : accuracy <= 100;

                        if (isHighAccuracy && distFromLast >= 5) {
                            const timeSinceLastStep = Date.now() - lastStepTime.current;

                            if (timeSinceLastStep > 10000 && distFromLast < 10) {
                                return;
                            }

                            const validPoint = {
                                latitude,
                                longitude,
                                accuracy,
                                altitude,
                                timestamp: newLoc.timestamp
                            };

                            lastValidatedLoc.current = validPoint;
                            setLocation(validPoint);
                        }

                        // 🔥 Indoor fallback
                        else if (!location && accuracy <= 300) {
                            setLocation({
                                latitude,
                                longitude,
                                accuracy,
                                altitude,
                                timestamp: newLoc.timestamp
                            });
                        }
                    }
                );
            } catch (err) {
                console.error('[SmartLocation]', err);
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
    }, [isTracking]);

    return {
        location,
        smoothedLocation,
        isWalking,
        gpsAccuracy,
        accuracyStatus,
        error
    };
};