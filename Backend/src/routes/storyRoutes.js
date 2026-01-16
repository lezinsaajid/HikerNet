import express from "express";
import Story from "../models/Story.js";
import User from "../models/User.js";
import protectRoute from "../middleware/auth.middleware.js";
import mongoose from "mongoose";

const router = express.Router();

// Create a new story
router.post("/create", protectRoute, async (req, res) => {
    try {
        const { media, type, trekId } = req.body;

        if (!media) {
            return res.status(400).json({ message: "Media URL is required" });
        }

        const newStory = new Story({
            user: req.user._id,
            media,
            type,
            trek: trekId,
        });

        await newStory.save();
        res.status(201).json(newStory);
    } catch (error) {
        console.error("Error creating story:", error);
        res.status(500).json({ message: "Error creating story" });
    }
});

// View story (mark as viewed)
router.post("/view/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid story ID format" });
        }
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: "Story not found" });

        if (!story.viewers.includes(req.user._id)) {
            story.viewers.push(req.user._id);
            await story.save();
        }

        res.json({ message: "Story viewed" });
    } catch (error) {
        console.error("Error viewing story:", error);
        res.status(500).json({ message: "Error viewing story" });
    }
});

// Get stories feed (active stories from following + self, grouped by user)
router.get("/feed", protectRoute, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        const following = currentUser.following;
        const userIds = [...following, req.user._id];

        const stories = await Story.find({ user: { $in: userIds } })
            .populate("user", "username profileImage")
            .populate("trek", "name stats")
            .sort({ createdAt: 1 });

        // Group by user
        const groupedStories = stories.reduce((acc, story) => {
            const userId = story.user._id.toString();
            if (!acc[userId]) {
                acc[userId] = {
                    user: story.user,
                    stories: []
                };
            }
            acc[userId].stories.push(story);
            return acc;
        }, {});

        res.json(Object.values(groupedStories));
    } catch (error) {
        console.error("Error fetching story feed:", error);
        res.status(500).json({ message: "Error fetching story feed" });
    }
});

export default router;
