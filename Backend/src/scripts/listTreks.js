
import mongoose from "mongoose";
import "dotenv/config";
import Trek from "../models/Trek.js";
import { connectDB } from "../lib/db.js";

const listTreks = async () => {
    try {
        await connectDB();

        console.log("--- Sample of Imported Treks ---");
        const treks = await Trek.find({ location: { $regex: /Kerala|Wayanad/i } })
            .select("name description")
            .limit(50);

        treks.forEach(t => console.log(`- ${t.name}`));

        console.log("\n--- Checking for potentially 'junk' names ---");
        const junk = await Trek.find({
            $or: [
                { name: { $regex: /road|residential|private|path to|way to|lane/i } },
            ],
            location: { $regex: /Kerala|Wayanad/i }
        }).countDocuments();

        console.log(`Found ${junk} treks with names like 'Road', 'Path to', 'Lane', etc.`);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listTreks();
