
import { Request, Response } from "express";
import { ProductsService } from "../../services/pos/products.service";

export class ProductsController {
    constructor(private productsService: ProductsService) { }

    findAll = async (req: Request, res: Response) => {
        try {
            const products = await this.productsService.findAll()
            res.status(200).json(products)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOne = async (req: Request, res: Response) => {
        try {
            const product = await this.productsService.findOne(req.params.id)
            res.status(200).json(product)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    findOneByName = async (req: Request, res: Response) => {
        try {
            const product = await this.productsService.findOneByName(req.params.product_name)
            res.status(200).json(product)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    create = async (req: Request, res: Response) => {
        try {
            const product = await this.productsService.create(req.body)
            res.status(201).json(product)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const product = await this.productsService.update(req.params.id, req.body)
            res.status(200).json(product)
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            await this.productsService.delete(req.params.id)
            res.status(200).json({ message: "สินค้าลบสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        }
    }
}   