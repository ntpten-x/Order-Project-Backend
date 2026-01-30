import { Request, Response } from "express";
import { DeliveryService } from "../../services/pos/delivery.service";

export class DeliveryController {
    constructor(private deliveryService: DeliveryService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const rawLimit = parseInt(req.query.limit as string);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
            const q = (req.query.q as string | undefined) || undefined;

            const delivery = await this.deliveryService.findAll(page, limit, q)
            res.status(200).json(delivery)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const delivery = await this.deliveryService.findOne(req.params.id)
            res.status(200).json(delivery)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findByName = async (req: Request, res: Response) => {
        try {
            const delivery = await this.deliveryService.findOneByName(req.params.name)
            res.status(200).json(delivery)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const delivery = await this.deliveryService.create(req.body)
            res.status(201).json(delivery)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const delivery = await this.deliveryService.update(req.params.id, req.body)
            res.status(200).json(delivery)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.deliveryService.delete(req.params.id)
            res.status(200).json({ message: "ลบข้อมูลบริการส่งสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
