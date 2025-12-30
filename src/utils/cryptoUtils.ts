
// زیرساخت رمزنگاری برای Payload اعلان‌ها
// در آینده برای Web Push (VAPID) استفاده خواهد شد.

export const encryptPayload = async (data: string): Promise<string> => {
    // شبیه‌سازی رمزنگاری (در نسخه واقعی از Web Crypto API استفاده می‌شود)
    // فعلاً برای کاهش سرباز از Base64 ساده استفاده می‌کنیم
    try {
        return btoa(unescape(encodeURIComponent(data)));
    } catch (e) {
        console.error('Encryption failed', e);
        return data;
    }
};

export const decryptPayload = async (cipherText: string): Promise<string> => {
    try {
        return decodeURIComponent(escape(atob(cipherText)));
    } catch (e) {
        console.error('Decryption failed', e);
        return cipherText;
    }
};

export const generateSecureId = (): string => {
    return crypto.randomUUID();
};
