import express from "express";
import Room from "../models/Room.js";
import User from "../models/User.js";
import Trek from "../models/Trek.js";
import protectRoute from "../middleware/auth.middleware.js";
import crypto from 'crypto';

const router = express.Router();

// Invite User to Room
router.post("/invite", protectRoute, async (req, res) => {
    try {
        const { roomId, targetUserId } = req.body;

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: "Room not found" });

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Check if already in room
        const isMember = room.members.some(m => m.user.toString() === targetUserId) || room.leader.toString() === targetUserId;
        if (isMember) {
            return res.status(400).json({ message: "User is already in the room" });
        }

        // Check cooldown (30s)
        const existingInvite = targetUser.trekInvitations && targetUser.trekInvitations.find(inv => inv.roomId && inv.roomId.toString() === roomId && inv.inviter && inv.inviter.id && inv.inviter.id.toString() === req.user._id.toString());

        if (existingInvite) {
            const timeDiff = Date.now() - new Date(existingInvite.sentAt).getTime();
            if (timeDiff < 30000) {
                return res.status(429).json({ message: "Please wait 30s before resending invite." });
            }
            // Update timestamp
            existingInvite.sentAt = Date.now();
        } else {
            // Add new invite
            if (!targetUser.trekInvitations) targetUser.trekInvitations = [];
            targetUser.trekInvitations.push({
                roomId: room._id,
                roomCode: room.code,
                trekName: room.trekName,
                inviter: {
                    id: req.user._id,
                    username: req.user.username
                },
                sentAt: Date.now()
            });
        }

        await targetUser.save();
        res.json({ message: "Invitation sent!" });

    } catch (error) {
        console.error("Error sending invite:", error);
        res.status(500).json({ message: "Error sending invite" });
    }
});

// Helper to generate 7-char alphanumeric code
const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Create a Room (Leader)
router.post("/create", protectRoute, async (req, res) => {
    try {
        const { trekName, trekDescription, startLocation } = req.body;

        let code = generateRoomCode();
        // Ensure uniqueness (simple retry)
        let existing = await Room.findOne({ code });
        while (existing) {
            code = generateRoomCode();
            existing = await Room.findOne({ code });
        }

        const newRoom = new Room({
            code,
            leader: req.user._id,
            trekName: trekName || "Group Trek",
            trekDescription: trekDescription || "",
            startLocation: startLocation || "",
            members: [], // Leader is implicit, but let's add them to members too? No, keep separate or add as member?
            // Let's add leader as a member too for easier map rendering, but mark them as special in Leader field.
            members: [{ user: req.user._id, isReady: true }] // Leader is always ready
        });

        await newRoom.save();

        const populatedRoom = await Room.findById(newRoom._id)
            .populate("leader", "username profileImage")
            .populate("members.user", "username profileImage");

        res.status(201).json(populatedRoom);
    } catch (error) {
        console.error("Error creating room:", error);
        res.status(500).json({ message: "Error creating room" });
    }
});

// Join Request (Member)
router.post("/join", protectRoute, async (req, res) => {
    try {
        const { code } = req.body;
        const room = await Room.findOne({ code, isActive: true });

        if (!room) {
            return res.status(404).json({ message: "Room not found or inactive" });
        }

        // Check if already member
        const isMember = room.members.some(m => m.user.toString() === req.user._id.toString());
        if (isMember) {
            return res.status(400).json({ message: "You are already in this room", roomId: room._id });
        }

        // Check if already requested
        const isRequested = room.requests.some(r => r.user.toString() === req.user._id.toString());
        if (isRequested) {
            return res.status(400).json({ message: "Join request already sent", roomId: room._id });
        }

        room.requests.push({ user: req.user._id });
        await room.save();

        res.json({ message: "Join request sent", roomId: room._id });
    } catch (error) {
        console.error("Error joining room:", error);
        res.status(500).json({ message: "Error joining room" });
    }
});

// Get Room Status (Polling)
router.get("/:id", protectRoute, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id)
            .populate("leader", "username profileImage")
            .populate("members.user", "username profileImage")
            .populate("requests.user", "username profileImage");

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        res.json(room);
    } catch (error) {
        console.error("Error fetching room:", error);
        res.status(500).json({ message: "Error fetching room" });
    }
});

