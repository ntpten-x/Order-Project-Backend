
import { Router } from "express";
import { ShiftsController } from "../../controllers/pos/shifts.controller";
import { ShiftsService } from "../../services/pos/shifts.service";

const shiftsRouter = Router();
const shiftsService = new ShiftsService();
const shiftsController = new ShiftsController(shiftsService);

shiftsRouter.post("/open", shiftsController.openShift);
shiftsRouter.post("/close", shiftsController.closeShift);
shiftsRouter.get("/current", shiftsController.getCurrentShift);

export default shiftsRouter;
