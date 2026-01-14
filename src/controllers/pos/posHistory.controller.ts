import { Request, Response } from "express";
import { PosHistoryService } from "../../services/pos/posHistory.service";

export class PosHistoryController {
    constructor(private posHistoryService: PosHistoryService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;

            const result = await this.posHistoryService.findAll(page, limit);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const result = await this.posHistoryService.findOne(req.params.id);
            if (!result) {
                res.status(404).json({ message: "ไม่พบข้อมูลประวัติ" });
                return;
            }
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const result = await this.posHistoryService.create(req.body);
            res.status(201).json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const result = await this.posHistoryService.update(req.params.id, req.body);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.posHistoryService.delete(req.params.id);
            res.status(200).json({ message: "ลบข้อมูลประวัติสำเร็จ" });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
