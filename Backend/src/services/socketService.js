import Trek from '../models/Trek.js';
import Room from '../models/Room.js';

let io;

export const initSocket = (socketIo) => {
    io = socketIo;

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        // Join a specific trek room
        socket.on("join-trek", ({ trekId, userId }) => {
            socket.join(`trek_${trekId}`);
            console.log(`User ${userId} joined room trek_${trekId}`);
        });

        // Leader: Shared absolute trail point
        socket.on("trail-point-shared", ({ trekId, point, isNewSegment }) => {
            // Broadcast to all participants in the room
            socket.to(`trek_${trekId}`).emit("trail-point-received", { point, isNewSegment });
        });

        // Participant: Share current location to leader
        socket.on("participant-location-update", ({ trekId, userId, username, location, isOffTrail, distanceToTrail }) => {
            // Send only to the room, but client-side logic will ensure only leader processes it or 
            // we could emit to a leader-specific event. 
            // For simplicity, we broadcast to the room, and other members filter it out.
            socket.to(`trek_${trekId}`).emit("participant-location-received", {
                userId,
                username,
                location,
                isOffTrail,
                distanceToTrail
            });
        });

        // Leader: Broadcast control actions (Pause, Stop, Start)
        socket.on("trek-control", ({ trekId, action }) => {
            socket.to(`trek_${trekId}`).emit("trek-control-received", { action });
        });

        // Real-time Waypoint (Pin) Sync
        socket.on("waypoint-added", ({ trekId, waypoint }) => {
            socket.to(`trek_${trekId}`).emit("waypoint-received", { waypoint });
        });

        // Drift alert specifically for Leader's attention
        socket.on("drift-alert", ({ trekId, userId, username, distance }) => {
            socket.to(`trek_${trekId}`).emit("drift-notification", {
                userId,
                username,
                distance,
                message: `${username} has left the trail (${Math.round(distance)}m off).`
            });
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });
};

export const getIO = () => io;
