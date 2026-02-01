import { Request, Response } from "express";
import { ProductsUnitService } from "../../services/pos/productsUnit.service";
import { getBranchId } from "../../middleware/branch.middleware";

export class ProductsUnitController {
    constructor(private productsUnitService: ProductsUnitService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const branchId = getBranchId(req as any);
            const productsUnits = await this.productsUnitService.findAll(branchId)
            res.status(200).json(productsUnits)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const branchId = getBranchId(req as any);
            const productsUnit = await this.productsUnitService.findOne(req.params.id, branchId)
            res.status(200).json(productsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOneByName = async (req: Request, res: Response) => {
        try {
            const branchId = getBranchId(req as any);
            const productsUnit = await this.productsUnitService.findOneByName(req.params.products_unit_name, branchId)
            res.status(200).json(productsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const branchId = getBranchId(req as any);
            if (branchId && !req.body.branch_id) {
                req.body.branch_id = branchId;
            }
            const productsUnit = await this.productsUnitService.create(req.body)
            res.status(201).json(productsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const productsUnit = await this.productsUnitService.update(req.params.id, req.body)
            res.status(200).json(productsUnit)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.productsUnitService.delete(req.params.id)
            res.status(200).json({ message: "หน่วยสินค้าลบสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}   
