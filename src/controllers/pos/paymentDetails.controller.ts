import { Request, Response } from "express";
import { PaymentDetailsService } from "../../services/pos/paymentDetails.service";

export class PaymentDetailsController {
    constructor(private paymentDetailsService: PaymentDetailsService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const details = await this.paymentDetailsService.findAll()
            res.status(200).json(details)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const detail = await this.paymentDetailsService.findOne(req.params.id)
            res.status(200).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const detail = await this.paymentDetailsService.create(req.body)
            res.status(201).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const detail = await this.paymentDetailsService.update(req.params.id, req.body)
            res.status(200).json(detail)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.paymentDetailsService.delete(req.params.id)
            res.status(200).json({ message: "ลบเรายละเอียดการชำระเงินสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
