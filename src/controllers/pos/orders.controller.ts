import { Request, Response } from "express";
import { OrdersService } from "../../services/pos/orders.service";

export class OrdersController {
    constructor(private ordersService: OrdersService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const orders = await this.ordersService.findAll()
            res.status(200).json(orders)
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
            const order = await this.ordersService.create(req.body)
            res.status(201).json(order)
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
