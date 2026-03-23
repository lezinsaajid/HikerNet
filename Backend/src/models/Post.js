import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["text", "image", "video"],
            default: "text",
        },
        content: {
            type: String, // Unified text field (tweet-style)
            trim: true,
        },
        mediaUrl: {
            type: String, // Unified media field (Cloudinary URL)
        },
        caption: {
            type: String,
            trim: true,
        },
        image: {
            type: String, // Cloudinary URL (legacy)
        },
        video: {
            type: String, // Cloudinary URL for video (legacy)
        },
        trek: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trek", // Optional interactive trek card
        },
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        comments: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                text: {
                    type: String,
                    required: true,
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        taggedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
    },
    { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

export default Post;
