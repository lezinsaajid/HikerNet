import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Hook to manage Group Trek synchronization via Socket.io
 */
export const useGroupSync = ({
    trailId,
    currentUser,
    isLeader,
    leaderId,
    onControlAction, // (action) => void
    onWaypointReceived, // (waypoint) => void
    onPathReceived, // (path) => void
    onDriftAlert, // ({ username, isOffTrail }) => void
    onChatMessage, // (message) => void
    onTrekStarted, // ({ trekId, leaderId }) => void
    onStatusChanged, // ({ userId, username, status, allParticipants }) => void
    baseUrl
}) => {
    const [participants, setParticipants] = useState({});
    const socketRef = useRef(null);

    const latestCallbacks = useRef({
        onControlAction, onWaypointReceived, onPathReceived, onDriftAlert, onChatMessage, onTrekStarted, onStatusChanged
    });

    useEffect(() => {
        latestCallbacks.current = {
            onControlAction, onWaypointReceived, onPathReceived, onDriftAlert, onChatMessage, onTrekStarted, onStatusChanged
        };
    });

    useEffect(() => {
        if (!trailId) return;

        const socketUrl = baseUrl.replace('/api', '');
        const socket = io(socketUrl, {
            transports: ['websocket'],
            jsonp: false
        });
        socketRef.current = socket;

        setParticipants({}); // Reset for new session
        socket.emit('join-trek', { 
            trekId: String(trailId), 
            userId: currentUser?._id, 
            username: currentUser?.username,
            profileImage: currentUser?.profileImage,
            leaderId: String(leaderId)
        });

        // Join lobby room if provided (for real-time start)
        const roomId = trailId; // Often room ID and trail ID are passed similarly or linked
        socket.emit('join-room', { roomId, userId: currentUser?._id, username: currentUser?.username });

        // --- LISTENERS ---

        socket.on('participant-status-changed', ({ userId, username, status, allParticipants }) => {
            if (userId !== currentUser?._id) {
                if (status === 'inactive') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (status === 'left') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }

            setParticipants(prev => {
                const updated = { ...prev };
                
                // Update specific user status
                if (status === 'left') {
                    delete updated[userId];
                } else {
                    updated[userId] = {
                        ...(updated[userId] || {}),
                        username,
                        status,
                        lastUpdate: Date.now()
                    };
                }

                // If server sent allParticipants, we can use it to sync fully
                if (allParticipants) {
                    Object.entries(allParticipants).forEach(([id, data]) => {
                        if (data.status === 'left') {
                            delete updated[id];
                        } else {
                            updated[id] = {
                                ...(updated[id] || {}),
                                username: data.username,
                                profileImage: data.profileImage,
                                status: data.status,
                                lastUpdate: data.lastActive
                            };
                        }
                    });
                }

                return updated;
            });

            if (latestCallbacks.current.onStatusChanged) latestCallbacks.current.onStatusChanged({ userId, username, status, allParticipants });
        });

        socket.on("participant-location-received", ({ userId, username, profileImage, location, isOffTrail, distanceToTrail, leaderId: pLeaderId }) => {
            if (userId === currentUser?._id) return;
            
            setParticipants(prev => ({
                ...prev,
                [userId]: { 
                    ...(prev[userId] || {}),
                    username, 
                    profileImage, 
                    location, 
                    isOffTrail, 
                    distanceToTrail, 
                    status: 'active',
                    role: String(userId) === String(pLeaderId || leaderId) ? 'leader' : 'member',
                    lastUpdate: Date.now() 
                }
            }));
        });

        socket.on('trail-point-received', ({ point, isNewSegment }) => {
            if (!isLeader) {
                latestCallbacks.current.onPathReceived(prev => {
                    const updated = [...prev];
                    if (isNewSegment || updated.length === 0) {
                        updated.push([point]);
                    } else {
                        const lastIdx = updated.length - 1;
                        updated[lastIdx] = [...updated[lastIdx], point];
                    }
                    return updated;
                }, point); // Pass point as second arg for routeRef updates
            }
        });

        socket.on('trail-path-received', ({ path }) => {
            if (!isLeader) {
                latestCallbacks.current.onPathReceived(path);
            }
        });

        socket.on('trek-control-received', (payload) => {
            latestCallbacks.current.onControlAction(payload);
        });

        socket.on('waypoint-received', ({ waypoint }) => {
            latestCallbacks.current.onWaypointReceived(waypoint);
        });

        socket.on('drift-notification', ({ userId, username, isOffTrail }) => {
            if (userId === currentUser?._id) return;
            latestCallbacks.current.onDriftAlert({ username, isOffTrail });
        });

        socket.on('group-centroid', ({ centroid, memberCount }) => {
            latestCallbacks.current.onControlAction({ type: 'CENTROID', centroid, memberCount });
        });

        socket.on('safety-alert', ({ userId, username, deviation, anchor }) => {
            latestCallbacks.current.onControlAction({ type: 'SAFETY_ALERT', userId, username, deviation, anchor });
        });

        socket.on('participant-ready', ({ userId, username, leaderId: pLeaderId }) => {
            if (userId === currentUser?._id) return;
            
            setParticipants(prev => {
                const updated = { ...prev };
                updated[userId] = { 
                    ...(updated[userId] || {}),
                    username, 
                    status: 'active',
                    role: String(userId) === String(pLeaderId || leaderId) ? 'leader' : 'member',
                    isInitialized: true,
                    lastUpdate: Date.now() 
                };
                return updated;
            });
        });

        socket.on('force-member-focus', ({ targetUserId }) => {
            latestCallbacks.current.onControlAction({ type: 'FOCUS', targetUserId });
        });

        socket.on('trek-started', ({ trekId, leaderId }) => {
            if (latestCallbacks.current.onTrekStarted) latestCallbacks.current.onTrekStarted({ trekId, leaderId });
        });

        socket.on('message-received', (message) => {
            if (latestCallbacks.current.onChatMessage) latestCallbacks.current.onChatMessage(message);
        });

        // Presence cleanup is now handled server-side, but we keep a local safety check for very stale data
        const cleanupInterval = setInterval(() => {
            setParticipants(prev => {
                const now = Date.now();
                const filtered = {};
                let changed = false;
                Object.entries(prev).forEach(([id, p]) => {
                    // If no update for 5 mins, assume left (server should have caught this)
                    if (now - p.lastUpdate < 300000) { 
                        filtered[id] = p;
                    } else {
                        changed = true;
                    }
                });
                return changed ? filtered : prev;
            });
        }, 60000);

        return () => {
            clearInterval(cleanupInterval);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [trailId, isLeader, leaderId]);

    const emitLocation = (location, isOffTrail, distanceToTrail) => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('participant-location-update', {
                trekId: String(trailId),
                userId: currentUser?._id,
                username: currentUser?.username,
                profileImage: currentUser?.profileImage,
                location: { latitude: location.latitude, longitude: location.longitude },
                isOffTrail,
                distanceToTrail,
                leaderId: String(leaderId)
            });
        }
    };

    const emitLeaderTrack = (targetUserId) => {
        if (socketRef.current && trailId && isLeader) {
            socketRef.current.emit('leader-track-member', {
                trekId: String(trailId),
                targetUserId
            });
        }
    };

    const emitControl = (action) => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('trek-control', {
                trekId: String(trailId),
                action
            });
        }
    };

    const emitWaypoint = (waypoint) => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('waypoint-added', {
                trekId: String(trailId),
                waypoint
            });
        }
    };

    const emitPathReplaced = (path) => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('trail-path-replaced', {
                trekId: String(trailId),
                path
            });
        }
    };

    const emitPointShared = (point, isNewSegment) => {
        if (socketRef.current && trailId && isLeader) {
            socketRef.current.emit('trail-point-shared', {
                trekId: String(trailId),
                point,
                isNewSegment
            });
        }
    };

    const emitDrift = (isOffTrail) => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('drift-notification', {
                trekId: String(trailId),
                userId: currentUser?._id,
                username: currentUser?.username,
                isOffTrail
            });
        }
    };

    const emitReady = () => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('device-ready', {
                trekId: String(trailId),
                userId: currentUser?._id,
                username: currentUser?.username,
                leaderId: String(leaderId)
            });
        }
    };

    const emitMessage = (text) => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('send-message', {
                trekId: String(trailId),
                userId: currentUser?._id,
                username: currentUser?.username,
                profileImage: currentUser?.profileImage,
                text
            });
        }
    };

    const leaveGroup = () => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('leave-trek', {
                trekId: String(trailId),
                userId: currentUser?._id,
                username: currentUser?.username
            });
            socketRef.current.disconnect();
        }
    };
    return { 
        participants, 
        emitLocation, 
        emitControl, 
        emitWaypoint, 
        emitPathReplaced, 
        emitPointShared,
        emitDrift,
        emitLeaderTrack,
        emitReady,
        emitMessage,
        leaveGroup
    };
};
