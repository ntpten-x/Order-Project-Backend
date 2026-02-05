import express from "express";
import cors from "cors";
import { connectDatabase } from "./src/database/database";
import usersRouter from "./src/routes/users.route";
import rolesRouter from "./src/routes/roles.route";
import authRouter from "./src/routes/auth.route";
import { createServer } from "http";
import { Server } from "socket.io";
import { SocketService } from "./src/services/socket.service";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import csurf from "csurf";
import compression from "compression";
import { randomBytes } from "crypto";
import { apiLimiter, authLimiter, orderCreateLimiter, paymentLimiter } from "./src/middleware/rateLimit.middleware";
import { sanitizeObject, sanitizeString } from "./src/utils/sanitize";
import ingredientsUnitStockRouter from "./src/routes/stock/ingredientsUnit.route";
import ingredientsStockRouter from "./src/routes/stock/ingredients.route";
import ordersStockRouter from "./src/routes/stock/orders.route";
import ordersDetailStockRouter from "./src/routes/stock/ordersDetail.route";
import categoryPosRouter from "./src/routes/pos/category.route";
import productsUnitPosRouter from "./src/routes/pos/productsUnit.route";
import productsPosRouter from "./src/routes/pos/products.route";
import tablesPosRouter from "./src/routes/pos/tables.route";
import deliveryPosRouter from "./src/routes/pos/delivery.route";
import discountsPosRouter from "./src/routes/pos/discounts.route";
import paymentMethodPosRouter from "./src/routes/pos/paymentMethod.route";
import paymentsPosRouter from "./src/routes/pos/payments.route";
import auditRouter from "./src/routes/audit.route";

import ordersPosRouter from "./src/routes/pos/orders.route";
import salesOrderItemPosRouter from "./src/routes/pos/salesOrderItem.route";
import salesOrderDetailPosRouter from "./src/routes/pos/salesOrderDetail.route";

import shiftsPosRouter from "./src/routes/pos/shifts.route";
import shopProfilePosRouter from "./src/routes/pos/shopProfile.route";
import paymentAccountPosRouter from "./src/routes/pos/paymentAccount.routes";
import dashboardRouter from "./src/routes/pos/dashboard.route";
import branchRouter from "./src/routes/branch.route";
import orderQueueRouter from "./src/routes/pos/orderQueue.route";
import { globalErrorHandler } from "./src/middleware/error.middleware";
import { AppError } from "./src/utils/AppError";
import { performanceMonitoring, errorTracking } from "./src/middleware/monitoring.middleware";
import { metrics } from "./src/utils/metrics";

const app = express();
const httpServer = createServer(app); // Wrap express with HTTP server
const port = process.env.PORT || 3000;
const bodyLimitMb = Number(process.env.REQUEST_BODY_LIMIT_MB || 5);
const enablePerfLogs = process.env.ENABLE_PERF_LOG === "true" || process.env.NODE_ENV !== "production";

// Trust proxy for secure cookies behind proxies (e.g., Render, Nginx)
app.set("trust proxy", 1);
// Reduce information leakage
app.disable("x-powered-by");

// Performance monitoring (always enabled)
app.use(performanceMonitoring);

// Basic performance logging (disabled in prod unless ENABLE_PERF_LOG=true)
if (enablePerfLogs) {
    app.use((req, res, next) => {
        const start = process.hrtime.bigint();
        res.on("finish", () => {
            const end = process.hrtime.bigint();
            const ms = Number(end - start) / 1_000_000;
            const status = res.statusCode;
            const method = req.method;
            const path = req.originalUrl;
            console.log(`[PERF] ${method} ${path} ${status} - ${ms.toFixed(1)}ms`);
        });
        next();
    });
}

// Ensure JWT secret exists (no insecure default)
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
        console.error("JWT_SECRET is required in production.");
        process.exit(1);
    } else {
        process.env.JWT_SECRET = randomBytes(32).toString("hex");
        console.warn("JWT_SECRET not set. Generated a temporary secret for this session.");
    }
}

// Security Middlewares
app.use(helmet());
app.use(cookieParser());
app.use(compression());

