import { Expo } from "expo-server-sdk";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const expo = new Expo();

/**
 * Notification Service
 * Handles creating notifications and sending push notifications.
 */
class NotificationService {
    /**
     * Create and send a notification
     * @param {Object} params - Notification parameters
     * @param {String} params.userId - Recipient user ID
     * @param {String} params.senderId - Triggering user ID
     * @param {String} params.type - Notification type
     * @param {String} params.message - Human-readable message
     * @param {String} [params.postId] - Related post ID
     * @param {String} [params.trekId] - Related trek ID
     * @param {Object} [params.data] - Additional data for push notification
     */
    async createNotification({ userId, senderId, type, message, postId, trekId, data = {} }) {
        try {
            // 1. Prevent duplicate notifications for specific types
            // e.g., don't notify multiple times for the same like/tag/invite
            const existing = await Notification.findOne({
                userId,
                senderId,
                type,
                $or: [
                    { postId: postId || null },
                    { trekId: trekId || null }
                ],
                createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24h
            });

            if (existing && ["like", "tag", "trek_invite"].includes(type)) {
                return existing;
            }

            // 2. Save to database
            const notification = new Notification({
                userId,
                senderId,
                type,
                message,
                postId,
                trekId
            });
            await notification.save();

            // 3. Send Push Notification
            await this.sendPushNotification(userId, message, {
                type,
                postId,
                trekId,
                ...data
            });

            return notification;
        } catch (error) {
            console.error("Error in createNotification:", error);
            // Don't throw error to avoid breaking the main request flow
        }
    }

    /**
     * Send push notification using Expo
     */
    async sendPushNotification(userId, message, data) {
        try {
            const user = await User.findById(userId).select("expoPushToken");
            if (!user || !user.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) {
                return;
            }

            const messages = [{
                to: user.expoPushToken,
                sound: "default",
                title: "HikerNet",
                body: message,
                data: data || {},
                priority: data?.type === "trek_invite" || data?.type === "sos" ? "high" : "default"
            }];

            const chunks = expo.chunkPushNotifications(messages);
            for (let chunk of chunks) {
                try {
                    await expo.sendPushNotificationsAsync(chunk);
                } catch (error) {
                    console.error("Error sending push notification chunk:", error);
                }
            }
        } catch (error) {
            console.error("Error in sendPushNotification:", error);
        }
    }

    /**
     * Mark a notification as read
     */
    async markAsRead(notificationId, userId) {
        return await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true },
            { new: true }
        );
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        return await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, limit = 20, skip = 0) {
        return await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("senderId", "username profileImage")
            .populate("postId", "content mediaUrl")
            .populate("trekId", "name");
    }
}

export default new NotificationService();
