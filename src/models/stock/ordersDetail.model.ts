import { StockOrdersDetail } from "../../entity/stock/OrdersDetail";
import { StockOrdersItem } from "../../entity/stock/OrdersItem";
import { getRepository } from "../../database/dbContext";

export class StockOrdersDetailModel {
    async findByOrderItemId(ordersItemId: string): Promise<StockOrdersDetail | null> {
        return await getRepository(StockOrdersDetail).findOneBy({ orders_item_id: ordersItemId });
    }

    async createOrUpdate(ordersItemId: string, data: { actual_quantity: number; purchased_by_id: string; is_purchased: boolean }): Promise<StockOrdersDetail> {
        const ordersDetailRepository = getRepository(StockOrdersDetail);
        let detail = await ordersDetailRepository.findOneBy({ orders_item_id: ordersItemId });

        if (!detail) {
            detail = ordersDetailRepository.create({
                orders_item_id: ordersItemId,
                ...data
            });
        } else {
            detail.actual_quantity = data.actual_quantity;
            detail.purchased_by_id = data.purchased_by_id;
            detail.is_purchased = data.is_purchased;
        }

        return await ordersDetailRepository.save(detail);
    }

    async getOrderItemWithOrder(ordersItemId: string, branchId?: string): Promise<StockOrdersItem | null> {
        const ordersItemRepository = getRepository(StockOrdersItem);
        const query = ordersItemRepository
            .createQueryBuilder("item")
            .leftJoinAndSelect("item.orders", "orders")
            .where("item.id = :id", { id: ordersItemId });

        if (branchId) {
            query.andWhere("orders.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }
}
