import { Request, Response } from "express";
import { SalesOrderItemService } from "../../services/pos/salesOrderItem.service";

export class SalesOrderItemController {
    constructor(private salesOrderItemService: SalesOrderItemService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const items = await this.salesOrderItemService.findAll()
            res.status(200).json(items)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const item = await this.salesOrderItemService.findOne(req.params.id)
            res.status(200).json(item)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const item = await this.salesOrderItemService.create(req.body)
            res.status(201).json(item)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const item = await this.salesOrderItemService.update(req.params.id, req.body)
            res.status(200).json(item)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.salesOrderItemService.delete(req.params.id)
            res.status(200).json({ message: "ลบรายการสินค้าในออเดอร์สำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
