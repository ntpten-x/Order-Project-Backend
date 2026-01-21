import { ViewEntity, ViewColumn, DataSource } from "typeorm";
import { SalesOrder } from "../SalesOrder";
import { Payments } from "../Payments";
import { PaymentMethod } from "../PaymentMethod";

@ViewEntity({
    expression: (dataSource: DataSource) =>
        dataSource
            .createQueryBuilder()
            .select("DATE(o.create_date)", "date")
            .addSelect("COUNT(DISTINCT o.id)", "total_orders")
            .addSelect("SUM(o.total_amount)", "total_sales")
            .addSelect("SUM(o.discount_amount)", "total_discount")
            .addSelect(`SUM(CASE 
                WHEN pm.payment_method_name ILIKE '%cash%' OR pm.display_name ILIKE '%สด%' THEN p.amount 
                ELSE 0 END)`, "cash_sales")
            .addSelect(`SUM(CASE 
                WHEN pm.payment_method_name ILIKE '%qr%' OR pm.payment_method_name ILIKE '%prompt%' THEN p.amount 
                ELSE 0 END)`, "qr_sales")
            .from(SalesOrder, "o")
            .leftJoin(Payments, "p", "p.order_id = o.id AND p.status = 'Success'")
            .leftJoin(PaymentMethod, "pm", "p.payment_method_id = pm.id")
            .where("o.status = 'Paid'")
            .groupBy("DATE(o.create_date)")
})
export class SalesSummaryView {
    @ViewColumn()
    date!: string;

    @ViewColumn()
    total_orders!: number;

    @ViewColumn()
    total_sales!: number;

    @ViewColumn()
    total_discount!: number;

    @ViewColumn()
    cash_sales!: number;

    @ViewColumn()
    qr_sales!: number;
}