// Rate Limiting - Enhanced with specific limiters
app.use(apiLimiter);
app.use("/auth/login", authLimiter);
app.use("/pos/orders", orderCreateLimiter); // Stricter limit for order creation
app.use("/pos/payments", paymentLimiter); // Stricter limit for payments

// CORS
// Update origin to match your frontend URL.
// For dev, we might assume localhost:3000 or 3001.
// If frontend is on same port or served by back, internal usage is fine.
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://13.239.29.168:3001",
    process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json({ limit: `${bodyLimitMb}mb` }));
app.use(express.urlencoded({ limit: `${bodyLimitMb}mb`, extended: true }));

// Input Sanitization Middleware
app.use((req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    // Sanitize query parameters
    // NOTE: req.query is read-only, so we sanitize in-place
    if (req.query && typeof req.query === 'object') {
        const query = req.query as Record<string, any>;
        for (const key in query) {
            if (Object.prototype.hasOwnProperty.call(query, key)) {
                if (typeof query[key] === 'string') {
                    // Sanitize string values in query
                    (query as any)[key] = sanitizeString(query[key]);
                } else if (Array.isArray(query[key])) {
                    // Sanitize array values
                    (query as any)[key] = query[key].map((item: any) =>
                        typeof item === 'string' ? sanitizeString(item) : item
                    );
                }
            }
        }
    }
    next();
});

// Initialize Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Initialize Socket Service
SocketService.getInstance().init(io);

// Routes
// Note: CSRF protection is usually applied after bodyParser/cookieParser
// We might want to exempt login/logout from CSRF if token is not yet established, 
// or follow standard pattern where we get a token first.
// For simplicity in this step, I'll apply CSRF to all routes but need a route to get the token.
// Or we can exclude GET HEAD OPTIONS.

// Conditional CSRF for now to avoid breaking existing API instantly without frontend changes.
// Uncomment below to enable strict CSRF.
// Initialize CSRF protection
// Using cookie-based CSRF tokens (no session required)
const csrfProtection = csurf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        key: '_csrf', // Cookie name for CSRF secret
        path: '/' // Cookie path
    },
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] // Don't enforce for these methods
});

// Apply CSRF protection to cookie-authenticated requests except explicit public endpoints
const csrfExcludedPaths = new Set([
    "/auth/login",
    "/auth/logout",
    "/health",
    "/csrf-token",
    "/metrics"
]);

// CSRF token endpoint - must be defined before CSRF middleware
// This endpoint needs to initialize CSRF token generation
// IMPORTANT: This endpoint must always work to ensure security
// NOTE: This endpoint is excluded from global error handler to return custom format
app.get('/csrf-token', (req, res, next) => {
    // Wrap in try-catch to handle any unexpected errors
    try {
        // Use csrfProtection middleware to generate token
        // csurf uses cookie-based tokens, so it should work even without explicit session
        // The cookie will be set automatically by csurf
        csrfProtection(req, res, (err) => {
            if (err) {
                // If CSRF initialization fails, log and return error
                console.error('CSRF token generation error:', err);
                console.error('Error details:', {
                    code: (err as any).code,
                    message: err.message,
                    name: err.name
                });
                
                // Check if it's a missing secret error (first request)
                if ((err as any).code === 'EBADCSRFTOKEN' || err.message?.includes('secret')) {
                    // This might be the first request - try to generate token anyway
                    // csurf should create the secret cookie on first call
                    console.log('First CSRF request - attempting to generate secret...');
                }
                
                // Return error in consistent format (bypass global error handler)
                return res.status(500).json({ 
                    success: false,
                    error: {
                        code: 'CSRF_TOKEN_ERROR',
                        message: 'Failed to generate CSRF token. Please try again.'
                    }
                });
            }
            
            // Success - get the generated token
            try {
                const token = req.csrfToken ? req.csrfToken() : '';
                if (!token) {
                    console.warn('CSRF token is empty after generation');
                    return res.status(500).json({ 
                        success: false,
                        error: {
                            code: 'CSRF_TOKEN_EMPTY',
                            message: 'CSRF token not generated. Please try again.'
                        }
                    });
                }
                
                // Return token in expected format
                return res.json({ 
                    success: true,
                    csrfToken: token 
                });
            } catch (tokenError) {
                console.error('Error getting CSRF token:', tokenError);
                return res.status(500).json({ 
                    success: false,
                    error: {
                        code: 'CSRF_TOKEN_ERROR',
                        message: 'Failed to retrieve CSRF token. Please try again.'
                    }
                });
            }
        });
    } catch (error) {
        // Catch any unexpected errors
        console.error('Unexpected error in CSRF token endpoint:', error);
        return res.status(500).json({ 
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Something went wrong while generating CSRF token.'
            }
        });
    }
});

