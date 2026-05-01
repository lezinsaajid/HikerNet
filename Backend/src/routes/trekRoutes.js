import express from "express";
import protectRoute from "../middleware/auth.middleware.js";
import * as trekController from "../controllers/trek.controller.js";

const router = express.Router();

// Start a new trek
router.post("/start", protectRoute, trekController.startTrek);

// Discover trails (External OSM)
router.get("/discover", trekController.searchTrails);

// Get OSM trail details
router.get("/discover/:osmId", trekController.getOSMTrailDetails);

// Get public feed (all public treks)
router.get("/feed/public", trekController.getPublicFeed);

// Get user's treks
router.get("/user/:userId", trekController.getUserTreks);

// Get nearby treks (Local DB)
router.get("/nearby", trekController.getNearbyTreks);

// Update trek (add points, update stats, finish)
router.put("/update/:id", protectRoute, trekController.updateTrek);

// Get a specific trek
router.get("/:id", trekController.getTrekById);

// Sync offline data (Bulk upload of treks)
router.post("/sync", protectRoute, trekController.syncTreks);

// Delete a trek
router.delete("/:id", protectRoute, trekController.deleteTrek);

export default router;

