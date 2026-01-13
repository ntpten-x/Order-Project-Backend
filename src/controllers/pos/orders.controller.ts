import { Request, Response } from "express";
import { OrdersService } from "../../services/pos/orders.service";

export class OrdersController {
    constructor(private ordersService: OrdersService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;

            const result = await this.ordersService.findAll(page, limit)
            res.status(200).json(result)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const order = await this.ordersService.findOne(req.params.id)
            res.status(200).json(order)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            // Check if input has items, if so use createFullOrder
            if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
                const order = await this.ordersService.createFullOrder(req.body)
                res.status(201).json(order)
            } else {
                const order = await this.ordersService.create(req.body)
                res.status(201).json(order)
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const order = await this.ordersService.update(req.params.id, req.body)
            res.status(200).json(order)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.ordersService.delete(req.params.id)
            res.status(200).json({ message: "ลบข้อมูลออเดอร์สำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
