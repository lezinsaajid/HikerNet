import express from "express";
import Trek from "../models/Trek.js";
import protectRoute from "../middleware/auth.middleware.js";
import mongoose from "mongoose";

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

// Get public feed (all public treks)
router.get("/feed/public", async (req, res) => {
    try {
        const treks = await Trek.find({ privacy: "public" })
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
        const treks = await Trek.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.json(treks);
    } catch (error) {
        console.error("Error fetching user treks:", error);
        res.status(500).json({ message: "Error fetching user treks" });
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
