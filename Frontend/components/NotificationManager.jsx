import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL = 30000;

let Notifications;
try {
    Notifications = require('expo-notifications');
    // Foreground notification behavior
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
} catch (e) {
    console.warn("expo-notifications disabled for Expo Go compatibility.");
    Notifications = null;
}

export default function NotificationManager() {
    const { user } = useAuth();
    const router = useRouter();

    const notificationListener = useRef(null);
    const responseListener = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!user) return;

        // 1 & 2. Push Notification listeners
        if (Notifications) {
            // Foreground listener
            notificationListener.current =
                Notifications.addNotificationReceivedListener(notification => {
                    console.log("[Push] Received:", notification.request.content.data);
                });

            // Tap listener
            responseListener.current =
                Notifications.addNotificationResponseReceivedListener(response => {
                    const data = response.notification.request.content.data;
                    console.log("[Push] Tapped:", data);
                    handleNotificationNavigation(data);
                });
        }

        // 3. Polling fallback
        const checkInvites = async () => {
            try {
                const res = await client.get('/users/invitations');
                const invites = res.data;

                if (invites?.length > 0) {
                    const latest = invites[invites.length - 1];
                    showInviteAlert(latest);
                }
            } catch (error) {
                console.log("Polling invites error:", error.message);
            }
        };

        const showInviteAlert = (invite) => {
            Alert.alert(
                "Trail Invitation",
                `@${invite.inviter.username} invited you to join "${invite.trailName || invite.trekName}"`,
                [
                    {
                        text: "Decline",
                        style: "cancel",
                        onPress: () => handleRespond(invite, false),
                    },
                    {
                        text: "Join",
                        onPress: () => handleRespond(invite, true),
                    },
                ]
            );
        };

        const handleRespond = async (invite, accept) => {
            try {
                await client.post('/users/invitations/clear', {
                    roomId: invite.roomId,
                });

                if (accept) {
                    router.push({
                        pathname: '/trek/room-lobby',
                        params: {
                            roomId: invite.roomId,
                            role: 'member',
                        },
                    });
                }
            } catch (error) {
                console.error("Invite response error:", error);
            }
        };

        const handleNotificationNavigation = (data) => {
            if (!data) return;

            switch (data.type) {
                case "like":
                case "comment":
                case "tag":
                    if (data.postId) {
                        router.push(`/post/${data.postId}`);
                    }
                    break;

                case "friend_request":
                case "follow":
                    if (data.senderId) {
                        router.push(`/user-profile/${data.senderId}`);
                    }
                    break;

                case "trek_invite":
                case "trek_update":
                case "trek_join":
                case "trek_leave":
                    if (data.roomId) {
                        router.push({
                            pathname: '/trek/room-lobby',
                            params: {
                                roomId: data.roomId,
                                role: 'member',
                            },
                        });
                    } else if (data.trekId) {
                        router.push(`/trek/${data.trekId}`);
                    }
                    break;

                default:
                    router.push('/notifications');
            }
        };

        // Start polling
        timerRef.current = setInterval(checkInvites, POLL_INTERVAL);
        checkInvites();

        // Cleanup
        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();

            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [user]);

    return null;
}