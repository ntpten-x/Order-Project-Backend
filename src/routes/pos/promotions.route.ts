import { Router } from "express";
import { PromotionsController } from "../../controllers/pos/promotions.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";

const router = Router();
const promotionsController = new PromotionsController();

// Protect all routes
router.use(authenticateToken);
router.use(requireBranch);

// Public routes (for validation and viewing)
router.post("/validate", promotionsController.validatePromotion);
router.get("/active", promotionsController.getActivePromotions);
router.get("/", promotionsController.getAll);
router.get("/getById/:id", promotionsController.getById);

// Protected routes (for applying promotions)
router.use(authorizeRole(["Admin", "Manager", "Employee"]));
router.post("/apply", promotionsController.applyPromotion);

// Admin only routes (for CRUD operations)
router.use(authorizeRole(["Admin"]));
router.post("/create", promotionsController.create);
router.put("/update/:id", promotionsController.update);
router.delete("/delete/:id", promotionsController.delete);

export default router;
