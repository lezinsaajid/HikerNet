import express from "express";
import Post from "../models/Post.js";
import User from "../models/User.js";
import protectRoute from "../middleware/auth.middleware.js";
import cloudinary from "../lib/cloudinary.js";

const router = express.Router();

// Create a new post
router.post("/create", protectRoute, async (req, res) => {
    try {
        let { caption, image, trekId } = req.body;

        if (!image && !caption && !trekId) {
            return res.status(400).json({ message: "Post must contain at least text, image, or a trek" });
        }

        if (image && image.startsWith("data:image")) {
            const uploadRes = await cloudinary.uploader.upload(image, {
                folder: "hikernet_posts",
            });
            image = uploadRes.secure_url;
        }

        const newPost = new Post({
            user: req.user._id,
            caption,
            image,
            trek: trekId,
        });

        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Error creating post" });
    }
});

// Delete a post
router.delete("/:id", protectRoute, async (req, res) => {
    try {
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

// Get feed (posts from followed users + own posts)
router.get("/feed", protectRoute, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        const following = currentUser.following;

        const posts = await Post.find({ user: { $in: [...following, req.user._id] } })
            .sort({ createdAt: -1 })
            .populate("user", "username profileImage")
            .populate("trek", "name stats");

        res.json(posts);
    } catch (error) {
        console.error("Error fetching feed:", error);
        res.status(500).json({ message: "Error fetching feed" });
    }
});

// Like / Unlike a post
router.put("/like/:id", protectRoute, async (req, res) => {
    try {
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
        const { text } = req.body;
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        if (!text) {
            return res.status(400).json({ message: "Comment text is required" });
        }

        const comment = {
            user: req.user._id,
            text,
        };

        post.comments.push(comment);
        await post.save();

        res.json(post);
    } catch (error) {
        console.error("Error commenting on post:", error);
        res.status(500).json({ message: "Error commenting on post" });
    }
});

export default router;
