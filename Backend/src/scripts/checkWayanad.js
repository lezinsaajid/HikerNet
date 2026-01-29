
import mongoose from "mongoose";
import "dotenv/config";
import Trek from "../models/Trek.js";
import { connectDB } from "../lib/db.js";

const checkWayanad = async () => {
    try {
        await connectDB();
        // Regex for Wayanad case insensitive
        const count = await Trek.countDocuments({
            $or: [
                { location: { $regex: /Wayanad/i } },
                { name: { $regex: /Wayanad/i } },
                { description: { $regex: /Wayanad/i } }
            ]
        });
        console.log(`Total Treks related to Wayanad: ${count}`);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkWayanad();
