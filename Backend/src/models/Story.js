import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        media: {
            type: String, // URL for image or video
            required: true,
        },
        type: {
            type: String,
            enum: ["image", "video"],
            default: "image",
        },
        trek: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trek", // Optional shared trek
        },
        viewers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        createdAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            default: () => Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
        },
    }
);

// TTL Index removed: Stories will no longer be automatically deleted
// storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Story = mongoose.model("Story", storySchema);

export default Story;
