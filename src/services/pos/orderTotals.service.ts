import { EntityManager } from "typeorm";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { DiscountType, Discounts } from "../../entity/pos/Discounts";
import { getRepository } from "../../database/dbContext";

export const recalculateOrderTotal = async (orderId: string, manager?: EntityManager): Promise<void> => {
    const orderRepo = manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
    const itemRepo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);
    const discountRepo = manager ? manager.getRepository(Discounts) : getRepository(Discounts);

    const orderQuery = orderRepo
        .createQueryBuilder("order")
        .where("order.id = :orderId", { orderId });

    if (manager) {
        orderQuery.setLock("pessimistic_write");
    }

    const order = await orderQuery.getOne();

    if (!order) return;

    const discount = order.discount_id
        ? await discountRepo.findOneBy({ id: order.discount_id })
        : null;

    const aggregate = await itemRepo
        .createQueryBuilder("item")
        .select("COALESCE(SUM(item.total_price), 0)", "sub_total")
        .where("item.order_id = :orderId", { orderId })
        .andWhere("item.status::text NOT IN ('Cancelled', 'cancelled')")
        .getRawOne<{ sub_total: string | number | null }>();

    const subTotal = Number(aggregate?.sub_total || 0);
    let discountAmount = 0;

    if (discount?.is_active) {
        if (discount.discount_type === DiscountType.Percentage) {
            discountAmount = (subTotal * Number(discount.discount_amount)) / 100;
        } else {
            discountAmount = Number(discount.discount_amount);
        }
    }

    discountAmount = Math.min(discountAmount, subTotal);
    const vatAmount = 0;
    const totalAmount = subTotal - discountAmount + vatAmount;

    await orderRepo.update(orderId, {
        sub_total: Number(subTotal.toFixed(2)),
        discount_amount: Number(discountAmount.toFixed(2)),
        vat: Number(vatAmount.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2))
    } as SalesOrder);
};
