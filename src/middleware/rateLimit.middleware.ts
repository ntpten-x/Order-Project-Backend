import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Enhanced Rate Limiting Middleware
 * Different limits for different endpoint types
 */

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many requests from this IP, please try again after 15 minutes"
            }
        });
    }
});

// Stricter limit for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // tighter limit for auth brute-force
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts, please try again shortly",
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many login attempts, please try again after 15 minutes"
            }
        });
    }
});

// Stricter limit for order creation (prevent spam)
export const orderCreateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 orders per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many order creation attempts, please slow down",
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many order creation attempts, please slow down"
            }
        });
    }
});

// Stricter limit for payment endpoints
export const paymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 payment attempts per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many payment attempts, please try again later",
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many payment attempts, please try again later"
            }
        });
    }
});

// Very strict limit for password reset
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many password reset attempts, please try again later",
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many password reset attempts, please try again later"
            }
        });
    }
});
