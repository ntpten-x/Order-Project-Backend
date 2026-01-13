import { Request, Response } from "express";
import { PaymentsService } from "../../services/pos/payments.service";

export class PaymentsController {
    constructor(private paymentsService: PaymentsService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const payments = await this.paymentsService.findAll()
            res.status(200).json(payments)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const payment = await this.paymentsService.findOne(req.params.id)
            res.status(200).json(payment)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const payment = await this.paymentsService.create(req.body)
            res.status(201).json(payment)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const payment = await this.paymentsService.update(req.params.id, req.body)
            res.status(200).json(payment)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.paymentsService.delete(req.params.id)
            res.status(200).json({ message: "ลบข้อมูลการชำระเงินสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
