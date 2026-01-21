import { Request, Response } from "express";
import { SalesOrderDetailService } from "../../services/pos/salesOrderDetail.service";

export class SalesOrderDetailController {
    constructor(private salesOrderDetailService: SalesOrderDetailService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const details = await this.salesOrderDetailService.findAll()
            res.status(200).json(details)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const detail = await this.salesOrderDetailService.findOne(req.params.id)
            res.status(200).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const detail = await this.salesOrderDetailService.create(req.body)
            res.status(201).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const detail = await this.salesOrderDetailService.update(req.params.id, req.body)
            res.status(200).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.salesOrderDetailService.delete(req.params.id)
            res.status(200).json({ message: "ลบรายละเอียดเพิ่มเติมสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
