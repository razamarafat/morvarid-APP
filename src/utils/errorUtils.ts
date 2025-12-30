
// Robust Error Extractor - Guaranteed to return a readable string
export const getErrorMessage = (e: any): string => {
    if (e === null || e === undefined) return 'خطای ناشناخته (Empty Error)';

    // 1. If it's already a string
    if (typeof e === 'string') return e;

    // 2. Standard JS Error
    if (e instanceof Error) return e.message;

    // 3. Supabase PostgrestError often has 'message'
    if (e?.message) {
        if (typeof e.message === 'string') return e.message;
        // If message itself is an object, try to stringify it safely
        try {
            return JSON.stringify(e.message);
        } catch {
            return 'خطای جزئیات پیام (Message Object)';
        }
    }

    // 4. OAuth / Auth errors
    if (e?.error_description) return e.error_description;

    // 5. PostgREST fields
    if (e?.details) return e.details;
    if (e?.hint) return e.hint;

    // 6. Fallback: JSON Stringify
    try {
        const json = JSON.stringify(e);
        // Avoid returning empty brackets
        if (json === '{}' || json === '[]') {
            const code = e?.code ? `Code: ${e.code}` : '';
            const status = e?.status ? `Status: ${e.status}` : '';
            if (code || status) return `خطای سرور (${code} ${status})`.trim();

            return 'خطای داخلی نامشخص (Unknown Object)';
        }
        return json;
    } catch {
        return 'خطای سیستمی (Circular Object)';
    }
};
