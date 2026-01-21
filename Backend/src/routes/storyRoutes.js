import express from "express";
import Story from "../models/Story.js";
import User from "../models/User.js";
import protectRoute from "../middleware/auth.middleware.js";
import cloudinary from "../lib/cloudinary.js";
import mongoose from "mongoose";

const router = express.Router();

// Create a new story
router.post("/create", protectRoute, async (req, res) => {
    try {
        let { media, type, trekId } = req.body;

        if (!media) {
            return res.status(400).json({ message: "Media URL or base64 is required" });
        }

        if (media && media.startsWith("data:image")) {
            const uploadRes = await cloudinary.uploader.upload(media, {
                folder: "hikernet_stories",
            });
            media = uploadRes.secure_url;
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

        const stories = await Story.find({
            user: { $in: userIds },
            expiresAt: { $gt: new Date() } // Only show active stories
        })
            .populate("user", "username profileImage")
            .populate("trek", "name stats")
            .populate("viewers", "username profileImage") // Populate viewers for all, we will filter visibility in grouping or frontend
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

// Get archived/all stories for a specific user (for profile page)
router.get("/user/:userId", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const stories = await Story.find({ user: req.params.userId })
            .populate("user", "username profileImage")
            .populate("trek", "name stats")
            .sort({ createdAt: -1 });

        res.json(stories);
    } catch (error) {
        console.error("Error fetching user stories:", error);
        res.status(500).json({ message: "Error fetching user stories" });
    }
});

export default router;
