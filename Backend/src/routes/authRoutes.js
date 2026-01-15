import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15d" });
};

router.post("/register", async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password should be at least 8 characters long" });
        }

        if (username.length < 3) {
            return res.status(400).json({ message: "Username should be at least 3 characters long" });
        }

        // check if user already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ message: "Username already exists" });
        }

        // get random avatar
        const profileImage = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

        const user = new User({
            email,
            username,
            password,
            profileImage,
        });

        await user.save();

        const token = generateToken(user._id);

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.log("Error in register route", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) return res.status(400).json({ message: "All fields are required" });

        // check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // check if password is correct
        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" });

        const token = generateToken(user._id);

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.log("Error in login route", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) return res.status(400).json({ message: "Token is required" });

        // Verify token (If we had a real Client ID. For now we will allow skip if not configured, or fail)
        // In production:
        // const ticket = await client.verifyIdToken({
        //     idToken: token,
        //     audience: process.env.GOOGLE_CLIENT_ID
        // });
        // const { name, email, picture } = ticket.getPayload();

        // For development/mock without valid FE token: 
        // We will assume the token IS the email for testing or simulate decode if it looks like JWT.
        // BUT to be safe and follow plan, I will write the REAL code, but commented out check if Env is missing?
        // No, let's write the REAL code. User can set GOOGLE_CLIENT_ID later.

        // However, since I cannot get a real Google Token easily without a frontend, verification might fail.
        // I will implement standard verification.

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { name, email, picture } = ticket.getPayload();

        let user = await User.findOne({ email });

        if (!user) {
            // Create new user
            // Generate a random password since they use Google
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

            user = new User({
                username: name.split(" ").join("").toLowerCase() + Math.floor(Math.random() * 1000), // simplistic username gen
                email,
                password: randomPassword,
                profileImage: picture,
            });
            await user.save();
        }

        const jwtToken = generateToken(user._id);

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            token: jwtToken,
            user: userResponse
        });

    } catch (error) {
        console.log("Error in google login:", error);
        res.status(400).json({ message: "Invalid Google Token" });
    }
});

export default router;