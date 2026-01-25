import express from "express";

const router = express.Router();

router.get("/current", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ message: "Latitude and Longitude required" });
        }

        const apiKey = process.env.API_KEY || process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
        const apiBase = process.env.API_BASE || process.env.WEATHER_API_BASE || "https://api.openweathermap.org/data/2.5";

        console.log(`[Weather] Request for Lat: ${lat}, Lon: ${lon}`);

        if (!apiKey) {
            console.log("[Weather] No API key found, returning mock data");
            return res.json({
                temp: 18.5,
                condition: "Cloudy",
                humidity: 65,
                wind: 4.2,
                city: "Trail Mountain (Mock)"
            });
        }

        // Combine API_BASE with /weather endpoint
        const endpoint = apiBase.endsWith('/weather') ? apiBase : `${apiBase}/weather`;
        const url = `${endpoint}?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

        console.log(`[Weather] Fetching real data from: ${endpoint}`);
        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Weather] API Error (${response.status}):`, errorText);
            throw new Error(`Weather API responded with status: ${response.status}`);
        }

        const data = await response.json();

        // Transform data to flat structure expected by frontend
        const weatherData = {
            temp: data.main?.temp ?? 0,
            condition: data.weather?.[0]?.main ?? "Unknown",
            humidity: data.main?.humidity ?? 0,
            wind: data.wind?.speed ?? 0,
            city: data.name ?? "Unknown Location"
        };

        console.log("[Weather] Success:", weatherData.city, weatherData.temp);
        res.json(weatherData);

    } catch (error) {
        console.error("[Weather] Route Error:", error.message);
        res.status(500).json({
            temp: 0,
            condition: "Service Unavailable",
            city: "N/A",
            error: error.message
        });
    }
});

export default router;
