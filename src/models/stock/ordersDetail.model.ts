import { AppDataSource } from "../../database/database";
import { OrdersDetail } from "../../entity/stock/OrdersDetail";
import { OrdersItem } from "../../entity/stock/OrdersItem";

export class OrdersDetailModel {
    private ordersDetailRepository = AppDataSource.getRepository(OrdersDetail);
    private ordersItemRepository = AppDataSource.getRepository(OrdersItem);

    async findByOrderItemId(ordersItemId: string): Promise<OrdersDetail | null> {
        return await this.ordersDetailRepository.findOneBy({ orders_item_id: ordersItemId });
    }

    async createOrUpdate(ordersItemId: string, data: { actual_quantity: number; purchased_by_id: string; is_purchased: boolean }): Promise<OrdersDetail> {
        let detail = await this.ordersDetailRepository.findOneBy({ orders_item_id: ordersItemId });

        if (!detail) {
            detail = this.ordersDetailRepository.create({
                orders_item_id: ordersItemId,
                ...data
            });
        } else {
            detail.actual_quantity = data.actual_quantity;
            detail.purchased_by_id = data.purchased_by_id;
            detail.is_purchased = data.is_purchased;
        }

        return await this.ordersDetailRepository.save(detail);
    }

    async getOrderItemWithOrder(ordersItemId: string): Promise<OrdersItem | null> {
        return await this.ordersItemRepository.findOne({
            where: { id: ordersItemId },
            relations: { orders: true }
        });
    }
}
