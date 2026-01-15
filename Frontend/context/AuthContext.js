import React, { createContext, useState, useEffect, useContext } from 'react';
import { getItem, setItem, deleteItem } from '../utils/platformStorage';
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
                const token = await getItem('token');
                const storedUser = await getItem('user');

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

    // Setup 401 interceptor
    useEffect(() => {
        const interceptor = client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                // If 401 and we haven't tried to redirect yet (avoid infinite loops ideally, 
                // but simple lockout is fine for now)
                if (error.response?.status === 401 && !originalRequest._retry) {
                    console.log("Session expired (401). Logging out...");
                    originalRequest._retry = true;
                    // Force logout
                    await logout();
                    // Explicitly redirect to login just in case the auth guard doesn't catch it immediately
                    router.replace('/login');
                }
                return Promise.reject(error);
            }
        );

        return () => {
            client.interceptors.response.eject(interceptor);
        };
    }, []);

    const login = async (email, password) => {
        try {
            const res = await client.post('/auth/login', { email, password });
            const { token, user } = res.data;

            await setItem('token', token);
            await setItem('user', JSON.stringify(user));
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

            await setItem('token', token);
            await setItem('user', JSON.stringify(user));
            setUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.response?.data?.message || "Registration failed" };
        }
    };

    const logout = async () => {
        try {
            await deleteItem('token');
            await deleteItem('user');
            if (Platform.OS === 'web') {
                localStorage.clear(); // Nuclear option for web logout debugging
            }
        } catch (e) {
            console.error("Logout error:", e);
        } finally {
            setUser(null);
            // Ensure we redirect to login
            router.replace('/login');
        }
    };

    const updateUserData = async (newData) => {
        try {
            const updatedUser = { ...user, ...newData };
            setUser(updatedUser);
            await setItem('user', JSON.stringify(updatedUser));
        } catch (error) {
            console.error("Error updating local user data:", error);
        }
    };

    useEffect(() => {
        if (isLoading) return;

        // segments[0] can be '(auth)', 'login', 'register' or undefined (for index)
        const inAuthGroup = segments.some(seg => seg === '(auth)' || seg === 'login' || seg === 'register');
        const isIndex = segments.length === 0 || (segments.length === 1 && (segments[0] === 'index' || segments[0] === undefined));

        console.log("Auth Guard Check:", { user: !!user, segments, inAuthGroup, isIndex });

        if (!user && !inAuthGroup && !isIndex) {
            console.log("Redirecting to Login (unauthenticated)");
            router.replace('/login');
        } else if (user && (inAuthGroup || isIndex)) {
            console.log("Redirecting to Home (authenticated)");
            router.replace('/(tabs)');
        }
    }, [user, segments, isLoading]);

    return (
        <AuthContext.Provider value={{ user, setUser, updateUserData, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
