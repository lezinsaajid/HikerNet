import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { getItem, setItem, deleteItem } from '../utils/platformStorage';
import client from '../api/client';
import { useRouter, useSegments } from 'expo-router';
import * as Device from 'expo-device';

let Notifications;
try {
    Notifications = require('expo-notifications');
} catch (e) {
    console.warn("expo-notifications disabled for Expo Go compatibility.");
    Notifications = null;
}
import Constants from 'expo-constants';
import { generateAndSaveKeys, getKeys, encryptPrivateKey, decryptPrivateKey, saveKeys } from '../utils/encryption';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Current active user
    const [accounts, setAccounts] = useState([]); // List of { user, token }
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingAccount, setIsAddingAccount] = useState(false); // Flag to bypass auth guard for adding account
    const [isLoggingOut, setIsLoggingOut] = useState(false); // Prevent multiple logout calls
    const [isMounted, setIsMounted] = useState(false);

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
                const isAuthRequest =
                    originalRequest.url?.includes('/auth/login') ||
                    originalRequest.url?.includes('/auth/register') ||
                    originalRequest.url?.includes('/auth/logout');


                if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest && !isLoggingOut) {
                    console.log("Session expired (401). Logging out current user...");
                    originalRequest._retry = true;
                    // Log out ONLY the current user
                    logout(); // Don't await here to avoid blocking interceptor? No, await is better but we check flag.
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

            await handleAuthSuccess(newUser, token, password);
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.response?.data?.message || "Login failed" };
        }
    };

    const register = async (username, email, password) => {
        try {
            const res = await client.post('/auth/register', { username, email, password });
            const { token, user: newUser } = res.data;

            await handleAuthSuccess(newUser, token, password);
            return { success: true };
        } catch (error) {
            return { success: false, msg: error.response?.data?.message || "Registration failed" };
        }
    };

    const handleAuthSuccess = async (newUser, token, password) => {
        try {
            if (!token || typeof token !== 'string') {
                console.error("Invalid token format:", token);
                if (token) token = String(token);
                else throw new Error("Invalid token received from server");
            }

            // --- E2EE KEY MANAGEMENT ---
            // 1. Check if we have keys locally
            let keys = await getKeys();
            let needsRestore = false;

            if (!keys.publicKey || !keys.secretKey) {
                // No Local Keys. 

                // AUTO-RESTORE CHECK
                if (newUser.encryptedPrivateKey && newUser.keyBackupSalt && password) {
                    console.log("[E2EE] Backup found. Attempting Auto-Restore...");
                    try {
                        const restoredSecretKey = await decryptPrivateKey(newUser.encryptedPrivateKey, newUser.keyBackupSalt, password);
                        keys = {
                            publicKey: newUser.publicKey,
                            secretKey: restoredSecretKey
                        }
                        await saveKeys(keys);
                        console.log("[E2EE] Auto-Restore SUCCESS!");
                    } catch (restoreErr) {
                        console.warn("[E2EE] Auto-Restore Failed (Wrong Password?):", restoreErr);
                        needsRestore = true; // Fallback to manual
                    }
                } else if (newUser.encryptedPrivateKey && newUser.keyBackupSalt) {
                    console.log("[E2EE] Backup found but no password provided for auto-restore.");
                    needsRestore = true;
                } else {
                    console.log("[E2EE] No keys, no backup. Generating new keys...");
                    keys = await generateAndSaveKeys();

                    // AUTO-BACKUP CHECK
                    if (password) {
                        try {
                            console.log("[E2EE] Performing Auto-Backup...");
                            const { encryptedPrivateKey, salt } = await encryptPrivateKey(keys.secretKey, password);

                            // We need to upload this. But we need 'token' first?
                            // Token is not set in storage yet, but we have it.
                            // We can use a direct axios call or use client with manual header if needed, 
                            // but simpler to do it after token storage or just call API.
                            // Let's do it later in the function? 
                            // Or calculate it here and attach to user object to save locally, then upload.

                            // Attach to newUser object so it gets saved to local accounts
                            newUser.encryptedPrivateKey = encryptedPrivateKey;
                            newUser.keyBackupSalt = salt;
                        } catch (backupErr) {
                            console.error("Auto-Backup Failed:", backupErr);
                        }
                    }
                }
            } else {
                console.log("[E2EE] Existing keys found.");
            }

            // ... (rest of function) ...

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

            // Set Storage (This sets the active token for `client` interceptor if we reload, but for now `client` reads from file? No `client` reads from storage on request)
            await setItem('token', token);
            await saveAccounts(sanitizedNewAccounts, sanitizedUser);

            // POST-LOGIN SYNC: Upload Public Key & Auto-Backup
            if (!needsRestore) {
                // 1. Upload Public Key if missing/changed
                if (!newUser.publicKey || newUser.publicKey !== keys.publicKey) {
                    try {
                        console.log("[E2EE] Uploading public key to server...");
                        await client.put('/users/keys', { publicKey: keys.publicKey });
                        sanitizedUser.publicKey = keys.publicKey;
                    } catch (keyErr) { console.error("Pubkey Upload Failed", keyErr); }
                }

                // 2. Upload Backup if we have it locally (from Auto-Backup step above) but server doesn't match?
                // Or if we just generated it.
                if (newUser.encryptedPrivateKey && newUser.keyBackupSalt && (!newUser.createdAt || newUser.encryptedPrivateKey !== "" /* check if it was just added */)) {
                    // How do we know if we need to upload backup? 
                    // If we just generated keys and auto-encrypted, `newUser` has the fields but server might not.
                    // Actually `newUser` came from server response. We modified it above locally. 
                    // So we should upload.
                    try {
                        console.log("[E2EE] Uploading Auto-Backup...");
                        await client.put('/users/keys/backup', {
                            encryptedPrivateKey: newUser.encryptedPrivateKey,
                            keyBackupSalt: newUser.keyBackupSalt
                        });
                    } catch (upErr) { console.error("Backup Upload Failed", upErr); }
                }

                // Save updated user again to be sure
                const finalAccounts = newAccounts.map(acc =>
                    String(acc.user._id) === String(sanitizedUser._id) ? { ...acc, user: sanitizedUser } : acc
                );
                await saveAccounts(finalAccounts, sanitizedUser);
            }

            setUser(sanitizedUser);
            setIsAddingAccount(false); // Reset flag

            // --- PUSH NOTIFICATION REGISTRATION ---
            registerForPushNotificationsAsync().then(token => {
                if (token) {
                    client.put('/users/profile', { expoPushToken: token }).catch(err => {
                        console.error("[Push] Failed to update token on server:", err);
                    });
                }
            });

            // Redirect based on restore need
            if (needsRestore && isMounted) {
                setTimeout(() => {
                    router.replace('/settings/restore-keys');
                }, 100);
            }
        } catch (error) {
            console.error("handleAuthSuccess error:", error);
            throw error; // Re-throw to let login() catch it
        }
    };

    const logout = useCallback(async () => {
        if (isLoggingOut) return;
        try {
            setIsLoggingOut(true);
            console.log("[AuthContext] Logout initiated...");

            // Notify server to set offline status (fire and forget, don't block UI)
            client.post('/auth/logout').catch(err => {
                console.warn("[AuthContext] Server logout notification failed (expected if token expired or offline):", err.message);
            });

            if (!user) {
                console.warn("[AuthContext] Logout called but no user is active.");
                setIsLoggingOut(false);
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
                if (isMounted) {
                    router.replace('/(tabs)');
                }
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
                // Note: AuthGuard useEffect will detect user=null and redirect to /login
                console.log("[AuthContext] Full logout complete.");
            }
        } catch (e) {
            console.error("[AuthContext] Logout error:", e);
            // Emergency cleanup
            setUser(null);
            setAccounts([]);
            // router.replace('/login'); // Handled by AuthGuard
        } finally {
            setIsLoggingOut(false);
        }
    }, [user, accounts, router, isLoggingOut]); // Added isLoggingOut dependency

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
            // router.replace('/login'); // Handled by AuthGuard
        } catch (e) {
            console.error("[AuthContext] logoutAll error:", e);
            setUser(null);
            setAccounts([]);
            // router.replace('/login'); // Handled by AuthGuard
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
                if (isMounted) {
                    router.replace('/(tabs)');
                }
            } else {
                console.warn("[AuthContext] switchAccount: Account not found for ID", targetIdStr);
            }
        } catch (error) {
            console.error("[AuthContext] switchAccount failed:", error);
        }
    }, [accounts, router, isMounted]);

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
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isLoading || !isMounted) return;

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

async function registerForPushNotificationsAsync() {
    let token;

    if (!Notifications) {
        console.log('[Push] expo-notifications not available, skipping registration.');
        return null;
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.warn('Failed to get push token for push notification!');
            return;
        }
        
        // Learn more about projectId here: https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
        try {
            const projectId =
                Constants?.expoConfig?.extra?.eas?.projectId ??
                Constants?.easConfig?.projectId;
            
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
            console.log("[Push] Token:", token);
        } catch (e) {
            console.error("[Push] Error getting token:", e);
        }
    } else {
        console.log('[Push] Must use physical device for Push Notifications');
    }

    return token;
}

export const useAuth = () => useContext(AuthContext);
