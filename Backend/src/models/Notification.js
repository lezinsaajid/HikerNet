import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        type: {
            type: String,
            enum: [
                "like",
                "comment",
                "tag",
                "follow",
                "friend_request",
                "trek_invite",
                "trek_update",
                "trek_join",
                "trek_leave",
                "trek_reminder",
                "sos",
                "system",
                "message",
            ],
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
        },
        trekId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trek",
        },
        relatedId: {
            type: mongoose.Schema.Types.ObjectId, // Generic fallback
        },
    },
    { timestamps: true }
);

// Indexes for performance and duplicate checks
notificationSchema.index({ userId: 1 });
notificationSchema.index({ senderId: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ userId: 1, senderId: 1, type: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
