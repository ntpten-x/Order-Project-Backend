import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SocketService } from "../socket.service";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { Topping } from "../../entity/pos/Topping";
import { OrderType } from "../../entity/pos/OrderEnums";
import { recalculateOrderTotal } from "./orderTotals.service";
import { getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { AppError } from "../../utils/AppError";
import { bumpOrderReadModelVersions, invalidateOrderReadCaches } from "./ordersReadCache.utils";
import { OrderSummarySnapshotService } from "./orderSummarySnapshot.service";

type AccessContext = {
    scope?: "none" | "own" | "branch" | "all";
    actorUserId?: string;
};

export class SalesOrderDetailService {
    private socketService = SocketService.getInstance();
    private orderSummarySnapshotService = new OrderSummarySnapshotService();

    constructor(private salesOrderDetailModel: SalesOrderDetailModels) { }

    private async invalidateOrderReadModels(branchId?: string): Promise<void> {
        await bumpOrderReadModelVersions(branchId);
        invalidateOrderReadCaches(branchId);
    }

    private async getOrderBranchId(orderId: string, fallbackBranchId?: string): Promise<string | undefined> {
        const order = await getRepository(SalesOrder).findOne({
            where: fallbackBranchId ? ({ id: orderId, branch_id: fallbackBranchId } as any) : { id: orderId },
            select: ["id", "branch_id"],
        });
        return order?.branch_id || fallbackBranchId;
    }

    private async emitOrderUpdate(orderId: string, branchId?: string): Promise<void> {
        if (!branchId) return;

        const summarySnapshot = await this.orderSummarySnapshotService.getPayload(orderId);
        this.socketService.emitToBranch(branchId, RealtimeEvents.orders.update, {
            id: orderId,
            status: summarySnapshot?.status ?? undefined,
            summary_snapshot: summarySnapshot,
        });
    }

    private async findAccessibleItem(
        ordersItemId: string,
        branchId?: string,
        access?: AccessContext,
    ): Promise<SalesOrderItem | null> {
        const itemRepo = getRepository(SalesOrderItem);
        const query = itemRepo
            .createQueryBuilder("item")
            .leftJoinAndSelect("item.product", "product")
            .leftJoinAndSelect("product.topping_groups", "topping_group")
            .innerJoinAndSelect("item.order", "order")
            .where("item.id = :id", { id: ordersItemId });

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        if (access?.scope === "none") {
            query.andWhere("1=0");
        }

        if (access?.scope === "own") {
            if (!access.actorUserId) {
                query.andWhere("1=0");
            } else {
                query.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
            }
        }

        return query.getOne();
    }

    private getToppingPrice(topping: Topping, orderType?: OrderType): number {
        if (orderType === OrderType.Delivery) {
            return Number(topping.price_delivery ?? topping.price ?? 0);
        }

        return Number(topping.price ?? 0);
    }

    private getProductToppingGroupIds(item: SalesOrderItem | null | undefined): string[] {
        return (item?.product?.topping_groups || [])
            .map((toppingGroup) => toppingGroup?.id)
            .filter((id): id is string => Boolean(id));
    }

    private async normalizeDetailPayload(
        salesOrderDetail: SalesOrderDetail,
        ordersItemId: string,
        branchId?: string,
        access?: AccessContext,
    ): Promise<SalesOrderDetail> {
        const item = await this.findAccessibleItem(ordersItemId, branchId, access);
        if (!item) {
            if (access?.scope === "own" || access?.scope === "none") {
                throw AppError.forbidden("Access denied");
            }
            throw AppError.notFound("Order item");
        }

        const toppingId = typeof salesOrderDetail.topping_id === "string" ? salesOrderDetail.topping_id.trim() : "";
        if (toppingId) {
            const toppingQuery = getRepository(Topping)
                .createQueryBuilder("topping")
                .leftJoinAndSelect("topping.categories", "category")
                .leftJoinAndSelect("topping.topping_groups", "topping_group")
                .where("topping.id = :id", { id: toppingId })
                .andWhere("topping.is_active = true");

            if (branchId) {
                toppingQuery.andWhere("topping.branch_id = :branchId", { branchId });
            }

            const topping = await toppingQuery.getOne();
            if (!topping) {
                throw AppError.badRequest("Selected topping is unavailable");
            }

            const toppingGroupIds = (topping.topping_groups || []).map((toppingGroup) => toppingGroup.id);
            const productToppingGroupIds = this.getProductToppingGroupIds(item);
            if (
                productToppingGroupIds.length === 0 ||
                toppingGroupIds.length === 0 ||
                !productToppingGroupIds.some((id) => toppingGroupIds.includes(id))
            ) {
                throw AppError.badRequest(`Topping "${topping.display_name}" is not available for this product`);
            }

            salesOrderDetail.topping_id = topping.id;
            salesOrderDetail.detail_name = topping.display_name;
            salesOrderDetail.extra_price = this.getToppingPrice(
                topping,
                item.order?.order_type as OrderType | undefined,
            );
            return salesOrderDetail;
        }

        const detailName = String(salesOrderDetail.detail_name || "").trim();
        const extraPrice = Number(salesOrderDetail.extra_price || 0);

        if (!detailName) {
            throw AppError.badRequest("Detail name is required");
        }

        if (!Number.isFinite(extraPrice) || extraPrice < 0) {
            throw AppError.badRequest("Invalid extra price");
        }

        salesOrderDetail.topping_id = null;
        salesOrderDetail.detail_name = detailName;
        salesOrderDetail.extra_price = extraPrice;
        return salesOrderDetail;
    }

    private async recalcByItemId(ordersItemId?: string | null): Promise<SalesOrderItem | null> {
        if (!ordersItemId) return null;
        const itemRepo = getRepository(SalesOrderItem);
        const item = await itemRepo.findOneBy({ id: ordersItemId });
        if (item) {
            await recalculateOrderTotal(item.order_id);
        }
        return item;
    }

    async findAll(branchId?: string, access?: AccessContext): Promise<SalesOrderDetail[]> {
        try {
            return this.salesOrderDetailModel.findAll(branchId, access);
        } catch (error) {
            throw error;
        }
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail | null> {
        try {
            return this.salesOrderDetailModel.findOne(id, branchId, access);
        } catch (error) {
            throw error;
        }
    }

    async create(salesOrderDetail: SalesOrderDetail, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail> {
        try {
            if (!salesOrderDetail.orders_item_id) {
                throw new Error("Order item id is required");
            }

            const normalizedDetail = await this.normalizeDetailPayload(salesOrderDetail, salesOrderDetail.orders_item_id, branchId, access);

            const createdDetail = await this.salesOrderDetailModel.create(normalizedDetail);
            const parentItem = await this.recalcByItemId(createdDetail.orders_item_id);
            const effectiveBranchId = parentItem?.order_id
                ? await this.getOrderBranchId(parentItem.order_id, branchId)
                : branchId;
            if (parentItem?.order_id) {
                await this.orderSummarySnapshotService.syncOrder(parentItem.order_id);
            }
            await this.invalidateOrderReadModels(effectiveBranchId);

            const completeDetail = await this.salesOrderDetailModel.findOne(createdDetail.id, branchId, access);
            if (completeDetail) {
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderDetail.create, completeDetail);
                    if (parentItem?.order_id) {
                        await this.emitOrderUpdate(parentItem.order_id, effectiveBranchId);
                    }
                }
                return completeDetail;
            }
            return createdDetail;
        } catch (error) {
            throw error;
        }
    }

    async update(id: string, salesOrderDetail: SalesOrderDetail, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail> {
        try {
            const detailToUpdate = await this.salesOrderDetailModel.findOne(id, branchId, access);
            if (!detailToUpdate) {
                throw new Error("Sales order detail not found");
            }

            const payload = await this.normalizeDetailPayload(
                {
                    id: detailToUpdate.id,
                    orders_item_id: detailToUpdate.orders_item_id,
                    topping_id: salesOrderDetail.topping_id ?? detailToUpdate.topping_id,
                    topping: null,
                    sales_order_item: detailToUpdate.sales_order_item,
                    detail_name: salesOrderDetail.detail_name ?? detailToUpdate.detail_name,
                    extra_price: salesOrderDetail.extra_price ?? detailToUpdate.extra_price,
                    create_date: detailToUpdate.create_date,
                },
                detailToUpdate.orders_item_id,
                branchId,
                access,
            );

            const updatedDetail = await this.salesOrderDetailModel.update(
                id,
                {
                    id: payload.id,
                    orders_item_id: payload.orders_item_id,
                    topping_id: payload.topping_id,
                    topping: null,
                    sales_order_item: payload.sales_order_item,
                    detail_name: payload.detail_name,
                    extra_price: payload.extra_price,
                    create_date: payload.create_date,
                },
                branchId,
                access,
            );
            const parentItem = await this.recalcByItemId(detailToUpdate.orders_item_id);
            const effectiveBranchId = parentItem?.order_id
                ? await this.getOrderBranchId(parentItem.order_id, branchId)
                : branchId;
            if (parentItem?.order_id) {
                await this.orderSummarySnapshotService.syncOrder(parentItem.order_id);
            }
            await this.invalidateOrderReadModels(effectiveBranchId);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderDetail.update, updatedDetail);
                if (parentItem?.order_id) {
                    await this.emitOrderUpdate(parentItem.order_id, effectiveBranchId);
                }
            }
            return updatedDetail;
        } catch (error) {
            throw error;
        }
    }

    async delete(id: string, branchId?: string, access?: AccessContext): Promise<void> {
        try {
            const detailToDelete = await this.salesOrderDetailModel.findOne(id, branchId, access);
            await this.salesOrderDetailModel.delete(id, branchId, access);
            const parentItem = await this.recalcByItemId(detailToDelete?.orders_item_id);
            const effectiveBranchId = parentItem?.order_id
                ? await this.getOrderBranchId(parentItem.order_id, branchId)
                : branchId;
            if (parentItem?.order_id) {
                await this.orderSummarySnapshotService.syncOrder(parentItem.order_id);
            }
            await this.invalidateOrderReadModels(effectiveBranchId);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderDetail.delete, { id });
                if (parentItem?.order_id) {
                    await this.emitOrderUpdate(parentItem.order_id, effectiveBranchId);
                }
            }
        } catch (error) {
            throw error;
        }
    }
}
