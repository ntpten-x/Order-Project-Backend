import { Request, Response } from "express";
import { CategoryService } from "../../services/pos/category.service";

export class CategoryController {
    constructor(private categoryService: CategoryService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const categories = await this.categoryService.findAll()
            res.status(200).json(categories)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const category = await this.categoryService.findOne(req.params.id)
            res.status(200).json(category)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOneByName = async (req: Request, res: Response) => {
        try {
            const category = await this.categoryService.findOneByName(req.params.category_name)
            res.status(200).json(category)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const category = await this.categoryService.create(req.body)
            res.status(201).json(category)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const category = await this.categoryService.update(req.params.id, req.body)
            res.status(200).json(category)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.categoryService.delete(req.params.id)
            res.status(200).json({ message: "หมวดหมู่ลบสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}