
import { Request, Response } from "express"
import { PaymentAccountService } from "../../services/pos/PaymentAccount.service"
import { PaymentAccountModel } from "../../models/pos/PaymentAccount.model"

export class PaymentAccountController {
    private service: PaymentAccountService

    constructor() {
        this.service = new PaymentAccountService(new PaymentAccountModel())
        console.log("PaymentAccountController initialized");
    }

    async getAccounts(req: Request, res: Response) {
        try {
            const shopId = (req as any).user?.shop_id || req.query.shopId as string || await this.service.getDeterministicShopId();
            if (!shopId) return res.status(404).json({ message: "Shop not found" });

            const accounts = await this.service.getAccounts(shopId);
            res.status(200).json(accounts);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async createAccount(req: Request, res: Response) {
        try {
            const shopId = (req as any).user?.shop_id || req.query.shopId as string || await this.service.getDeterministicShopId();
            if (!shopId) return res.status(404).json({ message: "Shop not found" });

            const account = await this.service.createAccount(shopId, req.body);
            res.status(201).json(account);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async updateAccount(req: Request, res: Response) {
        try {
            const shopId = (req as any).user?.shop_id || req.query.shopId as string || await this.service.getDeterministicShopId();
            if (!shopId) return res.status(404).json({ message: "Shop not found" });

            const { id } = req.params;
            const account = await this.service.updateAccount(shopId, id, req.body);
            res.status(200).json(account);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async activateAccount(req: Request, res: Response) {
        try {
            const shopId = (req as any).user?.shop_id || req.query.shopId as string || await this.service.getDeterministicShopId();
            if (!shopId) return res.status(404).json({ message: "Shop not found" });

            const { id } = req.params;
            const account = await this.service.activateAccount(shopId, id);
            res.status(200).json(account);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async deleteAccount(req: Request, res: Response) {
        try {
            const shopId = (req as any).user?.shop_id || req.query.shopId as string || await this.service.getDeterministicShopId();
            if (!shopId) return res.status(404).json({ message: "Shop not found" });

            const { id } = req.params;
            await this.service.deleteAccount(shopId, id);
            res.status(200).json({ message: "Account deleted successfully" });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}
