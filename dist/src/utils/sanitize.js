"use strict";
/**
 * Input Sanitization Utilities
 * Prevents XSS and injection attacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeString = sanitizeString;
exports.sanitizeNumber = sanitizeNumber;
exports.sanitizeInteger = sanitizeInteger;
exports.sanitizeEmail = sanitizeEmail;
exports.sanitizeUrl = sanitizeUrl;
exports.sanitizeObject = sanitizeObject;
exports.sanitizeSql = sanitizeSql;
/**
 * Sanitize string input - removes potentially dangerous characters
 */
function sanitizeString(input) {
    if (!input || typeof input !== 'string')
        return '';
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
        .substring(0, 10000); // Limit length
}
/**
 * Sanitize number input
 */
function sanitizeNumber(input) {
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
function sanitizeInteger(input) {
    const num = sanitizeNumber(input);
    return num !== null ? Math.floor(num) : null;
}
/**
 * Sanitize email input
 */
function sanitizeEmail(input) {
    if (!input || typeof input !== 'string')
        return '';
    const email = input.trim().toLowerCase();
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
        return '';
    return email.substring(0, 255);
}
/**
 * Sanitize URL input
 */
function sanitizeUrl(input) {
    if (!input || typeof input !== 'string')
        return '';
    try {
        const url = new URL(input);
        // Only allow http and https protocols
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return '';
        }
        return url.toString();
    }
    catch (_a) {
        return '';
    }
}
/**
 * Sanitize object - recursively sanitize all string properties
 */
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object')
        return obj;
    const sanitized = Object.assign({}, obj);
    for (const key in sanitized) {
        if (typeof sanitized[key] === 'string') {
            sanitized[key] = sanitizeString(sanitized[key]);
        }
        else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            if (Array.isArray(sanitized[key])) {
                sanitized[key] = sanitized[key].map((item) => typeof item === 'string' ? sanitizeString(item) : sanitizeObject(item));
            }
            else {
                sanitized[key] = sanitizeObject(sanitized[key]);
            }
        }
    }
    return sanitized;
}
/**
 * Sanitize SQL input - escape special characters
 * Note: TypeORM handles parameterized queries, but this is an extra layer
 */
function sanitizeSql(input) {
    if (!input || typeof input !== 'string')
        return '';
    return input
        .replace(/'/g, "''") // Escape single quotes
        .replace(/;/g, '') // Remove semicolons
        .replace(/--/g, '') // Remove SQL comments
        .replace(/\/\*/g, '') // Remove block comments start
        .replace(/\*\//g, ''); // Remove block comments end
}
