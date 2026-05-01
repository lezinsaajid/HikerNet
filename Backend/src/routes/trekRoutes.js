import express from "express";
import protectRoute from "../middleware/auth.middleware.js";
import * as trekController from "../controllers/trek.controller.js";

const router = express.Router();

// Start a new trek
router.post("/start", protectRoute, trekController.startTrek);

// Discover trails (External OSM)
router.get("/discover", trekController.searchTrails);

// Get OSM trail details
router.get("/discover/:osmId", trekController.getOSMTrailDetails);

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
router.get("/user/:userId", trekController.getUserTreks);

// Get nearby treks (Local DB)
router.get("/nearby", trekController.getNearbyTreks);

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
router.get("/:id", trekController.getTrekById);

// Sync offline data (Bulk upload of treks)
router.post("/sync", protectRoute, trekController.syncTreks);

// Delete a trek
router.delete("/:id", protectRoute, trekController.deleteTrek);

export default router;

