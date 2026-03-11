const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    
    // On Mac, en0 is usually Wi-Fi. Check it first.
    if (interfaces['en0']) {
        for (const iface of interfaces['en0']) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const frontendEnvPath = path.join(__dirname, '..', '.env');
const backendEnvPath = path.join(__dirname, '..', '..', 'Backend', '.env');
const localIP = getLocalIP();
const apiURL = `http://${localIP}:3000/api`;
const baseURL = `http://${localIP}:3000`;

console.log(`[IP Script] Detected Local IP: ${localIP}`);

function updateEnv(filePath, key, value) {
    if (!fs.existsSync(filePath)) {
        console.log(`[IP Script] Skipping missing file: ${filePath}`);
        return;
    }

    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newEntry = `${key}=${value}`;

        if (regex.test(content)) {
            content = content.replace(regex, newEntry);
        } else {
            content += (content.endsWith('\n') || content === '' ? '' : '\n') + newEntry + '\n';
        }

        fs.writeFileSync(filePath, content);
        console.log(`[IP Script] Updated ${path.basename(filePath)}: ${newEntry}`);
    } catch (error) {
        console.error(`[IP Script] Error updating ${filePath}: ${error.message}`);
    }
}

// Update Frontend
updateEnv(frontendEnvPath, 'EXPO_PUBLIC_API_URL', apiURL);

// Update Backend (for keep-alive/internal use)
updateEnv(backendEnvPath, 'API_URL', baseURL);
