import axios from 'axios';
import { getItem } from '../utils/platformStorage';

// UPDATE THIS WITH YOUR LOCAL IP ADDRESS IF TESTING ON REAL DEVICE
// For Android Emulator use 'http://10.0.2.2:3000/api'
// For iOS Simulator use 'http://localhost:3000/api'
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Priorities: 
// 1. .env variable (EXPO_PUBLIC_PREFIX)
// 2. Fallback to a common development IP or localhost
// Smarter fallback for Android Emulator
const localIp = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
// TIP: If you see "Network Error" on a real device, replace 'localIp' with your computer's actual IP address (e.g., '192.168.1.5')
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${localIp}:3000/api`;

const client = axios.create({
    baseURL: BASE_URL,
    timeout: 25000, // 15 seconds is a good balance
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
        // Essential for ngrok: avoid the landing page 'Welcome to ngrok'
        config.headers['ngrok-skip-browser-warning'] = 'true';
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

        // --- Added Retry Logic for Timeouts / Network Errors ---
        if (!config || !config.url) {
            return Promise.reject(error);
        }

        // Initialize retry count
        config.__retryCount = config.__retryCount || 0;
        const maxRetries = 2; // Only try 2 times to prevent infinite loops

        // Retry only on Network Errors or 5xx Server Errors (not 400s)
        const shouldRetry = (!response && message.includes('timeout')) ||
            (!response && message.includes('Network Error')) ||
            (response && response.status >= 500);

        if (shouldRetry && config.__retryCount < maxRetries) {
            config.__retryCount += 1;
            console.log(`[API Retry] Retrying request to ${url} (Attempt ${config.__retryCount} of ${maxRetries})...`);

            // Wait 1 second before retrying (exponential backoff could be used here)
            await new Promise(resolve => setTimeout(resolve, 1000 * config.__retryCount));

            // Retry the same configuration
            return client(config);
        }

        // If we reach here, we've exhausted retries or it's not a retriable error
        return Promise.reject(error);
    }
);

export default client;
