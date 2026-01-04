export const signRequest = async (
    method: string,
    url: string,
    body: any = null,
    secret: string = import.meta.env.VITE_API_SECRET || (() => {
        console.error('🔥 CRITICAL: VITE_API_SECRET not found in environment variables!');
        throw new Error('API Secret not configured. Check your .env file.');
    })()
): Promise<{ signature: string; timestamp: string; nonce: string }> => {
    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const payload = body ? JSON.stringify(body) : '';

    // Create message canonical form
    const message = `${timestamp}${method.toUpperCase()}${url}${nonce}${payload}`;

    // Using Web Crypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageData
    );

    // Convert to Hex string
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return { signature: signatureHex, timestamp, nonce };
};
