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
const ingredientsUnit_route_1 = __importDefault(require("./src/routes/ingredientsUnit.route"));
const ingredients_route_1 = __importDefault(require("./src/routes/ingredients.route"));
const orders_route_1 = __importDefault(require("./src/routes/orders.route"));
const ordersDetail_route_1 = __importDefault(require("./src/routes/ordersDetail.route"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app); // Wrap express with HTTP server
const port = process.env.PORT || 3000;
// Security Middlewares
app.use((0, helmet_1.default)());
app.use((0, cookie_parser_1.default)());
// Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use(limiter);
// CORS
// Update origin to match your frontend URL. 
// For dev, we might assume localhost:3000 or 3001. 
// If frontend is on same port or served by back, internal usage is fine.
app.use((0, cors_1.default)({
    origin: ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    credentials: true
}));
app.use(express_1.default.json());
// Initialize Socket.IO
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
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
// const csrfProtection = csurf({ cookie: true });
// app.use(csrfProtection);
// app.get('/csrf-token', (req, res) => {
//   res.json({ csrfToken: req.csrfToken() });
// });
app.use("/auth", auth_route_1.default);
app.use("/users", users_route_1.default);
app.use("/roles", roles_route_1.default);
app.use("/ingredientsUnit", ingredientsUnit_route_1.default);
app.use("/ingredients", ingredients_route_1.default);
app.use("/orders", orders_route_1.default);
app.use("/ordersDetail", ordersDetail_route_1.default);
(0, database_1.connectDatabase)().then(() => {
    httpServer.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
});
