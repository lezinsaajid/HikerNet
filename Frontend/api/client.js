import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// UPDATE THIS WITH YOUR LOCAL IP ADDRESS IF TESTING ON REAL DEVICE
// For Android Emulator use 'http://10.0.2.2:3000/api'
// For iOS Simulator use 'http://localhost:3000/api'
const BASE_URL = 'http://192.168.1.4:3000/api';

const client = axios.create({
    baseURL: BASE_URL,
});

client.interceptors.request.use(async (config) => {
    try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("Error reading token", error);
    }
    return config;
});

export default client;
