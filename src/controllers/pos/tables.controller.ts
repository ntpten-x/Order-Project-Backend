import { Request, Response } from "express";
import { TablesService } from "../../services/pos/tables.service";

export class TablesController {
    constructor(private tablesService: TablesService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const tables = await this.tablesService.findAll()
            res.status(200).json(tables)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const table = await this.tablesService.findOne(req.params.id)
            res.status(200).json(table)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const table = await this.tablesService.create(req.body)
            res.status(201).json(table)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const table = await this.tablesService.update(req.params.id, req.body)
            res.status(200).json(table)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.tablesService.delete(req.params.id)
            res.status(200).json({ message: "ลบข้อมูลโต๊ะสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
