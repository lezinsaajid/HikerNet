import express from "express";
import Post from "../models/Post.js";
import User from "../models/User.js";
import protectRoute from "../middleware/auth.middleware.js";
import cloudinary from "../lib/cloudinary.js";
import mongoose from "mongoose";

const router = express.Router();

// Create a new post
router.post("/create", protectRoute, async (req, res) => {
    try {
        let { caption, image, video, trekId, taggedUsernames } = req.body;

        if (!image && !video && !caption && !trekId) {
            return res.status(400).json({ message: "Post must contain at least text, image, video, or a trek" });
        }

        // Upload image to Cloudinary
        if (image && image.startsWith("data:image")) {
            const uploadRes = await cloudinary.uploader.upload(image, {
                folder: "hikernet_posts",
            });
            image = uploadRes.secure_url;
        }

        // Upload video to Cloudinary
        if (video && video.startsWith("data:video")) {
            const uploadRes = await cloudinary.uploader.upload(video, {
                folder: "hikernet_posts",
                resource_type: "video",
            });
            video = uploadRes.secure_url;
        }

        // Auto-detect post type
        let type = "text";
        if (image) type = "image";
        if (video) type = "video";

        // Resolve tagged usernames to user IDs (only allow friends, no duplicates)
        let taggedUserIds = [];
        if (Array.isArray(taggedUsernames) && taggedUsernames.length > 0) {
            const currentUser = await User.findById(req.user._id).select("following");
            const friendIdSet = new Set(currentUser.following.map(id => id.toString()));

            const taggedUsers = await User.find({ username: { $in: taggedUsernames } }).select("_id username");
            const seen = new Set();
            taggedUserIds = taggedUsers
                .filter(u => {
                    const id = u._id.toString();
                    // Only friends and no duplicates
                    if (friendIdSet.has(id) && !seen.has(id)) {
                        seen.add(id);
                        return true;
                    }
                    return false;
                })
                .map(u => u._id);
        }

        const newPost = new Post({
            user: req.user._id,
            type,
            content: caption, // New standard
            mediaUrl: video || image, // New standard
            caption, // Legacy
            image, // Legacy
            video, // Legacy
            trek: trekId,
            taggedUsers: taggedUserIds,
        });

        await newPost.save();

        const populated = await Post.findById(newPost._id)
            .populate("user", "username profileImage")
            .populate("taggedUsers", "username profileImage");

        res.status(201).json(populated);
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Error creating post" });
    }
});

// Get feed (Global, friends-first)
router.get("/feed", protectRoute, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        const followingIds = currentUser.following.map(id => id.toString());
        followingIds.push(req.user._id.toString());

        let posts = await Post.find({})
            .populate("user", "username profileImage followers")
            .populate("trek", "name stats")
            .populate("taggedUsers", "username profileImage")
            .lean();

        // Enforce unified fields for frontend (Backward compatibility)
        posts = posts.map(p => ({
            ...p,
            content: p.content || p.caption || "",
            mediaUrl: p.mediaUrl || p.video || p.image || null,
        }));

        posts.sort((a, b) => {
            const aIsFriend = followingIds.includes(a.user._id.toString());
            const bIsFriend = followingIds.includes(b.user._id.toString());
            if (aIsFriend && !bIsFriend) return -1;
            if (!aIsFriend && bIsFriend) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json(posts);
    } catch (error) {
        console.error("Error fetching feed:", error);
        res.status(500).json({ message: "Error fetching feed" });
    }
});

// Get posts where a user is tagged (must be before /:id to avoid collision)
router.get("/tagged/:userId", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        let posts = await Post.find({ taggedUsers: req.params.userId })
            .populate("user", "username profileImage")
            .populate("taggedUsers", "username profileImage")
            .populate("comments.user", "username profileImage")
            .sort({ createdAt: -1 })
            .lean();

        // Enforce unified fields for frontend (Backward compatibility)
        posts = posts.map(p => ({
            ...p,
            content: p.content || p.caption || "",
            mediaUrl: p.mediaUrl || p.video || p.image || null,
        }));

        res.json(posts);
    } catch (error) {
        console.error("Error fetching tagged posts:", error);
        res.status(500).json({ message: "Error fetching tagged posts" });
    }
});

// Get single post
router.get("/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid post ID format" });
        }
        const post = await Post.findById(req.params.id)
            .populate("user", "username profileImage")
            .populate("trek", "name stats")
            .populate("taggedUsers", "username profileImage")
            .populate("comments.user", "username profileImage")
            .lean();

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Enforce unified fields for frontend (Backward compatibility)
        const enrichedPost = {
            ...post,
            content: post.content || post.caption || "",
            mediaUrl: post.mediaUrl || post.video || post.image || null,
        };

        res.json(enrichedPost);
    } catch (error) {
        console.error("Error fetching post:", error);
        res.status(500).json({ message: "Error fetching post" });
    }
});

// Delete a post
router.delete("/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid post ID format" });
        }
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "You can only delete your own posts" });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ message: "Error deleting post" });
    }
});

// Like / Unlike a post
router.put("/like/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid post ID format" });
        }
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const isLiked = post.likes.includes(req.user._id);

        if (isLiked) {
            await Post.findByIdAndUpdate(req.params.id, { $pull: { likes: req.user._id } });
            res.json({ message: "Post unliked" });
        } else {
            await Post.findByIdAndUpdate(req.params.id, { $push: { likes: req.user._id } });
            res.json({ message: "Post liked" });
        }
    } catch (error) {
        console.error("Error liking post:", error);
        res.status(500).json({ message: "Error liking post" });
    }
});

// Add a comment
router.post("/comment/:id", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid post ID format" });
        }
        const { text } = req.body;
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        if (!text) {
            return res.status(400).json({ message: "Comment text is required" });
        }

        post.comments.push({ user: req.user._id, text });
        await post.save();

        // Return the updated post with populated comments
        const updatedPost = await Post.findById(post._id)
            .populate("user", "username profileImage")
            .populate("comments.user", "username profileImage")
            .populate("taggedUsers", "username profileImage");

        res.json(updatedPost);
    } catch (error) {
        console.error("Error commenting on post:", error);
        res.status(500).json({ message: "Error commenting on post" });
    }
});

// Delete a comment
router.delete("/:postId/comment/:commentId", protectRoute, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.postId) || !mongoose.Types.ObjectId.isValid(req.params.commentId)) {
            return res.status(400).json({ message: "Invalid ID format" });
        }

        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const comment = post.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        const isCommentAuthor = comment.user.toString() === req.user._id.toString();
        const isPostOwner = post.user.toString() === req.user._id.toString();

        if (!isCommentAuthor && !isPostOwner) {
            return res.status(401).json({ message: "Unauthorized to delete this comment" });
        }

        post.comments.pull(req.params.commentId);
        await post.save();

        res.json({ message: "Comment deleted successfully", post });
    } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ message: "Error deleting comment" });
    }
});

export default router;
