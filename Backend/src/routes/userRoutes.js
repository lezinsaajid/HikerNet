import express from "express";
import User from "../models/User.js";
import Trek from "../models/Trek.js";
import Post from "../models/Post.js";
import protectRoute from "../middleware/auth.middleware.js";
import cloudinary from "../lib/cloudinary.js";
import mongoose from "mongoose";

const router = express.Router();
const getHikerTier = (count) => {
    if (count >= 30) return "Trail Master";
    if (count >= 15) return "Pathfinder";
    if (count >= 5) return "Explorer";
    if (count >= 1) return "Wanderer";
    return "Newbie";
};

// Get user profile with social stats
router.get("/profile/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error(`[Backend] Rejecting invalid profile ID: "${req.params.id}"`);
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        // Calculate rank
        const leaderboard = await Trek.aggregate([
            { $match: { status: "completed", user: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: "$user",
                    treksCount: { $sum: 1 },
                },
            },
            { $sort: { treksCount: -1 } },
        ]);

        const rank = leaderboard.findIndex(item => item && item._id && item._id.toString() === req.params.id) + 1;

        res.json({
            ...user.toObject(),
            rank: rank || 0,
            treksCount: leaderboard.find(item => item && item._id && item._id.toString() === req.params.id)?.treksCount || 0,
            tier: getHikerTier(leaderboard.find(item => item && item._id && item._id.toString() === req.params.id)?.treksCount || 0),
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Error fetching user profile" });
    }
});

// Follow / Unfollow user
router.post("/follow/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: "You cannot follow yourself" });
        }

        const userToFollow = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!userToFollow || !currentUser) return res.status(404).json({ message: "User not found" });

        const isFollowing = currentUser.following.some(fid => String(fid) === String(req.params.id));

        if (isFollowing) {
            // Unfriend (Mutual)
            await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.id, followers: req.params.id } });
            await User.findByIdAndUpdate(req.params.id, { $pull: { followers: req.user._id, following: req.user._id } });
            res.json({ message: "Unfriended successfully" });
        } else {
            // Friend (Mutual)
            await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: req.params.id, followers: req.params.id } });
            await User.findByIdAndUpdate(req.params.id, { $addToSet: { followers: req.user._id, following: req.user._id } });
            res.json({ message: "Added friend successfully" });
        }
    } catch (error) {
        console.error("Error in follow/unfollow:", error);
        res.status(500).json({ message: "Error in follow/unfollow" });
    }
});

// Block user
router.post("/block/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: "You cannot block yourself" });
        }

        const currentUser = await User.findById(req.user._id);
        const userToBlock = await User.findById(req.params.id);

        if (!userToBlock) return res.status(404).json({ message: "User not found" });

        // Add to blockedUsers
        await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: req.params.id } });

        // Mutual unfollow
        await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.id, followers: req.params.id } });
        await User.findByIdAndUpdate(req.params.id, { $pull: { following: req.user._id, followers: req.user._id } });

        res.json({ message: "User blocked successfully" });
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).json({ message: "Error blocking user" });
    }
});

// Unblock user
router.post("/unblock/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: req.params.id } });
        res.json({ message: "User unblocked successfully" });
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.status(500).json({ message: "Error unblocking user" });
    }
});

// Get suggested users (simple implementation: users not followed)
router.get("/suggested", protectRoute, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        const users = await User.find({
            _id: { $ne: req.user._id, $nin: currentUser.following },
        })
            .select("username profileImage bio")
            .limit(10);

        res.json(users);
    } catch (error) {
        console.error("Error fetching suggested users:", error);
        res.status(500).json({ message: "Error fetching suggested users" });
    }
});

// Get Pending Invitations
router.get("/invitations", protectRoute, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Filter out old invites (> 1 hour?) - Optional, for now just return all
        res.json(user.trekInvitations || []);
    } catch (error) {
        console.error("Error fetching invitations:", error);
        res.status(500).json({ message: "Error fetching invitations" });
    }
});

