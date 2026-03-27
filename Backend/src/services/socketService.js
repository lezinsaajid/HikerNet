import Trek from '../models/Trek.js';
import Room from '../models/Room.js';

let io;

export const initSocket = (socketIo) => {
    io = socketIo;

    const socketToUser = new Map(); // socket.id -> { trekId, userId, username }

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);
 
        // Join a specific trek room
        socket.on("join-trek", ({ trekId, userId, username }) => {
            const roomName = `trek_${trekId}`;
            socket.join(roomName);
            
            socketToUser.set(socket.id, { trekId, userId, username });
            
            // Notify others
            socket.to(roomName).emit("participant-joined", { userId, username });
            console.log(`User ${username} (${userId}) joined room ${roomName}`);
        });
 
        // Leader: Shared absolute trail point
        socket.on("trail-point-shared", ({ trekId, point, isNewSegment }) => {
            socket.to(`trek_${trekId}`).emit("trail-point-received", { point, isNewSegment });
        });
 
        // Participant: Share current location
        socket.on("participant-location-update", ({ trekId, userId, username, location, isOffTrail, distanceToTrail }) => {
            socket.to(`trek_${trekId}`).emit("participant-location-received", {
                userId,
                username,
                location,
                isOffTrail,
                distanceToTrail
            });
        });
 
        // Leader: Broadcast control actions
        socket.on("trek-control", ({ trekId, action }) => {
            socket.to(`trek_${trekId}`).emit("trek-control-received", { action });
        });
 
        // Real-time Waypoint (Pin) Sync
        socket.on("waypoint-added", ({ trekId, waypoint }) => {
            socket.to(`trek_${trekId}`).emit("waypoint-received", { waypoint });
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
                const { trekId, username } = userData;
                socket.to(`trek_${trekId}`).emit("participant-left", { username });
                socketToUser.delete(socket.id);
                console.log(`User ${username} left room trek_${trekId}`);
            }
            console.log("Client disconnected:", socket.id);
        });
    });
};

export const getIO = () => io;
