import axios from 'axios';
import { getItem } from '../utils/platformStorage';

// UPDATE THIS WITH YOUR LOCAL IP ADDRESS IF TESTING ON REAL DEVICE
// For Android Emulator use 'http://10.0.2.2:3000/api'
// For iOS Simulator use 'http://localhost:3000/api'
import Constants from 'expo-constants';

// Priorities: 
// 1. .env variable (EXPO_PUBLIC_PREFIX)
// 2. Fallback to a common development IP or localhost
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://localhost:3000/api`;

const client = axios.create({
    baseURL: BASE_URL,
    timeout: 15000, // 15 seconds is a good balance
});

// Debug logging
if (__DEV__) {
    console.log('[API] Client Initialized with:', BASE_URL);
}

client.interceptors.request.use(async (config) => {
    try {
        const token = await getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("[API] Token retrieval failed", error);
    }
    return config;
}, (error) => Promise.reject(error));

client.interceptors.response.use(
    response => response,
    async (error) => {
        const { config, response, message } = error;
        
        // Log details safely
        const url = config?.url || 'unknown';
        if (response) {
            console.error(`[API Error] ${url}: ${response.status}`, response.data);
        } else if (error.request) {
            console.error(`[Network Error] ${url}: No response`, message);
        } else {
            console.error(`[API Crash] ${message}`);
        }
        
        return Promise.reject(error);
    }
);

export default client;
