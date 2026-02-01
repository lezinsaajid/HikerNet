
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
        const response = await fetch(OVERPASS_URL, {
            method: 'POST',
            body: `data=${encodeURIComponent(overpassQuery)}`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Hikernet-App/1.0 (contact@hikernet.com)'
            }
        });

        if (!response.ok) {
            if (response.status === 504 || response.status === 429) {
                console.warn(`Overpass API Busy/Timeout (${response.status}). Returning empty results.`);
                return [];
            }
            const errorText = await response.text();
            console.error("Overpass Response Error text:", errorText);
            throw new Error(`Overpass API Error: ${response.status}`);
        }

        const data = await response.json();
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

        const response = await fetch("https://api.open-elevation.com/api/v1/lookup", {
            method: 'POST',
            body: JSON.stringify({
                locations: sampled.map(c => ({ latitude: c.latitude, longitude: c.longitude }))
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) return null;
        const data = await response.json();

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

        const response = await fetch(OVERPASS_URL, {
            method: 'POST',
            body: `data=${encodeURIComponent(overpassQuery)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!response.ok) {
            throw new Error("Overpass API Error");
        }

        const data = await response.json();

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
