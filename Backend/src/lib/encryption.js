import crypto from 'crypto';
import "dotenv/config";

const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

if (!ENCRYPTION_KEY) {
    console.warn("WARNING: CHAT_ENCRYPTION_KEY is not set. Chat encryption will fail or be skipped.");
}

function encrypt(text) {
    if (!text) return text;
    if (!ENCRYPTION_KEY) return text;

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error("Encryption error:", error);
        return text; // Fallback? Or throw? For now fallback to avoid crash
    }
}

function decrypt(text) {
    if (!text) return text;
    if (!ENCRYPTION_KEY) return text;

    try {
        const textParts = text.split(':');
        // Simple check to see if it looks like our encrypted format (hex:hex)
        // If not, assume it's legacy plain text
        if (textParts.length !== 2) return text;

        const iv = Buffer.from(textParts.shift(), 'hex');
        if (iv.length !== IV_LENGTH) return text; // Not a valid IV, assume plain text

        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        // If decryption fails (e.g. wrong key, or it wasn't actually encrypted), return original
        // console.error("Decryption error (returning original):", error.message);
        return text;
    }
}

export { encrypt, decrypt };
