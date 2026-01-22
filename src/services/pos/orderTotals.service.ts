import { EntityManager } from "typeorm";
import { AppDataSource } from "../../database/database";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { PriceCalculatorService } from "./priceCalculator.service";

export const recalculateOrderTotal = async (orderId: string, manager?: EntityManager): Promise<void> => {
    const orderRepo = manager ? manager.getRepository(SalesOrder) : AppDataSource.getRepository(SalesOrder);
    const itemRepo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);

    const order = await orderRepo.findOne({
        where: { id: orderId },
        relations: ["discount"]
    });

    if (!order) return;

    const items = await itemRepo.find({ where: { order_id: orderId } });
    const validItems = items.filter(i => i.status !== OrderStatus.Cancelled);

    const result = PriceCalculatorService.calculateOrderTotal(validItems, order.discount);

    await orderRepo.update(orderId, {
        sub_total: result.subTotal,
        discount_amount: result.discountAmount,
        vat: result.vatAmount,
        total_amount: result.totalAmount
    } as SalesOrder);
};
