import { Request, Response, NextFunction } from "express";
import { BranchService } from "../services/branch.service";

export class BranchController {
    private branchService = new BranchService();

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const branches = await this.branchService.findAll();
            res.status(200).json(branches);
        } catch (error) {
            next(error);
        }
    };

    getOne = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const branch = await this.branchService.findOne(id);
            if (!branch) {
                res.status(404).json({ message: "Branch not found" });
                return;
            }
            res.status(200).json(branch);
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const branch = await this.branchService.create(req.body);
            res.status(201).json(branch);
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const branch = await this.branchService.update(id, req.body);
            res.status(200).json(branch);
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await this.branchService.delete(id);
            res.status(200).json({ message: "Branch deleted successfully" });
        } catch (error) {
            next(error);
        }
    };
}
