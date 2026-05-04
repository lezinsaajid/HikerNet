import Trek from '../models/Trek.js';
import Room from '../models/Room.js';

let io;

export const initSocket = (socketIo) => {
    io = socketIo;

    const socketToUser = new Map(); // socket.id -> { trekId, userId, username, location, isOffTrail }
    const groupIntervals = new Map(); // trekId -> intervalId
    const autoPausedTreks = new Set(); // trekId
    const trekPresence = new Map(); // trekId -> Map(userId -> { status, lastActive, username, profileImage, timeoutId })
    
    const getSanitizedPresence = (trekId) => {
        const presence = trekPresence.get(trekId);
        if (!presence) return {};
        const sanitized = {};
        presence.forEach((data, id) => {
            sanitized[id] = {
                status: data.status,
                username: data.username,
                profileImage: data.profileImage,
                lastActive: data.lastActive
            };
        });
        return sanitized;
    };

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        // Join Room (Lobby or Trek)
        socket.on("join-room", ({ roomId, userId, username }) => {
            socket.join(`room_${roomId}`);
            console.log(`User ${username} joined lobby room_${roomId}`);
        });
 
        // Join a specific trek room
        socket.on("join-trek", ({ trekId, userId, username, profileImage, leaderId }) => {
            const roomName = `trek_${trekId}`;
            socket.join(roomName);
            
            socketToUser.set(socket.id, { trekId, userId, username, leaderId, location: null });
            
            // Manage Presence
            if (!trekPresence.has(trekId)) {
                trekPresence.set(trekId, new Map());
            }
            const presence = trekPresence.get(trekId);
            
            // Clear any existing cleanup timeout if they are reconnecting
            if (presence.has(userId)) {
                const existing = presence.get(userId);
                if (existing.timeoutId) clearTimeout(existing.timeoutId);
            }

            presence.set(userId, { 
                status: 'active', 
                username, 
                profileImage,
                lastActive: Date.now(),
                timeoutId: null 
            });

            // Start centroid monitoring if not already started for this trek
            if (!groupIntervals.has(trekId)) {
                const intervalId = setInterval(() => {
                    calculateAndBroadcastGroupStats(trekId);
                }, 10000); // Every 10 seconds
                groupIntervals.set(trekId, intervalId);
            }

            // Notify everyone (including joiner) of the current state
            io.to(roomName).emit("participant-status-changed", { 
                userId, 
                username, 
                status: 'active',
                allParticipants: getSanitizedPresence(trekId)
            });

            console.log(`User ${username} (${userId}) joined room ${roomName} - Status: ACTIVE`);
        });

        socket.on("leave-trek", ({ trekId, userId, username }) => {
            const roomName = `trek_${trekId}`;
            const presence = trekPresence.get(trekId);
            
            if (presence && presence.has(userId)) {
                const p = presence.get(userId);
                if (p.timeoutId) clearTimeout(p.timeoutId);
                
                presence.set(userId, { ...p, status: 'left', lastActive: Date.now() });
                
                io.to(roomName).emit("participant-status-changed", {
                    userId,
                    username,
                    status: 'left',
                    allParticipants: getSanitizedPresence(trekId)
                });
            }
            
            socket.leave(roomName);
            socketToUser.delete(socket.id);
            console.log(`User ${username} explicitly LEFT trek ${trekId}`);
        });
 
        // Participant: Share current location
        socket.on("participant-location-update", ({ trekId, userId, username, profileImage, location, isOffTrail, distanceToTrail, leaderId }) => {
            // Update local state for centroid calculation
            const userData = socketToUser.get(socket.id);
            if (userData) {
                userData.location = location;
                userData.isOffTrail = isOffTrail;
                userData.leaderId = leaderId;
            }

            socket.to(`trek_${trekId}`).emit("participant-location-received", {
                userId,
                username,
                profileImage,
                location,
                isOffTrail,
                distanceToTrail,
                leaderId
            });
        });

        // Device Initialization Sync
        socket.on("device-ready", ({ trekId, userId, username, leaderId }) => {
            const roomName = `trek_${trekId}`;
            // Broadcast to others that I am ready
            socket.to(roomName).emit("participant-ready", { userId, username, leaderId });
        });

        // Leader: Specific Tracking Request (Zoom to member)
        socket.on("leader-track-member", ({ trekId, targetUserId }) => {
            socket.to(`trek_${trekId}`).emit("force-member-focus", { targetUserId });
        });

        // Leader: Broadcast control actions
        socket.on("trek-control", ({ trekId, action }) => {
            socket.to(`trek_${trekId}`).emit("trek-control-received", { action });
        });

        // Leader: Shared absolute trail point
        socket.on("trail-point-shared", ({ trekId, point, isNewSegment }) => {
            socket.to(`trek_${trekId}`).emit("trail-point-received", { point, isNewSegment });
        });
 
        // Leader: Full path replacement (e.g. loop removed)
        socket.on("trail-path-replaced", ({ trekId, path }) => {
            socket.to(`trek_${trekId}`).emit("trail-path-received", { path });
        });

        // Real-time Waypoint (Pin) Sync
        socket.on("waypoint-added", ({ trekId, waypoint }) => {
            socket.to(`trek_${trekId}`).emit("waypoint-received", { waypoint });
        });

        // Group Chat
        socket.on("send-message", ({ trekId, userId, username, text, profileImage }) => {
            const message = {
                id: Date.now().toString(),
                userId,
                username,
                text,
                profileImage,
                timestamp: new Date()
            };
            io.to(`trek_${trekId}`).emit("message-received", message);
        });
 
        // Drift notification broadcast
        socket.on("drift-notification", ({ trekId, userId, username, isOffTrail }) => {
            socket.to(`trek_${trekId}`).emit("drift-notification", {
                userId,
                username,
                isOffTrail
            });
        });

        socket.on("disconnect", () => {
            const userData = socketToUser.get(socket.id);
            if (userData) {
                const { trekId, userId, username } = userData;
                const presence = trekPresence.get(trekId);
                
                if (presence && presence.has(userId)) {
                    const p = presence.get(userId);
                    
                    // Mark as Inactive
                    presence.set(userId, { ...p, status: 'inactive', lastActive: Date.now() });
                    
                    io.to(`trek_${trekId}`).emit("participant-status-changed", {
                        userId,
                        username,
                        status: 'inactive',
                        allParticipants: getSanitizedPresence(trekId)
                    });

                    // Set timer to mark as 'left' after 2 minutes of inactivity
                    p.timeoutId = setTimeout(() => {
                        const currentPresence = presence.get(userId);
                        if (currentPresence && currentPresence.status === 'inactive') {
                            presence.set(userId, { ...currentPresence, status: 'left', timeoutId: null });
                            io.to(`trek_${trekId}`).emit("participant-status-changed", {
                                userId,
                                username,
                                status: 'left',
                                allParticipants: getSanitizedPresence(trekId)
                            });
                        }
                    }, 120000); // 2 minutes
                }

                socketToUser.delete(socket.id);

                // If trek room is empty, clear interval
                const roomName = `trek_${trekId}`;
                const clientsInRoom = io.sockets.adapter.rooms.get(roomName);
                if (!clientsInRoom || clientsInRoom.size === 0) {
                    const activeUsers = Array.from(presence?.values() || []).filter(p => p.status === 'active');
                    if (activeUsers.length === 0) {
                        if (groupIntervals.has(trekId)) {
                            clearInterval(groupIntervals.get(trekId));
                            groupIntervals.delete(trekId);
                        }
                    }
                }
            }
        });
    });

    // Helper: Centroid & Safety Monitoring
    function calculateAndBroadcastGroupStats(trekId) {
        const roomName = `trek_${trekId}`;
        // Only include ACTIVE users with valid locations for stats
        const usersInTrek = Array.from(socketToUser.values()).filter(u => {
            if (u.trekId !== trekId || !u.location) return false;
            const presence = trekPresence.get(trekId)?.get(u.userId);
            return presence?.status === 'active';
        });
        
        if (usersInTrek.length === 0) return;

        // 1. Calculate Centroid
        let sumLat = 0, sumLon = 0;
        usersInTrek.forEach(u => {
            sumLat += u.location.latitude;
            sumLon += u.location.longitude;
        });
        const centroid = { latitude: sumLat / usersInTrek.length, longitude: sumLon / usersInTrek.length };

        // 2. Broadcast Centroid (for heatmap/clustering)
        io.to(roomName).emit("group-centroid", { centroid, memberCount: usersInTrek.length });

        // 3. Safety Monitoring: Deviation Check
        const leader = usersInTrek.find(u => u.userId === u.leaderId);
        const anchor = leader ? leader.location : centroid;

        let anyDeviation = false;
        usersInTrek.forEach(u => {
            if (!u.location) return;
            const dist = getDistance(u.location.latitude, u.location.longitude, anchor.latitude, anchor.longitude);
            
            if (dist > 15) { // 15m Threshold
                anyDeviation = true;
                io.to(roomName).emit("safety-alert", {
                    userId: u.userId,
                    username: u.username,
                    deviation: Math.round(dist),
                    anchor
                });

                // AUTO-PAUSE: Notify all that trek is paused due to safety
                if (!autoPausedTreks.has(trekId)) {
                    autoPausedTreks.add(trekId);
                    io.to(roomName).emit("trek-control-received", { 
                        action: 'PAUSE',
                        reason: 'SAFETY_DEVIATION',
                        username: u.username 
                    });
                }
            }
        });

        // AUTO-RESUME: If everyone is back and we were auto-paused
        if (!anyDeviation && autoPausedTreks.has(trekId)) {
            autoPausedTreks.delete(trekId);
            io.to(roomName).emit("trek-control-received", { 
                action: 'RESUME',
                reason: 'SAFETY_DEVIATION'
            });
        }
    }
};

// Helper: Haversine distance
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const getIO = () => io;
