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
import ingredientsUnitRouter from "./src/routes/ingredientsUnit.route";
import ingredientsRouter from "./src/routes/ingredients.route";
import ordersRouter from "./src/routes/orders.route";
import ordersDetailRouter from "./src/routes/ordersDetail.route";

const app = express();
const httpServer = createServer(app); // Wrap express with HTTP server
const port = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet());
app.use(cookieParser());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use(limiter);

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

app.use(express.json());

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
// const csrfProtection = csurf({ cookie: true });
// app.use(csrfProtection);

// app.get('/csrf-token', (req, res) => {
//   res.json({ csrfToken: req.csrfToken() });
// });

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/roles", rolesRouter);
app.use("/ingredientsUnit", ingredientsUnitRouter);
app.use("/ingredients", ingredientsRouter);
app.use("/orders", ordersRouter);
app.use("/ordersDetail", ordersDetailRouter);

connectDatabase().then(() => {
    httpServer.listen(port, () => { // Listen on httpServer
        console.log(`Server is running on http://localhost:${port}`);
    });
});