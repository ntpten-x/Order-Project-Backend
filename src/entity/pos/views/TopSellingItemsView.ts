import { ViewEntity, ViewColumn, DataSource } from "typeorm";
import { SalesOrderItem } from "../SalesOrderItem";
import { SalesOrder } from "../SalesOrder";
import { Products } from "../Products";

@ViewEntity({
    expression: (dataSource: DataSource) =>
        dataSource
            .createQueryBuilder()
            .select("oi.product_id", "product_id")
            .addSelect("p.display_name", "product_name")
            .addSelect("p.img_url", "img_url")
            .addSelect("p.category_id", "category_id")
            .addSelect("SUM(oi.quantity)", "total_quantity")
            .addSelect("SUM(oi.total_price)", "total_revenue")
            .from(SalesOrderItem, "oi")
            .innerJoin(SalesOrder, "o", "oi.order_id = o.id")
            .leftJoin(Products, "p", "oi.product_id = p.id")
            .where("o.status = 'Paid'")
            .groupBy("oi.product_id")
            .addGroupBy("p.display_name")
            .addGroupBy("p.img_url")
            .addGroupBy("p.category_id")
})
export class TopSellingItemsView {
    @ViewColumn()
    product_id!: string;

    @ViewColumn()
    product_name!: string;

    @ViewColumn()
    img_url!: string;

    @ViewColumn()
    category_id!: string;

    @ViewColumn()
    total_quantity!: number;

    @ViewColumn()
    total_revenue!: number;
}
