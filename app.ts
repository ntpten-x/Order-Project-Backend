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

import ordersPosRouter from "./src/routes/pos/orders.route";
import salesOrderItemPosRouter from "./src/routes/pos/salesOrderItem.route";
import salesOrderDetailPosRouter from "./src/routes/pos/salesOrderDetail.route";

import shiftsPosRouter from "./src/routes/pos/shifts.route";
import shopProfilePosRouter from "./src/routes/pos/shopProfile.route";
import dashboardRouter from "./src/routes/pos/dashboard.route";
import { globalErrorHandler } from "./src/middleware/error.middleware";
import { AppError } from "./src/utils/AppError";

const app = express();
const httpServer = createServer(app); // Wrap express with HTTP server
const port = process.env.PORT || 3000;
const bodyLimitMb = Number(process.env.REQUEST_BODY_LIMIT_MB || 5);

// Trust proxy for secure cookies behind proxies (e.g., Render, Nginx)
app.set("trust proxy", 1);
// Reduce information leakage
app.disable("x-powered-by");

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

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes"
});
const loginLimiter = rateLimit({
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
].filter(Boolean) as string[];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json({ limit: `${bodyLimitMb}mb` }));
app.use(express.urlencoded({ limit: `${bodyLimitMb}mb`, extended: true }));

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
const csrfProtection = csurf({
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
    // Skip CSRF when using pure Bearer header (non-cookie flows) or explicitly excluded paths.
    const usesCookieAuth = Boolean(req.cookies?.token);
    const bearerOnly = req.headers.authorization && !usesCookieAuth;

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

app.use("/pos/orders", ordersPosRouter);
app.use("/pos/salesOrderItem", salesOrderItemPosRouter);
app.use("/pos/salesOrderDetail", salesOrderDetailPosRouter);

app.use("/pos/shifts", shiftsPosRouter);
app.use("/pos/shopProfile", shopProfilePosRouter);
app.use("/pos/dashboard", dashboardRouter);

// Handle Unhandled Routes
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

connectDatabase().then(() => {
    httpServer.listen(port, () => { // Listen on httpServer
        console.log(`Server is running on http://localhost:${port}`);
    });
});
