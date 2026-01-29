
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import "dotenv/config";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Trek from "../models/Trek.js";
import { connectDB } from "../lib/db.js";

const USERS_DATA = [
    {
        username: "jessica_hikes",
        email: "jessica@example.com",
        password: "password123",
        profileImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=150&q=80",
        bio: "Mountains are calling! 🏔️"
    },
    {
        username: "alex_adventures",
        email: "alex@example.com",
        password: "password123",
        profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=150&q=80",
        bio: "Chasing sunsets and trails. 🌅"
    },
    {
        username: "sarah_summit",
        email: "sarah@example.com",
        password: "password123",
        profileImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=150&q=80",
        bio: "Conquering one peak at a time."
    },
    {
        username: "mike_on_trail",
        email: "mike@example.com",
        password: "password123",
        profileImage: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-1.2.1&auto=format&fit=crop&w=150&q=80",
        bio: "Nature lover. 🌲"
    }
];

const POSTS_DATA = [
    {
        username: "jessica_hikes",
        caption: "Absolutely breathtaking views from Chembra Peak today! The climb was tough but totally worth it. 💚 #Wayanad #Trekking",
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        trekKeyword: "Chembra"
    },
    {
        username: "alex_adventures",
        caption: "Found this hidden gem near Banasura. So peaceful. 🌊",
        image: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        trekKeyword: "Banasura"
    },
    {
        username: "sarah_summit",
        caption: "Nothing beats a sunrise trek. ☀️ Who's joining me next weekend?",
        image: "https://images.unsplash.com/photo-1501555088652-021faa106b9b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1353&q=80",
    },
    {
        username: "mike_on_trail",
        caption: "Gear check! Ready for the weekend expedition. 🎒",
        image: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
    },
    {
        username: "jessica_hikes",
        caption: "Greenery everywhere! \n\nKerala truly is God's own country.",
        image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        trekKeyword: "Muneeshwaram"
    }
];

const seedSocial = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        const createdUsers = [];

        // 1. Create Users
        for (const u of USERS_DATA) {
            let user = await User.findOne({ email: u.email });
            if (!user) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(u.password, salt);
                user = await User.create({
                    ...u,
                    password: hashedPassword
                });
                console.log(`Created user: ${u.username}`);
            } else {
                console.log(`User exists: ${u.username}`);
            }
            createdUsers.push(user);
        }

        // 2. Make them follow each other (Friendship)
        // Make everyone follow everyone else for a lively feed
        for (const user of createdUsers) {
            for (const other of createdUsers) {
                if (user._id.toString() !== other._id.toString()) {
                    await User.findByIdAndUpdate(user._id, { $addToSet: { following: other._id } });
                    await User.findByIdAndUpdate(other._id, { $addToSet: { followers: user._id } }); // Mutual follow
                }
            }
        }
        console.log("Friendships established.");

        // 3. Create Posts
        for (const p of POSTS_DATA) {
            const author = createdUsers.find(u => u.username === p.username);
            if (!author) continue;

            let trekId = null;
            if (p.trekKeyword) {
                const trek = await Trek.findOne({ name: { $regex: p.trekKeyword, $options: 'i' } });
                if (trek) trekId = trek._id;
            }

            const newPost = await Post.create({
                user: author._id,
                caption: p.caption,
                image: p.image,
                trek: trekId,
                likes: [],
                comments: []
            });
            console.log(`Created post by ${author.username}`);

            // Random Likes
            const numLikes = Math.floor(Math.random() * createdUsers.length);
            for (let i = 0; i < numLikes; i++) {
                const liker = createdUsers[i];
                if (liker._id.toString() !== author._id.toString()) {
                    newPost.likes.push(liker._id);
                }
            }
            // Random Comment
            if (Math.random() > 0.5) {
                const commenter = createdUsers.find(u => u._id.toString() !== author._id.toString());
                if (commenter) {
                    newPost.comments.push({
                        user: commenter._id,
                        text: "Awesome! 🔥"
                    });
                }
            }

            await newPost.save();
        }

        console.log("Social seeding complete!");
        process.exit(0);

    } catch (error) {
        console.error("Error seeding social data:", error);
        process.exit(1);
    }
};

seedSocial();
