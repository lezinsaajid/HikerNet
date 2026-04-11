/**
 * Professional Geolocation Utilities for Trekking
 */

/**
 * Calculates the Haversine distance between two points in meters
 */
export const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Calculates the shortest distance from a point to a path (collection of line segments)
 * Supports progressive loop detection by constraining the search space via currentIndex and windowSize
 * Returns { distance, segmentIndex, snappedPoint }
 */
export const getPointToPathDistance = (point, path, currentIndex = -1, windowSize = 30) => {
    if (!path || path.length < 2) return { distance: Infinity, segmentIndex: -1 };

    let minDistance = Infinity;
    let closestSegment = -1;
    let bestPoint = null;

    let startIndex = 0;
    let endIndex = path.length - 1;

    // Apply progressive loop detection window if an index is provided
    if (currentIndex >= 0 && currentIndex < path.length) {
        startIndex = Math.max(0, currentIndex - windowSize);
        endIndex = Math.min(path.length - 1, currentIndex + windowSize);
    }

    for (let i = startIndex; i < endIndex; i++) {
        const v = path[i];
        const w = path[i + 1];
        const { distance, snapped } = getPointToSegmentDistance(point, v, w);

        if (distance < minDistance) {
            minDistance = distance;
            closestSegment = i;
            bestPoint = snapped;
        }
    }

    return { distance: minDistance, segmentIndex: closestSegment, snappedPoint: bestPoint };
};

/**
 * Shortest distance from a point to a single line segment
 */
function getPointToSegmentDistance(p, v, w) {
    const l2 = getDistanceSq(v.latitude, v.longitude, w.latitude, w.longitude);
    if (l2 === 0) return { distance: getDistance(p.latitude, p.longitude, v.latitude, v.longitude), snapped: v };

    let t = ((p.latitude - v.latitude) * (w.latitude - v.latitude) +
        (p.longitude - v.longitude) * (w.longitude - v.longitude)) / l2;
    t = Math.max(0, Math.min(1, t));

    const snapped = {
        latitude: v.latitude + t * (w.latitude - v.latitude),
        longitude: v.longitude + t * (w.longitude - v.longitude)
    };

    return {
        distance: getDistance(p.latitude, p.longitude, snapped.latitude, snapped.longitude),
        snapped
    };
}

/**
 * Approximated squared distance for optimization in local coordinate spaces
 */
function getDistanceSq(lat1, lon1, lat2, lon2) {
    return Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2);
}

/**
 * Calculates the bearing (heading) from one point to another in degrees
 */
export const calculateHeading = (start, end) => {
    const lat1 = (start.latitude * Math.PI) / 180;
    const lat2 = (end.latitude * Math.PI) / 180;
    const lon1 = (start.longitude * Math.PI) / 180;
    const lon2 = (end.longitude * Math.PI) / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
};

/**
 * Calculates a map region that fits all provided coordinates with some padding
 */
export const getRegionForCoordinates = (points, paddingMultiplier = 1.15) => {
    if (!points || points.length === 0) return null;
    let minLat, maxLat, minLng, maxLng;

    points.forEach((point) => {
        const lat = point.latitude;
        const lng = point.longitude;
        minLat = minLat === undefined ? lat : Math.min(minLat, lat);
        maxLat = maxLat === undefined ? lat : Math.max(maxLat, lat);
        minLng = minLng === undefined ? lng : Math.min(minLng, lng);
        maxLng = maxLng === undefined ? lng : Math.max(maxLng, lng);
    });

    const latDelta = (maxLat - minLat) * paddingMultiplier; 
    const lngDelta = (maxLng - minLng) * paddingMultiplier;

    return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(latDelta, 0.002),
        longitudeDelta: Math.max(lngDelta, 0.002),
    };
};