app.use((req, res, next) => {
    // Skip CSRF when using pure Bearer header (non-cookie flows) or explicitly excluded paths.
    const usesCookieAuth = Boolean(req.cookies?.token);
    const bearerOnly = req.headers.authorization && !usesCookieAuth;

    // Skip CSRF for excluded paths
    if (csrfExcludedPaths.has(req.path)) {
        return next();
    }

    // Skip CSRF for Bearer token only requests (no cookie)
    if (bearerOnly) {
        return next();
    }

    // For cookie-based authentication, enforce CSRF protection
    // This prevents CSRF attacks where malicious sites make requests with user's cookies
    if (usesCookieAuth) {
        // Only enforce for state-changing methods (POST, PUT, DELETE, PATCH)
        const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        if (stateChangingMethods.includes(req.method)) {
            // STRICT: Reject requests without CSRF token for state-changing methods
            return csrfProtection(req, res, (err) => {
                if (err) {
                    // CSRF token missing or invalid
                    console.warn(`[CSRF] Rejected ${req.method} ${req.path} - Missing or invalid CSRF token`);
                    return res.status(403).json({ 
                        error: 'CSRF token required',
                        message: 'Please refresh the page and try again'
                    });
                }
                return next();
            });
        }
        // For GET requests, still initialize CSRF but don't enforce
        // This allows CSRF token generation for subsequent requests
        return csrfProtection(req, res, (err) => {
            if (err && err.code !== 'EBADCSRFTOKEN') {
                return next(err);
            }
            // Allow GET requests even if CSRF token is missing
            return next();
        });
    }

    // No authentication - allow through
    return next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/metrics', async (req, res) => {
    if (!metrics.enabled) {
        return res.status(404).json({ message: "Metrics disabled" });
    }

    const apiKey = process.env.METRICS_API_KEY;
    if (apiKey && req.header("x-metrics-key") !== apiKey) {
        return res.status(403).json({ message: "Forbidden" });
    }

    res.setHeader("Content-Type", metrics.contentType);
    res.send(await metrics.getMetrics());
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/roles", rolesRouter);
app.use("/stock/ingredientsUnit", ingredientsUnitStockRouter);
app.use("/stock/ingredients", ingredientsStockRouter);
app.use("/stock/orders", ordersStockRouter);
app.use("/stock/ordersDetail", ordersDetailStockRouter);
app.use("/pos/category", categoryPosRouter);
app.use("/pos/productsUnit", productsUnitPosRouter);
app.use("/pos/products", productsPosRouter);
app.use("/pos/tables", tablesPosRouter);
app.use("/pos/delivery", deliveryPosRouter);
app.use("/pos/discounts", discountsPosRouter);
app.use("/pos/paymentMethod", paymentMethodPosRouter);
app.use("/pos/payments", paymentsPosRouter);
app.use("/audit", auditRouter);

app.use("/pos/orders", ordersPosRouter);
app.use("/pos/salesOrderItem", salesOrderItemPosRouter);
app.use("/pos/salesOrderDetail", salesOrderDetailPosRouter);

app.use("/pos/shifts", shiftsPosRouter);
app.use("/pos/shopProfile", shopProfilePosRouter);
app.use("/pos/payment-accounts", paymentAccountPosRouter);
app.use("/pos/dashboard", dashboardRouter);
app.use("/pos/queue", orderQueueRouter);
app.use("/branches", branchRouter);

// Handle Unhandled Routes
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error Tracking Middleware (before global error handler)
app.use(errorTracking);

// Global Error Handler
app.use(globalErrorHandler);

connectDatabase().then(() => {
    httpServer.listen(port, () => { // Listen on httpServer
        console.log(`Server is running on http://localhost:${port}`);
    });
});
