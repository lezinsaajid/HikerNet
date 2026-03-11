import axios from 'axios';
import { getItem } from '../utils/platformStorage';

// UPDATE THIS WITH YOUR LOCAL IP ADDRESS IF TESTING ON REAL DEVICE
// For Android Emulator use 'http://10.0.2.2:3000/api'
// For iOS Simulator use 'http://localhost:3000/api'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000, // 30 seconds (increased from 10s)
});

// Debug logging
console.log('API Client Configured:', {
    baseURL: BASE_URL,
    isDevice: !__DEV__,
});

client.interceptors.request.use(async (config) => {
    try {
        const token = await getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // console.log(`[Request] ${config.method.toUpperCase()} ${config.url}`);
    } catch (error) {
        console.error("Error reading token", error);
    }
    return config;
});

client.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            // Server responded with a status code outside 2xx
            console.error(`[API Error] ${error.config?.url}:`, error.response.status, error.response.data);
        } else if (error.request) {
            // Request was made but no response received
            console.error(`[Network Error] ${error.config?.url}: No response received`, error.message);
        } else {
            console.error(`[Error] ${error.message}`);
        }
        return Promise.reject(error);
    }
);

export default client;
