import express from "express";
import Adventure from "../models/Adventure.js";
import protectRoute from "../middleware/auth.middleware.js";
import mongoose from "mongoose";

const router = express.Router();

// Create a new adventure remark
router.post("/create", protectRoute, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ message: "Content is required" });
        }

        const newAdventure = new Adventure({
            user: req.user._id,
            content,
        });

        await newAdventure.save();
        res.status(201).json(newAdventure);
    } catch (error) {
        console.error("Error creating adventure:", error);
        res.status(500).json({ message: "Error creating adventure" });
    }
});

// Get user's adventure remarks
router.get("/user/:userId", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const adventures = await Adventure.find({ user: req.params.userId })
            .populate("user", "username profileImage")
            .sort({ createdAt: -1 });

        res.json(adventures);
    } catch (error) {
        console.error("Error fetching adventures:", error);
        res.status(500).json({ message: "Error fetching adventures" });
    }
});

// Delete an adventure remark
router.delete("/:id", protectRoute, async (req, res) => {
    try {
        const adventure = await Adventure.findById(req.params.id);

        if (!adventure) {
            return res.status(404).json({ message: "Adventure not found" });
        }

        if (adventure.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Unauthorized to delete this adventure" });
        }

        await Adventure.findByIdAndDelete(req.params.id);
        res.json({ message: "Adventure deleted successfully" });
    } catch (error) {
        console.error("Error deleting adventure:", error);
        res.status(500).json({ message: "Error deleting adventure" });
    }
});

export default router;
