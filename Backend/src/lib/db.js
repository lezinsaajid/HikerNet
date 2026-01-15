import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`Database connected ${conn.connection.host}`);
    } catch (error) {
        console.error("Error connecting to database. Retrying is handled by Mongoose auto-reconnect or manual restart is needed.", error);
        // process.exit(1); // Do not exit, keep server alive to avoid reboot loops
    }
};