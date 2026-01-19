import mongoose from "mongoose";

const pointSchema = new mongoose.Schema({
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    altitude: { type: Number },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const trekSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        location: {
            type: String, // Human readable location name
        },
        coordinates: [pointSchema], // Array of GPS points for the path
        waypoints: [
            {
                latitude: { type: Number, required: true },
                longitude: { type: Number, required: true },
                altitude: { type: Number },
                title: { type: String },
                description: { type: String },
                icon: { type: String, default: 'location' }, // marker icon name
                images: [{ type: String }], // Array of image URLs specific to this point
                timestamp: { type: Date, default: Date.now },
            }
        ],
        mode: {
            type: String,
            enum: ['solo', 'group'],
            default: 'solo'
        },
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        stats: {
            distance: { type: Number, default: 0 }, // in meters
            duration: { type: Number, default: 0 }, // in seconds
            elevationGain: { type: Number, default: 0 }, // in meters
            avgSpeed: { type: Number, default: 0 }, // km/h
        },
        images: [{
            type: String, // URLs
        }],
        status: {
            type: String,
            enum: ["ongoing", "completed", "paused"],
            default: "ongoing",
        },
        privacy: {
            type: String,
            enum: ["public", "private", "followers"],
            default: "public",
        },
        startTime: {
            type: Date,
            default: Date.now,
        },
        endTime: {
            type: Date,
        },
    },
    { timestamps: true }
);

const Trek = mongoose.model("Trek", trekSchema);

export default Trek;
