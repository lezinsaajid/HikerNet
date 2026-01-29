
import mongoose from "mongoose";
import "dotenv/config";
import Trek from "../models/Trek.js";
import User from "../models/User.js";
import { connectDB } from "../lib/db.js";

const cleanup = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        const systemUser = await User.findOne({ email: "system@hikernet.com" });
        if (!systemUser) {
            console.log("System user not found, nothing to clean.");
            process.exit(0);
        }

        // Patterns to identify junk
        const junkPatterns = [
            /road/i,
            /lane/i,
            /path to/i,
            /way to/i,
            /residential/i,
            /private/i,
            /footpath/i, // Generic footpath with no specific name
            /access/i,
            /driveway/i,
            /street/i,
            /avenue/i,
            /close/i,
            /bridge/i, // Often just a bridge segment
            /unnamed/i
        ];

        // Fetch all treks by system user
        const treks = await Trek.find({ user: systemUser._id });
        console.log(`Found ${treks.length} treks owned by System Admin.`);

        let deletedCount = 0;
        for (const trek of treks) {
            let isJunk = false;

            // Check name against patterns
            if (junkPatterns.some(p => p.test(trek.name))) {
                isJunk = true;
            }

            // Check if name is extremely short (likely bad data)
            if (trek.name.length < 3) isJunk = true;

            // Check if coordinates are suspiciously few for a completed trek?
            // Actually seeded treks usually have valid coords, but check length
            if (trek.coordinates.length < 5) isJunk = true;

            // Keep "Nature Reserve Trail" or "Scenic Spot Trail" generated names
            if (trek.name.includes("Nature Reserve") || trek.name.includes("Scenic Spot")) {
                isJunk = false;
            }

            if (isJunk) {
                console.log(`Deleting junk: ${trek.name}`);
                await Trek.findByIdAndDelete(trek._id);
                deletedCount++;
            }
        }

        console.log(`Cleanup complete. Deleted ${deletedCount} junk trails.`);
        process.exit(0);

    } catch (error) {
        console.error("Error cleaning up:", error);
        process.exit(1);
    }
};

cleanup();
