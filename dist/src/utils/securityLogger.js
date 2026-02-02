"use strict";
/**
 * Security Event Logger
 * Logs security-related events for monitoring and auditing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityLogger = void 0;
exports.getClientIp = getClientIp;
class SecurityLogger {
    constructor() {
        this.events = [];
        this.maxEvents = 1000; // Keep last 1000 events in memory
    }
    /**
     * Log a security event
     */
    log(event) {
        const securityEvent = Object.assign(Object.assign({}, event), { timestamp: new Date() });
        // Add to in-memory store
        this.events.push(securityEvent);
        if (this.events.length > this.maxEvents) {
            this.events.shift(); // Remove oldest
        }
        // Log to console (in production, send to external service)
        const logLevel = this.getLogLevel(event.type);
        const logMessage = this.formatLogMessage(securityEvent);
        if (logLevel === 'error') {
            console.error(`[SECURITY] ${logMessage}`);
        }
        else if (logLevel === 'warn') {
            console.warn(`[SECURITY] ${logMessage}`);
        }
        else {
            console.log(`[SECURITY] ${logMessage}`);
        }
        // In production, you might want to send to external service
        // Example: sendToSentry(securityEvent), sendToDataDog(securityEvent)
    }
    /**
     * Get recent security events
     */
    getRecentEvents(limit = 100) {
        return this.events.slice(-limit);
    }
    /**
     * Get events by type
     */
    getEventsByType(type, limit = 100) {
        return this.events
            .filter(e => e.type === type)
            .slice(-limit);
    }
    /**
     * Get events for a specific user
     */
    getEventsByUser(userId, limit = 100) {
        return this.events
            .filter(e => e.userId === userId)
            .slice(-limit);
    }
    /**
     * Get log level based on event type
     */
    getLogLevel(type) {
        switch (type) {
            case 'AUTH_FAILURE':
            case 'UNAUTHORIZED_ACCESS':
            case 'SUSPICIOUS_ACTIVITY':
                return 'warn';
            case 'RATE_LIMIT':
            case 'TOKEN_EXPIRED':
            case 'CSRF_FAILURE':
                return 'warn';
            case 'AUTH_SUCCESS':
                return 'info';
            default:
                return 'info';
        }
    }
    /**
     * Format log message
     */
    formatLogMessage(event) {
        const parts = [
            `[${event.type}]`,
            event.userId ? `User: ${event.userId}` : 'Anonymous',
            `IP: ${event.ip}`,
            `${event.method} ${event.path}`,
            event.details ? JSON.stringify(event.details) : ''
        ];
        return parts.filter(Boolean).join(' | ');
    }
    /**
     * Check for suspicious patterns
     */
    checkSuspiciousActivity(userId, ip) {
        const recentFailures = this.events
            .filter(e => e.type === 'AUTH_FAILURE' &&
            e.userId === userId &&
            e.timestamp > new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
        );
        if (recentFailures.length >= 5) {
            this.log({
                type: 'SUSPICIOUS_ACTIVITY',
                userId,
                ip,
                path: 'N/A',
                method: 'N/A',
                details: { reason: 'Multiple failed login attempts', count: recentFailures.length }
            });
            return true;
        }
        return false;
    }
}
// Singleton instance
exports.securityLogger = new SecurityLogger();
/**
 * Helper function to extract IP from request
 */
function getClientIp(req) {
    var _a, _b, _c, _d;
    return (((_b = (_a = req.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.split(',')[0]) === null || _b === void 0 ? void 0 : _b.trim()) ||
        req.headers['x-real-ip'] ||
        ((_c = req.connection) === null || _c === void 0 ? void 0 : _c.remoteAddress) ||
        ((_d = req.socket) === null || _d === void 0 ? void 0 : _d.remoteAddress) ||
        'unknown');
}
