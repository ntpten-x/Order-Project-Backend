import { describe, expect, it } from "vitest";
import { OrderType, ServingStatus } from "../../entity/pos/OrderEnums";
import { getServingBoardSource, groupServingBoardRows } from "../../utils/servingBoard";

describe("servingBoard utils", () => {
    it("builds source labels for dine in and take away", () => {
        expect(
            getServingBoardSource({
                order_type: OrderType.DineIn,
                table_name: "12",
                delivery_name: null,
                delivery_code: null,
                order_no: "ORD-001",
            })
        ).toEqual({
            title: "Dine in โต๊ะ 12",
            subtitle: "ORD-001",
        });

        expect(
            getServingBoardSource({
                order_type: OrderType.TakeAway,
                table_name: null,
                delivery_name: null,
                delivery_code: "order#a123",
                order_no: "ORD-002",
            })
        ).toEqual({
            title: "Take away order#a123",
            subtitle: "ORD-002",
        });
    });

    it("groups rows by serving batch and counts pending/served items", () => {
        const groups = groupServingBoardRows([
            {
                item_id: "i-1",
                order_id: "o-1",
                order_no: "ORD-001",
                order_type: OrderType.DineIn,
                order_status: "Pending",
                delivery_code: null,
                table_name: "1",
                delivery_name: null,
                product_id: "p-1",
                product_name: "ไก่ทอด",
                product_image_url: null,
                quantity: 1,
                notes: null,
                serving_status: ServingStatus.PendingServe,
                serving_group_id: "g-1",
                serving_group_created_at: "2026-03-04T10:00:00.000Z",
            },
            {
                item_id: "i-2",
                order_id: "o-1",
                order_no: "ORD-001",
                order_type: OrderType.DineIn,
                order_status: "Pending",
                delivery_code: null,
                table_name: "1",
                delivery_name: null,
                product_id: "p-2",
                product_name: "โค้ก",
                product_image_url: null,
                quantity: 2,
                notes: "ไม่ใส่น้ำแข็ง",
                serving_status: ServingStatus.Served,
                serving_group_id: "g-1",
                serving_group_created_at: "2026-03-04T10:00:00.000Z",
            },
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            id: "g-1",
            pending_count: 1,
            served_count: 1,
            total_items: 2,
            source_title: "Dine in โต๊ะ 1",
        });
        expect(groups[0].items).toHaveLength(2);
    });
});
