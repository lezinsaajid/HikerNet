
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const cleanupSelfFollow = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const users = await User.find({});
        let cleanedCount = 0;

        for (const user of users) {
            const originalLength = user.following.length;
            // Filter out own ID (ensure string comparison)
            const newFollowing = user.following.filter(id => id && id.toString() !== user._id.toString());

            if (newFollowing.length !== originalLength) {
                user.following = newFollowing;
                await user.save();
                console.log(`Cleaned user ${user.username} (${user._id})`);
                cleanedCount++;
            }
        }

        console.log(`\nCleaned ${cleanedCount} users.`);
        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

cleanupSelfFollow();
