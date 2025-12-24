import express from "express";
import cors from "cors";
import { connectDatabase } from "./src/database/database";
import usersRouter from "./src/routes/users.route";
import rolesRouter from "./src/routes/roles.route";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/users", usersRouter);
app.use("/roles", rolesRouter);
connectDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
});