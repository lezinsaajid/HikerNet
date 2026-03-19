import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);

    const fetchUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await client.get('/notifications');
            const unread = data.filter(n => !n.isRead).length;
            setUnreadCount(unread);
            setNotifications(data);
        } catch (error) {
            console.error("Error fetching unread count:", error);
        }
    }, [user]);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    return (
        <NotificationContext.Provider value={{ unreadCount, setUnreadCount, notifications, fetchUnreadCount }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);
