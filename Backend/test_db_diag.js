import mongoose from 'mongoose';
import 'dotenv/config';

console.log('Testing DB connection to:', process.env.MONGO_URI);

try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('SUCCESS: Connected to', conn.connection.host);
    process.exit(0);
} catch (err) {
    console.error('FAILURE:', err.message);
    process.exit(1);
}
