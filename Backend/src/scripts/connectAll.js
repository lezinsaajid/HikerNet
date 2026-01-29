
import mongoose from "mongoose";
import "dotenv/config";
import User from "../models/User.js";
import { connectDB } from "../lib/db.js";

const INFLUENCERS = ["jessica_hikes", "alex_adventures", "sarah_summit", "mike_on_trail"];

const connectAll = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        // Find influencers
        const influencers = await User.find({ username: { $in: INFLUENCERS } });
        const influencerIds = influencers.map(u => u._id);

        if (influencerIds.length === 0) {
            console.log("No influencers found. Did you run seedSocial?");
            process.exit(0);
        }

        // Add influencers to EVERY user's following list
        const res = await User.updateMany(
            {},
            { $addToSet: { following: { $each: influencerIds } } }
        );

        console.log(`Updated users. Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);
        console.log("Everyone is now following the influencers!");
        process.exit(0);

    } catch (error) {
        console.error("Error connecting users:", error);
        process.exit(1);
    }
};

connectAll();
