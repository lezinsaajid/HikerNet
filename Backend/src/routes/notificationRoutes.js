import express from "express";
import NotificationService from "../services/notificationService.js";
import protectRoute from "../middleware/auth.middleware.js";
import mongoose from "mongoose";

const router = express.Router();

// Get User Notifications
router.get("/", protectRoute, async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;
        const notifications = await NotificationService.getUserNotifications(
            req.user._id,
            parseInt(limit),
            parseInt(skip)
        );
        res.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Error fetching notifications" });
    }
});

// Mark as Read
router.patch("/:id/read", protectRoute, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid notification ID format" });
        }
        const notification = await NotificationService.markAsRead(id, req.user._id);
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.json({ message: "Notification marked as read" });
    } catch (error) {
        console.error("Error updating notification:", error);
        res.status(500).json({ message: "Error updating notification" });
    }
});

// Mark All as Read
router.patch("/read-all", protectRoute, async (req, res) => {
    try {
        await NotificationService.markAllAsRead(req.user._id);
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error updating notifications:", error);
        res.status(500).json({ message: "Error updating notifications" });
    }
});

export default router;
