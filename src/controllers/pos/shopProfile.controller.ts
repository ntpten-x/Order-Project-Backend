import { Request, Response } from "express";
import { ShopProfileService } from "../../services/pos/shopProfile.service";
import { ShopProfileModels } from "../../models/pos/shopProfile.model";

const service = new ShopProfileService(new ShopProfileModels());

export const getShopProfile = async (req: Request, res: Response) => {
    try {
        const profile = await service.getProfile();
        res.json(profile);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateShopProfile = async (req: Request, res: Response) => {
    try {
        const profile = await service.updateProfile(req.body);
        res.json(profile);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
