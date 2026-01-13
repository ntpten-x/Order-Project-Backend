import { Request, Response } from "express";
import { OrdersItemService } from "../../services/pos/ordersItem.service";

export class OrdersItemController {
    constructor(private ordersItemService: OrdersItemService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const items = await this.ordersItemService.findAll()
            res.status(200).json(items)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const item = await this.ordersItemService.findOne(req.params.id)
            res.status(200).json(item)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const item = await this.ordersItemService.create(req.body)
            res.status(201).json(item)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const item = await this.ordersItemService.update(req.params.id, req.body)
            res.status(200).json(item)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.ordersItemService.delete(req.params.id)
            res.status(200).json({ message: "ลบรายการสินค้าในออเดอร์สำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
