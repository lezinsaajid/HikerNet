import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const PORTRAITS = [
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80"
];

async function forceAddDP() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        // Find users with empty DP or placeholder DP
        const users = await User.find({ 
            $or: [
                { profileImage: "" }, 
                { profileImage: null }, 
                { profileImage: /placeholder/ },
                { profileImage: "https://via.placeholder.com/150" }
            ] 
        });

        console.log(`Found ${users.length} users requiring a profile picture update.`);

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const dp = PORTRAITS[Math.floor(Math.random() * PORTRAITS.length)];
            console.log(`Assigning DP to ${user.username}...`);
            await User.updateOne({ _id: user._id }, { profileImage: dp });
        }

        console.log("Database update complete.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

forceAddDP();
