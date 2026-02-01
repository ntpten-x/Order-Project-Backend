/**
 * Security Event Logger
 * Logs security-related events for monitoring and auditing
 */

interface SecurityEvent {
    type: 'AUTH_FAILURE' | 'AUTH_SUCCESS' | 'RATE_LIMIT' | 'SUSPICIOUS_ACTIVITY' | 'UNAUTHORIZED_ACCESS' | 'TOKEN_EXPIRED' | 'CSRF_FAILURE';
    userId?: string;
    ip: string;
    userAgent?: string;
    path: string;
    method: string;
    details?: Record<string, any>;
    timestamp: Date;
}

class SecurityLogger {
    private events: SecurityEvent[] = [];
    private readonly maxEvents = 1000; // Keep last 1000 events in memory

    /**
     * Log a security event
     */
    log(event: Omit<SecurityEvent, 'timestamp'>): void {
        const securityEvent: SecurityEvent = {
            ...event,
            timestamp: new Date()
        };

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
        } else if (logLevel === 'warn') {
            console.warn(`[SECURITY] ${logMessage}`);
        } else {
            console.log(`[SECURITY] ${logMessage}`);
        }

        // In production, you might want to send to external service
        // Example: sendToSentry(securityEvent), sendToDataDog(securityEvent)
    }

    /**
     * Get recent security events
     */
    getRecentEvents(limit: number = 100): SecurityEvent[] {
        return this.events.slice(-limit);
    }

    /**
     * Get events by type
     */
    getEventsByType(type: SecurityEvent['type'], limit: number = 100): SecurityEvent[] {
        return this.events
            .filter(e => e.type === type)
            .slice(-limit);
    }

    /**
     * Get events for a specific user
     */
    getEventsByUser(userId: string, limit: number = 100): SecurityEvent[] {
        return this.events
            .filter(e => e.userId === userId)
            .slice(-limit);
    }

    /**
     * Get log level based on event type
     */
    private getLogLevel(type: SecurityEvent['type']): 'error' | 'warn' | 'info' {
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
    private formatLogMessage(event: SecurityEvent): string {
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
    checkSuspiciousActivity(userId: string, ip: string): boolean {
        const recentFailures = this.events
            .filter(e => 
                e.type === 'AUTH_FAILURE' && 
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
export const securityLogger = new SecurityLogger();

/**
 * Helper function to extract IP from request
 */
export function getClientIp(req: any): string {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown'
    );
}