// Clear Invitation (Accept/Decline)
router.post("/invitations/clear", protectRoute, async (req, res) => {
    try {
        const { roomId } = req.body;
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { trekInvitations: { roomId: roomId } }
        });
        res.json({ message: "Invitation cleared" });
    } catch (error) {
        console.error("Error clearing invitation:", error);
        res.status(500).json({ message: "Error clearing invitation" });
    }
});

router.get("/leaderboard", async (req, res) => {
    try {
        const { timeframe = 'all' } = req.query;
        let dateFilter = {};

        const now = new Date();
        if (timeframe === 'week') {
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFilter = { createdAt: { $gte: lastWeek } };
        } else if (timeframe === 'month') {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            dateFilter = { createdAt: { $gte: lastMonth } };
        }

        const leaderboard = await User.aggregate([
            {
                $match: { email: { $ne: "system@hikernet.com" } }
            },
            {
                $lookup: {
                    from: "treks",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$user", "$$userId"] },
                                        { $eq: ["$status", "completed"] },
                                        ...(timeframe !== 'all' ? [{ $gte: ["$createdAt", timeframe === 'week' ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())] }] : [])
                                    ]
                                }
                            }
                        }
                    ],
                    as: "filteredTreks"
                }
            },
            {
                $addFields: {
                    treksCount: { $size: "$filteredTreks" },
                    totalDistance: { $sum: "$filteredTreks.stats.distance" }
                }
            },
            { $sort: { treksCount: -1, totalDistance: -1 } },
            { $limit: 20 },
            {
                $project: {
                    _id: 1,
                    username: 1,
                    profileImage: 1,
                    location: 1,
                    treksCount: 1,
                    totalDistance: 1,
                    tier: {
                        $switch: {
                            branches: [
                                { case: { $gte: ["$treksCount", 30] }, then: "Trail Master" },
                                { case: { $gte: ["$treksCount", 15] }, then: "Pathfinder" },
                                { case: { $gte: ["$treksCount", 5] }, then: "Explorer" },
                                { case: { $gte: ["$treksCount", 1] }, then: "Wanderer" }
                            ],
                            default: "Newbie"
                        }
                    }
                }
            }
        ]);

        res.json(leaderboard);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        res.status(500).json({ message: "Error fetching leaderboard" });
    }
});

// Update user profile
router.put("/profile", protectRoute, async (req, res) => {
    try {
        const { bio, profileImage, username, emergencyContacts, medicalInfo, location } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (username) user.username = username;
        if (bio !== undefined) user.bio = bio;
        if (emergencyContacts !== undefined) user.emergencyContacts = emergencyContacts;
        if (medicalInfo !== undefined) user.medicalInfo = medicalInfo;
        if (location !== undefined) user.location = location;

        if (profileImage) {
            if (profileImage.startsWith("data:image")) {
                // Upload to cloudinary
                const uploadRes = await cloudinary.uploader.upload(profileImage, {
                    folder: "hikernet_profiles",
                });
                user.profileImage = uploadRes.secure_url;
            } else {
                user.profileImage = profileImage;
            }
        }

        await user.save();
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: "Profile updated successfully",
            user: userResponse
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Error updating profile" });
    }
});

// Get user posts
router.get("/posts/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error(`[Backend] Rejecting invalid posts ID: "${req.params.id}"`);
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        const posts = await Post.find({ user: req.params.id }).sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        console.error("Error fetching user posts:", error);
        res.status(500).json({ message: "Error fetching user posts" });
    }
});

// Get followers
router.get("/followers/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error(`[Backend] Rejecting invalid followers ID: "${req.params.id}"`);
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        const user = await User.findById(req.params.id).populate("followers", "username profileImage bio");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user.followers);
    } catch (error) {
        console.error("Error fetching followers:", error);
        res.status(500).json({ message: "Error fetching followers" });
    }
});

// Get following
router.get("/following/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error(`[Backend] Rejecting invalid following ID: "${req.params.id}"`);
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        const user = await User.findById(req.params.id).populate("following", "username profileImage bio");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user.following);
    } catch (error) {
        console.error("Error fetching following:", error);
        res.status(500).json({ message: "Error fetching following" });
    }
});

export default router;
