import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';
import { useRouter, useSegments } from 'expo-router';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        const loadUser = async () => {
            try {
                const token = await SecureStore.getItemAsync('token');
                const storedUser = await SecureStore.getItemAsync('user');

                if (token && storedUser) {
                    setUser(JSON.parse(storedUser));
                    // Check validity by fetching profile? Or assume session valid until 401.
                }
            } catch (e) {
                console.error("Failed to load user", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadUser();
    }, []);

    const login = async (email, password) => {
        try {
            const res = await client.post('/auth/login', { email, password });
            const { token, user } = res.data;

            await SecureStore.setItemAsync('token', token);
            await SecureStore.setItemAsync('user', JSON.stringify(user));
            setUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.response?.data?.message || "Login failed" };
        }
    };

    const register = async (username, email, password) => {
        try {
            const res = await client.post('/auth/register', { username, email, password });
            const { token, user } = res.data;

            await SecureStore.setItemAsync('token', token);
            await SecureStore.setItemAsync('user', JSON.stringify(user));
            setUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.response?.data?.message || "Registration failed" };
        }
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('user');
        setUser(null);
    };

    useEffect(() => {
        if (isLoading) return;

        // segments[0] can be '(auth)', 'login', 'register' or undefined (for index)
        const inAuthGroup = segments.some(seg => seg === '(auth)' || seg === 'login' || seg === 'register');
        const isIndex = segments.length === 0 || (segments.length === 1 && (segments[0] === 'index' || segments[0] === undefined));

        console.log("Auth Guard Check:", { user: !!user, segments, inAuthGroup, isIndex });

        if (!user && !inAuthGroup && !isIndex) {
            console.log("Redirecting to Welcome (unauthenticated)");
            router.replace('/');
        } else if (user && (inAuthGroup || isIndex)) {
            console.log("Redirecting to Home (authenticated)");
            router.replace('/(tabs)');
        }
    }, [user, segments, isLoading]);

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
