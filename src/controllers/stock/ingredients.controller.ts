import { Request, Response } from "express";
import { IngredientsService } from "../../services/stock/ingredients.service";

export class IngredientsController {
    constructor(private ingredientsService: IngredientsService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
            const ingredients = await this.ingredientsService.findAll(active !== undefined ? { is_active: active } : undefined)
            res.status(200).json(ingredients)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const ingredients = await this.ingredientsService.findOne(req.params.id)
            res.status(200).json(ingredients)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOneByName = async (req: Request, res: Response) => {
        try {
            const ingredients = await this.ingredientsService.findOneByName(req.params.ingredient_name)
            res.status(200).json(ingredients)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const ingredients = await this.ingredientsService.create(req.body)
            res.status(201).json(ingredients)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const ingredients = await this.ingredientsService.update(req.params.id, req.body)
            res.status(200).json(ingredients)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.ingredientsService.delete(req.params.id)
            res.status(200).json({ message: "วัตถุดิบลบสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}
