"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./src/database/database");
const users_route_1 = __importDefault(require("./src/routes/users.route"));
const roles_route_1 = __importDefault(require("./src/routes/roles.route"));
const auth_route_1 = __importDefault(require("./src/routes/auth.route"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const socket_service_1 = require("./src/services/socket.service");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const csurf_1 = __importDefault(require("csurf"));
const compression_1 = __importDefault(require("compression"));
const crypto_1 = require("crypto");
const rateLimit_middleware_1 = require("./src/middleware/rateLimit.middleware");
const sanitize_1 = require("./src/utils/sanitize");
const ingredientsUnit_route_1 = __importDefault(require("./src/routes/stock/ingredientsUnit.route"));
const ingredients_route_1 = __importDefault(require("./src/routes/stock/ingredients.route"));
const orders_route_1 = __importDefault(require("./src/routes/stock/orders.route"));
const ordersDetail_route_1 = __importDefault(require("./src/routes/stock/ordersDetail.route"));
const category_route_1 = __importDefault(require("./src/routes/pos/category.route"));
const productsUnit_route_1 = __importDefault(require("./src/routes/pos/productsUnit.route"));
const products_route_1 = __importDefault(require("./src/routes/pos/products.route"));
const tables_route_1 = __importDefault(require("./src/routes/pos/tables.route"));
const delivery_route_1 = __importDefault(require("./src/routes/pos/delivery.route"));
const discounts_route_1 = __importDefault(require("./src/routes/pos/discounts.route"));
const paymentMethod_route_1 = __importDefault(require("./src/routes/pos/paymentMethod.route"));
const payments_route_1 = __importDefault(require("./src/routes/pos/payments.route"));
const audit_route_1 = __importDefault(require("./src/routes/audit.route"));
const orders_route_2 = __importDefault(require("./src/routes/pos/orders.route"));
const salesOrderItem_route_1 = __importDefault(require("./src/routes/pos/salesOrderItem.route"));
const salesOrderDetail_route_1 = __importDefault(require("./src/routes/pos/salesOrderDetail.route"));
const shifts_route_1 = __importDefault(require("./src/routes/pos/shifts.route"));
const shopProfile_route_1 = __importDefault(require("./src/routes/pos/shopProfile.route"));
const paymentAccount_routes_1 = __importDefault(require("./src/routes/pos/paymentAccount.routes"));
const dashboard_route_1 = __importDefault(require("./src/routes/pos/dashboard.route"));
const branch_route_1 = __importDefault(require("./src/routes/branch.route"));
const orderQueue_route_1 = __importDefault(require("./src/routes/pos/orderQueue.route"));
const error_middleware_1 = require("./src/middleware/error.middleware");
const AppError_1 = require("./src/utils/AppError");
const monitoring_middleware_1 = require("./src/middleware/monitoring.middleware");
const metrics_1 = require("./src/utils/metrics");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app); // Wrap express with HTTP server
const port = process.env.PORT || 4000;
const bodyLimitMb = Number(process.env.REQUEST_BODY_LIMIT_MB || 5);
const enablePerfLogs = process.env.ENABLE_PERF_LOG === "true" || process.env.NODE_ENV !== "production";
// Trust proxy for secure cookies behind proxies (e.g., Render, Nginx)
app.set("trust proxy", 1);
// Reduce information leakage
app.disable("x-powered-by");
// Performance monitoring (always enabled)
app.use(monitoring_middleware_1.performanceMonitoring);
// Basic performance logging (disabled in prod unless ENABLE_PERF_LOG=true)
if (enablePerfLogs) {
    app.use((req, res, next) => {
        const start = process.hrtime.bigint();
        res.on("finish", () => {
            const end = process.hrtime.bigint();
            const ms = Number(end - start) / 1000000;
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
    }
    else {
        process.env.JWT_SECRET = (0, crypto_1.randomBytes)(32).toString("hex");
        console.warn("JWT_SECRET not set. Generated a temporary secret for this session.");
    }
}
// Security Middlewares
app.use((0, helmet_1.default)());
app.use((0, cookie_parser_1.default)());
app.use((0, compression_1.default)());
// Rate Limiting - Enhanced with specific limiters
app.use(rateLimit_middleware_1.apiLimiter);
app.use("/auth/login", rateLimit_middleware_1.authLimiter);
app.use("/pos/orders", rateLimit_middleware_1.orderCreateLimiter); // Stricter limit for order creation
app.use("/pos/payments", rateLimit_middleware_1.paymentLimiter); // Stricter limit for payments
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
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express_1.default.json({ limit: `${bodyLimitMb}mb` }));
app.use(express_1.default.urlencoded({ limit: `${bodyLimitMb}mb`, extended: true }));
// Input Sanitization Middleware
app.use((req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        req.body = (0, sanitize_1.sanitizeObject)(req.body);
    }
    // Sanitize query parameters
    // NOTE: req.query is read-only, so we sanitize in-place
    if (req.query && typeof req.query === 'object') {
        const query = req.query;
        for (const key in query) {
            if (Object.prototype.hasOwnProperty.call(query, key)) {
                if (typeof query[key] === 'string') {
                    // Sanitize string values in query
                    query[key] = (0, sanitize_1.sanitizeString)(query[key]);
                }
                else if (Array.isArray(query[key])) {
                    // Sanitize array values
                    query[key] = query[key].map((item) => typeof item === 'string' ? (0, sanitize_1.sanitizeString)(item) : item);
                }
            }
        }
    }
    next();
});
// Initialize Socket.IO
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});
// Initialize Socket Service
socket_service_1.SocketService.getInstance().init(io);
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
const csrfProtection = (0, csurf_1.default)({
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
            var _a;
            if (err) {
                // If CSRF initialization fails, log and return error
                console.error('CSRF token generation error:', err);
                console.error('Error details:', {
                    code: err.code,
                    message: err.message,
                    name: err.name
                });
                // Check if it's a missing secret error (first request)
                if (err.code === 'EBADCSRFTOKEN' || ((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('secret'))) {
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
            }
            catch (tokenError) {
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
    }
    catch (error) {
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
    var _a;
    // Skip CSRF when using pure Bearer header (non-cookie flows) or explicitly excluded paths.
    const usesCookieAuth = Boolean((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token);
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
app.get('/metrics', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!metrics_1.metrics.enabled) {
        return res.status(404).json({ message: "Metrics disabled" });
    }
    const apiKey = process.env.METRICS_API_KEY;
    if (apiKey && req.header("x-metrics-key") !== apiKey) {
        return res.status(403).json({ message: "Forbidden" });
    }
    res.setHeader("Content-Type", metrics_1.metrics.contentType);
    res.send(yield metrics_1.metrics.getMetrics());
}));
app.use("/auth", auth_route_1.default);
app.use("/users", users_route_1.default);
app.use("/roles", roles_route_1.default);
app.use("/stock/ingredientsUnit", ingredientsUnit_route_1.default);
app.use("/stock/ingredients", ingredients_route_1.default);
app.use("/stock/orders", orders_route_1.default);
app.use("/stock/ordersDetail", ordersDetail_route_1.default);
app.use("/pos/category", category_route_1.default);
app.use("/pos/productsUnit", productsUnit_route_1.default);
app.use("/pos/products", products_route_1.default);
app.use("/pos/tables", tables_route_1.default);
app.use("/pos/delivery", delivery_route_1.default);
app.use("/pos/discounts", discounts_route_1.default);
app.use("/pos/paymentMethod", paymentMethod_route_1.default);
app.use("/pos/payments", payments_route_1.default);
app.use("/audit", audit_route_1.default);
app.use("/pos/orders", orders_route_2.default);
app.use("/pos/salesOrderItem", salesOrderItem_route_1.default);
app.use("/pos/salesOrderDetail", salesOrderDetail_route_1.default);
app.use("/pos/shifts", shifts_route_1.default);
app.use("/pos/shopProfile", shopProfile_route_1.default);
app.use("/pos/payment-accounts", paymentAccount_routes_1.default);
app.use("/pos/dashboard", dashboard_route_1.default);
app.use("/pos/queue", orderQueue_route_1.default);
app.use("/branches", branch_route_1.default);
// Handle Unhandled Routes
app.use((req, res, next) => {
    next(new AppError_1.AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
// Error Tracking Middleware (before global error handler)
app.use(monitoring_middleware_1.errorTracking);
// Global Error Handler
app.use(error_middleware_1.globalErrorHandler);
(0, database_1.connectDatabase)().then(() => {
    httpServer.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
});
