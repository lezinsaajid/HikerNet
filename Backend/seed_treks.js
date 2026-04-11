
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure dotenv
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

// Define Schemas 
const trekSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: String,
    location: String,
    path: {
        type: { type: String, enum: ['LineString', 'MultiLineString'], default: 'MultiLineString' },
        coordinates: mongoose.Schema.Types.Mixed
    },
    waypoints: [],
    stats: {
        distance: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        elevationGain: { type: Number, default: 0 },
        avgSpeed: { type: Number, default: 0 },
    },
    status: { type: String, default: 'completed' },
    privacy: { type: String, default: 'public' },
    startTime: { type: Date, default: Date.now },
    endTime: Date
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    username: String,
    email: String
});

const Trek = mongoose.model('Trek', trekSchema);
const User = mongoose.model('User', userSchema);

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ 
            $or: [
                { username: 'lezinsajid' },
                { username: 'Lezin Sajid' },
                { _id: '6965fb6ca52c1f788b3c083c' }
            ]
        });
        if (!user) {
            console.error('User lezinsajid not found! Please ensure you have an account with this username.');
            process.exit(1);
        }

        console.log(`Found user: ${user.username} (ID: ${user._id})`);

        const generatePath = (start, end, pointsCount = 60) => {
            const path = [];
            for (let i = 0; i <= pointsCount; i++) {
                const ratio = i / pointsCount;
                const lat = start.lat + (end.lat - start.lat) * ratio + (Math.random() - 0.5) * 0.001;
                const lng = start.lng + (end.lng - start.lng) * ratio + (Math.random() - 0.5) * 0.001;
                path.push([lng, lat]); 
            }
            return [path]; 
        };

        const treks = [
            {
                user: user._id,
                name: "Chembra Peak Morning Hike",
                description: "Witnessed the famous heart-shaped lake at dawn. A bit slippery but worth it.",
                location: "Wayanad, Kerala",
                path: {
                    type: 'MultiLineString',
                    coordinates: generatePath({ lat: 11.5173, lng: 76.0850 }, { lat: 11.5038, lng: 76.0895 })
                },
                stats: {
                    distance: 3800,
                    duration: 6800,
                    elevationGain: 410,
                    avgSpeed: 2.0
                },
                status: 'completed',
                startTime: new Date(Date.now() - 86400000 * 2),
                endTime: new Date(Date.now() - 86400000 * 2 + 6800000)
            },
            {
                user: user._id,
                name: "Anamudi Expedition",
                description: "Highest peak in South India. The views were breathtaking above the clouds.",
                location: "Munnar, Kerala",
                path: {
                    type: 'MultiLineString',
                    coordinates: generatePath({ lat: 10.1585, lng: 77.0600 }, { lat: 10.1705, lng: 77.0640 })
                },
                stats: {
                    distance: 2900,
                    duration: 5100,
                    elevationGain: 280,
                    avgSpeed: 2.1
                },
                status: 'completed',
                startTime: new Date(Date.now() - 86400000 * 4),
                endTime: new Date(Date.now() - 86400000 * 4 + 5100000)
            },
            {
                user: user._id,
                name: "Meesapulimala Rhododendron Trail",
                description: "Through the wild rhododendrons and golden grass. A true wilderness experience.",
                location: "Munnar, Kerala",
                path: {
                    type: 'MultiLineString',
                    coordinates: generatePath({ lat: 10.0935, lng: 77.1750 }, { lat: 10.1058, lng: 77.1852 })
                },
                stats: {
                    distance: 5400,
                    duration: 9800,
                    elevationGain: 590,
                    avgSpeed: 1.9
                },
                status: 'completed',
                startTime: new Date(Date.now() - 86400000),
                endTime: new Date(Date.now() - 86400000 + 9800000)
            }
        ];

        // Clean up previous test treks of the same name to avoid duplicates
        await Trek.deleteMany({ user: user._id, name: { $in: treks.map(t => t.name) } });

        await Trek.insertMany(treks);
        console.log('Successfully seeded 3 realistic test treks for lezinsajid!');

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
