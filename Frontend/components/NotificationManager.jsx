import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL = 10000; // 10 seconds

export default function NotificationManager() {
    const { user } = useAuth();
    const router = useRouter();
    const segments = useSegments();
    const timerRef = useRef(null);

    useEffect(() => {
        if (!user) return;

        const checkInvites = async () => {
            try {
                const res = await client.get('/users/invitations');
                const invites = res.data;

                if (invites && invites.length > 0) {
                    // Show alert for the most recent invite
                    const latest = invites[invites.length - 1]; // Assuming ordered? API does not sort explicitly but push appends.

                    // Prevent duplicate alerts if we just showed one? 
                    // For simplicity, we'll just show it and clear it from backend if accepted/declined.
                    // If multiple, maybe just showing one is fine.

                    showInviteAlert(latest);
                }
            } catch (error) {
                // Silent fail
                console.log("Polling invites error:", error.response?.status || error.message);
            }
        };

        const showInviteAlert = (invite) => {
            // Check if we are already in the room?
            // If we are in 'room-lobby' with same ID, ignore.

            Alert.alert(
                "Trail Invitation",
                `@${invite.inviter.username} invited you to join "${invite.trailName || invite.trekName}"`,
                [
                    {
                        text: "Decline",
                        style: "cancel",
                        onPress: () => handleRespond(invite, false)
                    },
                    {
                        text: "Join",
                        onPress: () => handleRespond(invite, true)
                    }
                ]
            );
        };

        const handleRespond = async (invite, accept) => {
            try {
                // Clear invite from backend first
                await client.post('/users/invitations/clear', { roomId: invite.roomId });

                if (accept) {
                    router.push({
                        pathname: '/trek/room-lobby',
                        params: { roomId: invite.roomId, role: 'member' }
                    });
                }
            } catch (error) {
                console.error("Error responding to invite:", error);
            }
        };

        // Start Polling
        timerRef.current = setInterval(checkInvites, POLL_INTERVAL);
        checkInvites(); // Initial check

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [user]);

    return null; // This component renders nothing visible
}
