import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

async function checkDP() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({ $or: [{ profileImage: "" }, { profileImage: null }, { profileImage: "https://via.placeholder.com/150" }] });
        console.log(`Found ${users.length} users WITHOUT a proper DP.`);
        users.forEach(u => console.log(`- ${u.username}`));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDP();
