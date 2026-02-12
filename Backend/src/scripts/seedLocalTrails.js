
import mongoose from "mongoose";
import "dotenv/config";
import Trek from "../models/Trek.js";
import User from "../models/User.js";
import { connectDB } from "../lib/db.js";

const seedLocalTrails = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB...");

        // 1. Get or Create System User
        let systemUser = await User.findOne({ email: "system@hikernet.com" });
        if (!systemUser) {
            systemUser = await User.create({
                username: "hikernet_system",
                email: "system@hikernet.com",
                password: "hashedpassword123",
                fullName: "System Admin"
            });
        }

        // 2. Get first regular user (to populate their profile history)
        const regularUser = await User.findOne({ email: { $ne: "system@hikernet.com" } });

        const sampleTrails = [
            {
                user: systemUser._id,
                name: "Chembra Peak Trail",
                description: "The highest peak in Wayanad, with a heart-shaped lake.",
                location: "Wayanad, Kerala",
                path: {
                    type: "LineString",
                    coordinates: [[76.0867, 11.5125], [76.0880, 11.5140], [76.0895, 11.5160]]
                },
                stats: { distance: 4500, duration: 7200, elevationGain: 400, avgSpeed: 2.2 },
                status: "completed",
                privacy: "public"
            },
            {
                user: systemUser._id,
                name: "Banasura Hill Trek",
                description: "A challenging trek offering panoramic views of the reservoir.",
                location: "Wayanad, Kerala",
                path: {
                    type: "LineString",
                    coordinates: [[75.9250, 11.6350], [75.9270, 11.6380], [75.9300, 11.6420]]
                },
                stats: { distance: 8200, duration: 18000, elevationGain: 850, avgSpeed: 1.6 },
                status: "completed",
                privacy: "public"
            }
        ];

        if (regularUser) {
            sampleTrails.push({
                user: regularUser._id,
                name: "Morning Walk in Munnar",
                description: "A beautiful walk through tea plantations.",
                location: "Munnar, Kerala",
                path: {
                    type: "LineString",
                    coordinates: [[77.0600, 10.0889], [77.0620, 10.0900], [77.0650, 10.0920]]
                },
                stats: { distance: 2500, duration: 3600, elevationGain: 120, avgSpeed: 2.5 },
                status: "completed",
                privacy: "public"
            });
        }

        for (const trail of sampleTrails) {
            await Trek.create(trail);
            console.log(`Seeded: ${trail.name}`);
        }

        console.log("Local seeding complete!");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding local trails:", error);
        process.exit(1);
    }
};

seedLocalTrails();
