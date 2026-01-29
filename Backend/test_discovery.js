const BASE_URL = 'http://localhost:3000/api';

async function testDiscovery() {
    console.log("Testing Trek Discovery (OSM) endpoints...");

    // 1. Search by name
    console.log("\n1. Searching for 'Bright Angel Trail'...");
    try {
        const resSearch = await fetch(`${BASE_URL}/treks/discover?q=Bright Angel Trail`);
        const dataSearch = await resSearch.json();
        console.log(`   Found ${dataSearch.length} trails.`);
        if (dataSearch.length > 0) {
            console.log("   First result:", dataSearch[0].name, `(OSM ID: ${dataSearch[0].osmId})`);

            // 2. Get details for the first result
            console.log(`\n2. Fetching details for OSM ID: ${dataSearch[0].osmId}...`);
            const resDetails = await fetch(`${BASE_URL}/treks/discover/${dataSearch[0].osmId}?type=${dataSearch[0].type}`);
            const dataDetails = await resDetails.json();
            console.log("   Name:", dataDetails.name);
            console.log("   Coordinates Count:", dataDetails.coordinates.length);
        }
    } catch (e) {
        console.error("   Discovery Error:", e.message);
    }

    // 3. Search by location (Simulating near a known hiking area - e.g., Boulder, CO)
    console.log("\n3. Searching near Boulder, CO (Lat: 40.015, Lon: -105.27)...");
    try {
        const resLoc = await fetch(`${BASE_URL}/treks/discover?lat=40.015&lon=-105.27&radius=10000`);
        const dataLoc = await resLoc.json();
        console.log(`   Found ${dataLoc.length} trails nearby.`);
        if (dataLoc.length > 0) {
            console.log("   Nearby trail:", dataLoc[0].name);
        }
    } catch (e) {
        console.error("   Location Discovery Error:", e.message);
    }
}

testDiscovery();
