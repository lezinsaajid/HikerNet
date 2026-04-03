import { useEffect, useRef } from 'react';
import { detectIntersectionLoop } from '../../../utils/trekUtils';
import { TREK_CONFIG, ACTIONS } from '../utils/constants';

export function usePathProcessor(state, dispatch, location) {
    const loopCooldownRef = useRef(0);

    useEffect(() => {
        if (!state.isTracking || state.isPaused || state.trailFinished) return;
        if (!location) return;

        // Loop detection check (only when moving forward)
        if (!state.isTrailingBack && loopCooldownRef.current <= 0) {
            const segments = [...state.pathSegments];
            const fullPath = segments.flat();
            const newPoint = { latitude: location.latitude, longitude: location.longitude };

            const loopData = detectIntersectionLoop(newPoint, fullPath, fullPath.length, TREK_CONFIG.LOOP_DETECTION);
            
            if (loopData && loopData.isLoop) {
                const loopStart = loopData.loopStartIndex;
                let acc = 0;
                const pruned = [];
                let ghost = [];

                for (const s of segments) {
                    const end = acc + s.length;
                    if (end <= loopStart) pruned.push(s);
                    else if (acc < loopStart) { 
                        pruned.push(s.slice(0, loopStart - acc + 1));
                        ghost = ghost.concat(s.slice(loopStart - acc + 1));
                    } else ghost = ghost.concat(s);
                    acc = end;
                }

                dispatch({ 
                    type: 'DETECT_LOOP', 
                    payload: { 
                        pathSegments: pruned, 
                        routeCoordinates: pruned.flat(), 
                        ghostPart: ghost 
                    } 
                });
                loopCooldownRef.current = TREK_CONFIG.LOOP_COOLDOWN;
            }
        }

        if (loopCooldownRef.current > 0) loopCooldownRef.current--;

    }, [location, state.pathSegments, state.isTracking]);
}
