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
            username: currentUser?.username,
            leaderId: String(leaderId)
        });

        // --- LISTENERS ---

        socket.on('participant-joined', ({ username }) => {
            if (isLeader) {
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

        socket.on("participant-location-received", ({ userId, username, profileImage, location, isOffTrail, distanceToTrail, leaderId: pLeaderId }) => {
            if (userId === currentUser?._id) return;
            
            setParticipants(prev => ({
                ...prev,
                [userId]: { 
                    username, 
                    profileImage, 
                    location, 
                    isOffTrail, 
                    distanceToTrail, 
                    role: userId === (pLeaderId || leaderId) ? 'leader' : 'member',
                    lastUpdate: Date.now() 
                }
            }));

            // Process leader-specific logic (e.g. auto-follow) handled by parent via participants state
        });

        socket.on('trail-point-received', ({ point, isNewSegment }) => {
            if (!isLeader) {
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
            if (!isLeader) {
                onPathReceived(path);
            }
        });

        socket.on('trek-control-received', ({ action }) => {
            if (!isLeader) {
                onControlAction(action);
            }
        });

        socket.on('waypoint-received', ({ waypoint }) => {
            if (!isLeader) {
                onWaypointReceived(waypoint);
            }
        });

        socket.on('drift-notification', ({ userId, username, isOffTrail }) => {
            if (userId === currentUser?._id) return;
            onDriftAlert({ username, isOffTrail });
        });

        socket.on('group-centroid', ({ centroid, memberCount }) => {
            onControlAction({ type: 'CENTROID', centroid, memberCount });
        });

        socket.on('safety-alert', ({ userId, username, deviation, anchor }) => {
            onControlAction({ type: 'SAFETY_ALERT', userId, username, deviation, anchor });
        });

        socket.on('participant-ready', ({ userId, username, leaderId: pLeaderId }) => {
            if (userId === currentUser?._id) return;
            
            setParticipants(prev => {
                const isNew = !prev[userId];
                const updated = {
                    ...prev,
                    [userId]: { 
                        username, 
                        role: String(userId) === String(pLeaderId || leaderId) ? 'leader' : 'member',
                        isInitialized: true,
                        lastUpdate: Date.now() 
                    }
                };
                
                // If they are new to us, tell them we are here too
                if (isNew) {
                    emitReady();
                }
                
                return updated;
            });
        });

        socket.on('force-member-focus', ({ targetUserId }) => {
            onControlAction({ type: 'FOCUS', targetUserId });
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

    return { 
        participants, 
        emitLocation, 
        emitControl, 
        emitWaypoint, 
        emitPathReplaced, 
        emitPointShared,
        emitDrift,
        emitLeaderTrack,
        emitReady
    };
};
