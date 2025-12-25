import express from "express";
import cors from "cors";
import { connectDatabase } from "./src/database/database";
import usersRouter from "./src/routes/users.route";
import rolesRouter from "./src/routes/roles.route";
import { createServer } from "http";
import { Server } from "socket.io";
import { SocketService } from "./src/services/socket.service";

const app = express();
const httpServer = createServer(app); // Wrap express with HTTP server
const port = process.env.PORT || 3000;

// Initialize Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: "*",        // Allow all origins for now
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Initialize Socket Service
SocketService.getInstance().init(io);

app.use(cors());
app.use(express.json());
app.use("/users", usersRouter);
app.use("/roles", rolesRouter);

connectDatabase().then(() => {
    httpServer.listen(port, () => { // Listen on httpServer
        console.log(`Server is running on http://localhost:${port}`);
    });
});