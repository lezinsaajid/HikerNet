
import mongoose from "mongoose";
import "dotenv/config";
import Trek from "../models/Trek.js";
import { connectDB } from "../lib/db.js";

const checkTreks = async () => {
    try {
        await connectDB();
        const count = await Trek.countDocuments({ location: "Kerala, India" });
        console.log(`Total Treks imported for Kerala: ${count}`);

        // Sample one
        const sample = await Trek.findOne({ location: "Kerala, India" });
        if (sample) {
            console.log("Sample Trek:", sample.name);
            console.log("Coordinates count:", sample.coordinates.length);
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkTreks();
