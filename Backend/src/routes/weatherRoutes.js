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

        console.log(`[Weather] Current Request for Lat: ${lat}, Lon: ${lon}`);

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

        const endpoint = apiBase.endsWith('/weather') ? apiBase : `${apiBase}/weather`;
        const url = `${endpoint}?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

        console.log(`[Weather] Fetching current real data`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Weather API responded with status: ${response.status}`);

        const data = await response.json();
        const weatherData = {
            temp: data.main?.temp ?? 0,
            condition: data.weather?.[0]?.main ?? "Unknown",
            humidity: data.main?.humidity ?? 0,
            wind: data.wind?.speed ?? 0,
            city: data.name ?? "Unknown Location"
        };

        res.json(weatherData);
    } catch (error) {
        console.error("[Weather] Route Error:", error.message);
        res.status(500).json({ temp: 0, condition: "Service Unavailable", city: "N/A", error: error.message });
    }
});

router.get("/forecast", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ message: "Latitude and Longitude required" });
        }

        const apiKey = process.env.API_KEY || process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
        const apiBase = (process.env.API_BASE || process.env.WEATHER_API_BASE || "https://api.openweathermap.org/data/2.5").replace(/\/weather$/, "");

        console.log(`[Weather] Forecast Request for Lat: ${lat}, Lon: ${lon}`);

        if (!apiKey) {
            console.log("[Weather] No API key found, returning mock forecast");
            return res.json({
                list: [
                    { dt: Date.now() / 1000, main: { temp: 20 }, weather: [{ main: "Clear" }] },
                    { dt: (Date.now() / 1000) + 86400, main: { temp: 22 }, weather: [{ main: "Clouds" }] }
                ]
            });
        }

        const url = `${apiBase}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Forecast API responded with status: ${response.status}`);

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("[Weather] Forecast Route Error:", error.message);
        res.status(500).json({ message: "Error fetching forecast", error: error.message });
    }
});

export default router;
