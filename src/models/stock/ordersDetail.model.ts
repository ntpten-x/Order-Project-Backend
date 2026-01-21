import { AppDataSource } from "../../database/database";
import { StockOrdersDetail } from "../../entity/stock/OrdersDetail";
import { StockOrdersItem } from "../../entity/stock/OrdersItem";

export class StockOrdersDetailModel {
    private ordersDetailRepository = AppDataSource.getRepository(StockOrdersDetail);
    private ordersItemRepository = AppDataSource.getRepository(StockOrdersItem);

    async findByOrderItemId(ordersItemId: string): Promise<StockOrdersDetail | null> {
        return await this.ordersDetailRepository.findOneBy({ orders_item_id: ordersItemId });
    }

    async createOrUpdate(ordersItemId: string, data: { actual_quantity: number; purchased_by_id: string; is_purchased: boolean }): Promise<StockOrdersDetail> {
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

    async getOrderItemWithOrder(ordersItemId: string): Promise<StockOrdersItem | null> {
        return await this.ordersItemRepository.findOne({
            where: { id: ordersItemId },
            relations: { orders: true }
        });
    }
}
