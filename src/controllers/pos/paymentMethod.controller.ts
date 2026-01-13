import { Request, Response } from "express";
import { PaymentMethodService } from "../../services/pos/paymentMethod.service";

export class PaymentMethodController {
    constructor(private paymentMethodService: PaymentMethodService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const paymentMethods = await this.paymentMethodService.findAll()
            res.status(200).json(paymentMethods)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const paymentMethod = await this.paymentMethodService.findOne(req.params.id)
            res.status(200).json(paymentMethod)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const paymentMethod = await this.paymentMethodService.create(req.body)
            res.status(201).json(paymentMethod)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const paymentMethod = await this.paymentMethodService.update(req.params.id, req.body)
            res.status(200).json(paymentMethod)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.paymentMethodService.delete(req.params.id)
            res.status(200).json({ message: "ลบข้อมูลวิธีการชำระเงินสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
