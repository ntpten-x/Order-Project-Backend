"use strict";
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
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const csurf_1 = __importDefault(require("csurf"));
const compression_1 = __importDefault(require("compression"));
const crypto_1 = require("crypto");
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
const orders_route_2 = __importDefault(require("./src/routes/pos/orders.route"));
const salesOrderItem_route_1 = __importDefault(require("./src/routes/pos/salesOrderItem.route"));
const salesOrderDetail_route_1 = __importDefault(require("./src/routes/pos/salesOrderDetail.route"));
const shifts_route_1 = __importDefault(require("./src/routes/pos/shifts.route"));
const shopProfile_route_1 = __importDefault(require("./src/routes/pos/shopProfile.route"));
const paymentAccount_routes_1 = __importDefault(require("./src/routes/pos/paymentAccount.routes"));
const dashboard_route_1 = __importDefault(require("./src/routes/pos/dashboard.route"));
const error_middleware_1 = require("./src/middleware/error.middleware");
const AppError_1 = require("./src/utils/AppError");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app); // Wrap express with HTTP server
const port = process.env.PORT || 3000;
const bodyLimitMb = Number(process.env.REQUEST_BODY_LIMIT_MB || 5);
const enablePerfLogs = process.env.ENABLE_PERF_LOG === "true" || process.env.NODE_ENV !== "production";
// Trust proxy for secure cookies behind proxies (e.g., Render, Nginx)
app.set("trust proxy", 1);
// Reduce information leakage
app.disable("x-powered-by");
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
// Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes"
});
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20, // tighter limit for auth brute-force
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts, please try again shortly"
});
app.use(limiter);
app.use("/auth/login", loginLimiter);
// CORS
// Update origin to match your frontend URL.
// For dev, we might assume localhost:3000 or 3001.
// If frontend is on same port or served by back, internal usage is fine.
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "https://order-project-frontend.onrender.com",
    process.env.FRONTEND_URL
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express_1.default.json({ limit: `${bodyLimitMb}mb` }));
app.use(express_1.default.urlencoded({ limit: `${bodyLimitMb}mb`, extended: true }));
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
const csrfProtection = (0, csurf_1.default)({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
});
// Apply CSRF protection to cookie-authenticated requests except explicit public endpoints
const csrfExcludedPaths = new Set([
    "/auth/login",
    "/auth/logout",
    "/health"
]);
app.use((req, res, next) => {
    var _a;
    // Skip CSRF when using pure Bearer header (non-cookie flows) or explicitly excluded paths.
    const usesCookieAuth = Boolean((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token);
    const bearerOnly = req.headers.authorization && !usesCookieAuth;
    if (req.path.startsWith("/pos/payment-accounts")) {
        console.log(`[DEBUG Backend] CSRF Check for ${req.method} ${req.path}`);
        console.log(`- Cookie: ${req.headers.cookie ? 'Present' : 'Missing'}`);
        console.log(`- Token: ${req.headers['x-csrf-token'] ? 'Present' : 'Missing'}`);
    }
    if (csrfExcludedPaths.has(req.path) || bearerOnly) {
        return next();
    }
    return csrfProtection(req, res, next);
});
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
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
app.use("/pos/orders", orders_route_2.default);
app.use("/pos/salesOrderItem", salesOrderItem_route_1.default);
app.use("/pos/salesOrderDetail", salesOrderDetail_route_1.default);
app.use("/pos/shifts", shifts_route_1.default);
app.use("/pos/shopProfile", shopProfile_route_1.default);
app.use("/pos/payment-accounts", paymentAccount_routes_1.default);
app.use("/pos/dashboard", dashboard_route_1.default);
// Handle Unhandled Routes
app.use((req, res, next) => {
    next(new AppError_1.AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
// Global Error Handler
app.use(error_middleware_1.globalErrorHandler);
(0, database_1.connectDatabase)().then(() => {
    httpServer.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
});
