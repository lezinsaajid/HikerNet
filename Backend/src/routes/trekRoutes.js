import express from "express";
import Trek from "../models/Trek.js";
import protectRoute from "../middleware/auth.middleware.js";
import mongoose from "mongoose";
import { discoverTreks, getTrekDetails } from "../lib/trekDiscoveryService.js";

const router = express.Router();

// Start a new trek
router.post("/start", protectRoute, async (req, res) => {
    const { name, description, location } = req.body;

    const trek = new Trek({
        user: req.user._id,
        name: name || "Untitled Trek",
        description,
        location,
        privacy: "public",
        status: "ongoing",
        startTime: new Date()
    });

    await trek.save();
    res.status(201).json(trek);
});

// Discover trails (External OSM)
router.get("/discover", async (req, res) => {
    console.log("GET /discover:", req.query);
    const { q, lat, lon, radius } = req.query;
    let query;

    try {
        if (q || (lat && lon)) {
            query = {
                q,
                lat: lat ? parseFloat(lat) : null,
                lon: lon ? parseFloat(lon) : null,
                radius: radius ? parseInt(radius) : 50000
            };
        } else {
            return res.status(400).json({ message: "Query or Lat/Lon required" });
        }

        const trails = await discoverTreks(query);
        res.json(trails || []); // Return empty array if null/undefined
    } catch (error) {
        console.error("Error discovering treks:", error);
        // Return empty array instead of error for better UX
        res.json([]);
    }
});

// Get OSM trail details
router.get("/discover/:osmId", async (req, res) => {
    console.log("GET /discover/:osmId:", req.params.osmId, req.query);
    try {
        const { osmId } = req.params;
        const { type } = req.query; // 'relation' (default) or 'way'

        const details = await getTrekDetails(osmId, type || 'relation');
        if (!details) return res.status(404).json({ message: "Trail not found" });

        res.json(details);
    } catch (error) {
        console.error("Error fetching trail details:", error);
        res.status(500).json({ message: "Error fetching trail details" });
    }
});

// Get public feed (all public treks)
router.get("/feed/public", async (req, res) => {
    try {
        const treks = await Trek.find({
            "stats.distance": { $gt: 10 } // Only legit trails (at least 10m walk)
        })
            .select("-path -waypoints")
            .sort({ createdAt: -1 })
            .populate("user", "username profileImage")
            .limit(20);
        res.json(treks);
    } catch (error) {
        console.error("Error fetching public feed:", error);
        res.status(500).json({ message: "Error fetching public feed" });
    }
});

// Get user's treks
router.get("/user/:userId", async (req, res) => {
    try {
        const treks = await Trek.find({
            user: req.params.userId,
            // Removed distance filter to show all "added" trails in profile
        }).select("-path -waypoints").sort({ createdAt: -1 });
        res.json(treks);
    } catch (error) {
        console.error("Error fetching user treks:", error);
        res.status(500).json({ message: "Error fetching user treks" });
    }
});

// Helper for distance calculation (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Get nearby treks (Local DB)
router.get("/nearby", async (req, res) => {
    try {
        const { lat, lon, radius = 50 } = req.query; // radius in km

        if (!lat || !lon) {
            return res.status(400).json({ message: "Latitude and Longitude required" });
        }

        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);
        const maxDist = parseFloat(radius);

        // Fetch all public treks with coordinates
        // Optimization: Fetching only the first part of the path for distance checking
        // But since we can't easily slice nested 2D arrays in find() and still be efficient, 
        // we'll fetch just enough to get the start point.
        const allTreks = await Trek.find({
            "path.coordinates": { $exists: true, $not: { $size: 0 } }
        })
        .select("name location path.coordinates stats user images description createdAt status")
        .populate("user", "username profileImage");

        const nearbyTreks = allTreks.filter(trek => {
            if (!trek.path || !trek.path.coordinates || trek.path.coordinates.length === 0) return false;
            
            // Handle both LineString and MultiLineString for start point
            let startCoord;
            if (Array.isArray(trek.path.coordinates[0][0])) {
                // MultiLineString: coordinates[0] is an array of points
                startCoord = trek.path.coordinates[0][0];
            } else {
                // LineString: coordinates[0] is a point [lng, lat]
                startCoord = trek.path.coordinates[0];
            }
            
            const startNode = { latitude: startCoord[1], longitude: startCoord[0] }; 
            const dist = getDistanceFromLatLonInKm(userLat, userLon, startNode.latitude, startNode.longitude);
            return dist <= maxDist;
        }).map(trek => {
            const trekObj = trek.toObject();
            delete trekObj.path; // STRIP the path before sending to client
            
            let startCoord;
            if (Array.isArray(trek.path.coordinates[0][0])) {
                startCoord = trek.path.coordinates[0][0];
            } else {
                startCoord = trek.path.coordinates[0];
            }
            
            const dist = getDistanceFromLatLonInKm(userLat, userLon, startCoord[1], startCoord[0]);
            return { ...trekObj, distanceConfig: dist }; // Enrich with distance from user
        }).sort((a, b) => a.distanceConfig - b.distanceConfig);

        res.json(nearbyTreks);

    } catch (error) {
        console.error("Error fetching nearby treks:", error);
        res.status(500).json({ message: "Error fetching nearby treks" });
    }
});

