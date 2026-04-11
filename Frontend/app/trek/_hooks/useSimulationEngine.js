import { useEffect, useRef } from 'react';
import { ACTIONS, TREK_CONFIG } from '../_utils/constants';

export function useSimulationEngine(state, dispatch) {
    const simIntervalRef = useRef(null);

    useEffect(() => {
        if (!state.simulation.isActive || !state.isTracking || state.isPaused || state.trailFinished) {
            if (simIntervalRef.current) clearInterval(simIntervalRef.current);
            return;
        }

        const runSim = () => {
            let path = state.isTrailingBack ? state.navigationPolyline : state.targetRoute;
            
            // 🔥 FALLBACK: If no path exists (simulating a "New Trail"), generate a synthetic 1km loop
            if (!path || path.length === 0) {
                const start = state.simulation.location || { latitude: 37.7749, longitude: -122.4194 }; // SF default or latest sim loc
                path = [
                    start,
                    { latitude: start.latitude + 0.002, longitude: start.longitude + 0.002 },
                    { latitude: start.latitude + 0.004, longitude: start.longitude },
                    { latitude: start.latitude + 0.002, longitude: start.longitude - 0.002 },
                    start
                ];
            }

            const stepSize = 1; 
            const currentIndex = state.navigation.currentNavIndex;
            const nextIdx = Math.min(path.length - 1, currentIndex + stepSize);
            const nextLoc = path[nextIdx];

            dispatch({ 
                type: ACTIONS.SET_SIMULATION, 
                payload: { 
                    location: { ...nextLoc, altitude: 100, accuracy: 5, timestamp: Date.now() },
                    phase: state.isTrailingBack ? "Simulating Return..." : "Simulating Forward..."
                } 
            });
        };

        simIntervalRef.current = setInterval(runSim, 1000);
        return () => simIntervalRef.current && clearInterval(simIntervalRef.current);

    }, [state.simulation.isActive, state.isTracking, state.isPaused, state.trailFinished, state.isTrailingBack, state.navigationPolyline, state.targetRoute, state.navigation.currentNavIndex]);

    const toggleSimulation = (location) => {
        dispatch({ type: ACTIONS.SET_SIMULATION, payload: { isActive: true, location, phase: "Starting Simulation..." } });
    };

    return { toggleSimulation };
}
