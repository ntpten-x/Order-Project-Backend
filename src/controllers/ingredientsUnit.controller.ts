import { Request, Response } from "express";
import { IngredientsUnitService } from "../services/ingredientsUnit.service";

export class IngredientsUnitController {
    constructor(private ingredientsUnitService: IngredientsUnitService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const ingredientsUnit = await this.ingredientsUnitService.findAll()
            res.status(200).json(ingredientsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const ingredientsUnit = await this.ingredientsUnitService.findOne(req.params.id)
            res.status(200).json(ingredientsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOneByUnitName = async (req: Request, res: Response) => {
        try {
            const ingredientsUnit = await this.ingredientsUnitService.findOneByUnitName(req.params.unit_name)
            res.status(200).json(ingredientsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const ingredientsUnit = await this.ingredientsUnitService.create(req.body)
            res.status(201).json(ingredientsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const ingredientsUnit = await this.ingredientsUnitService.update(req.params.id, req.body)
            res.status(200).json(ingredientsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.ingredientsUnitService.delete(req.params.id)
            res.status(200).json({ message: "IngredientsUnit deleted successfully" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}