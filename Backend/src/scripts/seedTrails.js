
import mongoose from "mongoose";
import axios from "axios";
import osmtogeojson from "osmtogeojson";
import "dotenv/config";
import Trek from "../models/Trek.js";
import User from "../models/User.js";
import { connectDB } from "../lib/db.js";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// Kerala Area ID or just use area name search in Overpass
// A rough bounding box for Kerala is sufficient for testing if area search fails, 
// but area search is better.

const seedTrails = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        // 1. Create System User
        let systemUser = await User.findOne({ email: "system@hikernet.com" });
        if (!systemUser) {
            systemUser = await User.create({
                fullName: "System Admin",
                email: "system@hikernet.com",
                password: "systempassword123", // Should be hashed in real scenario if login needed
                username: "hikernet_system"
            });
            console.log("System user created");
        } else {
            console.log("System user already exists");
        }

        // 2. Query Overpass API
        // Query for named hiking trails in Kerala
        const query = `
            [out:json][timeout:90];
            (
              area["name"="Kerala"]->.kerala;
              area["name"="Wayanad"]->.wayanad;
            );
            (
              // Kerala broad search
              way["highway"~"path|footway|track"]["name"](area.kerala);
              relation["route"="hiking"](area.kerala);
              
              // Wayanad specific deeper search
              way["highway"~"path|footway|track"](area.wayanad); // Even unnamed paths in Wayanad
              way["leisure"~"nature_reserve|park"](area.wayanad);
              way["tourism"~"attraction|viewpoint"](area.wayanad);
              node["tourism"~"attraction|viewpoint"](area.wayanad); // Nodes might be points of interest, maybe skip if just points
              relation["leisure"~"nature_reserve"](area.wayanad);
            );
            out body;
            >;
            out skel qt;
        `;

        console.log("Fetching data from Overpass API...");
        const response = await axios.post(OVERPASS_API, query, {
            headers: { "Content-Type": "text/plain" } // Overpass expects raw query body
        });

        if (!response.data) {
            throw new Error("No data received from Overpass");
        }

        const osmData = response.data;
        const geoJsonIdx = osmtogeojson(osmData);

        console.log(`Fetched ${geoJsonIdx.features.length} features`);

        let count = 0;
        for (const feature of geoJsonIdx.features) {
            if (feature.geometry.type !== "LineString" &&
                feature.geometry.type !== "MultiLineString" &&
                feature.geometry.type !== "Polygon") continue;

            const { name, description, vehicle } = feature.properties;
            const tags = feature.properties || {};

            // Determine if we should keep this feature
            // 1. Must be a trail/path/footway OR nature reserve/attraction
            // 2. Must define "isInterest" if no name (e.g. nature reserve area)
            // 3. Keep all named hiking routes

            const isNature = tags.leisure === 'nature_reserve' || tags.leisure === 'park';
            const isAttraction = tags.tourism === 'attraction' || tags.tourism === 'viewpoint';
            const isPath = tags.highway === 'path' || tags.highway === 'footway' || tags.highway === 'track';

            // If it has no name, only keep if it's a specific nature attraction or explicitly requested
            // But for Wayanad, even unnamed paths might be useful if we give them a generic name?
            // Let's rely on name OR isNature/isAttraction

            if (!name && !isNature && !isAttraction) continue; // Skip unnamed regular paths to avoid clutter

            if (vehicle === "yes") continue;

            // Convert geometry
            let coordinates = [];
            if (feature.geometry.type === "LineString") {
                coordinates = feature.geometry.coordinates.map(coord => ({
                    longitude: coord[0],
                    latitude: coord[1]
                }));
            } else if (feature.geometry.type === "MultiLineString") {
                const flatten = feature.geometry.coordinates.flat();
                coordinates = flatten.map(coord => ({
                    longitude: coord[0],
                    latitude: coord[1]
                }));
            } else if (feature.geometry.type === "Polygon") {
                // Polygon outer ring
                if (feature.geometry.coordinates.length > 0) {
                    coordinates = feature.geometry.coordinates[0].map(coord => ({
                        longitude: coord[0],
                        latitude: coord[1]
                    }));
                }
            }

            if (coordinates.length < 2) continue;

            // Generate a name if missing
            let finalName = name;
            if (!finalName) {
                if (isNature) finalName = "Nature Reserve Trail";
                else if (isAttraction) finalName = "Scenic Spot Trail";
                else finalName = "Unnamed Trail";

                // Append partial location if available to make it unique-ish
                if (tags['addr:city']) finalName += ` (${tags['addr:city']})`;
            }

            const trekData = {
                user: systemUser._id,
                name: finalName,
                description: description || tags.note || "Imported from OpenStreetMap",
                location: tags['addr:city'] || "Kerala, India",
                coordinates: coordinates,
                mode: "solo",
                status: "completed",
                privacy: "public"
            };

            // key unique by name + user + approx first coord?
            // existing check by name is too strict if we have many "Nature Reserve Trail"
            // lets check also by first coordinate roughly?
            // For now stick to name + user, but if we use duplicate names for unnamed stuff, we might skip.
            // So let's skip "Unnamed..." duplicates or append ID?

            // Simplification: if name is generic, we might skip duplicates.
            // Let's just try to create.

            const existing = await Trek.findOne({ name: finalName, user: systemUser._id });
            if (!existing) {
                await Trek.create(trekData);
                count++;
                console.log(`Imported: ${finalName}`);
            } else {
                console.log(`Skipped existing: ${finalName}`);
            }
        }

        console.log(`Successfully imported ${count} trails.`);
        process.exit(0);

    } catch (error) {
        console.error("Error seeding trails:", error);
        process.exit(1);
    }
};

seedTrails();
