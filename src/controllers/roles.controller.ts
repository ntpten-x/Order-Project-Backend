import { RolesService } from "../services/roles.service"
import { Request, Response } from "express"

export class RolesController {
    constructor(private rolesService: RolesService) { }
    findAll = async (req: Request, res: Response) => {
        try {
            const roles = await this.rolesService.findAll()
            res.status(200).json(roles)
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" })
        }
    }
    findOne = async (req: Request, res: Response) => {
        try {
            const roles = await this.rolesService.findOne(parseInt(req.params.id))
            res.status(200).json(roles)
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" })
        }
    }
    create = async (req: Request, res: Response) => {
        try {
            const roles = await this.rolesService.create(req.body)
            res.status(201).json(roles)
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" })
        }
    }
    update = async (req: Request, res: Response) => {
        try {
            const roles = await this.rolesService.update(parseInt(req.params.id), req.body)
            res.status(200).json(roles)
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" })
        }
    }
    delete = async (req: Request, res: Response) => {
        try {
            await this.rolesService.delete(parseInt(req.params.id))
            res.status(204).send()
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" })
        }
    }
}