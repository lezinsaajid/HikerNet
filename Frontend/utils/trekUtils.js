import { getDistance, calculateHeading } from './geoUtils';

/**
 * Advanced Trekking Utilities
 */

/**
 * Robust intersection loop detection for trekking.
 * Detects when a user has completed a circular path and returns the indices to prune.
 * 
 * @param {Object} currentPoint Current GPS point { latitude, longitude }
 * @param {Array} path The existing path points
 * @param {Number} currentIndex The index of the last point in the path array
 * @param {Object} options Configuration for detection
 * @returns {Object|null} Loop metadata or null if no loop detected
 */
export const detectIntersectionLoop = (currentPoint, path, currentIndex, options = {}) => {
    const {
        minPoints = 30,         // Minimum points to consider a loop (needs history)
        ignoreLast = 15,        // Guard window: ignore the most recent N points to avoid "switchback" false positives
        maxDistance = 20,       // Max distance in meters to consider as an intersection
        maxHeadingDiff = 110,   // Max bearing difference to be considered a parallel loop (wider for mountains)
    } = options;

    if (!path || currentIndex < minPoints) return null;

    // Search from the start of the path up to the safety guard window
    const searchLimit = Math.max(0, currentIndex - ignoreLast);

    const prevPoint = path[currentIndex - 1];
    if (!prevPoint) return null;

    // Calculate heading of the segment being added
    const currentHeading = calculateHeading(prevPoint, currentPoint);

    for (let i = 0; i < searchLimit; i++) {
        const oldPoint = path[i];
        const dist = getDistance(currentPoint.latitude, currentPoint.longitude, oldPoint.latitude, oldPoint.longitude);

        if (dist <= maxDistance) {
            // found potential intersection, check segment directionality
            const oldPrevPoint = i > 0 ? path[i - 1] : path[0];
            const oldHeading = calculateHeading(oldPrevPoint, oldPoint);

            const diff = Math.abs(currentHeading - oldHeading);
            const normalizedDiff = diff > 180 ? 360 - diff : diff;

            // Strict check: if the user is moving in roughly the same direction, it's a loop.
            // If they are moving toward it but from the side, it's also a potential loop crossing.
            if (normalizedDiff < maxHeadingDiff) {
                // Return indices for pruning
                return {
                    isLoop: true,
                    loopStartIndex: i,
                    loopEndIndex: currentIndex,
                    distance: dist,
                    headingDiff: normalizedDiff
                };
            }
        }
    }

    return null;
};

/**
 * Path Smoothing & EMA Filter Logic
 * Can be added here later if needed.
 */
