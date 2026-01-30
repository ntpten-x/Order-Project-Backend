import { Request, Response } from "express";
import { DiscountsService } from "../../services/pos/discounts.service";

export class DiscountsController {
    constructor(private discountsService: DiscountsService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const q = (req.query.q as string | undefined) || undefined;
            const discounts = await this.discountsService.findAll(q)
            res.status(200).json(discounts)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const discount = await this.discountsService.findOne(req.params.id)
            res.status(200).json(discount)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findByName = async (req: Request, res: Response) => {
        try {
            const discount = await this.discountsService.findOneByName(req.params.name)
            res.status(200).json(discount)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const discount = await this.discountsService.create(req.body)
            res.status(201).json(discount)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const discount = await this.discountsService.update(req.params.id, req.body)
            res.status(200).json(discount)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.discountsService.delete(req.params.id)
            res.status(200).json({ message: "ลบข้อมูลส่วนลดสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
