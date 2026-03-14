import { encrypt, decrypt } from './src/lib/encryption.js';

describe('Encryption Utility', () => {
    const text = 'Hello HikerNet!';

    test('should encrypt and decrypt correctly', () => {
        const encrypted = encrypt(text);
        expect(encrypted).toBeDefined();
        expect(encrypted).not.toBe(text);

        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(text);
    });

    test('should return different results for different inputs', () => {
        const encrypted1 = encrypt('text1');
        const encrypted2 = encrypt('text2');
        expect(encrypted1).not.toBe(encrypted2);
    });
});
