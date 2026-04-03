import { useEffect, useRef } from 'react';
import { ACTIONS, TREK_CONFIG } from '../utils/constants';

export function useSimulationEngine(state, dispatch) {
    const simIntervalRef = useRef(null);

    useEffect(() => {
        // Only run if active tracker is simulation or explicit param set
        if (!state.simulation.isActive || !state.isTracking || state.isPaused || state.trailFinished) {
            if (simIntervalRef.current) clearInterval(simIntervalRef.current);
            return;
        }

        const runSim = () => {
            const path = state.isTrailingBack ? state.navigationPolyline : state.targetRoute;
            if (!path || path.length === 0) return;

            const stepSize = 1; 
            const currentIndex = state.navigation.currentNavIndex;
            const nextIdx = Math.min(path.length - 1, currentIndex + stepSize);
            const nextLoc = path[nextIdx];

            dispatch({ 
                type: 'SET_SIMULATION', 
                payload: { 
                    location: { ...nextLoc, altitude: 100, timestamp: Date.now() },
                    phase: state.isTrailingBack ? "Simulating Return..." : "Simulating Forward..."
                } 
            });
        };

        simIntervalRef.current = setInterval(runSim, 1000);
        return () => simIntervalRef.current && clearInterval(simIntervalRef.current);

    }, [state.simulation.isActive, state.isTracking, state.isPaused, state.trailFinished, state.isTrailingBack, state.navigationPolyline, state.targetRoute, state.navigation.currentNavIndex]);

    const toggleSimulation = (location) => {
        dispatch({ type: 'SET_SIMULATION', payload: { isActive: true, location } });
    };

    return { toggleSimulation };
}
