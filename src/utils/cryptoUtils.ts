
// زیرساخت رمزنگاری امن برای Payload اعلان‌ها
// استفاده از Web Crypto API با AES-GCM برای امنیت بالا

/**
 * تولید کلید رمزنگاری از روی رمز عبور
 */
const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new Uint8Array(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'] as KeyUsage[]
    );
};

/**
 * رمزنگاری امن داده‌ها با AES-GCM
 */
export const encryptPayload = async (data: string, password?: string): Promise<string> => {
    try {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        
        // تولید salt و IV تصادفی
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // استفاده از کلید پیش‌فرض یا کلید ارائه شده
        const defaultPassword = import.meta.env.VITE_API_SECRET || 'MORVARID_FALLBACK_2026';
        const key = await deriveKey(password || defaultPassword, salt);
        
        // رمزنگاری
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            dataBuffer
        );
        
        // ترکیب salt + iv + encrypted data
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);
        
        // تبدیل به Base64 امن
        return btoa(String.fromCharCode(...combined));
    } catch (e) {
        console.error('🔥 Encryption failed:', e);
        throw new Error('Failed to encrypt payload');
    }
};

/**
 * رمزگشایی امن داده‌ها
 */
export const decryptPayload = async (cipherText: string, password?: string): Promise<string> => {
    try {
        // تبدیل از Base64
        const combined = new Uint8Array(
            atob(cipherText).split('').map(char => char.charCodeAt(0))
        );
        
        // جداسازی اجزا
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);
        
        // تولید کلید
        const defaultPassword = import.meta.env.VITE_API_SECRET || 'MORVARID_FALLBACK_2026';
        const key = await deriveKey(password || defaultPassword, salt);
        
        // رمزگشایی
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (e) {
        console.error('🔥 Decryption failed:', e);
        throw new Error('Failed to decrypt payload');
    }
};

export const generateSecureId = (): string => {
    return crypto.randomUUID();
};
