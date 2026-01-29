import express from "express";
import Trek from "../models/Trek.js";
import protectRoute from "../middleware/auth.middleware.js";
import mongoose from "mongoose";
import { discoverTreks, getTrekDetails } from "../lib/trekDiscoveryService.js";

const router = express.Router();

// Start a new trek
router.post("/start", protectRoute, async (req, res) => {
    try {
        const { name, description, location, privacy } = req.body;

        const trek = new Trek({
            user: req.user._id,
            name: name || "Untitled Trek",
            description,
            location,
            privacy,
            status: "ongoing",
            startTime: new Date()
        });

        await trek.save();
        res.status(201).json(trek);
    } catch (error) {
        console.error("Error starting trek:", error);
        res.status(500).json({ message: "Error starting trek" });
    }
});

// Discover trails (External OSM)
router.get("/discover", async (req, res) => {
    console.log("GET /discover:", req.query);
    try {
        const { q, lat, lon, radius } = req.query;
        let query;

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
        res.json(trails);
    } catch (error) {
        console.error("Error discovering treks:", error);
        res.status(500).json({ message: "Error discovering treks" });
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
            privacy: "public",
            "stats.distance": { $gt: 10 } // Only legit trails (at least 10m walk)
        })
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
            "stats.distance": { $gt: 10 } // Filter out aborted/empty treks
        }).sort({ createdAt: -1 });
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
        // Optimization: In real app, use MongoDB $near or 2dsphere index.
        // Since we don't have 2dsphere index on specific start point yet, we do in-memory filter.
        // It's fine for < 5000 treks.
        const allTreks = await Trek.find({
            privacy: "public",
            coordinates: { $exists: true, $not: { $size: 0 } }
        }).select("name location coordinates stats user images description");

        const nearbyTreks = allTreks.filter(trek => {
            if (!trek.coordinates || trek.coordinates.length === 0) return false;
            const startNode = trek.coordinates[0];
            const dist = getDistanceFromLatLonInKm(userLat, userLon, startNode.latitude, startNode.longitude);
            return dist <= maxDist;
        }).map(trek => {
            const startNode = trek.coordinates[0];
            const dist = getDistanceFromLatLonInKm(userLat, userLon, startNode.latitude, startNode.longitude);
            return { ...trek.toObject(), distanceConfig: dist }; // Enrich with distance from user
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
        const { coordinates, stats, status, images } = req.body;
        const trekId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(trekId)) {
            return res.status(400).json({ message: "Invalid trek ID format" });
        }

        const trek = await Trek.findOne({ _id: trekId, user: req.user._id });

        if (!trek) {
            return res.status(404).json({ message: "Trek not found or unauthorized" });
        }

        if (coordinates && Array.isArray(coordinates)) {
            trek.coordinates.push(...coordinates);
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



export default router;
