import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * Platform independent storage utility
 * Uses localStorage for Web and SecureStore for Native (iOS/Android)
 */

export const setItem = async (key, value) => {
    if (isWeb) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn('Local storage is not available on web:', e);
        }
    } else {
        await SecureStore.setItemAsync(key, value);
    }
};

export const getItem = async (key) => {
    if (isWeb) {
        try {
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(key);
            }
            return null;
        } catch (e) {
            console.warn('Local storage is not available on web:', e);
            return null;
        }
    } else {
        return await SecureStore.getItemAsync(key);
    }
};

export const deleteItem = async (key) => {
    if (isWeb) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn('Local storage is not available on web:', e);
        }
    } else {
        await SecureStore.deleteItemAsync(key);
    }
};
