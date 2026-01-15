import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { getItem, setItem, deleteItem } from '../utils/platformStorage';
import client from '../api/client';
import { useRouter, useSegments } from 'expo-router';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Current active user
    const [accounts, setAccounts] = useState([]); // List of { user, token }
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingAccount, setIsAddingAccount] = useState(false); // Flag to bypass auth guard for adding account

    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        const loadState = async () => {
            try {
                const storedAccounts = await getItem('accounts');
                const lastActiveId = await getItem('active_user_id');

                if (storedAccounts) {
                    const parsedAccounts = JSON.parse(storedAccounts);
                    if (Array.isArray(parsedAccounts)) {
                        setAccounts(parsedAccounts);

                        if (parsedAccounts.length > 0) {
                            const lastIdStr = lastActiveId ? String(lastActiveId) : null;
                            const activeAccount = parsedAccounts.find(acc => acc.user?._id && String(acc.user._id) === lastIdStr) || parsedAccounts[0];
                            const sanitizedUser = activeAccount.user?._id ? { ...activeAccount.user, _id: String(activeAccount.user._id) } : activeAccount.user || null;
                            setUser(sanitizedUser);
                            await setItem('token', activeAccount.token);
                        }
                    } else {
                        // Invalid structure, reset
                        setAccounts([]);
                    }
                }
            } catch (e) {
                console.error("Failed to load auth state", e);
                setAccounts([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadState();
    }, []);

    // Setup 401 interceptor
    useEffect(() => {
        const interceptor = client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                // Ignore 401s from auth endpoints (login/register) to prevent logging out current user on failed attempts
                const isAuthRequest = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register');

                if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
                    console.log("Session expired (401). Logging out current user...");
                    originalRequest._retry = true;
                    // Log out ONLY the current user
                    await logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            client.interceptors.response.eject(interceptor);
        };
    }, [user, accounts, logout]); // include logout as dependency

    const saveAccounts = async (newAccounts, activeUser) => {
        setAccounts(newAccounts);
        await setItem('accounts', JSON.stringify(newAccounts));
        if (activeUser && activeUser._id) {
            await setItem('active_user_id', String(activeUser._id));
        } else {
            await deleteItem('active_user_id');
        }
    };

    const login = async (email, password) => {
        try {
            const res = await client.post('/auth/login', { email, password });
            const { token, user: newUser } = res.data;

            await handleAuthSuccess(newUser, token);
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.response?.data?.message || "Login failed" };
        }
    };

    const register = async (username, email, password) => {
        try {
            const res = await client.post('/auth/register', { username, email, password });
            const { token, user: newUser } = res.data;

            await handleAuthSuccess(newUser, token);
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.response?.data?.message || "Registration failed" };
        }
    };

    const handleAuthSuccess = async (newUser, token) => {
        try {
            if (!token || typeof token !== 'string') {
                console.error("Invalid token format:", token);
                if (token) token = String(token);
                else throw new Error("Invalid token received from server");
            }

            // Safe array check
            const currentAccounts = Array.isArray(accounts) ? accounts : [];

            // Remove existing entry for this user if it exists (to update it)
            const otherAccounts = currentAccounts.filter(acc => acc?.user?._id && String(acc.user._id) !== String(newUser._id));
            const newAccounts = [...otherAccounts, { user: newUser, token }];

            // Sanitize all accounts to ensure _id is always a string
            const sanitizedNewAccounts = newAccounts.map(acc => ({
                ...acc,
                user: acc.user?._id ? { ...acc.user, _id: String(acc.user._id) } : acc.user
            }));

            const sanitizedUser = newUser?._id ? { ...newUser, _id: String(newUser._id) } : newUser;
            setUser(sanitizedUser);
            await setItem('token', token); // Set active token for client
            await saveAccounts(sanitizedNewAccounts, sanitizedUser);
            setIsAddingAccount(false); // Reset flag
        } catch (error) {
            console.error("handleAuthSuccess error:", error);
            throw error; // Re-throw to let login() catch it
        }
    };

    const logout = useCallback(async () => {
        try {
            console.log("[AuthContext] Logout initiated...");
            if (!user) {
                console.warn("[AuthContext] Logout called but no user is active.");
                return;
            }

            const currentId = String(user._id);
            console.log(`[AuthContext] Logging out user: ${user.username} (${currentId})`);

            // 1. Identify remaining accounts
            const remainingAccounts = accounts.filter(acc => acc.user?._id && String(acc.user._id) !== currentId);
            console.log(`[AuthContext] Remaining accounts: ${remainingAccounts.length}`);

            if (remainingAccounts.length > 0) {
                // Switch to the next available account
                const nextAccount = remainingAccounts[0];
                console.log(`[AuthContext] Switching to next account: ${nextAccount.user.username}`);

                // Update local state first for immediate UI response
                const sanitizedNextUser = { ...nextAccount.user, _id: String(nextAccount.user._id) };
                setUser(sanitizedNextUser);
                setAccounts(remainingAccounts);

                // Update storage
                await setItem('token', nextAccount.token);
                await setItem('accounts', JSON.stringify(remainingAccounts));
                await setItem('active_user_id', String(sanitizedNextUser._id));

                console.log("[AuthContext] Logout/Switch complete. Refreshing UI...");
                router.replace('/(tabs)');
            } else {
                // No accounts left, perform full cleanup
                console.log("[AuthContext] No accounts left. Clearing all auth data...");

                // Clear storage first
                await deleteItem('token');
                await deleteItem('accounts');
                await deleteItem('active_user_id');

                // Clear state
                setAccounts([]);
                setUser(null);

                console.log("[AuthContext] Full logout complete. Navigating to login...");
                router.replace('/login');
            }
        } catch (e) {
            console.error("[AuthContext] Logout error:", e);
            // Emergency cleanup
            setUser(null);
            setAccounts([]);
            router.replace('/login');
        }
    }, [user, accounts, router]); // Removed switchAccount dependency to avoid loops

    const logoutAll = useCallback(async () => {
        try {
            console.log("[AuthContext] Logout All initiated...");

            // 1. Clear storage
            await deleteItem('token');
            await deleteItem('accounts');
            await deleteItem('active_user_id');

            // 2. Clear state
            setAccounts([]);
            setUser(null);

            console.log("[AuthContext] Full logout of all accounts complete.");
            router.replace('/login');
        } catch (e) {
            console.error("[AuthContext] logoutAll error:", e);
            setUser(null);
            setAccounts([]);
            router.replace('/login');
        }
    }, [router]);

    const switchAccount = useCallback(async (targetUserId) => {
        try {
            const targetIdStr = String(targetUserId);
            console.log(`[AuthContext] switchAccount attempt for: ${targetIdStr}`);

            const targetAccount = accounts.find(acc => acc.user?._id && String(acc.user._id) === targetIdStr);

            if (targetAccount) {
                const sanitizedUser = { ...targetAccount.user, _id: String(targetAccount.user._id) };

                // 1. Update State
                setUser(sanitizedUser);

                // 2. Update Storage
                await setItem('token', targetAccount.token);
                await setItem('active_user_id', String(sanitizedUser._id));

                console.log(`[AuthContext] State updated for ${sanitizedUser.username}. Navigating...`);

                // 3. Force navigation reset
                router.replace('/(tabs)');
            } else {
                console.warn("[AuthContext] switchAccount: Account not found for ID", targetIdStr);
            }
        } catch (error) {
            console.error("[AuthContext] switchAccount failed:", error);
        }
    }, [accounts, router]);

    const prepareAddAccount = useCallback(() => {
        setIsAddingAccount(true);
        router.push('/login');
    }, [router]);

    const updateUserData = async (newData) => {
        try {
            if (!user?._id) return;
            const currentId = String(user._id);
            const updatedUser = { ...user, ...newData, _id: currentId };
            setUser(updatedUser);

            // Update in accounts list too
            const updatedAccounts = accounts.map(acc =>
                acc.user?._id && String(acc.user._id) === currentId ? { ...acc, user: updatedUser } : acc
            );
            await saveAccounts(updatedAccounts, updatedUser);
        } catch (error) {
            console.error("Error updating local user data:", error);
        }
    };

    const cancelAddAccount = useCallback(() => {
        setIsAddingAccount(false);
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)');
        }
    }, [router]);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments.some(seg => seg === '(auth)' || seg === 'login' || seg === 'register');
        const isIndex = segments.length === 0 || (segments.length === 1 && (segments[0] === 'index' || segments[0] === undefined));

        // console.log("Auth Guard:", { user: !!user, segments, inAuthGroup, isAddingAccount });

        if (!user && !inAuthGroup && !isIndex) {
            router.replace('/login');
        } else if (user && (inAuthGroup || isIndex) && !isAddingAccount) {
            // Only redirect to home if we are NOT trying to add an account
            router.replace('/(tabs)');
        }
    }, [user, segments, isLoading, isAddingAccount, router]);

    return (
        <AuthContext.Provider value={{
            user,
            accounts,
            setUser,
            updateUserData,
            isLoading,
            login,
            register,
            logout,
            logoutAll,
            switchAccount,
            prepareAddAccount,
            cancelAddAccount
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
