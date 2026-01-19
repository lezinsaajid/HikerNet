import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        leader: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        members: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                joinedAt: {
                    type: Date,
                    default: Date.now,
                },
                isReady: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        requests: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        startLocation: {
            type: String,
            default: "",
        },
        trekName: {
            type: String,
            required: true,
        },
        trekDescription: {
            type: String,
            default: "",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // If trek has started, link to it
        trekId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trek",
        },
    },
    { timestamps: true }
);

const Room = mongoose.model("Room", roomSchema);

export default Room;
