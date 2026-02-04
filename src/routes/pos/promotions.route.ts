import { Router } from "express";
import { ApiResponses } from "../../utils/ApiResponse";

/**
 * Promotions feature has been removed in favor of Discounts.
 * This router remains as a stub to keep TypeScript builds stable.
 */
const router = Router();

router.all("*", (_req, res) => {
  return ApiResponses.badRequest(res, "Promotions feature has been removed. Please use discounts instead.");
});

export default router;
