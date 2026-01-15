import axios from 'axios';
import { getItem } from '../utils/platformStorage';

// UPDATE THIS WITH YOUR LOCAL IP ADDRESS IF TESTING ON REAL DEVICE
// For Android Emulator use 'http://10.0.2.2:3000/api'
// For iOS Simulator use 'http://localhost:3000/api'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const client = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
});

client.interceptors.request.use(async (config) => {
    try {
        const token = await getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("Error reading token", error);
    }
    return config;
});

export default client;
