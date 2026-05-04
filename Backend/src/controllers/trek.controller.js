import Trek from "../models/Trek.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { discoverTreks, getTrekDetails } from "../lib/trekDiscoveryService.js";

/**
 * Trek Controller
 * Each function handles a single feature/responsibility.
 */

export const startTrek = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Error starting trek:", error);
        res.status(500).json({ message: "Error starting trek" });
    }
};

export const searchTrails = async (req, res) => {
    const { q, lat, lon, radius } = req.query;
    try {
        if (!q && (!lat || !lon)) {
            return res.status(400).json({ message: "Query or Lat/Lon required" });
        }

        const query = {
            q,
            lat: lat ? parseFloat(lat) : null,
            lon: lon ? parseFloat(lon) : null,
            radius: radius ? parseInt(radius) : 50000
        };

        const trails = await discoverTreks(query);
        res.json(trails || []);
    } catch (error) {
        console.error("Error discovering treks:", error);
        res.json([]);
    }
};

export const getOSMTrailDetails = async (req, res) => {
    try {
        const { osmId } = req.params;
        const { type } = req.query;
        const details = await getTrekDetails(osmId, type || 'relation');
        if (!details) return res.status(404).json({ message: "Trail not found" });
        res.json(details);
    } catch (error) {
        console.error("Error fetching trail details:", error);
        res.status(500).json({ message: "Error fetching trail details" });
    }
};

export const getPublicFeed = async (req, res) => {
    try {
        const treks = await Trek.find({
            "stats.distance": { $gt: 10 }
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
};

export const getLiveTreks = async (req, res) => {
    try {
        const treks = await Trek.find({ status: "ongoing" })
            .select("-path -waypoints")
            .sort({ createdAt: -1 })
            .populate("user", "username profileImage")
            .limit(10);
        res.json(treks);
    } catch (error) {
        console.error("Error fetching live treks:", error);
        res.status(500).json({ message: "Error fetching live treks" });
    }
};

export const getUserTreks = async (req, res) => {
    try {
        const treks = await Trek.find({
            $or: [
                { user: req.params.userId },
                { participants: req.params.userId }
            ]
        })
            .select("-path -waypoints")
            .sort({ createdAt: -1 })
            .populate("user", "username profileImage")
            .populate("participants", "username profileImage");
        res.json(treks);
    } catch (error) {
        console.error("Error fetching user treks:", error);
        res.status(500).json({ message: "Error fetching user treks" });
    }
};

export const getNearbyTreks = async (req, res) => {
    try {
        const { lat, lon, radius = 50 } = req.query;
        if (!lat || !lon) return res.status(400).json({ message: "Latitude and Longitude required" });

        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);
        const maxDist = parseFloat(radius);

        const allTreks = await Trek.find({
            "path.coordinates": { $exists: true, $not: { $size: 0 } }
        })
        .select("name location path.coordinates stats user images description createdAt status")
        .populate("user", "username profileImage");

        const nearbyTreks = filterTreksByDistance(allTreks, userLat, userLon, maxDist);

        res.json(nearbyTreks);
    } catch (error) {
        console.error("Error fetching nearby treks:", error);
        res.status(500).json({ message: "Error fetching nearby treks" });
    }
};

export const updateTrek = async (req, res) => {
    try {
        const trekId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(trekId)) {
            return res.status(400).json({ message: "Invalid trek ID format" });
        }

        const trek = await Trek.findOne({ _id: trekId, user: req.user._id });
        if (!trek) return res.status(404).json({ message: "Trek not found or unauthorized" });

        const previousStatus = trek.status;

        // Modular feature handling
        handlePathUpdate(trek, req.body);
        handleStatsUpdate(trek, req.body.stats);
        handleMediaUpdate(trek, req.body.images);
        handleWaypointsUpdate(trek, req.body.waypoints);
        handleStatusUpdate(trek, req.body.status);

        await trek.save();

        // Increment trek count if completed
        if (req.body.status === "completed" && previousStatus !== "completed") {
            const participantIds = new Set();
            participantIds.add(trek.user.toString());
            if (trek.mode === "group" && trek.participants) {
                trek.participants.forEach(p => participantIds.add(p.toString()));
            }

            await User.updateMany(
                { _id: { $in: Array.from(participantIds) } },
                { $inc: { treksCompleted: 1 } }
            );
        }

        res.json(trek);
    } catch (error) {
        console.error("Error updating trek:", error);
        res.status(500).json({ message: "Error updating trek" });
    }
};

export const syncTreks = async (req, res) => {
    try {
        const { treks } = req.body;
        if (!Array.isArray(treks)) return res.status(400).json({ message: "Invalid data format" });

        const savedTreks = [];
        for (const trekData of treks) {
            const newTrek = new Trek({ ...trekData, user: req.user._id, status: "completed" });
            await newTrek.save();
            savedTreks.push(newTrek._id);
        }

        if (savedTreks.length > 0) {
            await User.findByIdAndUpdate(req.user._id, {
                $inc: { treksCompleted: savedTreks.length }
            });
        }

        res.json({ message: "Sync successful", count: savedTreks.length, ids: savedTreks });
    } catch (error) {
        console.error("Error syncing treks:", error);
        res.status(500).json({ message: "Error syncing treks" });
    }
};

export const deleteTrek = async (req, res) => {
    try {
        const trek = await Trek.findById(req.params.id);
        if (!trek) return res.status(404).json({ message: "Trek not found" });
        if (trek.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        await Trek.findByIdAndDelete(req.params.id);
        res.json({ message: "Trek deleted successfully" });
    } catch (error) {
        console.error("Error deleting trek:", error);
        res.status(500).json({ message: "Error deleting trek" });
    }
};

export const getTrekById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid trek ID format" });
        }
        const trek = await Trek.findById(req.params.id).populate("user", "username profileImage");
        if (!trek) return res.status(404).json({ message: "Trek not found" });
        res.json(trek);
    } catch (error) {
        console.error("Error fetching trek:", error);
        res.status(500).json({ message: "Error fetching trek" });
    }
};

