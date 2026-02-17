/**
 * Input Sanitization Utilities
 * Prevents XSS and injection attacks
 */

import { looksLikeRawBase64Payload, normalizeImageSource } from "./imageSource";

const DEFAULT_STRING_LIMIT = 10000;
const IMAGE_STRING_LIMIT = Number(process.env.SANITIZE_IMAGE_MAX_LENGTH || 0);
const DATA_IMAGE_PREFIX = /^data:image\/[a-zA-Z0-9.+-]+/i;

function isLikelyImagePayload(value: string): boolean {
    return DATA_IMAGE_PREFIX.test(value) || looksLikeRawBase64Payload(value);
}

/**
 * Sanitize string input - removes potentially dangerous characters
 */
export function sanitizeString(input: string | undefined | null): string {
    if (!input || typeof input !== 'string') return '';

    const trimmed = input.replace(/^\uFEFF/, "").trim();
    if (!trimmed) return "";

    // Keep image payloads intact to avoid corrupting base64/data URLs.
    if (isLikelyImagePayload(trimmed)) {
        const normalizedImage = normalizeImageSource(trimmed);
        const value = normalizedImage || trimmed;
        if (IMAGE_STRING_LIMIT > 0 && value.length > IMAGE_STRING_LIMIT) {
            return "";
        }
        return value;
    }

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
        .substring(0, DEFAULT_STRING_LIMIT); // Limit length
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(input: unknown): number | null {
    if (typeof input === 'number') {
        return isNaN(input) || !isFinite(input) ? null : input;
    }
    if (typeof input === 'string') {
        const num = parseFloat(input);
        return isNaN(num) || !isFinite(num) ? null : num;
    }
    return null;
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(input: unknown): number | null {
    const num = sanitizeNumber(input);
    return num !== null ? Math.floor(num) : null;
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(input: string | undefined | null): string {
    if (!input || typeof input !== 'string') return '';
    
    const email = input.trim().toLowerCase();
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return '';
    
    return email.substring(0, 255);
}

/**
 * Sanitize URL input
 */
export function sanitizeUrl(input: string | undefined | null): string {
    if (!input || typeof input !== 'string') return '';
    
    try {
        const url = new URL(input);
        // Only allow http and https protocols
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return '';
        }
        return url.toString();
    } catch {
        return '';
    }
}

/**
 * Sanitize object - recursively sanitize all string properties
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = { ...obj } as any;
    
    for (const key in sanitized) {
        if (typeof sanitized[key] === 'string') {
            sanitized[key] = sanitizeString(sanitized[key]);
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            if (Array.isArray(sanitized[key])) {
                sanitized[key] = sanitized[key].map((item: any) =>
                    typeof item === 'string' ? sanitizeString(item) : sanitizeObject(item)
                );
            } else {
                sanitized[key] = sanitizeObject(sanitized[key]);
            }
        }
    }
    
    return sanitized as T;
}

/**
 * Sanitize SQL input - escape special characters
 * Note: TypeORM handles parameterized queries, but this is an extra layer
 */
export function sanitizeSql(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
        .replace(/'/g, "''") // Escape single quotes
        .replace(/;/g, '') // Remove semicolons
        .replace(/--/g, '') // Remove SQL comments
        .replace(/\/\*/g, '') // Remove block comments start
        .replace(/\*\//g, ''); // Remove block comments end
}
