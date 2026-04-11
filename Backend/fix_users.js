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

const NAME_MAP = {
    "geo_user": "Alex Rivera",
    "stat_test": "Sarah Chen",
    "test_user": "Marcus Stone",
    "admin": "Julian Thorne",
    "hiker1": "Emma Woods",
    "hiker2": "Leo Peak",
    "trek_dev": "Dr. Aris Vallas"
};

const RANDOM_NAMES = [
    "Sophia Miller", "James Wilson", "Olivia Moore", "Ethan Hunt", 
    "Isabella Garcia", "Liam Brown", "Mia Davis", "Noah Taylor"
];

async function fixUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({});
        
        console.log(`Found ${users.length} users. Starting fix...`);

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            let updated = false;

            // 1. Fix Username
            const originalUser = user.username;
            if (NAME_MAP[user.username]) {
                user.username = NAME_MAP[user.username];
                console.log(`Renamed: ${originalUser} -> ${user.username}`);
                updated = true;
            } else if (user.username.includes('_') || user.username.match(/\d/)) {
                 const newName = RANDOM_NAMES[i % RANDOM_NAMES.length] + " " + (i + 1);
                 console.log(`Auto-Renamed: ${user.username} -> ${newName}`);
                 user.username = newName;
                 updated = true;
            }

            // 2. Fix Profile Image
            if (!user.profileImage) {
                user.profileImage = PORTRAITS[i % PORTRAITS.length];
                console.log(`Set Avatar for: ${user.username}`);
                updated = true;
            }

            // 3. Fix Bio/Location for realism
            if (!user.bio) {
                user.bio = "Mountain enthusiast and weekend explorer. Always looking for the next peak.";
                updated = true;
            }
            if (!user.location) {
                user.location = ["Denver, CO", "Portland, OR", "Asheville, NC", "Innsbruck, AT"][i % 4];
                updated = true;
            }

            if (updated) {
                // Remove password modification to avoid double hashing if User model has post-save hooks
                // Actually, User.js has a pre-save hook for password. 
                // We shouldn't trigger password change.
                await User.updateOne({ _id: user._id }, { 
                    username: user.username,
                    profileImage: user.profileImage,
                    bio: user.bio,
                    location: user.location
                });
            }
        }

        console.log("Fix complete.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixUsers();
