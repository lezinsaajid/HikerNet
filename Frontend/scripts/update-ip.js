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

async function getNgrokUrl() {
    try {
        const response = await fetch('http://127.0.0.1:4040/api/tunnels');
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        const httpsTunnel = data.tunnels.find(t => t.public_url.startsWith('https://'));
        return httpsTunnel ? httpsTunnel.public_url : null;
    } catch (error) {
        // ngrok is likely not running
        return null;
    }
}

const frontendEnvPath = path.join(__dirname, '..', '.env');
const backendEnvPath = path.join(__dirname, '..', '..', 'Backend', '.env');

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

async function main() {
    let apiURL;
    let baseURL;

    console.log("[IP Script] Checking for active ngrok tunnel...");
    const ngrokUrl = await getNgrokUrl();

    if (ngrokUrl) {
        console.log(`[IP Script] Detected Ngrok URL: ${ngrokUrl}`);
        apiURL = `${ngrokUrl}/api`;
        baseURL = ngrokUrl;
    } else {
        const localIP = getLocalIP();
        console.log(`[IP Script] No ngrok tunnel found. Using Local IP: ${localIP}`);
        apiURL = `http://${localIP}:3000/api`;
        baseURL = `http://${localIP}:3000`;
    }

    // Update Frontend
    updateEnv(frontendEnvPath, 'EXPO_PUBLIC_API_URL', apiURL);

    // Update Backend (for keep-alive/internal use)
    updateEnv(backendEnvPath, 'API_URL', baseURL);
}

main();
