import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
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

import { createServer } from "http";
import { Server } from "socket.io";
import { initSocket } from "./services/socketService.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

console.log("Hikernet Backend Starting...");

// Initialize Socket Service
initSocket(io);

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

// Coverage endpoint for manual testing
if (process.env.COLLECT_COVERAGE === 'true') {
    app.get("/api/coverage", (req, res) => {
        res.json({ message: "Coverage is now handled automatically by c8. Please stop the server (Ctrl+C) to save the report to coverage/manual/." });
    });
}


// Error Handling Middleware (must be last)
app.use(errorMiddleware);

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});