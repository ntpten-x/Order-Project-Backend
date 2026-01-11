import { UsersService } from "../services/users.service";
import { Request, Response } from "express";

export class UsersController {
    constructor(private usersService: UsersService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const role = req.query.role as string;
            const users = await this.usersService.findAll(role ? { role } : undefined)
            res.status(200).json(users)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const users = await this.usersService.findOne(req.params.id)
            res.status(200).json(users)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const users = await this.usersService.create(req.body)
            res.status(201).json(users)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const users = await this.usersService.update(req.params.id, req.body)
            res.status(200).json(users)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.usersService.delete(req.params.id)
            res.status(204).json({ message: "User deleted successfully" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }


}