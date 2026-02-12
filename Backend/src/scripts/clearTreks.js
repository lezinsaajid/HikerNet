
import mongoose from "mongoose";
import "dotenv/config";
import Trek from "../models/Trek.js";
import { connectDB } from "../lib/db.js";

const clearTreks = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB for cleanup...");

        const count = await Trek.countDocuments();
        console.log(`Found ${count} treks. Deleting...`);

        const result = await Trek.deleteMany({});
        console.log(`Deleted ${result.deletedCount} treks successfully.`);

        process.exit(0);
    } catch (error) {
        console.error("Error clearing treks:", error);
        process.exit(1);
    }
};

clearTreks();
