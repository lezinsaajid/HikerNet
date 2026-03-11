import express from "express";
import cors from "cors";
import "dotenv/config";
import job from "./lib/cron.js";

import authRoutes from "./routes/authRoutes.js";
import trekRoutes from "./routes/trekRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import storyRoutes from "./routes/storyRoutes.js";
import safetyRoutes from "./routes/safetyRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import adventureRoutes from "./routes/adventureRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import chatRoutes from "./routes/chat.js";

import { connectDB } from "./lib/db.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();
const PORT = process.env.PORT || 3000;

console.log("Hikernet Backend Starting...");

job.start();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/treks", trekRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/adventures", adventureRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/chat", chatRoutes);

// Error Handling Middleware (must be last)
app.use(errorMiddleware);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});