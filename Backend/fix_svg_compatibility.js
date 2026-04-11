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

async function convertSVGtoPNG() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Find users with SVG profile pictures (Dicebear default)
        const users = await User.find({ 
            profileImage: { $regex: /\.svg/i } 
        });

        console.log(`Found ${users.length} users with incompatible SVG profile pictures.`);

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const newDP = PORTRAITS[i % PORTRAITS.length];
            console.log(`Updating ${user.username} to Compatible JPG...`);
            await User.updateOne({ _id: user._id }, { profileImage: newDP });
        }

        console.log("SVG compatibility fix complete.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

convertSVGtoPNG();