// Update trek (add points, update stats, finish)
router.put("/update/:id", protectRoute, async (req, res) => {
    try {
        const { coordinates, stats, status, images } = req.body; // Client still sends 'coordinates' or 'path'
        const trekId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(trekId)) {
            return res.status(400).json({ message: "Invalid trek ID format" });
        }

        const trek = await Trek.findOne({ _id: trekId, user: req.user._id });

        if (!trek) {
            return res.status(404).json({ message: "Trek not found or unauthorized" });
        }

        if (req.body.path) {
            // Full path replacement (e.g. after loop detection or segment manipulation)
            trek.path = req.body.path;
        } else if (coordinates && Array.isArray(coordinates)) {
            // Incremental append logic (existing)
            const newPoints = coordinates.map(p => {
                if (Array.isArray(p)) return p;
                if (p.latitude && p.longitude) return [p.longitude, p.latitude];
                return null;
            }).filter(p => p !== null);

            if (!trek.path || !trek.path.coordinates || trek.path.coordinates.length === 0) {
                if (newPoints.length === 1) {
                    const p1 = newPoints[0];
                    const p2 = [p1[0] + 0.000001, p1[1]];
                    trek.path = { type: 'MultiLineString', coordinates: [[p1, p2]] };
                } else {
                    trek.path = { type: 'MultiLineString', coordinates: [newPoints] };
                }
            } else {
                if (trek.path.type === 'LineString') {
                    trek.path = { type: 'MultiLineString', coordinates: [trek.path.coordinates] };
                }

                if (req.body.isNewSegment) {
                    trek.path.coordinates.push(newPoints);
                } else {
                    const lastSegmentIndex = trek.path.coordinates.length - 1;
                    trek.path.coordinates[lastSegmentIndex].push(...newPoints);
                }
            }
        }

        if (stats) {
            trek.stats = { ...trek.stats, ...stats };
        }

        if (images && Array.isArray(images)) {
            trek.images.push(...images);
        }

        if (req.body.waypoints && Array.isArray(req.body.waypoints)) {
            trek.waypoints.push(...req.body.waypoints);
        }

        if (status) {
            trek.status = status;
            if (status === "completed") {
                trek.endTime = new Date();
            }
        }

        await trek.save();
        res.json(trek);
    } catch (error) {
        console.error("Error updating trek:", error);
        res.status(500).json({ message: "Error updating trek" });
    }
});

// Get a specific trek
router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid trek ID format" });
        }
        const trek = await Trek.findById(req.params.id).populate("user", "username profileImage");

        if (!trek) {
            return res.status(404).json({ message: "Trek not found" });
        }

        // Check privacy if needed (omitted for simplicity, but good to have)

        res.json(trek);
    } catch (error) {
        console.error("Error fetching trek:", error);
        res.status(500).json({ message: "Error fetching trek" });
    }
});



// Sync offline data (Bulk upload of treks)
router.post("/sync", protectRoute, async (req, res) => {
    try {
        const { treks } = req.body; // Array of full trek objects from offline storage

        if (!treks || !Array.isArray(treks)) {
            return res.status(400).json({ message: "Invalid data format" });
        }

        const savedTreks = [];

        for (const trekData of treks) {
            // Create new trek entry for each
            const newTrek = new Trek({
                ...trekData,
                user: req.user._id, // Ensure user matches token
                status: "completed", // Usually synced treks are done
            });
            await newTrek.save();
            savedTreks.push(newTrek._id);
        }

        res.json({ message: "Sync successful", count: savedTreks.length, ids: savedTreks });

    } catch (error) {
        console.error("Error syncing treks:", error);
        res.status(500).json({ message: "Error syncing treks" });
    }
});



// Delete a trek
router.delete("/:id", protectRoute, async (req, res) => {
    try {
        const trek = await Trek.findById(req.params.id);

        if (!trek) {
            return res.status(404).json({ message: "Trek not found" });
        }

        // Only owner can delete
        if (trek.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Unauthorized to delete this trek" });
        }

        await Trek.findByIdAndDelete(req.params.id);
        res.json({ message: "Trek deleted successfully" });
    } catch (error) {
        console.error("Error deleting trek:", error);
        res.status(500).json({ message: "Error deleting trek" });
    }
});

export default router;
