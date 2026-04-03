const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://lezinsajid_db_user:kpVQc1LAueBOmlq6@ac-mlbjt13-shard-00-00.rds7zvo.mongodb.net:27017,ac-mlbjt13-shard-00-01.rds7zvo.mongodb.net:27017,ac-mlbjt13-shard-00-02.rds7zvo.mongodb.net:27017/?ssl=true&replicaSet=atlas-qs7fsl-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

mongoose.connect(MONGO_URI).then(async () => {
    const db = mongoose.connection.db;
    const treks = await db.collection('treks').find({}).sort({ createdAt: -1 }).limit(3).toArray();
    
    console.log("Found " + treks.length + " treks");
    for(const trek of treks) {
        console.log("Trek Name:", trek.name);
        if(!trek.path || !trek.path.coordinates) {
             console.log("No path coordinates");
             continue;
        }
        let startCoord;
        if (Array.isArray(trek.path.coordinates[0][0])) {
            startCoord = trek.path.coordinates[0][0];
        } else {
            startCoord = trek.path.coordinates[0];
        }
        console.log("Start Coord:", startCoord);
        
        // Mock user location same as start coord
        const dist = getDistanceFromLatLonInKm(startCoord[1], startCoord[0], startCoord[1], startCoord[0]);
        console.log("Distance from itself:", dist);
    }
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
