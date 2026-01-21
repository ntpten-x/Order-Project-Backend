import { Request, Response, NextFunction } from "express";
import { OrdersService } from "../../services/pos/orders.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";

export class OrdersController {
    constructor(private ordersService: OrdersService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const statuses = req.query.status ? (req.query.status as string).split(',') : undefined;

        const result = await this.ordersService.findAll(page, limit, statuses)
        res.status(200).json(result)
    })

    getStats = catchAsync(async (req: Request, res: Response) => {
        const stats = await this.ordersService.getStats();
        res.status(200).json(stats);
    })

    findAllItems = catchAsync(async (req: Request, res: Response) => {
        const status = req.query.status as string
        const result = await this.ordersService.findAllItems(status)
        res.status(200).json(result)
    })

    findOne = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.findOne(req.params.id)
        if (!order) {
            throw new AppError("ไม่พบข้อมูลออเดอร์", 404);
        }
        res.status(200).json(order)
    })

    create = catchAsync(async (req: Request, res: Response) => {
        // Check if input has items, if so use createFullOrder
        if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
            const order = await this.ordersService.createFullOrder(req.body)
            res.status(201).json(order)
        } else {
            const order = await this.ordersService.create(req.body)
            res.status(201).json(order)
        }
    })

    update = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.update(req.params.id, req.body)
        res.status(200).json(order)
    })

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.ordersService.delete(req.params.id)
        res.status(200).json({ message: "ลบข้อมูลออเดอร์สำเร็จ" })
    })

    updateItemStatus = catchAsync(async (req: Request, res: Response) => {
        const { status } = req.body
        if (!status) {
            throw new AppError("กรุณาระบุสถานะ", 400);
        }
        await this.ordersService.updateItemStatus(req.params.id, status)
        res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" })
    })

    addItem = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.addItem(req.params.id, req.body);
        res.status(201).json(order);
    })

    updateItem = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.updateItemDetails(req.params.itemId, req.body);
        res.status(200).json(order);
    })

    deleteItem = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.deleteItem(req.params.itemId);
        res.status(200).json(order);
    })
}
