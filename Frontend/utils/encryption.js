import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

// Polyfill for tweetnacl PRNG
try {
    nacl.setPRNG((x, n) => {
        const randomBytes = Crypto.getRandomBytes(n);
        for (let i = 0; i < n; i++) {
            x[i] = randomBytes[i];
        }
    });
} catch (e) { console.log("PRNG likely already set", e); }

// Keys storage keys
const KEY_PAIR_STORAGE_KEY = 'user_keys_v1';
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // tweetnacl secretbox key length

// Generate new keypair and save to SecureStore
export const generateAndSaveKeys = async () => {
    try {
        const keyPair = nacl.box.keyPair();
        const keys = {
            publicKey: encodeBase64(keyPair.publicKey),
            secretKey: encodeBase64(keyPair.secretKey)
        };
        await SecureStore.setItemAsync(KEY_PAIR_STORAGE_KEY, JSON.stringify(keys));

        console.log("Generated new E2EE Interaction Keys");
        return keys;
    } catch (error) {
        console.error("Error generating keys:", error);
        throw error;
    }
};

// Get keys from SecureStore
export const getKeys = async () => {
    try {
        const keys = await SecureStore.getItemAsync(KEY_PAIR_STORAGE_KEY);
        return keys ? JSON.parse(keys) : {};
    } catch (e) {
        console.error("Error retrieving keys", e);
        return {};
    }
};

export const saveKeys = async (keys) => {
    await SecureStore.setItemAsync(KEY_PAIR_STORAGE_KEY, JSON.stringify(keys));
};

// Helper to convert WordArray to Uint8Array/Buffer
const wordArrayToBuffer = (wordArray) => {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        u8[i] = byte;
    }
    return Buffer.from(u8);
};

// DERIVE KEY FROM PASSWORD
const deriveKey = async (password, saltBuffer) => {
    // PBKDF2 in crypto-js takes salt as specific type? It handles strings well.
    // But we have saltBuffer (Buffer/Uint8Array).
    // Let's convert salt buffer to Hex string for Crypto-JS
    const saltHex = saltBuffer.toString('hex');

    const derived = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(saltHex), {
        keySize: KEY_LENGTH * 8 / 32, // keySize is in 32-bit words. 32 bytes = 256 bits. 256/32 = 8 words.
        iterations: ITERATIONS,
        hasher: CryptoJS.algo.SHA256
    });

    return wordArrayToBuffer(derived);
};

export const encryptPrivateKey = async (privateKeyBase64, password) => {
    try {
        // 1. Generate Salt
        const salt = await Crypto.getRandomBytesAsync(16);
        const saltBuffer = Buffer.from(salt);

        // 2. Derive Key
        const key = await deriveKey(password, saltBuffer); // Uint8Array

        // 3. Encrypt
        const nonce = await Crypto.getRandomBytesAsync(nacl.secretbox.nonceLength);
        const message = decodeBase64(privateKeyBase64);
        const box = nacl.secretbox(message, nonce, key);

        return {
            encryptedPrivateKey: encodeBase64(nonce) + ":" + encodeBase64(box),
            salt: encodeBase64(saltBuffer)
        };
    } catch (error) {
        console.error("Encryption failed", error);
        throw error;
    }
};

export const decryptPrivateKey = async (encryptedBundle, saltBase64, password) => {
    try {
        const [nonceB64, boxB64] = encryptedBundle.split(':');
        const nonce = decodeBase64(nonceB64);
        const box = decodeBase64(boxB64);
        const salt = decodeBase64(saltBase64);

        const key = await deriveKey(password, Buffer.from(salt));

        const decrypted = nacl.secretbox.open(box, nonce, key);

        if (!decrypted) {
            throw new Error("Could not decrypt key (Wrong password?)");
        }

        return encodeBase64(decrypted);
    } catch (error) {
        console.error("Decryption failed", error);
        throw error;
    }
};

// Encrypt message for a receiver
export const encryptMessage = async (message, receiverPublicKeyBase64) => {
    try {
        if (!message || !receiverPublicKeyBase64) return message;

        const receiverPublicKey = decodeBase64(receiverPublicKeyBase64);
        const { secretKey } = await getKeys();
        if (!secretKey) throw new Error("No private key found");

        const mySecretKey = decodeBase64(secretKey);

        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const messageUint8 = new TextEncoder().encode(message);

        const encrypted = nacl.box(messageUint8, nonce, receiverPublicKey, mySecretKey);

        return encodeBase64(nonce) + ':' + encodeBase64(encrypted);
    } catch (error) {
        console.error("E2EE Encrypt Error", error);
        throw error;
    }
};

// Decrypt message from a sender
export const decryptMessage = async (encryptedMessage, senderPublicKeyBase64) => {
    try {
        // If not containing ':', assume plain text
        if (!encryptedMessage || typeof encryptedMessage !== 'string' || !encryptedMessage.includes(':')) {
            return encryptedMessage;
        }

        const [nonceBase64, cipherTextBase64] = encryptedMessage.split(':');
        if (!nonceBase64 || !cipherTextBase64) return encryptedMessage;

        const { secretKey } = await getKeys();
        if (!secretKey) throw new Error("No private key found");

        const nonce = decodeBase64(nonceBase64);
        const cipherText = decodeBase64(cipherTextBase64);
        const senderPublicKey = decodeBase64(senderPublicKeyBase64);
        const mySecretKey = decodeBase64(secretKey);

        const decrypted = nacl.box.open(
            cipherText,
            nonce,
            senderPublicKey,
            mySecretKey
        );

        if (!decrypted) {
            throw new Error("Decryption returned null (auth failed?)");
        }

        return Buffer.from(decrypted).toString('utf8');
    } catch (error) {
        console.error("E2EE Decrypt Error:", error);
        return "[Encrypted Message]"; // Better safe fallback
    }
};
