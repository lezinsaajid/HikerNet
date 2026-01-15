import mongoose from "mongoose";
import "dotenv/config";

const connectDB = async () => {
    try {
        console.log("Attempting to connect to MongoDB...");
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`Database connected: ${conn.connection.host}`);
        process.exit(0);
    } catch (error) {
        console.error("Error connecting to database:", error);
        process.exit(1);
    }
};

connectDB();
