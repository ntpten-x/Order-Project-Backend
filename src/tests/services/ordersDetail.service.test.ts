import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersDetailService } from "../../services/stock/ordersDetail.service";
import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";

const emitToBranchMock = vi.fn();

vi.mock("../../services/socket.service", () => ({
    SocketService: {
        getInstance: () => ({
            emitToBranch: emitToBranchMock,
        }),
    },
}));

describe("OrdersDetailService", () => {
    const model = {
        getOrderItemWithOrder: vi.fn(),
        createOrUpdate: vi.fn(),
        findByOrderItemId: vi.fn(),
    };

    const service = new OrdersDetailService(model as any);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects purchase detail updates when the order is no longer pending", async () => {
        model.getOrderItemWithOrder.mockResolvedValue({
            id: "item-1",
            orders: {
                id: "order-1",
                branch_id: "branch-1",
                status: PurchaseOrderStatus.COMPLETED,
            },
        });

        await expect(
            service.updatePurchaseDetail(
                "item-1",
                { actual_quantity: 2, purchased_by_id: "user-1", is_purchased: true },
                "branch-1"
            )
        ).rejects.toMatchObject({
            statusCode: 409,
            message: "อัปเดตรายการตรวจรับได้เฉพาะใบซื้อที่ยังรอดำเนินการ",
        });

        expect(model.createOrUpdate).not.toHaveBeenCalled();
        expect(emitToBranchMock).not.toHaveBeenCalled();
    });

    it("updates purchase detail and emits realtime events for pending orders", async () => {
        model.getOrderItemWithOrder.mockResolvedValue({
            id: "item-1",
            orders: {
                id: "order-1",
                branch_id: "branch-1",
                status: PurchaseOrderStatus.PENDING,
            },
        });
        model.createOrUpdate.mockResolvedValue({
            id: "detail-1",
            orders_item_id: "item-1",
            actual_quantity: 2,
            is_purchased: true,
        });

        const result = await service.updatePurchaseDetail(
            "item-1",
            { actual_quantity: 2, purchased_by_id: "user-1", is_purchased: true },
            "branch-1"
        );

        expect(model.createOrUpdate).toHaveBeenCalledWith("item-1", {
            actual_quantity: 2,
            purchased_by_id: "user-1",
            is_purchased: true,
        });
        expect(result).toMatchObject({
            id: "detail-1",
            actual_quantity: 2,
        });
        expect(emitToBranchMock).toHaveBeenCalledTimes(3);
    });
});