// Accept Request (Leader)
router.post("/accept", protectRoute, async (req, res) => {
    try {
        const { roomId, userId } = req.body;
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.leader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only leader can accept requests" });
        }

        // Move from requests to members
        const requestIndex = room.requests.findIndex(r => r.user.toString() === userId);
        if (requestIndex === -1) {
            return res.status(400).json({ message: "Request not found" });
        }

        room.requests.splice(requestIndex, 1);
        room.members.push({ user: userId, isReady: false }); // New members not ready by default

        await room.save();

        // Return updated room
        const updatedRoom = await Room.findById(roomId)
            .populate("leader", "username profileImage")
            .populate("members.user", "username profileImage")
            .populate("requests.user", "username profileImage");

        res.json(updatedRoom);
    } catch (error) {
        console.error("Error accepting request:", error);
        res.status(500).json({ message: "Error accepting request" });
    }
});

// Reject Request (Leader)
router.post("/reject", protectRoute, async (req, res) => {
    try {
        const { roomId, userId } = req.body;
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.leader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only leader can reject requests" });
        }

        room.requests = room.requests.filter(r => r.user.toString() !== userId);
        await room.save();

        res.json({ message: "Request rejected" });
    } catch (error) {
        console.error("Error rejecting request:", error);
        res.status(500).json({ message: "Error rejecting request" });
    }
});

// Remove Member (Leader) or Leave Room (Member)
router.post("/leave", protectRoute, async (req, res) => {
    try {
        const { roomId, userId } = req.body; // userId is optional if self-leaving
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ message: "Room not found" });

        const targetId = userId || req.user._id.toString();
        const isLeader = room.leader.toString() === req.user._id.toString();

        if (!isLeader && targetId !== req.user._id.toString()) {
            return res.status(403).json({ message: "You can only remove yourself" });
        }

        if (isLeader && targetId === req.user._id.toString()) {
            // Leader leaving -> Close room? Or assign new leader? 
            // Requirement says leader can remove users. If leader leaves, let's close room for now.
            room.isActive = false;
            await room.save();
            return res.json({ message: "Room closed" });
        }

        room.members = room.members.filter(m => m.user.toString() !== targetId);
        await room.save();

        res.json({ message: "Member removed/left" });
    } catch (error) {
        console.error("Error leaving room:", error);
        res.status(500).json({ message: "Error leaving room" });
    }
});

// Toggle Ready (Member)
router.post("/ready", protectRoute, async (req, res) => {
    try {
        const { roomId, isReady } = req.body;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: "Room not found" });

        const member = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!member) return res.status(403).json({ message: "You are not a member of this room" });

        member.isReady = isReady;
        await room.save();

        res.json(room);
    } catch (error) {
        console.error("Error toggling ready:", error);
        res.status(500).json({ message: "Error toggling ready" });
    }
});

// Start Trek (Leader)
router.post("/start", protectRoute, async (req, res) => {
    try {
        const { roomId } = req.body;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: "Room not found" });

        if (room.leader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only leader can start the trek" });
        }

        // Validate all members are ready
        const allReady = room.members.every(m => m.isReady);
        if (!allReady) {
            return res.status(400).json({ message: "Not all members are ready" });
        }

        // Create Trek object via existing logic or new logic?
        // Let's create a Trek entry and link it.
        const newTrek = new Trek({
            user: req.user._id, // Leader owns the trek record for now? 
            // Or maybe created Group Trek model? Re-using Trek model.
            // Trek model has 'user' field.
            name: room.trekName,
            description: room.trekDescription,
            location: room.startLocation || "Unknown",
            mode: "group",
            participants: room.members.map(m => m.user), // Assuming Trek model has participants field (need to check/add)
            status: "active"
        });

        await newTrek.save();

        room.trekId = newTrek._id;
        await room.save();

        res.json({ trekId: newTrek._id });
    } catch (error) {
        console.error("Error starting group trek:", error);
        res.status(500).json({ message: "Error starting group trek" });
    }
});


export default router;
