
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const checkSelfFollow = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const users = await User.find({});
        let count = 0;

        users.forEach(user => {
            const selfFollow = user.following.some(id => id.toString() === user._id.toString());
            if (selfFollow) {
                console.log(`User ${user.username} (${user._id}) follows themselves.`);
                count++;
            }
        });

        console.log(`\nTotal users following themselves: ${count}`);
        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

checkSelfFollow();
