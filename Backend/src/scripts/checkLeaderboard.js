
import mongoose from "mongoose";
import "dotenv/config";
import Trek from "../models/Trek.js";
import User from "../models/User.js";
import { connectDB } from "../lib/db.js";

const checkLeaderboard = async () => {
    try {
        await connectDB();

        // Simulate leaderboard Aggregation
        const leaderboard = await User.aggregate([
            {
                $match: { email: { $ne: "system@hikernet.com" } }
            },
            {
                $lookup: {
                    from: "treks",
                    localField: "_id",
                    foreignField: "user",
                    as: "userTreks"
                }
            },
            {
                $addFields: {
                    completedTreks: {
                        $filter: {
                            input: "$userTreks",
                            as: "trek",
                            cond: { $eq: ["$$trek.status", "completed"] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    treksCount: { $size: "$completedTreks" }
                }
            },
            { $sort: { treksCount: -1 } },
            { $limit: 10 }
        ]);

        console.log("Top Leaderboard Users:");
        leaderboard.forEach((u, i) => console.log(`${i + 1}. ${u.username} (${u.treksCount} treks)`));

        const systemUser = await User.findOne({ email: "system@hikernet.com" });
        if (systemUser) {
            console.log("System User ID:", systemUser._id);
            const sysTreks = await Trek.countDocuments({ user: systemUser._id });
            console.log("System User Trek Count (after cleanup):", sysTreks);
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkLeaderboard();
