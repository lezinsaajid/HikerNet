import express from "express";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import protectRoute from "../middleware/auth.middleware.js";
import cloudinary from "../lib/cloudinary.js";

const router = express.Router();

// Helper middleware for auth (assuming req.user is set by existing auth middleware)
// If not, we'll need to update this to use the actual auth middleware you have.
// For now, I'll assume `req.headers.authorization` or similar is used, 
// but since I don't see the middleware imported yet, I'll rely on the caller to ensure it's protected or add it.
// Looking at previous patterns, I should probably check how auth is handled. 
// Assuming a middleware sets `req.user`.

// SEARCH USERS
router.get("/search", protectRoute, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ message: "Search query is required" });

        // Find users by username or email, excluding the current user
        const users = await User.find({
            username: { $regex: query, $options: "i" },
            _id: { $ne: req.user._id }
        }).limit(10).select("_id username profileImage email");

        res.json(users);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET OR CREATE CHAT (1-on-1)
router.post("/", protectRoute, async (req, res) => {
    const { partnerId } = req.body;
    const currentUserId = req.user._id;

    if (!currentUserId || !partnerId) {
        return res.status(400).json({ message: "Missing participants" });
    }

    try {
        let chat = await Chat.findOne({
            participants: { $all: [currentUserId, partnerId] },
        }).populate("participants", "username profileImage email");

        if (!chat) {
            chat = await Chat.create({
                participants: [currentUserId, partnerId],
            });
            chat = await chat.populate("participants", "username profileImage email");
        }

        res.json(chat);
    } catch (error) {
        console.error("Create chat error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET ALL CHATS FOR USER
router.get("/user/:userId", protectRoute, async (req, res) => {
    try {
        const userId = req.user._id;
        const chats = await Chat.find({
            participants: { $in: [userId] },
        })
            .populate("participants", "username profileImage email")
            .populate("lastMessage")
            .sort({ updatedAt: -1 });

        res.json(chats);
    } catch (error) {
        console.error("Get chats error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET SINGLE CHAT BY ID
router.get("/:chatId", protectRoute, async (req, res) => {
    try {
        const { chatId } = req.params;
        const chat = await Chat.findById(chatId).populate("participants", "username profileImage email lastSeen");
        if (!chat) return res.status(404).json({ message: "Chat not found" });
        res.json(chat);
    } catch (error) {
        console.error("Get chat error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET MESSAGES
router.get("/:chatId/messages", protectRoute, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        // Mark all messages from other person as read when I fetch them
        await Message.updateMany(
            { chatId, sender: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );

        const messages = await Message.find({ chatId })
            .populate("sender", "username profileImage")
            .sort({ createdAt: 1 }); // Oldest first for chat history

        res.json(messages);
    } catch (error) {
        console.error("Get messages error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// SEND MESSAGE
router.post("/:chatId/messages", protectRoute, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { content, messageType = "text", media } = req.body; // media is base64 for images or url for stickers
        const senderId = req.user._id;

        let mediaUrl = null;

        if (messageType === "image" && media) {
            // Upload base64 to cloudinary
            const uploadRes = await cloudinary.uploader.upload(media, {
                folder: "hikernet_chats",
            });
            mediaUrl = uploadRes.secure_url;
        } else if (messageType === "sticker" && media) {
            mediaUrl = media;
        }

        const message = await Message.create({
            chatId,
            sender: senderId,
            content: messageType === "text" ? content : "",
            messageType,
            mediaUrl,
            readBy: [senderId],
        });

        // Update last message in chat
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: message._id,
            updatedAt: new Date(),
        });

        const populatedMessage = await message.populate("sender", "username profileImage");
        res.json(populatedMessage);
    } catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE MESSAGE
router.delete("/:chatId/messages/:messageId", protectRoute, async (req, res) => {
    try {
        const { messageId } = req.params;
        const senderId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.sender.toString() !== senderId.toString()) {
            return res.status(401).json({ message: "You can only delete your own messages" });
        }

        await Message.findByIdAndDelete(messageId);
        res.json({ message: "Message deleted" });
    } catch (error) {
        console.error("Delete message error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
