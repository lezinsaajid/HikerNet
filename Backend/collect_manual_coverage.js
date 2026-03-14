import fs from 'fs';
import path from 'path';

const COVERAGE_URL = 'http://localhost:3000/api/coverage';
const OUTPUT_DIR = './coverage/manual';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'coverage-final.json');

async function collect() {
    console.log(`Connecting to ${COVERAGE_URL}...`);
    try {
        const response = await fetch(COVERAGE_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch coverage: ${response.statusText}`);
        }
        const coverageData = await response.json();
        
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(coverageData));
        console.log(`✅ Coverage data saved to ${OUTPUT_FILE}`);
    } catch (error) {
        console.error('❌ Error collecting coverage:', error.message);
        console.log('Hint: Make sure the server is running with "npm run test:manual"');
    }
}

collect();
