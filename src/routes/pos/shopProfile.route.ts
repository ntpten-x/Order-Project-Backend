import express from "express";
import { getShopProfile, updateShopProfile } from "../../controllers/pos/shopProfile.controller";

const router = express.Router();

router.get("/", getShopProfile);
router.put("/", updateShopProfile);
router.post("/", updateShopProfile); // Allow POST as update too

export default router;
