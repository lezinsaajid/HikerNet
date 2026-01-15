import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const migrate = async () => {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected.");

        const users = await User.find();
        console.log(`Processing ${users.length} users...`);

        for (const user of users) {
            const currentFriends = Array.from(new Set([
                ...(user.following || []).map(id => id.toString()),
                ...(user.followers || []).map(id => id.toString())
            ]));

            if (currentFriends.length === 0) continue;

            console.log(`Syncing ${currentFriends.length} friends for ${user.username}...`);

            for (const friendId of currentFriends) {
                // Ensure mutual connection
                await User.findByIdAndUpdate(user._id, {
                    $addToSet: { following: friendId, followers: friendId }
                });
                await User.findByIdAndUpdate(friendId, {
                    $addToSet: { following: user._id, followers: user._id }
                });
            }
        }

        console.log("Migration complete!");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrate();
