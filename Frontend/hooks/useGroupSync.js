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
    role,
    leaderId,
    onControlAction, // (action) => void
    onWaypointReceived, // (waypoint) => void
    onPathReceived, // (path) => void
    onDriftAlert, // ({ username, isOffTrail }) => void
    baseUrl
}) => {
    const [participants, setParticipants] = useState({});
    const socketRef = useRef(null);

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
            username: currentUser?.username 
        });

        // --- LISTENERS ---

        socket.on('participant-joined', ({ username }) => {
            if (role === 'leader') {
                // Toast/Alert handled by parent if needed, or here for consistency
            }
        });

        socket.on('participant-left', ({ userId, username }) => {
            setParticipants(prev => {
                const updated = { ...prev };
                if (userId) delete updated[userId];
                else {
                    // Fallback to username search if userId not provided
                    const idToRemove = Object.keys(updated).find(id => updated[id].username === username);
                    if (idToRemove) delete updated[idToRemove];
                }
                return updated;
            });
            // Notify via alert or callback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDriftAlert({ username, isOffTrail: false, isLeft: true }); // Reuse drift alert for notifications
        });

        socket.on("participant-location-received", ({ userId, username, profileImage, location, isOffTrail, distanceToTrail }) => {
            if (userId === currentUser?._id) return;
            
            setParticipants(prev => ({
                ...prev,
                [userId]: { username, profileImage, location, isOffTrail, distanceToTrail, lastUpdate: Date.now() }
            }));

            // Process leader-specific logic (e.g. auto-follow) handled by parent via participants state
        });

        socket.on('trail-point-received', ({ point, isNewSegment }) => {
            if (role === 'member') {
                onPathReceived(prev => {
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
            if (role === 'member') {
                onPathReceived(path);
            }
        });

        socket.on('trek-control-received', ({ action }) => {
            if (role === 'member') {
                onControlAction(action);
            }
        });

        socket.on('waypoint-received', ({ waypoint }) => {
            if (role === 'member') {
                onWaypointReceived(waypoint);
            }
        });

        socket.on('drift-notification', ({ userId, username, isOffTrail }) => {
            if (userId === currentUser?._id) return;
            onDriftAlert({ username, isOffTrail });
        });

        // Cleanup stale markers periodically
        const cleanupInterval = setInterval(() => {
            setParticipants(prev => {
                const now = Date.now();
                const filtered = {};
                let changed = false;
                Object.entries(prev).forEach(([id, p]) => {
                    if (now - p.lastUpdate < 30000) { // 30s timeout
                        filtered[id] = p;
                    } else {
                        changed = true;
                    }
                });
                return changed ? filtered : prev;
            });
        }, 10000);

        return () => {
            clearInterval(cleanupInterval);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [trailId, role]);

    const emitLocation = (location, isOffTrail, distanceToTrail) => {
        if (socketRef.current && trailId) {
            socketRef.current.emit('participant-location-update', {
                trekId: String(trailId),
                userId: currentUser?._id,
                username: currentUser?.username,
                profileImage: currentUser?.profileImage,
                location: { latitude: location.latitude, longitude: location.longitude },
                isOffTrail,
                distanceToTrail
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
        if (socketRef.current && trailId && role === 'leader') {
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

    return { 
        participants, 
        emitLocation, 
        emitControl, 
        emitWaypoint, 
        emitPathReplaced, 
        emitPointShared,
        emitDrift
    };
};