// --- Private Helper Functions (Internal Decomposition) ---

function filterTreksByDistance(treks, userLat, userLon, maxDist) {
    return treks
        .filter(trek => {
            const startCoord = getTrekStartCoordinate(trek);
            if (!startCoord) return false;
            
            const dist = getDistanceFromLatLonInKm(userLat, userLon, startCoord[1], startCoord[0]);
            return dist <= maxDist;
        })
        .map(trek => {
            const trekObj = trek.toObject();
            const startCoord = getTrekStartCoordinate(trek);
            
            delete trekObj.path;
            const dist = getDistanceFromLatLonInKm(userLat, userLon, startCoord[1], startCoord[0]);
            return { ...trekObj, distanceConfig: dist };
        })
        .sort((a, b) => a.distanceConfig - b.distanceConfig);
}

function getTrekStartCoordinate(trek) {
    if (!trek.path?.coordinates?.length) return null;
    return Array.isArray(trek.path.coordinates[0][0]) 
        ? trek.path.coordinates[0][0] 
        : trek.path.coordinates[0];
}

function handlePathUpdate(trek, body) {
    const { path, coordinates, isNewSegment } = body;
    
    if (path) {
        trek.path = path;
        return;
    }

    if (coordinates && Array.isArray(coordinates)) {
        const newPoints = coordinates.map(p => {
            if (Array.isArray(p)) return p;
            if (p.latitude && p.longitude) return [p.longitude, p.latitude];
            return null;
        }).filter(p => p !== null);

        if (!trek.path?.coordinates?.length) {
            // Initialize path
            if (newPoints.length === 1) {
                const p1 = newPoints[0];
                const p2 = [p1[0] + 0.000001, p1[1]];
                trek.path = { type: 'MultiLineString', coordinates: [[p1, p2]] };
            } else {
                trek.path = { type: 'MultiLineString', coordinates: [newPoints] };
            }
        } else {
            // Ensure MultiLineString
            if (trek.path.type === 'LineString') {
                trek.path = { type: 'MultiLineString', coordinates: [trek.path.coordinates] };
            }

            if (isNewSegment) {
                trek.path.coordinates.push(newPoints);
            } else {
                const lastIdx = trek.path.coordinates.length - 1;
                trek.path.coordinates[lastIdx].push(...newPoints);
            }
        }
    }
}

function handleStatsUpdate(trek, stats) {
    if (stats) {
        trek.stats = { ...trek.stats, ...stats };
    }
}

function handleMediaUpdate(trek, images) {
    if (images && Array.isArray(images)) {
        trek.images.push(...images);
    }
}

function handleWaypointsUpdate(trek, waypoints) {
    if (waypoints && Array.isArray(waypoints)) {
        trek.waypoints.push(...waypoints);
    }
}

function handleStatusUpdate(trek, status) {
    if (status) {
        trek.status = status;
        if (status === "completed") {
            trek.endTime = new Date();
        }
    }
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
