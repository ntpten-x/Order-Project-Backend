import { Request, Response } from "express";
import { OrdersDetailService } from "../../services/pos/ordersDetail.service";

export class OrdersDetailController {
    constructor(private ordersDetailService: OrdersDetailService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const details = await this.ordersDetailService.findAll()
            res.status(200).json(details)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const detail = await this.ordersDetailService.findOne(req.params.id)
            res.status(200).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const detail = await this.ordersDetailService.create(req.body)
            res.status(201).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const detail = await this.ordersDetailService.update(req.params.id, req.body)
            res.status(200).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.ordersDetailService.delete(req.params.id)
            res.status(200).json({ message: "ลบรายละเอียดเพิ่มเติมสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
