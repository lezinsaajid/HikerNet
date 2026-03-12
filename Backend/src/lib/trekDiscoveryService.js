import axios from "axios";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/**
 * Search for hiking trails near a location or by name.
 * Uses Overpass API to find elements with route=hiking.
 */
export const discoverTreks = async (query, limit = 30) => {
    try {
        let overpassQuery;

        if (query.lat && query.lon) {
            // Search by radius (e.g., 50km default for stability)
            const radius = query.radius || 50000;
            overpassQuery = `
                [out:json][timeout:30];
                (
                  relation["route"~"hiking|foot|mtb|equestrian"](around:${radius},${query.lat},${query.lon});
                  way["route"~"hiking|foot|mtb|equestrian"](around:${radius},${query.lat},${query.lon});
                  way["highway"~"path|footway"]["foot"!="no"](around:${radius},${query.lat},${query.lon});
                );
                out center ${limit};
            `;
        } else if (typeof query === 'string' || (query.q && typeof query.q === 'string')) {
            // Search by name, optionally around a location
            const searchTerm = typeof query === 'string' ? query : query.q;
            const aroundClause = (query.lat && query.lon) ? `(around:${query.radius || 50000},${query.lat},${query.lon})` : '';

            overpassQuery = `
                [out:json][timeout:30];
                (
                  relation["route"~"hiking|foot|mtb|equestrian"]["name"~"${searchTerm}",i]${aroundClause};
                  way["route"~"hiking|foot|mtb|equestrian"]["name"~"${searchTerm}",i]${aroundClause};
                  way["highway"~"path|footway"]["name"~"${searchTerm}",i]${aroundClause};
                );
                out center ${limit};
            `;
        } else {
            throw new Error("Invalid discovery query");
        }

        console.log("Sending Expanded Overpass Query...");

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        let response;
        let retries = 2;

        // Retry logic with exponential backoff
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const responseObj = await axios.post(OVERPASS_URL,
                    `data=${encodeURIComponent(overpassQuery)}`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Hikernet-App/1.0 (contact@hikernet.com)'
                        },
                        signal: controller.signal
                    }
                );
                response = responseObj;
                clearTimeout(timeoutId);
                break; // Success, exit retry loop

            } catch (error) {
                clearTimeout(timeoutId);

                if (attempt === retries) {
                    // Last attempt failed
                    console.warn(`Overpass API timeout after ${retries + 1} attempts. Returning empty results.`);
                    return []; // Return empty array instead of throwing
                }

                // Wait before retry (exponential backoff: 1s, 2s, 4s)
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`Retry ${attempt + 1}/${retries} after ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        if (response.status !== 200) {
            if (response.status === 504 || response.status === 429) {
                console.warn(`Overpass API Busy/Timeout (${response.status}). Returning empty results.`);
                return [];
            }
            console.error("Overpass Response Error:", response.status, response.data);
            throw new Error(`Overpass API Error: ${response.status}`);
        }

        const data = response.data;
        console.log(`Received ${data.elements?.length || 0} elements from expanded Overpass.`);

        if (!data.elements) return [];

        return data.elements
            .filter(el => {
                const tags = el.tags || {};
                // Only legit trails have names
                if (!tags.name) return false;

                // Exclude generic sidewalks or very minor paths if they don't have route info
                const isRoute = !!tags.route;
                const isNamedPath = !!tags.name && (tags.highway === 'path' || tags.highway === 'footway' || tags.highway === 'track');

                return isRoute || isNamedPath;
            })
            .map(el => ({
                osmId: el.id,
                type: el.type,
                name: el.tags.name || (el.tags.highway ? `Path near ${el.tags["addr:street"] || 'unknown'}` : "Unnamed Trail"),
                location: el.tags["addr:city"] || el.tags["addr:region"] || el.tags["addr:state"] || el.tags["addr:suburb"] || "Nature Area",
                distance: el.tags.distance ? parseFloat(el.tags.distance) : null,
                difficulty: el.tags.difficulty || el.tags.sac_scale || el.tags.mtb_scale || "Easy",
                surface: el.tags.surface || "Natural",
                visibility: el.tags.trail_visibility || "Good",
                description: el.tags.description || el.tags.note || `A ${el.tags.route || el.tags.highway || 'route'} for exploration.`,
                image: el.tags.image || el.tags.wikimedia_commons || el.tags.mapillary || null,
                website: el.tags.website || el.tags.wikipedia || null,
                coordinates: el.center ? { latitude: el.center.lat, longitude: el.center.lon } : null,
                source: 'OSM',
                routeType: el.tags.route || el.tags.highway || 'path'
            }));

    } catch (error) {
        console.error("Discover Treks Error:", error);
        throw error;
    }
};

/**
 * Fetch elevation data for a list of coordinates.
 * Samples the coordinates to avoid overloading the API.
 */
const getElevationData = async (coordinates) => {
    if (!coordinates || coordinates.length === 0) return null;

    try {
        // Sample up to 20 points for the elevation profile
        const sampleSize = 20;
        const sampled = [];
        const step = Math.max(1, Math.floor(coordinates.length / sampleSize));

        for (let i = 0; i < coordinates.length; i += step) {
            sampled.push(coordinates[i]);
            if (sampled.length >= sampleSize) break;
        }

        const response = await axios.post("https://api.open-elevation.com/api/v1/lookup", {
            locations: sampled.map(c => ({ latitude: c.latitude, longitude: c.longitude }))
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status !== 200) return null;
        const data = response.data;

        const elevations = data.results.map(r => r.elevation);
        const gain = elevations.reduce((acc, curr, i) => {
            if (i === 0) return 0;
            const diff = curr - elevations[i - 1];
            return acc + (diff > 0 ? diff : 0);
        }, 0);

        return {
            profile: elevations,
            elevationGain: Math.round(gain),
            minElevation: Math.min(...elevations),
            maxElevation: Math.max(...elevations)
        };
    } catch (error) {
        console.error("Elevation Fetch Error:", error);
        return null;
    }
};

/**
 * Get detailed geometry and tags for a specific OSM element.
 */
export const getTrekDetails = async (osmId, type = 'relation') => {
    try {
        const overpassQuery = `
            [out:json][timeout:25];
            ${type}(${osmId});
            (._;>;);
            out body;
        `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let response;
        try {
            response = await axios.post(OVERPASS_URL,
                `data=${encodeURIComponent(overpassQuery)}`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    signal: controller.signal
                }
            );
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            console.warn("Trek details fetch timeout/error, returning null");
            return null;
        }

        if (response.status !== 200) {
            throw new Error("Overpass API Error");
        }

        const data = response.data;

        // Find the main element
        const mainElement = data.elements.find(el => el.id == osmId && el.type == type);
        if (!mainElement) return null;

        // Extract nodes for geometry
        const nodes = data.elements.filter(el => el.type === 'node');
        const nodeMap = new Map(nodes.map(n => [n.id, { latitude: n.lat, longitude: n.lon }]));

        let coordinates = [];
        if (type === 'way') {
            coordinates = mainElement.nodes.map(nodeId => nodeMap.get(nodeId)).filter(n => n);
        } else if (type === 'relation') {
            // For relations, we need to collect ways and their nodes
            const ways = data.elements.filter(el => el.type === 'way');
            const wayMap = new Map(ways.map(w => [w.id, w.nodes]));

            mainElement.members.forEach(member => {
                if (member.type === 'way') {
                    const wayNodes = wayMap.get(member.ref);
                    if (wayNodes) {
                        coordinates.push(...wayNodes.map(nodeId => nodeMap.get(nodeId)).filter(n => n));
                    }
                }
            });
        }

        const elevationData = await getElevationData(coordinates);

        return {
            osmId: mainElement.id,
            type: mainElement.type,
            name: mainElement.tags.name || "Unnamed Trail",
            tags: mainElement.tags,
            difficulty: mainElement.tags.difficulty || mainElement.tags.sac_scale || mainElement.tags.mtb_scale || "Unknown",
            surface: mainElement.tags.surface || "Natural",
            visibility: mainElement.tags.trail_visibility || "Unknown",
            image: mainElement.tags.image || mainElement.tags.wikimedia_commons || mainElement.tags.mapillary || null,
            website: mainElement.tags.website || mainElement.tags.wikipedia || null,
            coordinates,
            elevationData,
            source: 'OSM'
        };

    } catch (error) {
        console.error("Trek Details Error:", error);
        throw error;
    }
};
